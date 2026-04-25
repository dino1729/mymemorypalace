const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const { buildDiscoveryGraph, DEFAULT_CLUSTER_TITLES } = require("./vaultDiscovery");
const { createChatCompletion, createEmbedding, getLiteLLMConfig } = require("./litellm");

const CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 6;
const CACHE_FILE = path.join(process.cwd(), ".runtime", "discovery-cache.json");
const MASTER_CLUSTER_ID = "master-neural-network";

const cosineSimilarity = (left, right) => {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }

  if (!leftNorm || !rightNorm) {
    return 0;
  }

  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
};

const readJsonIfPresent = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    console.error(`Failed to read JSON from ${filePath}:`, error);
    return null;
  }
};

const writeJson = (filePath, value) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
};

const hashGraph = (graph) =>
  crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        clusters: graph.clusters,
        nodes: graph.nodes.map((node) => ({
          id: node.id,
          label: node.label,
          summary: node.summary,
          relatedNodeIds: node.relatedNodeIds,
        })),
        edges: graph.edges,
      }),
    )
    .digest("hex");

const buildDeterministicPrompts = (cluster, nodes) =>
  nodes.slice(0, 4).map((node, index) => {
    const templates = [
      `How does ${node.label} connect to the rest of my ${cluster.title.replace(/ Cluster$/, "")} ideas?`,
      `What are the most useful takeaways from ${node.label} in my memory palace?`,
      `Show me a practical way to apply ${node.label} this week.`,
      `Which ideas in my memory palace reinforce or challenge ${node.label}?`,
    ];
    return templates[index] || `Help me explore ${node.label} through related ideas in my memory palace.`;
  });

const buildMasterCluster = (clusters) => ({
  id: MASTER_CLUSTER_ID,
  title: "Master Neural Network",
  nodes: [...new Set(clusters.flatMap((cluster) => cluster.nodes))],
});

const buildMasterPromptSet = (promptSets) => ({
  clusterId: MASTER_CLUSTER_ID,
  highlightedNodeIds: [...new Set(promptSets.flatMap((promptSet) => promptSet.highlightedNodeIds))].slice(0, 8),
  prompts: [...new Set(promptSets.flatMap((promptSet) => promptSet.prompts))].slice(0, 8),
  source: promptSets.some((promptSet) => promptSet.source === "litellm")
    ? "litellm"
    : promptSets.some((promptSet) => promptSet.source === "deterministic")
      ? "deterministic"
      : "empty",
});

const extractJson = (text) => {
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    return JSON.parse(objectMatch[0]);
  }

  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    return JSON.parse(arrayMatch[0]);
  }

  throw new Error("No JSON object found in model response");
};

const rankNodesForCluster = async ({
  cluster,
  nodes,
  env,
}) => {
  if (nodes.length <= 1) {
    return nodes;
  }

  const embeddingPayload = await createEmbedding({
    env,
    input: [
      `${cluster.title} memory palace cluster`,
      ...nodes.map((node) => `${node.label}\n${node.summary}`),
    ],
  });

  const embeddings = embeddingPayload?.data?.map((item) => item.embedding) || [];
  if (embeddings.length !== nodes.length + 1) {
    return nodes;
  }

  const [clusterEmbedding, ...nodeEmbeddings] = embeddings;

  return nodes
    .map((node, index) => ({
      node,
      score:
        cosineSimilarity(clusterEmbedding, nodeEmbeddings[index]) +
        node.relatedNodeIds.length * 0.025 +
        node.summary.length * 0.0001,
    }))
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.node);
};

const generatePromptSet = async ({
  cluster,
  nodes,
  env,
  fetchImpl,
}) => {
  const rankedNodes = await rankNodesForCluster({ cluster, nodes, env });
  const featuredNodes = rankedNodes.slice(0, 4);

  if (featuredNodes.length === 0) {
    return {
      clusterId: cluster.id,
      highlightedNodeIds: [],
      prompts: [],
      source: "empty",
    };
  }

  const prompt = [
    "Generate four short first-person example prompts for a private memory-palace search app.",
    "Keep each prompt concrete, natural, and under 110 characters.",
    "Return strict JSON with the shape {\"prompts\":[\"...\"]}.",
    `Cluster: ${cluster.title}`,
    "Concept seeds:",
    ...featuredNodes.map((node) => `- ${node.label}: ${node.summary}`),
  ].join("\n");

  const response = await createChatCompletion({
    env,
    fetchImpl,
    stream: false,
    messages: [
      {
        role: "system",
        content:
          "You write concise prompts for a high-signal personal knowledge tool. Output valid JSON only.",
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    temperature: 0.7,
    max_tokens: 250,
  });

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content || "";
  const parsed = extractJson(content);
  const prompts = Array.isArray(parsed?.prompts)
    ? parsed.prompts.map((item) => String(item).trim()).filter(Boolean).slice(0, 4)
    : [];

  return {
    clusterId: cluster.id,
    highlightedNodeIds: featuredNodes.map((node) => node.id),
    prompts: prompts.length > 0 ? prompts : buildDeterministicPrompts(cluster, featuredNodes),
    source: prompts.length > 0 ? "litellm" : "deterministic",
  };
};

const buildFallbackPromptSets = (clusters, nodes) => {
  const clusterPromptSets = clusters.map((cluster) => {
    const clusterNodes = nodes.filter((node) => cluster.nodes.includes(node.id));
    return {
      clusterId: cluster.id,
      highlightedNodeIds: clusterNodes.slice(0, 4).map((node) => node.id),
      prompts: buildDeterministicPrompts(cluster, clusterNodes),
      source: "deterministic",
    };
  });
  return [buildMasterPromptSet(clusterPromptSets), ...clusterPromptSets];
};

const isFresh = (cache) => {
  if (!cache?.generatedAt) {
    return false;
  }
  return Date.now() - new Date(cache.generatedAt).getTime() <= CACHE_MAX_AGE_MS;
};

const isReusableCache = (cache, { graphHash, model, embeddingModel }) => {
  if (!cache || cache.graphHash !== graphHash) {
    return false;
  }

  if (!isFresh(cache)) {
    return false;
  }

  return cache.model === model && cache.embeddingModel === embeddingModel;
};

const getDiscoveryPayload = async ({
  env = process.env,
  fetchImpl = fetch,
} = {}) => {
  const baseGraph = buildDiscoveryGraph({
    selectedClusters: DEFAULT_CLUSTER_TITLES,
  });
  const thematicClusters = baseGraph.clusters;
  const masterCluster = buildMasterCluster(thematicClusters);
  const graph = {
    ...baseGraph,
    clusters: [masterCluster, ...thematicClusters],
    defaultClusterIds: [MASTER_CLUSTER_ID],
  };
  const config = getLiteLLMConfig(env);
  const graphHash = hashGraph(graph);
  const cache = readJsonIfPresent(CACHE_FILE);

  if (isReusableCache(cache, { graphHash, model: config.model, embeddingModel: config.embeddingModel })) {
    return {
      ...graph,
      promptSets: cache.promptSets,
      generatedAt: cache.generatedAt,
      stale: false,
      model: cache.model,
      embeddingModel: cache.embeddingModel,
    };
  }

  try {
    const clusterPromptSets = [];
    for (const cluster of thematicClusters) {
      const clusterNodes = graph.nodes.filter((node) => cluster.nodes.includes(node.id));
      clusterPromptSets.push(await generatePromptSet({ cluster, nodes: clusterNodes, env, fetchImpl }));
    }
    const promptSets = [buildMasterPromptSet(clusterPromptSets), ...clusterPromptSets];

    const payload = {
      graphHash,
      generatedAt: new Date().toISOString(),
      model: config.model,
      embeddingModel: config.embeddingModel,
      promptSets,
    };

    writeJson(CACHE_FILE, payload);

    return {
      ...graph,
      promptSets,
      generatedAt: payload.generatedAt,
      stale: false,
      model: payload.model,
      embeddingModel: payload.embeddingModel,
    };
  } catch (error) {
    console.error("Failed to refresh discovery prompts:", error);
    if (cache && cache.graphHash === graphHash) {
      return {
        ...graph,
        promptSets: cache.promptSets,
        generatedAt: cache.generatedAt,
        stale: true,
        model: cache.model,
        embeddingModel: cache.embeddingModel,
      };
    }

    return {
      ...graph,
      promptSets: buildFallbackPromptSets(thematicClusters, graph.nodes),
      generatedAt: new Date().toISOString(),
      stale: false,
      model: config.model,
      embeddingModel: config.embeddingModel,
    };
  }
};

module.exports = {
  CACHE_FILE,
  CACHE_MAX_AGE_MS,
  MASTER_CLUSTER_ID,
  buildMasterCluster,
  buildMasterPromptSet,
  isReusableCache,
  getDiscoveryPayload,
  buildFallbackPromptSets,
};
