import fs from "fs";
import path from "path";
import { MPChunk } from "@/types";

type IngestedChunk = MPChunk & {
  id: string;
  source_type: string;
  searchable_text: string;
};

type IngestedPayload = {
  generated_at: string;
  total_count: number;
  chunks: IngestedChunk[];
};

const ingestedPath = path.join(process.cwd(), "data", "memory-palace-ingested.json");

let cachedPayload: IngestedPayload | null = null;
let cachedMtimeMs = 0;

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const uniqueTokens = (value: string): string[] =>
  Array.from(new Set(normalize(value).split(" ").filter((token) => token.length > 1)));

const readPayload = (): IngestedPayload => {
  const stats = fs.statSync(ingestedPath);
  if (!cachedPayload || stats.mtimeMs !== cachedMtimeMs) {
    cachedPayload = JSON.parse(fs.readFileSync(ingestedPath, "utf8")) as IngestedPayload;
    cachedMtimeMs = stats.mtimeMs;
  }
  return cachedPayload;
};

const scoreChunk = (query: string, chunk: IngestedChunk): number => {
  const normalizedQuery = normalize(query);
  const haystack = normalize(chunk.searchable_text || chunk.content);
  const title = normalize(chunk.content_title || "");
  const queryTokens = uniqueTokens(query);

  let score = 0;

  if (normalizedQuery && haystack.includes(normalizedQuery)) {
    score += 12;
  }
  if (normalizedQuery && title.includes(normalizedQuery)) {
    score += 8;
  }

  for (const token of queryTokens) {
    if (title.includes(token)) {
      score += 3;
    } else if (haystack.includes(token)) {
      score += 1.25;
    }
  }

  for (let i = 0; i < queryTokens.length - 1; i += 1) {
    const bigram = `${queryTokens[i]} ${queryTokens[i + 1]}`;
    if (haystack.includes(bigram)) {
      score += 2;
    }
  }

  return score;
};

const dateScore = (value: string): number => {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
};

export const loadIngestedMemoryPalace = (): IngestedPayload => {
  if (!fs.existsSync(ingestedPath)) {
    throw new Error("Ingested memory dataset not found. Run `npm run ingest-memory-palace` first.");
  }
  return readPayload();
};

export const searchLocalMemoryPalace = (query: string, matchCount: number): MPChunk[] => {
  const payload = loadIngestedMemoryPalace();
  const normalizedQuery = normalize(query);

  const ranked = payload.chunks
    .map((chunk) => ({
      chunk,
      score: scoreChunk(query, chunk),
    }))
    .filter(({ score, chunk }) => score > 0 || normalize(chunk.content).includes(normalizedQuery))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return dateScore(b.chunk.content_date) - dateScore(a.chunk.content_date);
    })
    .slice(0, matchCount);

  return ranked.map(({ chunk }) => ({
    content_title: chunk.content_title,
    content_url: chunk.content_url,
    content_date: chunk.content_date,
    content: chunk.content,
    content_length: chunk.content_length,
    content_tokens: chunk.content_tokens,
    embedding: [],
  }));
};
