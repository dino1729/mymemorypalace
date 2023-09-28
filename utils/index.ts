import { OpenAIModel } from "@/types";
import { createClient } from "@supabase/supabase-js";
import { createParser, ParsedEvent, ReconnectInterval } from "eventsource-parser";

export const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const openaiApiKey = process.env.AZURE_OPENAI_APIKEY!;
const openaiEndpoint = process.env.AZURE_OPENAI_ENDPOINT!;
const openaiModel = process.env.AZURE_OPENAI_MODEL!;
const openaiVersion = process.env.AZURE_OPENAI_VERSION!;

export class OpenAIError extends Error {
  type: string;
  param: string;
  code: string;

  constructor(message: string, type: string, param: string, code: string) {
    super(message);
    this.name = 'OpenAIError';
    this.type = type;
    this.param = param;
    this.code = code;
  }
}

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
          "content": "You are an intelligent and helpful assistant that accurately answers queries using my memory palace – a location where my personal learnings are stored. You will be provided with a subset of passages from this memory database, which could contain the most likely answer to my query. Please use the context provided to form your answer, but try to avoid copying word-for-word from the passages. Use your own knowledge database only if you don't find a relavant answer in the provided context and keep your answer concise."
        },
        {
          "role": "user",
          "content": prompt,
        },
      ],
      "max_tokens": 2048,
      "temperature": 0.3,
      "stream": true,
    })
  });

  if (res.status !== 200) {
    const result = await res.json();
    if (result.error) {
      throw new OpenAIError(
        result.error.message,
        result.error.type,
        result.error.param,
        result.error.code,
      );
    } else {
      throw new Error(
        `OpenAI API returned an error: ${
          decoder.decode(result?.value) || result.statusText
        }`,
      );
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      const onParse = (event: ParsedEvent | ReconnectInterval) => {
        if (event.type === 'event') {
          const data = event.data;
  
          // console.log(data);
          // console.log('--------------------');

          if (data === '[DONE]') {
            console.log("End of stream");
            return;
          }
  
          try {
            const json = JSON.parse(data);
  
            if (json.choices[0]) {
              if (json.choices[0].finish_reason != null) {
                controller.close();
                return;
              }
              const text = json.choices[0].delta.content;
              const queue = encoder.encode(text);
              controller.enqueue(queue);
            }
          } catch (e) {
            // Handle JSON parsing or other errors more gracefully
            console.error('Error processing JSON data:', e);
  
            // Close the controller when a JSON parsing error occurs
            controller.close();
            return;
          }
        }
      };
  
      const parser = createParser(onParse);
  
      for await (const chunk of res.body as any) {
        parser.feed(decoder.decode(chunk));
      }
    },
  });

  return stream;
};
