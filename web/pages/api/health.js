import { getCollection } from "../../lib/api-server.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const collection = await getCollection();
    const count = await collection.countDocuments();
    return res.status(200).json({
      ok: true,
      database: collection.dbName,
      collection: collection.collectionName,
      count
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
