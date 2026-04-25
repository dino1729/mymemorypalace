import type { NextApiRequest, NextApiResponse } from "next";
import { searchLocalMemoryPalace } from "@/utils/localMemoryPalace";

const handler = (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).send("Method Not Allowed");
  }

  try {
    const { query, matches } = req.body as {
      query?: string;
      matches?: number;
    };

    if (!query?.trim()) {
      return res.status(400).send("Query is required");
    }

    const chunks = searchLocalMemoryPalace(query, Math.max(1, Math.min(matches ?? 5, 10)));
    return res.status(200).json(chunks);
  } catch (error) {
    console.error(error);
    return res.status(500).send("Error");
  }
};

export default handler;
