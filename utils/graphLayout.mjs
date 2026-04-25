import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
} from "d3-force";

export const MASTER_CLUSTER_ID = "master-neural-network";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const createRandomSource = (seed) => {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

const getThematicClusters = (discovery) =>
  discovery.clusters.filter((cluster) => cluster.id !== MASTER_CLUSTER_ID);

const getClusterCenterMap = (clusters, width, height) => {
  if (clusters.length === 3) {
    return {
      [clusters[0].id]: { x: width * 0.5, y: height * 0.2 },
      [clusters[1].id]: { x: width * 0.23, y: height * 0.74 },
      [clusters[2].id]: { x: width * 0.77, y: height * 0.74 },
    };
  }

  const angleStep = (Math.PI * 2) / Math.max(clusters.length, 1);
  return Object.fromEntries(
    clusters.map((cluster, index) => [
      cluster.id,
      {
        x: width * 0.5 + Math.cos(-Math.PI / 2 + angleStep * index) * width * 0.26,
        y: height * 0.5 + Math.sin(-Math.PI / 2 + angleStep * index) * height * 0.24,
      },
    ]),
  );
};

const getNodeMembership = (thematicClusters) => {
  const membership = {};
  for (const cluster of thematicClusters) {
    for (const nodeId of cluster.nodes) {
      if (!membership[nodeId]) {
        membership[nodeId] = [];
      }
      membership[nodeId].push(cluster.id);
    }
  }
  return membership;
};

const buildDegreeMap = (nodeIds, edges) => {
  const degreeMap = Object.fromEntries(nodeIds.map((nodeId) => [nodeId, 0]));
  for (const edge of edges) {
    if (degreeMap[edge.source] === undefined || degreeMap[edge.target] === undefined) {
      continue;
    }
    degreeMap[edge.source] += 1;
    degreeMap[edge.target] += 1;
  }
  return degreeMap;
};

const computeLabelNodeIds = ({
  activeClusterId,
  degreeMap,
  highlightedNodeIds,
  membershipMap,
  nodeIds,
}) => {
  const nodeIdSet = new Set(nodeIds);
  const visibleSpotlightNodes =
    activeClusterId === MASTER_CLUSTER_ID
      ? [...nodeIds]
      : nodeIds.filter((nodeId) => (membershipMap[nodeId] || []).includes(activeClusterId));

  const hubNodes = [...visibleSpotlightNodes]
    .sort((left, right) => degreeMap[right] - degreeMap[left])
    .slice(0, activeClusterId === MASTER_CLUSTER_ID ? 6 : 4);

  const bridgeNodes = nodeIds
    .filter((nodeId) => (membershipMap[nodeId] || []).length > 1)
    .sort((left, right) => degreeMap[right] - degreeMap[left])
    .slice(0, 2);

  return [
    ...new Set(
      [...highlightedNodeIds, ...hubNodes, ...bridgeNodes].filter((nodeId) => nodeIdSet.has(nodeId)),
    ),
  ];
};

export const createForceGraphLayout = ({
  discovery,
  width,
  height,
  activeClusterId,
  highlightedNodeIds = [],
}) => {
  const masterCluster = discovery.clusters.find((cluster) => cluster.id === MASTER_CLUSTER_ID);
  const thematicClusters = getThematicClusters(discovery);
  const networkNodeIds = masterCluster ? masterCluster.nodes : discovery.nodes.map((node) => node.id);
  const networkNodeIdSet = new Set(networkNodeIds);
  const visibleNodes = discovery.nodes.filter((node) => networkNodeIdSet.has(node.id));
  const edges = discovery.edges.filter(
    (edge) => networkNodeIdSet.has(edge.source) && networkNodeIdSet.has(edge.target),
  );
  const clusterCenters = getClusterCenterMap(thematicClusters, width, height);
  const membershipMap = getNodeMembership(thematicClusters);
  const degreeMap = buildDegreeMap(networkNodeIds, edges);
  const random = createRandomSource(42);

  const simulationNodes = visibleNodes.map((node) => {
    const memberships = membershipMap[node.id] || [];
    const primaryClusterId = memberships[0] || thematicClusters[0]?.id || MASTER_CLUSTER_ID;
    const anchor =
      clusterCenters[primaryClusterId] ||
      clusterCenters[thematicClusters[0]?.id] || { x: width / 2, y: height / 2 };
    const jitterX = (random() - 0.5) * 28;
    const jitterY = (random() - 0.5) * 22;

    return {
      ...node,
      clusterIds: memberships,
      x: anchor.x + jitterX,
      y: anchor.y + jitterY,
      radius: 5.5 + Math.min(degreeMap[node.id] || 0, 6) * 0.6,
    };
  });

  const simulationLinks = edges.map((edge) => ({
    source: edge.source,
    target: edge.target,
    interCluster:
      (membershipMap[edge.source] || []).filter((id) => (membershipMap[edge.target] || []).includes(id)).length ===
      0,
  }));

  const simulation = forceSimulation(simulationNodes)
    .randomSource(random)
    .force(
      "link",
      forceLink(simulationLinks)
        .id((node) => node.id)
        .distance((link) => (link.interCluster ? 62 : 28))
        .strength((link) => (link.interCluster ? 0.15 : 0.36)),
    )
    .force("charge", forceManyBody().strength(-78))
    .force("collide", forceCollide().radius((node) => node.radius + 2.5).iterations(2))
    .force(
      "x",
      forceX((node) => {
        if (!node.clusterIds.length) {
          return width / 2;
        }
        const center = node.clusterIds
          .map((clusterId) => clusterCenters[clusterId])
          .filter(Boolean)
          .reduce((sum, point) => sum + point.x, 0);
        return center / node.clusterIds.length;
      }).strength(0.14),
    )
    .force(
      "y",
      forceY((node) => {
        if (!node.clusterIds.length) {
          return height / 2;
        }
        const center = node.clusterIds
          .map((clusterId) => clusterCenters[clusterId])
          .filter(Boolean)
          .reduce((sum, point) => sum + point.y, 0);
        return center / node.clusterIds.length;
      }).strength(0.14),
    )
    .force("center", forceCenter(width / 2, height / 2))
    .stop();

  simulation.tick(280);

  const positions = Object.fromEntries(
    simulationNodes.map((node) => [
      node.id,
      {
        x: clamp(node.x, 18, width - 18),
        y: clamp(node.y, 18, height - 18),
      },
    ]),
  );

  return {
    positions,
    clusterCenters,
    visibleNodes: simulationNodes.map((node) => node.id),
    degreeMap,
    spotlightNodeIds:
      activeClusterId === MASTER_CLUSTER_ID
        ? networkNodeIds
        : networkNodeIds.filter((nodeId) => (membershipMap[nodeId] || []).includes(activeClusterId)),
    bridgeNodeIds: networkNodeIds.filter((nodeId) => (membershipMap[nodeId] || []).length > 1),
    labelNodeIds: computeLabelNodeIds({
      activeClusterId,
      degreeMap,
      highlightedNodeIds,
      membershipMap,
      nodeIds: networkNodeIds,
    }),
    nodeMembership: membershipMap,
    networkEdges: edges,
    nodeRadii: Object.fromEntries(simulationNodes.map((node) => [node.id, node.radius])),
  };
};
