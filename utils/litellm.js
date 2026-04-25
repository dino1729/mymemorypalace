const DEFAULT_BASE_URL = "http://localhost:4000";
const DEFAULT_MODEL = "gemini-3-flash-preview";
const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-large";

const trimTrailingSlash = (value) => value.replace(/\/+$/, "");

const getLiteLLMConfig = (env = process.env) => {
  const baseUrl = trimTrailingSlash(env.LITELLM_BASE_URL || DEFAULT_BASE_URL);
  const apiKey = env.LITELLM_API_KEY || "";
  const model = env.LITELLM_MODEL || DEFAULT_MODEL;
  const embeddingModel = env.LITELLM_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;

  return {
    baseUrl,
    apiKey,
    model,
    embeddingModel,
  };
};

const buildJsonRequest = ({ url, apiKey, body }) => ({
  url,
  options: {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  },
});

const buildChatCompletionRequest = ({
  baseUrl,
  apiKey,
  model,
  messages,
  stream = false,
  temperature = 0.3,
  max_tokens = 2048,
}) =>
  buildJsonRequest({
    url: `${trimTrailingSlash(baseUrl)}/chat/completions`,
    apiKey,
    body: {
      model,
      messages,
      stream,
      temperature,
      max_tokens,
    },
  });

const buildEmbeddingRequest = ({
  baseUrl,
  apiKey,
  embeddingModel,
  input,
}) =>
  buildJsonRequest({
    url: `${trimTrailingSlash(baseUrl)}/embeddings`,
    apiKey,
    body: {
      model: embeddingModel,
      input,
    },
  });

const parseModelList = (payload) => {
  const models = Array.isArray(payload?.data) ? payload.data.map((item) => item.id).filter(Boolean) : [];
  const embeddingModels = models.filter((model) => model.includes("embedding")).sort();
  const chatModels = models.filter((model) => !model.includes("embedding")).sort();

  return {
    models,
    embeddingModels,
    chatModels,
  };
};

class LiteLLMError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = "LiteLLMError";
    this.status = status;
    this.payload = payload;
  }
}

const readErrorPayload = async (response) => {
  try {
    return await response.json();
  } catch (_error) {
    return null;
  }
};

const ensureSuccess = async (response) => {
  if (response.ok) {
    return response;
  }

  const payload = await readErrorPayload(response);
  const message =
    payload?.error?.message ||
    payload?.message ||
    `LiteLLM request failed with status ${response.status}`;
  throw new LiteLLMError(message, response.status, payload);
};

const createChatCompletion = async ({
  messages,
  stream = false,
  model,
  fetchImpl = fetch,
  env = process.env,
  temperature = 0.3,
  max_tokens = 2048,
}) => {
  const config = getLiteLLMConfig(env);
  const request = buildChatCompletionRequest({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    model: model || config.model,
    messages,
    stream,
    temperature,
    max_tokens,
  });

  const response = await fetchImpl(request.url, request.options);
  return ensureSuccess(response);
};

const createEmbedding = async ({
  input,
  model,
  fetchImpl = fetch,
  env = process.env,
}) => {
  const config = getLiteLLMConfig(env);
  const request = buildEmbeddingRequest({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    embeddingModel: model || config.embeddingModel,
    input,
  });

  const response = await fetchImpl(request.url, request.options);
  const successfulResponse = await ensureSuccess(response);
  return successfulResponse.json();
};

const fetchLiteLLMModels = async ({
  fetchImpl = fetch,
  env = process.env,
}) => {
  const config = getLiteLLMConfig(env);
  const response = await fetchImpl(`${config.baseUrl}/models`, {
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
  });
  const successfulResponse = await ensureSuccess(response);
  return successfulResponse.json();
};

module.exports = {
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
  DEFAULT_EMBEDDING_MODEL,
  LiteLLMError,
  getLiteLLMConfig,
  buildChatCompletionRequest,
  buildEmbeddingRequest,
  parseModelList,
  createChatCompletion,
  createEmbedding,
  fetchLiteLLMModels,
};
