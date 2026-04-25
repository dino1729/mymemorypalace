import type { NextApiRequest, NextApiResponse } from "next";

const { getDiscoveryPayload } = require("../../utils/discovery");

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).send("Method Not Allowed");
  }

  try {
    const payload = await getDiscoveryPayload();
    return res.status(200).json(payload);
  } catch (error) {
    console.error(error);
    return res.status(500).send("Error");
  }
};

export default handler;
