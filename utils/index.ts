import { createParser, ParsedEvent, ReconnectInterval } from "eventsource-parser";

const { buildChatCompletionRequest, getLiteLLMConfig, LiteLLMError } = require("./litellm");

const SYSTEM_PROMPT =
  "You are an intelligent and helpful assistant that answers using the user's Memory Palace. Prefer the retrieved passages, synthesize them in your own words, and keep the answer concise but useful.";

const createTextStream = (text: string) => {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
};

const normalizeForMatch = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const buildFallbackAnswer = (prompt: string) => {
  const queryMatch = prompt.match(/query:\s*"([^"]+)"/i);
  const query = queryMatch?.[1] ?? "";
  const normalizedQuery = normalizeForMatch(query);
  const queryTokens = Array.from(new Set(normalizedQuery.split(" ").filter((token) => token.length > 1)));

  const passageSection = prompt.replace(/^.*?["”]\s*/s, "");
  const sentences = passageSection
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter((sentence) => sentence.length > 40);

  const ranked = sentences
    .map((sentence) => {
      const normalizedSentence = normalizeForMatch(sentence);
      let score = 0;

      if (normalizedQuery && normalizedSentence.includes(normalizedQuery)) {
        score += 10;
      }

      for (const token of queryTokens) {
        if (normalizedSentence.includes(token)) {
          score += 1;
        }
      }

      return { sentence, score };
    })
    .sort((a, b) => b.score - a.score);

  const bestSentences = ranked
    .filter((item) => item.score > 0)
    .slice(0, 3)
    .map((item) => item.sentence);

  if (bestSentences.length === 0) {
    return "I couldn't reach the configured LiteLLM server, so I'm falling back to your imported memory passages. Use the retrieved passages below as the source of truth for this query.";
  }

  return [
    "I couldn't reach the configured LiteLLM server, so this answer is a direct synthesis from your local Memory Palace.",
    bestSentences.join(" "),
  ].join("\n\n");
};

export const createAnswerStream = async (prompt: string) => {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  try {
    const config = getLiteLLMConfig(process.env);
    const request = buildChatCompletionRequest({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: config.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      stream: true,
      temperature: 0.3,
      max_tokens: 2048,
    });

    const response = await fetch(request.url, request.options);

    if (!response.ok) {
      let payload = null;
      try {
        payload = await response.json();
      } catch (_error) {
        payload = null;
      }

      const message =
        payload?.error?.message ||
        payload?.message ||
        `LiteLLM request failed with status ${response.status}`;
      throw new LiteLLMError(message, response.status, payload);
    }

    const stream = new ReadableStream({
      async start(controller) {
        const onParse = (event: ParsedEvent | ReconnectInterval) => {
          if (event.type !== "event") {
            return;
          }

          const data = event.data;
          if (data === "[DONE]") {
            controller.close();
            return;
          }

          try {
            const json = JSON.parse(data);
            const text = json.choices?.[0]?.delta?.content;

            if (json.choices?.[0]?.finish_reason != null) {
              controller.close();
              return;
            }

            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          } catch (error) {
            console.error("Error processing LiteLLM stream chunk:", error);
            controller.close();
          }
        };

        const parser = createParser(onParse);
        for await (const chunk of response.body as any) {
          parser.feed(decoder.decode(chunk));
        }
      },
    });

    return stream;
  } catch (error) {
    console.error("Falling back to local answer stream:", error);
    return createTextStream(buildFallbackAnswer(prompt));
  }
};
