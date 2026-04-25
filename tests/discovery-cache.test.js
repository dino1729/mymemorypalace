const test = require("node:test");
const assert = require("node:assert/strict");

const { isReusableCache } = require("../utils/discovery");

test("isReusableCache accepts fresh cache with matching graph and model config", () => {
  const cache = {
    graphHash: "abc",
    generatedAt: new Date().toISOString(),
    model: "gemini-3-flash-preview",
    embeddingModel: "text-embedding-3-large",
  };

  assert.equal(
    isReusableCache(cache, {
      graphHash: "abc",
      model: "gemini-3-flash-preview",
      embeddingModel: "text-embedding-3-large",
    }),
    true,
  );
});

test("isReusableCache rejects cache when model config changes", () => {
  const cache = {
    graphHash: "abc",
    generatedAt: new Date().toISOString(),
    model: "qwen3-coder-480b-a35b-instruct",
    embeddingModel: "text-embedding-3-large",
  };

  assert.equal(
    isReusableCache(cache, {
      graphHash: "abc",
      model: "gemini-3-flash-preview",
      embeddingModel: "text-embedding-3-large",
    }),
    false,
  );
});
