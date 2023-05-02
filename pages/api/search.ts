import { supabaseAdmin } from "@/utils";
const openaiEndpoint = process.env.AZURE_OPENAI_ENDPOINT!;
const openaiEmbedding = process.env.AZURE_OPENAI_EMBEDDING!;
const openaiVersion = process.env.AZURE_OPENAI_VERSION!;
export const config = {
  runtime: "edge"
};

const handler = async (req: Request): Promise<Response> => {

  try {
    const { query, apiKey, matches } = (await req.json()) as {
      query: string;
      apiKey: string;
      matches: number;
    };

    const input = query.replace(/\n/g, " ");

    let url = `${openaiEndpoint}openai/deployments/${openaiEmbedding}/embeddings?api-version=${openaiVersion}`;

    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey
      },
      method: "POST",
      body: JSON.stringify({
        deployment: openaiEmbedding,
        input
      })
    });

    const json = await res.json();
    const embedding = json.data[0].embedding;

    const { data: chunks, error } = await supabaseAdmin.rpc("mp_search", {
      query_embedding: embedding,
      similarity_threshold: 0.01,
      match_count: matches
    });

    if (error) {
      console.error(error);
      return new Response("Error", { status: 500 });
    }

    return new Response(JSON.stringify(chunks), { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response("Error", { status: 500 });
  }
};

export default handler;
