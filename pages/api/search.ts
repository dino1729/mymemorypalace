import { supabaseAdmin } from "@/utils";
const openaiApiKey = process.env.AZURE_OPENAI_APIKEY!;
const openaiEndpoint = process.env.AZURE_OPENAI_ENDPOINT!;
const openaiEmbedding = process.env.AZURE_OPENAI_EMBEDDING!;
const openaiVersion = process.env.AZURE_OPENAI_VERSION!;
export const config = {
  runtime: "edge"
};

const handler = async (req: Request): Promise<Response> => {

  try {
    const { query, matches } = (await req.json()) as {
      query: string;
      matches: number;
    };

    const input = query.replace(/\n/g, " ");

    let url = `${openaiEndpoint}openai/deployments/${openaiEmbedding}/embeddings?api-version=2022-12-01`;

    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        "api-key": openaiApiKey
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
      similarity_threshold: 0.05,
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
