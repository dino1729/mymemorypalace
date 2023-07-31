import { OpenAIModel } from "@/types";
import { createClient } from "@supabase/supabase-js";
import { createParser, ParsedEvent, ReconnectInterval } from "eventsource-parser";

export const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const openaiApiKey = process.env.AZURE_OPENAI_APIKEY!;
const openaiEndpoint = process.env.AZURE_OPENAI_ENDPOINT!;
const openaiModel = process.env.AZURE_OPENAI_MODEL!;
const openaiVersion = process.env.AZURE_OPENAI_VERSION!;

export const OpenAIStream = async (prompt: string) => {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  let url = `${openaiEndpoint}openai/deployments/${openaiModel}/chat/completions?api-version=${openaiVersion}`;
  //console.log(url);
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      "api-key": openaiApiKey
    },
    method: "POST",
    body: JSON.stringify({
      "model": openaiModel,
      "messages": [
        {
          "role": "system",
          "content": "You are an intelligent and helpful assistant that accurately answers queries using my memory palace – a location where my personal learnings are stored. You will be provided with a subset of passages from this memory database, which could contain the most likely answer to my query. Please use the context provided to form your answer, but try to avoid copying word-for-word from the passages. Use your own knowledge database only if you don't find a relavant answer in the provided context and keep your answer concise, using no more than 10 sentences."
        },
        {
          "role": "user",
          "content": prompt,
        },
      ],
      "max_tokens": 840,
      "temperature": 0.4,
      "stream": true,
      "stop": null,
    })
  });

  if (res.status !== 200) {
    const error = new Error(`Azure OpenAI ChatGPT API returned an error with status code ${res.status}`);
    error.stack = await res.text();
    console.error(error);
    throw error;
  }

  const stream = new ReadableStream({
    async start(controller) {

      let timeoutId: NodeJS.Timeout | undefined;
      let isControllerClosed = false;

      const onParse = (event: ParsedEvent | ReconnectInterval) => {
        if (event.type === "event") {
          const data = event.data;

          // if (data === "[DONE]") {
          //   controller.close();
          //   return;
          // }

          // try {
          //   const json = JSON.parse(data);
          //   //console.log(json);
          //   const text = json.choices[0].delta.content;
          //   //const text = json.choices[0].text;
          //   //console.log(text);
          //   const queue = encoder.encode(text);
          //   controller.enqueue(queue);
          // } catch (e) {
          //   controller.error(e);
          // }
          try {
            const json = JSON.parse(data);
            if (json.choices[0].finish_reason != null || data === '[DONE]') {
              if (!isControllerClosed) { // Check if controller is not already closed
                clearTimeout(timeoutId);
                controller.close();
                isControllerClosed = true; // Set the flag to true
              }
              return;
            }
            const text = json.choices[0].delta.content;
            const queue = encoder.encode(text);
            controller.enqueue(queue);
          } catch (e) {
            controller.error(e);
          }

        }
      };

      const parser = createParser(onParse);

      for await (const chunk of res.body as any) {
        parser.feed(decoder.decode(chunk));
      }

      // Set the timeout to close the controller after a specified duration (e.g., 10 seconds)
      const timeoutDuration = 1000; // 1 seconds (adjust as needed)
      timeoutId = setTimeout(() => {
        // Only close the controller if it's not already closed
        if (!isControllerClosed) {
          controller.close();
          isControllerClosed = true; // Set the flag to true
        }
      }, timeoutDuration);

    },
  });

  return stream;
};
