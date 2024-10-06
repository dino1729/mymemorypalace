// export enum OpenAIModel {
//   GPT35_TURBO_16K = "gpt-4o-mini",
//   GPT4 = "gpt-4",
// }
export type OpenAIModel = 'gpt-4o-mini' | 'gpt-4';

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
