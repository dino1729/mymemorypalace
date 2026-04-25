export type MemoryPalace = {
  title: string;
  url: string;
  date: string;
  content: string;
  length: number;
  tokens: number;
  chunks: MPChunk[];
};

export type MPChunk = {
  content_title: string;
  content_url: string;
  content_date: string;
  content: string;
  content_length: number;
  content_tokens: number;
  embedding: number[];
};

export type MPJSON = {
  current_date: string;
  author: string;
  url: string;
  length: number;
  tokens: number;
  contents: MemoryPalace[];
};

export type DiscoveryNode = {
  id: string;
  slug: string;
  label: string;
  summary: string;
  relatedNodeIds: string[];
};

export type DiscoveryEdge = {
  id: string;
  source: string;
  target: string;
};

export type DiscoveryCluster = {
  id: string;
  title: string;
  nodes: string[];
};

export type ClusterPromptSet = {
  clusterId: string;
  highlightedNodeIds: string[];
  prompts: string[];
  source: "litellm" | "deterministic" | "empty";
};

export type DiscoveryPayload = {
  generatedAt: string;
  stale: boolean;
  model: string;
  embeddingModel: string;
  defaultClusterIds: string[];
  clusters: DiscoveryCluster[];
  nodes: DiscoveryNode[];
  edges: DiscoveryEdge[];
  promptSets: ClusterPromptSet[];
};
