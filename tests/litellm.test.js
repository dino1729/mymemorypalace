const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getLiteLLMConfig,
  buildChatCompletionRequest,
  buildEmbeddingRequest,
  parseModelList,
} = require("../utils/litellm");

test("getLiteLLMConfig reads required env fields", () => {
  const config = getLiteLLMConfig({
    LITELLM_BASE_URL: "http://litellm.example.test",
    LITELLM_API_KEY: "secret",
    LITELLM_MODEL: "gemini-3-flash-preview",
    LITELLM_EMBEDDING_MODEL: "text-embedding-3-large",
  });

  assert.equal(config.baseUrl, "http://litellm.example.test");
  assert.equal(config.apiKey, "secret");
  assert.equal(config.model, "gemini-3-flash-preview");
  assert.equal(config.embeddingModel, "text-embedding-3-large");
});

test("buildChatCompletionRequest targets the OpenAI-compatible LiteLLM endpoint", () => {
  const request = buildChatCompletionRequest({
    baseUrl: "http://litellm.example.test",
    apiKey: "secret",
    model: "gemini-3-flash-preview",
    messages: [{ role: "user", content: "hello" }],
    stream: true,
    temperature: 0.3,
    max_tokens: 256,
  });

  assert.equal(request.url, "http://litellm.example.test/chat/completions");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers.Authorization, "Bearer secret");
  const body = JSON.parse(request.options.body);
  assert.equal(body.model, "gemini-3-flash-preview");
  assert.equal(body.stream, true);
});

test("buildEmbeddingRequest uses the configured LiteLLM embedding model", () => {
  const request = buildEmbeddingRequest({
    baseUrl: "http://litellm.example.test",
    apiKey: "secret",
    embeddingModel: "text-embedding-3-large",
    input: ["memory palace"],
  });

  assert.equal(request.url, "http://litellm.example.test/embeddings");
  const body = JSON.parse(request.options.body);
  assert.equal(body.model, "text-embedding-3-large");
  assert.deepEqual(body.input, ["memory palace"]);
});

test("parseModelList sorts models and separates embeddings", () => {
  const payload = {
    data: [
      { id: "gemini-3-flash-preview" },
      { id: "text-embedding-3-large" },
      { id: "text-embedding-3-small" },
      { id: "gpt-5.4-mini" },
    ],
  };

  const parsed = parseModelList(payload);

  assert.deepEqual(parsed.embeddingModels, [
    "text-embedding-3-large",
    "text-embedding-3-small",
  ]);
  assert.deepEqual(parsed.chatModels, [
    "gemini-3-flash-preview",
    "gpt-5.4-mini",
  ]);
});
