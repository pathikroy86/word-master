import { getCollection, loadWords, normalizeWord, ObjectId } from "../../../lib/api-server.js";

export default async function handler(req, res) {
    if (req.method !== "GET") {
        res.setHeader("Allow", "GET");
        return res.status(405).json({ error: "Method not allowed" });
    }

    const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
    if (!id) return res.status(400).json({ error: "Word id is required." });

    try {
        const collection = await getCollection();
        let doc = ObjectId.isValid(id) ? await collection.findOne({ _id: new ObjectId(id) }) : null;

        if (!doc) {
            const allWords = await loadWords();
            const match = allWords.find((item) => item.id === id || item.slug === id);
            if (!match) return res.status(404).json({ error: "Word not found" });
            return res.status(200).json(match);
        }

        return res.status(200).json(normalizeWord(doc));
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
