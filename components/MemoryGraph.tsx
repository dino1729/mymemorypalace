import {
  DiscoveryPayload,
  DiscoveryNode,
  DiscoveryCluster,
} from "@/types";
import {
  IconCirclesRelation,
  IconFocusCentered,
  IconMinus,
  IconNetwork,
  IconPlus,
  IconSparkles,
  IconTopologyRing3,
  IconZoomReset,
} from "@tabler/icons-react";
import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { MASTER_CLUSTER_ID, createForceGraphLayout } from "@/utils/graphLayout.mjs";
import { GRAPH_SCALE_LIMITS, stepScale } from "@/utils/graphViewport.mjs";

type MemoryGraphProps = {
  discovery: DiscoveryPayload | null;
  activeClusterId: string | null;
  onSelectCluster: (clusterId: string) => void;
  onSelectPrompt: (prompt: string) => void;
};

type Point = { x: number; y: number };

type GraphEdge = {
  id: string;
  source: string;
  target: string;
};

type GraphLayout = {
  positions: Record<string, Point>;
  clusterCenters: Record<string, Point>;
  visibleNodes: string[];
  degreeMap: Record<string, number>;
  spotlightNodeIds: string[];
  bridgeNodeIds: string[];
  labelNodeIds: string[];
  nodeMembership: Record<string, string[]>;
  networkEdges: GraphEdge[];
  nodeRadii: Record<string, number>;
};

type ClusterPalette = {
  fill: string;
  ring: string;
  edge: string;
  halo: string;
  tint: string;
  text: string;
  glow: string;
};

type ClusterSummary = {
  cluster: DiscoveryCluster;
  title: string;
  nodeCount: number;
  palette: ClusterPalette;
};

type Rect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

type NodeLabelPlacement = {
  nodeId: string;
  label: string;
  x: number;
  y: number;
  width: number;
};

const DESKTOP_GRAPH_WIDTH = 420;
const DESKTOP_GRAPH_HEIGHT = 280;
const COMPACT_GRAPH_WIDTH = 280;
const COMPACT_GRAPH_HEIGHT = 360;
const NODE_LABEL_HEIGHT = 9;

const MASTER_PALETTE: ClusterPalette = {
  fill: "rgba(248,250,252,0.96)",
  ring: "rgba(226,232,240,0.32)",
  edge: "rgba(226,232,240,0.2)",
  halo: "rgba(226,232,240,0.2)",
  tint: "rgba(226,232,240,0.08)",
  text: "rgba(248,250,252,0.94)",
  glow: "rgba(226,232,240,0.32)",
};

const NEUTRAL_PALETTE: ClusterPalette = {
  fill: "rgba(226,232,240,0.88)",
  ring: "rgba(226,232,240,0.18)",
  edge: "rgba(148,163,184,0.16)",
  halo: "rgba(226,232,240,0.12)",
  tint: "rgba(148,163,184,0.08)",
  text: "rgba(203,213,225,0.86)",
  glow: "rgba(226,232,240,0.2)",
};

const FALLBACK_CLUSTER_PALETTES: ClusterPalette[] = [
  {
    fill: "rgba(96,165,250,0.94)",
    ring: "rgba(96,165,250,0.26)",
    edge: "rgba(96,165,250,0.25)",
    halo: "rgba(96,165,250,0.22)",
    tint: "rgba(96,165,250,0.08)",
    text: "rgba(191,219,254,0.94)",
    glow: "rgba(96,165,250,0.32)",
  },
  {
    fill: "rgba(251,113,133,0.94)",
    ring: "rgba(251,113,133,0.25)",
    edge: "rgba(251,113,133,0.24)",
    halo: "rgba(251,113,133,0.2)",
    tint: "rgba(251,113,133,0.08)",
    text: "rgba(254,205,211,0.94)",
    glow: "rgba(251,113,133,0.3)",
  },
  {
    fill: "rgba(52,211,153,0.94)",
    ring: "rgba(52,211,153,0.24)",
    edge: "rgba(52,211,153,0.23)",
    halo: "rgba(52,211,153,0.2)",
    tint: "rgba(52,211,153,0.08)",
    text: "rgba(167,243,208,0.94)",
    glow: "rgba(52,211,153,0.3)",
  },
];

const CLUSTER_COLORS: Record<string, ClusterPalette> = {
  "cognitive-bias-cluster": {
    fill: "rgba(45,212,191,0.96)",
    ring: "rgba(45,212,191,0.28)",
    edge: "rgba(45,212,191,0.3)",
    halo: "rgba(45,212,191,0.22)",
    tint: "rgba(45,212,191,0.1)",
    text: "rgba(153,246,228,0.96)",
    glow: "rgba(45,212,191,0.34)",
  },
  "nash-equilibrium-cluster": {
    fill: "rgba(251,191,36,0.96)",
    ring: "rgba(251,191,36,0.28)",
    edge: "rgba(251,191,36,0.3)",
    halo: "rgba(251,191,36,0.2)",
    tint: "rgba(251,191,36,0.09)",
    text: "rgba(253,230,138,0.96)",
    glow: "rgba(251,191,36,0.32)",
  },
  "compound-interest-cluster": {
    fill: "rgba(196,181,253,0.96)",
    ring: "rgba(196,181,253,0.27)",
    edge: "rgba(196,181,253,0.28)",
    halo: "rgba(196,181,253,0.2)",
    tint: "rgba(196,181,253,0.09)",
    text: "rgba(221,214,254,0.96)",
    glow: "rgba(196,181,253,0.32)",
  },
};

const controlButtonClass =
  "inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-slate-950/75 text-slate-100 shadow-[0_12px_32px_-20px_rgba(0,0,0,0.75)] backdrop-blur transition hover:border-teal-300/60 hover:bg-teal-300/10 disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-9";

const getClusterTitle = (title: string) => title.replace(/ Cluster$/, "");

const getClusterPalette = (clusterId: string, fallbackIndex = 0) =>
  CLUSTER_COLORS[clusterId] ||
  FALLBACK_CLUSTER_PALETTES[fallbackIndex % FALLBACK_CLUSTER_PALETTES.length] ||
  NEUTRAL_PALETTE;

const getNodeColor = (memberships: string[]) =>
  memberships.length > 0 ? getClusterPalette(memberships[0]) : NEUTRAL_PALETTE;

const shortenLabel = (label: string) => (label.length > 30 ? `${label.slice(0, 27)}...` : label);

const getLabelWidth = (label: string) => Math.min(82, Math.max(24, label.length * 2.25 + 8));

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const getLabelRect = (x: number, y: number, width: number): Rect => ({
  left: x - width / 2,
  top: y - 5.5,
  right: x + width / 2,
  bottom: y - 5.5 + NODE_LABEL_HEIGHT,
});

const rectsOverlap = (first: Rect, second: Rect, gap = 1.6) =>
  first.left < second.right + gap &&
  first.right + gap > second.left &&
  first.top < second.bottom + gap &&
  first.bottom + gap > second.top;

const findLabelPlacement = ({
  point,
  radius,
  width,
  graphWidth,
  graphHeight,
  occupiedRects,
}: {
  point: Point;
  radius: number;
  width: number;
  graphWidth: number;
  graphHeight: number;
  occupiedRects: Rect[];
}) => {
  const candidates = [
    { x: point.x, y: point.y - radius - 11 },
    { x: point.x, y: point.y + radius + 14 },
    { x: point.x + radius + width / 2 + 8, y: point.y + 1 },
    { x: point.x - radius - width / 2 - 8, y: point.y + 1 },
    { x: point.x + radius + width / 2 + 6, y: point.y - radius - 6 },
    { x: point.x - radius - width / 2 - 6, y: point.y - radius - 6 },
    { x: point.x + radius + width / 2 + 6, y: point.y + radius + 10 },
    { x: point.x - radius - width / 2 - 6, y: point.y + radius + 10 },
  ];

  for (const candidate of candidates) {
    const x = clamp(candidate.x, width / 2 + 3, graphWidth - width / 2 - 3);
    const y = clamp(candidate.y, 8, graphHeight - 5);
    const rect = getLabelRect(x, y, width);

    if (!occupiedRects.some((occupiedRect) => rectsOverlap(rect, occupiedRect))) {
      return { x, y, rect };
    }
  }

  return null;
};

const getNodeLabelPlacements = ({
  compactGraph,
  degreeMap,
  graphHeight,
  graphWidth,
  highlightedNodeSet,
  hoveredNodeId,
  labelNodeSet,
  selectedNodeId,
  nodes,
  nodeRadii,
  positions,
  reservedRects = [],
  visibleNodeSet,
}: {
  compactGraph: boolean;
  degreeMap: Record<string, number>;
  graphHeight: number;
  graphWidth: number;
  highlightedNodeSet: Set<string>;
  hoveredNodeId: string | null;
  labelNodeSet: Set<string>;
  selectedNodeId: string | null;
  nodes: DiscoveryNode[];
  nodeRadii: Record<string, number>;
  positions: Record<string, Point>;
  reservedRects?: Rect[];
  visibleNodeSet: Set<string>;
}): NodeLabelPlacement[] => {
  const candidates = nodes
    .filter((node) => {
      if (!visibleNodeSet.has(node.id) || !positions[node.id]) {
        return false;
      }

      if (hoveredNodeId === node.id || selectedNodeId === node.id || highlightedNodeSet.has(node.id)) {
        return true;
      }

      return !compactGraph && labelNodeSet.has(node.id);
    })
    .map((node) => ({
      node,
      priority:
        hoveredNodeId === node.id
          ? 0
          : selectedNodeId === node.id
            ? 1
            : highlightedNodeSet.has(node.id)
              ? 2
              : 3,
      degree: degreeMap[node.id] || 0,
    }))
    .sort((left, right) => left.priority - right.priority || right.degree - left.degree);

  const maxLabels = compactGraph ? 4 : 12;
  const occupiedRects: Rect[] = [...reservedRects];
  const placements: NodeLabelPlacement[] = [];

  for (const candidate of candidates) {
    if (placements.length >= maxLabels && candidate.priority > 0) {
      continue;
    }

    const point = positions[candidate.node.id];
    const label = shortenLabel(candidate.node.label);
    const width = getLabelWidth(label);
    const radius = nodeRadii[candidate.node.id] || 4.5;
    const placement = findLabelPlacement({
      point,
      radius,
      width,
      graphWidth,
      graphHeight,
      occupiedRects,
    });

    if (!placement) {
      continue;
    }

    occupiedRects.push(placement.rect);
    placements.push({
      nodeId: candidate.node.id,
      label,
      x: placement.x,
      y: placement.y,
      width,
    });
  }

  return placements;
};

const getEdgePath = (from: Point, to: Point, edgeId: string) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const distance = Math.sqrt(dx * dx + dy * dy) || 1;
  let hash = 0;
  for (let index = 0; index < edgeId.length; index += 1) {
    hash += edgeId.charCodeAt(index);
  }
  const bend = Math.min(14, Math.max(4, distance * 0.1)) * (hash % 2 === 0 ? 1 : -1);
  const controlX = (from.x + to.x) / 2 - (dy / distance) * bend;
  const controlY = (from.y + to.y) / 2 + (dx / distance) * bend;

  return `M ${from.x.toFixed(2)} ${from.y.toFixed(2)} Q ${controlX.toFixed(2)} ${controlY.toFixed(
    2,
  )} ${to.x.toFixed(2)} ${to.y.toFixed(2)}`;
};

const createNodePromptSuggestions = (
  node: DiscoveryNode,
  nodeLookup: Map<string, DiscoveryNode>,
): string[] => {
  const related = node.relatedNodeIds
    .map((relatedId) => nodeLookup.get(relatedId)?.label)
    .filter(Boolean) as string[];

  return [
    `How does ${node.label} connect to ${related.slice(0, 2).join(" and ") || "the rest of my ideas"}?`,
    `Give me the most practical lesson from ${node.label} in my memory palace.`,
  ];
};

export const MemoryGraph: React.FC<MemoryGraphProps> = ({
  discovery,
  activeClusterId,
  onSelectCluster,
  onSelectPrompt,
}) => {
  const svgUid = useId().replace(/:/g, "");
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [compactGraph, setCompactGraph] = useState(false);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);

  const masterCluster =
    discovery?.clusters.find((cluster) => cluster.id === MASTER_CLUSTER_ID) ?? null;

  const activeCluster =
    discovery?.clusters.find((cluster) => cluster.id === activeClusterId) ??
    masterCluster ??
    discovery?.clusters[0] ??
    null;

  const activePromptSet =
    discovery?.promptSets.find((promptSet) => promptSet.clusterId === activeCluster?.id) ??
    discovery?.promptSets[0] ??
    null;

  const nodeLookup = useMemo(
    () => new Map((discovery?.nodes ?? []).map((node) => [node.id, node])),
    [discovery?.nodes],
  );

  const clusterSummaries = useMemo<ClusterSummary[]>(
    () =>
      (discovery?.clusters ?? []).map((cluster, index) => {
        const isMaster = cluster.id === MASTER_CLUSTER_ID;

        return {
          cluster,
          title: isMaster ? "Master" : getClusterTitle(cluster.title),
          nodeCount: cluster.nodes.length,
          palette: isMaster ? MASTER_PALETTE : getClusterPalette(cluster.id, index),
        };
      }),
    [discovery?.clusters],
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 639px)");
    const syncGraphMode = () => setCompactGraph(mediaQuery.matches);

    syncGraphMode();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncGraphMode);

      return () => {
        mediaQuery.removeEventListener("change", syncGraphMode);
      };
    }

    mediaQuery.addListener(syncGraphMode);

    return () => {
      mediaQuery.removeListener(syncGraphMode);
    };
  }, []);

  const graphWidth = compactGraph ? COMPACT_GRAPH_WIDTH : DESKTOP_GRAPH_WIDTH;
  const graphHeight = compactGraph ? COMPACT_GRAPH_HEIGHT : DESKTOP_GRAPH_HEIGHT;

  const layout = useMemo<GraphLayout | null>(() => {
    if (!discovery || !activeCluster) {
      return null;
    }

    return createForceGraphLayout({
      discovery,
      width: graphWidth,
      height: graphHeight,
      activeClusterId: activeCluster.id,
      highlightedNodeIds: activePromptSet?.highlightedNodeIds ?? [],
    }) as GraphLayout;
  }, [activeCluster, activePromptSet?.highlightedNodeIds, discovery, graphHeight, graphWidth]);

  useEffect(() => {
    if (!selectedNodeId || !layout) {
      return;
    }

    if (!layout.visibleNodes.includes(selectedNodeId)) {
      setSelectedNodeId(null);
    }
  }, [layout, selectedNodeId]);

  const previewNode =
    (hoveredNodeId ? nodeLookup.get(hoveredNodeId) : null) ||
    (selectedNodeId ? nodeLookup.get(selectedNodeId) : null) ||
    (activePromptSet?.highlightedNodeIds[0] ? nodeLookup.get(activePromptSet.highlightedNodeIds[0]) : null) ||
    (masterCluster?.nodes[0] ? nodeLookup.get(masterCluster.nodes[0]) : null) ||
    null;

  if (!discovery || !activeCluster || !layout) {
    return null;
  }

  const stageGradientId = `${svgUid}-stage-gradient`;
  const gridPatternId = `${svgUid}-grid-pattern`;
  const nodeGlowId = `${svgUid}-node-glow`;
  const edgeGlowId = `${svgUid}-edge-glow`;
  const clusterGlowId = `${svgUid}-cluster-glow`;
  const titleId = `${svgUid}-title`;
  const suggestions = previewNode ? createNodePromptSuggestions(previewNode, nodeLookup) : [];
  const thematicClusters = discovery.clusters.filter((cluster) => cluster.id !== MASTER_CLUSTER_ID);
  const highlightedNodeSet = new Set(activePromptSet?.highlightedNodeIds ?? []);
  const visibleNodeSet = new Set(layout.visibleNodes);
  const spotlightNodeSet = new Set(layout.spotlightNodeIds);
  const bridgeNodeSet = new Set(layout.bridgeNodeIds);
  const labelNodeSet = new Set(layout.labelNodeIds);
  const activeClusterIsMaster = activeCluster.id === MASTER_CLUSTER_ID;
  const graphPadX = compactGraph ? 18 : 0;
  const graphPadY = compactGraph ? 14 : 0;
  const graphViewBox = `${-graphPadX} ${-graphPadY} ${graphWidth + graphPadX * 2} ${graphHeight + graphPadY * 2}`;
  const clusterLabelRects = compactGraph
    ? []
    : thematicClusters
        .map((cluster) => {
          const center = layout.clusterCenters[cluster.id];
          if (!center) {
            return null;
          }

          const active = activeCluster.id === cluster.id;
          const label = shortenLabel(getClusterTitle(cluster.title)).toUpperCase();
          return getLabelRect(center.x, center.y + (active ? 46 : 40), getLabelWidth(label));
        })
        .filter(Boolean) as Rect[];
  const nodeLabelPlacements = getNodeLabelPlacements({
    compactGraph,
    degreeMap: layout.degreeMap,
    graphHeight,
    graphWidth,
    highlightedNodeSet,
    hoveredNodeId,
    labelNodeSet,
    selectedNodeId,
    nodes: discovery.nodes,
    nodeRadii: layout.nodeRadii,
    positions: layout.positions,
    reservedRects: clusterLabelRects,
    visibleNodeSet,
  });
  const nodeLabelPlacementMap = new Map(
    nodeLabelPlacements.map((placement) => [placement.nodeId, placement]),
  );

  const resetViewport = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }

    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX - offset.x,
      y: event.clientY - offset.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) {
      return;
    }

    setOffset({
      x: event.clientX - dragRef.current.x,
      y: event.clientY - dragRef.current.y,
    });
  };

  const stopDragging = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
  };

  const selectActiveNode = (node: DiscoveryNode) => {
    setSelectedNodeId(node.id);
  };

  const stats = [
    { label: "Nodes", value: discovery.nodes.length },
    { label: "Links", value: layout.networkEdges.length },
    { label: "Bridges", value: layout.bridgeNodeIds.length },
  ];

  return (
    <section className="min-w-0 overflow-hidden rounded-[1.5rem] border border-slate-800 bg-[linear-gradient(135deg,#0b1120_0%,#111827_46%,#050816_100%)] p-4 text-white shadow-[0_34px_120px_-48px_rgba(2,6,23,0.94)] sm:rounded-[2rem] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-teal-200">
            <IconTopologyRing3 size={15} />
            Neural Graph
          </p>
          <h2 className="mt-2 break-words text-2xl font-semibold leading-tight text-white sm:text-3xl">
            A living map of the palace
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            Clusters, bridges, and prompt-ready concepts in one navigable field.
          </p>
        </div>

        <div className="grid w-full min-w-0 grid-cols-3 gap-2 sm:w-auto sm:min-w-[330px]">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-white/10 bg-white/[0.055] px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">{stat.label}</div>
              <div className="mt-1 text-xl font-semibold text-slate-100">{stat.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 grid min-w-0 grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
        {clusterSummaries.map(({ cluster, nodeCount, palette, title }) => {
          const active = cluster.id === activeCluster.id;

          return (
            <button
              key={cluster.id}
              type="button"
              className={`inline-flex min-h-[2.75rem] min-w-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition sm:min-h-[2.5rem] ${
                active
                  ? "border-white/25 text-white shadow-[0_14px_38px_-25px_rgba(255,255,255,0.42)]"
                  : "border-white/10 bg-slate-950/45 text-slate-300 hover:border-white/25 hover:bg-white/[0.07] hover:text-white"
              }`}
              style={
                active
                  ? {
                      background: `linear-gradient(135deg, ${palette.tint}, rgba(15,23,42,0.84))`,
                      borderColor: palette.ring,
                    }
                  : undefined
              }
              onClick={() => onSelectCluster(cluster.id)}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: palette.fill, boxShadow: `0 0 18px ${palette.glow}` }}
              />
              <span className="min-w-0 flex-1 truncate text-left sm:max-w-[11rem] sm:flex-none">{title}</span>
              <span className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[10px] text-slate-300">{nodeCount}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 overflow-hidden rounded-[1.25rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.74),rgba(2,6,23,0.96))] sm:rounded-[1.5rem]">
          <div className="flex min-w-0 flex-col gap-3 border-b border-white/10 bg-slate-950/30 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs font-semibold text-slate-200">
              <span className="max-w-full truncate rounded-full border border-white/10 bg-slate-950/70 px-3 py-2 backdrop-blur">
                {activeClusterIsMaster ? "Master field" : getClusterTitle(activeCluster.title)}
              </span>
              <span className="rounded-full border border-white/10 bg-slate-950/70 px-3 py-2 text-slate-400 backdrop-blur">
                {layout.spotlightNodeIds.length} active nodes
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 sm:justify-end">
              <button
                type="button"
                aria-label="Zoom out"
                title="Zoom out"
                className={controlButtonClass}
                onClick={() => setScale((current) => stepScale(current, "out"))}
                disabled={scale <= GRAPH_SCALE_LIMITS.min}
              >
                <IconMinus size={16} />
              </button>
              <div className="flex min-h-[44px] min-w-[64px] items-center justify-center rounded-full border border-white/10 bg-slate-950/75 px-3 text-center text-xs font-semibold text-slate-300 backdrop-blur sm:min-h-0 sm:py-2">
                {Math.round(scale * 100)}%
              </div>
              <button
                type="button"
                aria-label="Zoom in"
                title="Zoom in"
                className={controlButtonClass}
                onClick={() => setScale((current) => stepScale(current, "in"))}
                disabled={scale >= GRAPH_SCALE_LIMITS.max}
              >
                <IconPlus size={16} />
              </button>
              <button
                type="button"
                aria-label="Reset graph view"
                title="Reset graph view"
                className={controlButtonClass}
                onClick={resetViewport}
              >
                <IconZoomReset size={16} />
              </button>
            </div>
          </div>

          <div
            className="aspect-[7/9] min-h-[22rem] w-full cursor-grab touch-none overflow-hidden active:cursor-grabbing sm:aspect-auto sm:h-[560px] sm:min-h-0 lg:h-[660px]"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={stopDragging}
            onPointerCancel={stopDragging}
          >
            <svg
              viewBox={graphViewBox}
              role="img"
              aria-labelledby={titleId}
              className="h-full w-full"
            >
              <title id={titleId}>{`${activeCluster.title} neural graph`}</title>
              <defs>
                <radialGradient id={stageGradientId} cx="50%" cy="45%" r="75%">
                  <stop offset="0%" stopColor="rgba(30,41,59,0.92)" />
                  <stop offset="46%" stopColor="rgba(15,23,42,0.94)" />
                  <stop offset="100%" stopColor="rgba(2,6,23,1)" />
                </radialGradient>
                <pattern id={gridPatternId} width="20" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(148,163,184,0.14)" strokeWidth="0.45" />
                  <circle cx="0" cy="0" r="0.45" fill="rgba(148,163,184,0.2)" />
                </pattern>
                <filter id={nodeGlowId} x="-60%" y="-60%" width="220%" height="220%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter id={edgeGlowId} x="-35%" y="-35%" width="170%" height="170%">
                  <feGaussianBlur stdDeviation="1.2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter id={clusterGlowId} x="-35%" y="-35%" width="170%" height="170%">
                  <feGaussianBlur stdDeviation="7" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <rect
                x={-graphPadX}
                y={-graphPadY}
                width={graphWidth + graphPadX * 2}
                height={graphHeight + graphPadY * 2}
                fill={`url(#${stageGradientId})`}
              />
              <rect
                x={-graphPadX}
                y={-graphPadY}
                width={graphWidth + graphPadX * 2}
                height={graphHeight + graphPadY * 2}
                fill={`url(#${gridPatternId})`}
                opacity={0.4}
              />
              <path
                d={`M 0 ${graphHeight * 0.74} C ${graphWidth * 0.24} ${graphHeight * 0.57}, ${
                  graphWidth * 0.6
                } ${graphHeight * 0.88}, ${graphWidth} ${graphHeight * 0.64}`}
                fill="none"
                stroke="rgba(45,212,191,0.1)"
                strokeWidth={0.8}
              />

              <g transform={`translate(${offset.x / 10} ${offset.y / 10}) scale(${scale})`}>
                {thematicClusters.map((cluster, index) => {
                  const center = layout.clusterCenters[cluster.id];
                  if (!center) {
                    return null;
                  }

                  const palette = getClusterPalette(cluster.id, index);
                  const active = activeCluster.id === cluster.id;
                  const visible = activeClusterIsMaster || active;
                  const label = shortenLabel(getClusterTitle(cluster.title)).toUpperCase();

                  return (
                    <g key={cluster.id} opacity={visible ? 1 : 0.55}>
                      <ellipse
                        cx={center.x}
                        cy={center.y}
                        rx={active ? 62 : 54}
                        ry={active ? 40 : 34}
                        fill={palette.tint}
                        stroke={active ? palette.ring : "rgba(148,163,184,0.16)"}
                        strokeWidth={active ? 1.1 : 0.65}
                        strokeDasharray={active ? undefined : "2 3"}
                        filter={active ? `url(#${clusterGlowId})` : undefined}
                        vectorEffect="non-scaling-stroke"
                      />
                      <circle cx={center.x} cy={center.y} r={3.2} fill={palette.fill} opacity={0.78} />
                      {!compactGraph && (
                        <text
                          x={center.x}
                          y={center.y + (active ? 46 : 40)}
                          textAnchor="middle"
                          className="select-none text-[3.8px] font-semibold uppercase tracking-[0.18em]"
                          fill={active ? palette.text : "rgba(148,163,184,0.62)"}
                        >
                          {label}
                        </text>
                      )}
                    </g>
                  );
                })}

                {layout.networkEdges.map((edge) => {
                  const from = layout.positions[edge.source];
                  const to = layout.positions[edge.target];
                  if (!from || !to) {
                    return null;
                  }

                  const sourceMembership = layout.nodeMembership[edge.source] || [];
                  const targetMembership = layout.nodeMembership[edge.target] || [];
                  const sharedCluster = sourceMembership.find((clusterId) => targetMembership.includes(clusterId));
                  const palette = sharedCluster ? getClusterPalette(sharedCluster) : NEUTRAL_PALETTE;
                  const path = getEdgePath(from, to, edge.id);
                  const isPromptEdge = highlightedNodeSet.has(edge.source) || highlightedNodeSet.has(edge.target);
                  const inSpotlight = spotlightNodeSet.has(edge.source) && spotlightNodeSet.has(edge.target);

                  return (
                    <React.Fragment key={edge.id}>
                      {isPromptEdge && (
                        <path
                          d={path}
                          fill="none"
                          stroke="rgba(248,250,252,0.3)"
                          strokeLinecap="round"
                          strokeWidth={4}
                          filter={`url(#${edgeGlowId})`}
                          vectorEffect="non-scaling-stroke"
                        />
                      )}
                      <path
                        d={path}
                        fill="none"
                        stroke={
                          isPromptEdge
                            ? "rgba(248,250,252,0.86)"
                            : inSpotlight
                              ? palette.edge
                              : "rgba(100,116,139,0.13)"
                        }
                        strokeLinecap="round"
                        strokeWidth={isPromptEdge ? 1.25 : inSpotlight ? 0.78 : 0.44}
                        opacity={isPromptEdge ? 1 : inSpotlight ? 0.88 : 0.72}
                        vectorEffect="non-scaling-stroke"
                      />
                    </React.Fragment>
                  );
                })}

                {discovery.nodes
                  .filter((node) => visibleNodeSet.has(node.id))
                  .map((node: DiscoveryNode) => {
                    const point = layout.positions[node.id];
                    if (!point) {
                      return null;
                    }

                    const memberships = layout.nodeMembership[node.id] || [];
                    const palette = getNodeColor(memberships);
                    const hovered = hoveredNodeId === node.id;
                    const selected = selectedNodeId === node.id;
                    const highlighted = highlightedNodeSet.has(node.id);
                    const spotlighted = activeClusterIsMaster || spotlightNodeSet.has(node.id);
                    const bridged = bridgeNodeSet.has(node.id);
                    const radius = layout.nodeRadii[node.id] || 4.5;
                    const labelPlacement = nodeLabelPlacementMap.get(node.id);
                    const nodeOpacity = spotlighted ? 0.98 : 0.25;

                    return (
                      <g
                        key={node.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`Select ${node.label} as active node`}
                        onMouseEnter={() => setHoveredNodeId(node.id)}
                        onMouseLeave={() => setHoveredNodeId(null)}
                        onFocus={() => setHoveredNodeId(node.id)}
                        onBlur={() => setHoveredNodeId(null)}
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={() => selectActiveNode(node)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            selectActiveNode(node);
                          }
                        }}
                        className="cursor-pointer outline-none"
                      >
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r={radius + (selected || highlighted ? 10 : hovered ? 8 : 6)}
                          fill={selected || highlighted ? "rgba(248,250,252,0.18)" : palette.halo}
                          opacity={selected || highlighted ? 0.74 : hovered ? 0.58 : spotlighted ? 0.28 : 0.08}
                          filter={selected || highlighted || hovered ? `url(#${nodeGlowId})` : undefined}
                        />
                        {bridged && (
                          <circle
                            cx={point.x}
                            cy={point.y}
                            r={radius + 4.5}
                            fill="none"
                            stroke={selected || highlighted ? "rgba(248,250,252,0.76)" : "rgba(226,232,240,0.38)"}
                            strokeDasharray="1.4 1.7"
                            strokeWidth={0.7}
                            opacity={spotlighted ? 0.9 : 0.32}
                            vectorEffect="non-scaling-stroke"
                          />
                        )}
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r={hovered ? radius + 1.9 : radius}
                          fill={selected || highlighted ? "rgba(248,250,252,0.98)" : palette.fill}
                          opacity={nodeOpacity}
                          stroke={selected || highlighted ? "rgba(248,250,252,0.92)" : "rgba(15,23,42,0.36)"}
                          strokeWidth={selected || highlighted ? 0.85 : 0.45}
                          vectorEffect="non-scaling-stroke"
                        />
                        <circle
                          cx={point.x - radius * 0.22}
                          cy={point.y - radius * 0.26}
                          r={Math.max(1.2, radius * 0.33)}
                          fill="rgba(255,255,255,0.44)"
                          opacity={spotlighted ? 0.72 : 0.18}
                        />
                        {labelPlacement && (
                          <g className="pointer-events-none">
                            <rect
                              x={labelPlacement.x - labelPlacement.width / 2}
                              y={labelPlacement.y - 5.5}
                              width={labelPlacement.width}
                              height={9}
                              rx={4.5}
                              fill="rgba(2,6,23,0.78)"
                              stroke={selected || highlighted ? "rgba(248,250,252,0.48)" : palette.ring}
                              strokeWidth={0.55}
                              vectorEffect="non-scaling-stroke"
                            />
                            <text
                              x={labelPlacement.x}
                              y={labelPlacement.y - 0.8}
                              textAnchor="middle"
                              className="select-none fill-slate-100 text-[3.8px] font-semibold"
                            >
                              {labelPlacement.label}
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}
              </g>
            </svg>
          </div>
        </div>

        <aside className="grid content-start gap-4">
          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-5 backdrop-blur">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-teal-200">
              <IconFocusCentered size={15} />
              Active Node
            </div>

            {previewNode ? (
              <>
                <h3 className="mt-4 text-2xl font-semibold leading-tight text-white">{previewNode.label}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">{previewNode.summary}</p>

                <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-400">
                  {previewNode.relatedNodeIds.slice(0, 6).map((relatedId) => (
                    <span
                      key={relatedId}
                      className="rounded-full border border-white/10 bg-slate-950/45 px-3 py-1 text-slate-300"
                    >
                      {nodeLookup.get(relatedId)?.label || relatedId}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-4 text-sm text-slate-400">Select a node to inspect it.</p>
            )}
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-5 backdrop-blur">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-teal-200">
              <IconSparkles size={15} />
              Prompt Jumpstart
            </div>

            <div className="mt-5 grid gap-3">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  className="block w-full rounded-2xl border border-white/10 bg-slate-950/35 px-4 py-3 text-left text-sm leading-6 text-slate-100 transition hover:border-teal-300/60 hover:bg-teal-300/10 focus:border-teal-300/60 focus:outline-none focus:ring-2 focus:ring-teal-300/20"
                  onClick={() => onSelectPrompt(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/35 p-5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              <IconNetwork size={15} />
              Signal Mix
            </div>

            <div className="mt-4 space-y-3">
              {clusterSummaries
                .filter(({ cluster }) => cluster.id !== MASTER_CLUSTER_ID)
                .map(({ cluster, nodeCount, palette, title }) => (
                  <div key={cluster.id}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-xs text-slate-300">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: palette.fill }} />
                        <span className="truncate">{title}</span>
                      </span>
                      <span className="text-slate-500">{nodeCount}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(10, (nodeCount / Math.max(discovery.nodes.length, 1)) * 100)}%`,
                          backgroundColor: palette.fill,
                          boxShadow: `0 0 16px ${palette.glow}`,
                        }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-slate-950/35 p-4 text-sm leading-6 text-slate-400">
            <div className="flex items-start gap-3">
              <IconCirclesRelation className="mt-0.5 shrink-0 text-teal-200" size={17} />
              <span>
                Bridge rings mark concepts that belong to more than one cluster; bright paths are tied to the current
                prompt set.
              </span>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
};
