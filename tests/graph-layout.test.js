const test = require("node:test");
const assert = require("node:assert/strict");

let createForceGraphLayout;

test.before(async () => {
  ({ createForceGraphLayout } = await import("../utils/graphLayout.mjs"));
});

const discovery = {
  clusters: [
    {
      id: "master-neural-network",
      title: "Master Neural Network",
      nodes: ["a1", "a2", "a3", "b1", "b2", "b3", "c1", "c2", "c3"],
    },
    {
      id: "cluster-a",
      title: "Cluster A",
      nodes: ["a1", "a2", "a3"],
    },
    {
      id: "cluster-b",
      title: "Cluster B",
      nodes: ["b1", "b2", "b3"],
    },
    {
      id: "cluster-c",
      title: "Cluster C",
      nodes: ["c1", "c2", "c3"],
    },
  ],
  nodes: [
    { id: "a1", label: "A1", summary: "A1", relatedNodeIds: ["a2", "b1"] },
    { id: "a2", label: "A2", summary: "A2", relatedNodeIds: ["a1", "a3"] },
    { id: "a3", label: "A3", summary: "A3", relatedNodeIds: ["a2", "b2"] },
    { id: "b1", label: "B1", summary: "B1", relatedNodeIds: ["b2", "a1"] },
    { id: "b2", label: "B2", summary: "B2", relatedNodeIds: ["b1", "b3", "a3"] },
    { id: "b3", label: "B3", summary: "B3", relatedNodeIds: ["b2", "c1"] },
    { id: "c1", label: "C1", summary: "C1", relatedNodeIds: ["c2", "b3"] },
    { id: "c2", label: "C2", summary: "C2", relatedNodeIds: ["c1", "c3"] },
    { id: "c3", label: "C3", summary: "C3", relatedNodeIds: ["c2"] },
  ],
  edges: [
    { id: "a1-a2", source: "a1", target: "a2" },
    { id: "a2-a3", source: "a2", target: "a3" },
    { id: "a1-b1", source: "a1", target: "b1" },
    { id: "a3-b2", source: "a3", target: "b2" },
    { id: "b1-b2", source: "b1", target: "b2" },
    { id: "b2-b3", source: "b2", target: "b3" },
    { id: "b3-c1", source: "b3", target: "c1" },
    { id: "c1-c2", source: "c1", target: "c2" },
    { id: "c2-c3", source: "c2", target: "c3" },
  ],
};

test("createForceGraphLayout returns deterministic in-bounds positions", () => {
  const first = createForceGraphLayout({
    discovery,
    width: 260,
    height: 176,
    activeClusterId: "master-neural-network",
    highlightedNodeIds: ["a1", "b2"],
  });

  const second = createForceGraphLayout({
    discovery,
    width: 260,
    height: 176,
    activeClusterId: "master-neural-network",
    highlightedNodeIds: ["a1", "b2"],
  });

  assert.deepEqual(first.positions, second.positions);

  for (const point of Object.values(first.positions)) {
    assert.ok(point.x >= 0 && point.x <= 260);
    assert.ok(point.y >= 0 && point.y <= 176);
  }
});

test("createForceGraphLayout keeps thematic cluster anchors separated", () => {
  const layout = createForceGraphLayout({
    discovery,
    width: 260,
    height: 176,
    activeClusterId: "cluster-a",
    highlightedNodeIds: [],
  });

  const centers = Object.values(layout.clusterCenters);
  const distances = [];

  for (let i = 0; i < centers.length; i += 1) {
    for (let j = i + 1; j < centers.length; j += 1) {
      const dx = centers[i].x - centers[j].x;
      const dy = centers[i].y - centers[j].y;
      distances.push(Math.sqrt(dx * dx + dy * dy));
    }
  }

  assert.ok(distances.every((distance) => distance > 30));
  assert.ok(layout.labelNodeIds.length <= 10);
});
