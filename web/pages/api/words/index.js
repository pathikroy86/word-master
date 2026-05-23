import { getCollection, loadWords, filterWords, normalizeWordInput, normalizeWord } from "../../../lib/api-server.js";

export default async function handler(req, res) {
    if (req.method === "GET") {
        try {
            const limit = Math.min(Number(req.query.limit || 20), 200);
            const skip = Math.max(Number(req.query.skip || 0), 0);
            const allWords = await loadWords();
            const filtered = filterWords(allWords, req.query);

            return res.status(200).json({
                items: filtered.slice(skip, skip + limit),
                total: filtered.length,
                skip,
                limit,
                page: Math.floor(skip / limit) + 1,
                pages: Math.max(Math.ceil(filtered.length / limit), 1)
            });
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }

    if (req.method === "POST") {
        try {
            const parsed = normalizeWordInput(req.body || {});
            if (parsed.error) return res.status(400).json({ error: parsed.error });

            const collection = await getCollection();
            const existing = await collection.findOne({ word: new RegExp(`^${parsed.doc.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") });
            if (existing) {
                return res.status(409).json({ error: "This word already exists." });
            }

            const result = await collection.insertOne(parsed.doc);
            const inserted = await collection.findOne({ _id: result.insertedId });
            return res.status(201).json(normalizeWord(inserted));
        } catch (error) {
            return res.status(500).json({ error: error.message });
        }
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
}
