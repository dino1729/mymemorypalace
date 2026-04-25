const test = require("node:test");
const assert = require("node:assert/strict");

const {
  MASTER_CLUSTER_ID,
  buildMasterCluster,
  buildMasterPromptSet,
} = require("../utils/discovery");

test("buildMasterCluster merges node ids from all curated clusters", () => {
  const cluster = buildMasterCluster([
    { id: "a", title: "Cluster A", nodes: ["one", "two", "three"] },
    { id: "b", title: "Cluster B", nodes: ["three", "four"] },
    { id: "c", title: "Cluster C", nodes: ["five"] },
  ]);

  assert.equal(cluster.id, MASTER_CLUSTER_ID);
  assert.equal(cluster.title, "Master Neural Network");
  assert.deepEqual(cluster.nodes, ["one", "two", "three", "four", "five"]);
});

test("buildMasterPromptSet deduplicates and caps prompts across clusters", () => {
  const promptSet = buildMasterPromptSet([
    {
      clusterId: "a",
      highlightedNodeIds: ["one", "two"],
      prompts: ["alpha", "beta", "gamma"],
      source: "litellm",
    },
    {
      clusterId: "b",
      highlightedNodeIds: ["three", "two"],
      prompts: ["beta", "delta", "epsilon"],
      source: "litellm",
    },
  ]);

  assert.equal(promptSet.clusterId, MASTER_CLUSTER_ID);
  assert.deepEqual(promptSet.highlightedNodeIds, ["one", "two", "three"]);
  assert.deepEqual(promptSet.prompts, ["alpha", "beta", "gamma", "delta", "epsilon"]);
  assert.equal(promptSet.source, "litellm");
});
