import fs from "fs";
import path from "path";

type LocalMemoryChunk = {
  id: string;
  source_type: "lesson" | "archive" | "memory";
  content_title: string;
  content_url: string;
  content_date: string;
  content: string;
  content_length: number;
  content_tokens: number;
  searchable_text: string;
};

type DocstoreRecord = {
  __data__: {
    text: string;
    metadata: Record<string, unknown>;
  };
};

type IngestedMemoryPalace = {
  generated_at: string;
  total_count: number;
  source_counts: Record<string, number>;
  chunks: LocalMemoryChunk[];
};

const rootDir = process.cwd();
const memoryRoot = path.join(rootDir, "memory_palace");
const outputDir = path.join(rootDir, "data");
const outputPath = path.join(outputDir, "memory-palace-ingested.json");

const readJson = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, "utf8")) as T;

const normalizeWhitespace = (value: unknown): string =>
  String(value ?? "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();

const toDate = (value: unknown): string => {
  const text = String(value ?? "").trim();
  if (!text) {
    return "";
  }
  return text.slice(0, 10);
};

const titleFromCategory = (category: unknown): string => {
  const raw = String(category ?? "lesson").trim();
  if (!raw) {
    return "Lesson";
  }
  return `${raw.charAt(0).toUpperCase()}${raw.slice(1)} Lesson`;
};

const toTokenCount = (value: string): number => {
  const trimmed = value.trim();
  if (!trimmed) {
    return 0;
  }
  return trimmed.split(/\s+/).length;
};

const maybeUrl = (value: unknown): string => {
  const text = String(value ?? "").trim();
  return /^https?:\/\//i.test(text) ? text : "";
};

const lessonsPath = path.join(memoryRoot, "lessons_index", "docstore.json");
const archivePath = path.join(memoryRoot, "archive_index", "docstore.json");
const vectorPath = path.join(memoryRoot, "litellm__text-embedding-3-large", "vector_store.json");

const chunks: LocalMemoryChunk[] = [];
const seen = new Set<string>();

const pushChunk = (chunk: LocalMemoryChunk) => {
  const dedupeKey = `${chunk.source_type}:${chunk.content_title}:${chunk.content.slice(0, 240)}`;
  if (seen.has(dedupeKey)) {
    return;
  }
  seen.add(dedupeKey);
  chunks.push(chunk);
};

if (fs.existsSync(lessonsPath)) {
  const docstore = readJson<{ "docstore/data": Record<string, DocstoreRecord> }>(lessonsPath);
  Object.values(docstore["docstore/data"]).forEach((record) => {
    const metadata = record.__data__.metadata;
    const content = normalizeWhitespace(record.__data__.text || metadata.original_input || "");
    if (!content) {
      return;
    }

    const searchable = normalizeWhitespace(
      [
        content,
        metadata.original_input,
        metadata.category,
        metadata.tags,
        metadata.source,
      ].join("\n"),
    );

    pushChunk({
      id: String(metadata.id ?? crypto.randomUUID()),
      source_type: "lesson",
      content_title: titleFromCategory(metadata.category),
      content_url: "",
      content_date: toDate(metadata.created_at),
      content,
      content_length: content.length,
      content_tokens: toTokenCount(content),
      searchable_text: searchable,
    });
  });
}

if (fs.existsSync(archivePath)) {
  const docstore = readJson<{ "docstore/data": Record<string, DocstoreRecord> }>(archivePath);
  Object.values(docstore["docstore/data"]).forEach((record) => {
    const metadata = record.__data__.metadata;
    const content = normalizeWhitespace(
      [
        metadata.summary,
        metadata.takeaways,
        metadata.content_preview,
      ].join("\n\n"),
    );
    if (!content) {
      return;
    }

    const title = normalizeWhitespace(metadata.title || "Archived Memory");
    const searchable = normalizeWhitespace(
      [
        title,
        content,
        metadata.author,
        metadata.source_domain,
        metadata.tags,
      ].join("\n"),
    );

    pushChunk({
      id: String(metadata.id ?? crypto.randomUUID()),
      source_type: "archive",
      content_title: title,
      content_url: maybeUrl(metadata.url),
      content_date: toDate(metadata.publish_date || metadata.indexed_at),
      content,
      content_length: content.length,
      content_tokens: toTokenCount(content),
      searchable_text: searchable,
    });
  });
}

if (fs.existsSync(vectorPath)) {
  const vectorStore = readJson<Record<string, { text: string; metadata: Record<string, unknown> }>>(vectorPath);
  Object.values(vectorStore).forEach((record) => {
    const metadata = record.metadata ?? {};
    const content = normalizeWhitespace(record.text);
    if (!content) {
      return;
    }

    const title = normalizeWhitespace(metadata.source_title || "Saved Memory");
    const searchable = normalizeWhitespace(
      [
        title,
        content,
        metadata.source_type,
        metadata.source_ref,
      ].join("\n"),
    );

    pushChunk({
      id: crypto.randomUUID(),
      source_type: "memory",
      content_title: title,
      content_url: maybeUrl(metadata.source_ref),
      content_date: toDate(metadata.created_at),
      content,
      content_length: content.length,
      content_tokens: toTokenCount(content),
      searchable_text: searchable,
    });
  });
}

const payload: IngestedMemoryPalace = {
  generated_at: new Date().toISOString(),
  total_count: chunks.length,
  source_counts: chunks.reduce<Record<string, number>>((acc, chunk) => {
    acc[chunk.source_type] = (acc[chunk.source_type] ?? 0) + 1;
    return acc;
  }, {}),
  chunks,
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2));

console.log(`Ingested ${payload.total_count} memory items to ${outputPath}`);
console.log(payload.source_counts);
