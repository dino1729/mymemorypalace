const fs = require("node:fs");
const path = require("node:path");

const DEFAULT_CLUSTER_TITLES = [
  "Cognitive Bias Cluster",
  "Nash Equilibrium Cluster",
  "Compound Interest Cluster",
];

const slugify = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const parseConnectionsMarkdown = (markdown) => {
  const lines = markdown.split(/\r?\n/);
  const clusters = [];
  let current = null;

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+?)\s*$/);
    if (headingMatch) {
      if (current) {
        clusters.push(current);
      }
      current = {
        id: slugify(headingMatch[1]),
        title: headingMatch[1].trim(),
        members: [],
      };
      continue;
    }

    const memberMatch = line.match(/^\s*-\s+\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
    if (memberMatch && current) {
      current.members.push(slugify(memberMatch[1]));
    }
  }

  if (current) {
    clusters.push(current);
  }

  return clusters.filter((cluster) => cluster.members.length > 0);
};

const parseFrontmatter = (markdown) => {
  const match = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!match) {
    return {};
  }

  const frontmatter = {};
  for (const line of match[1].split(/\r?\n/)) {
    const simpleMatch = line.match(/^([A-Za-z0-9_-]+):\s*(.+?)\s*$/);
    if (!simpleMatch) {
      continue;
    }

    const [, key, rawValue] = simpleMatch;
    frontmatter[key] = rawValue.replace(/^['"]|['"]$/g, "").trim();
  }

  return frontmatter;
};

const extractWikilinks = (markdown) => {
  const links = new Set();
  const regex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  let match = regex.exec(markdown);

  while (match) {
    links.add(slugify(match[1]));
    match = regex.exec(markdown);
  }

  return [...links];
};

const getSummaryFromBody = (body) => {
  const coreIdeaMatch = body.match(/##\s+The Core Idea\s*\n+([\s\S]*?)(?:\n##\s+|\n---|\s*$)/i);
  const text = coreIdeaMatch ? coreIdeaMatch[1] : body;
  const cleaned = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^#+\s.*$/gm, " ")
    .replace(/\[\[([^\]|]+)\|?([^\]]*)\]\]/g, (_match, slug, label) => label || slug.replace(/-/g, " "))
    .replace(/\*\*/g, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return "";
  }

  const firstSentence = cleaned.match(/(.+?[.!?])(?:\s|$)/);
  return (firstSentence ? firstSentence[1] : cleaned).trim();
};

const parseConceptMarkdown = (markdown, slug) => {
  const frontmatter = parseFrontmatter(markdown);
  const body = markdown.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, "");
  const links = extractWikilinks(markdown).filter((link) => link !== slug);

  return {
    slug,
    title: frontmatter.title || slug.replace(/-/g, " "),
    summary: getSummaryFromBody(body),
    links,
  };
};

const loadConceptMap = (vaultRoot) => {
  const conceptsDir = path.join(vaultRoot, "concepts");
  const conceptMap = new Map();

  if (!fs.existsSync(conceptsDir)) {
    return conceptMap;
  }

  for (const fileName of fs.readdirSync(conceptsDir)) {
    if (!fileName.endsWith(".md")) {
      continue;
    }
    const slug = fileName.replace(/\.md$/, "");
    const markdown = fs.readFileSync(path.join(conceptsDir, fileName), "utf8");
    conceptMap.set(slug, parseConceptMarkdown(markdown, slug));
  }

  return conceptMap;
};

const buildDiscoveryGraph = ({
  vaultRoot = path.resolve(process.cwd(), "../LLM_QA_Bot/vault"),
  selectedClusters = DEFAULT_CLUSTER_TITLES,
} = {}) => {
  const connectionsPath = path.join(vaultRoot, "CONNECTIONS.md");
  if (!fs.existsSync(connectionsPath)) {
    throw new Error(`Vault connections file not found at ${connectionsPath}`);
  }

  const allClusters = parseConnectionsMarkdown(fs.readFileSync(connectionsPath, "utf8"));
  const clusterMap = new Map(allClusters.map((cluster) => [cluster.title, cluster]));
  const chosenClusters = selectedClusters
    .map((title) => clusterMap.get(title))
    .filter(Boolean);

  const conceptMap = loadConceptMap(vaultRoot);
  const selectedNodeIds = new Set(chosenClusters.flatMap((cluster) => cluster.members));

  const nodes = [...selectedNodeIds]
    .map((nodeId) => conceptMap.get(nodeId))
    .filter(Boolean)
    .map((concept) => ({
      id: concept.slug,
      slug: concept.slug,
      label: concept.title,
      summary: concept.summary,
      relatedNodeIds: concept.links.filter((link) => selectedNodeIds.has(link)).slice(0, 6),
    }));

  const seenEdges = new Set();
  const edges = [];

  for (const node of nodes) {
    for (const relatedNodeId of node.relatedNodeIds) {
      const key = [node.id, relatedNodeId].sort().join("::");
      if (seenEdges.has(key)) {
        continue;
      }
      seenEdges.add(key);
      edges.push({
        id: key,
        source: node.id,
        target: relatedNodeId,
      });
    }
  }

  const clusters = chosenClusters.map((cluster) => ({
    id: cluster.id,
    title: cluster.title,
    nodes: cluster.members.filter((member) => selectedNodeIds.has(member)),
  }));

  return {
    generatedAt: new Date().toISOString(),
    defaultClusterIds: clusters.map((cluster) => cluster.id),
    clusters,
    nodes,
    edges,
  };
};

module.exports = {
  DEFAULT_CLUSTER_TITLES,
  parseConnectionsMarkdown,
  parseConceptMarkdown,
  buildDiscoveryGraph,
};
