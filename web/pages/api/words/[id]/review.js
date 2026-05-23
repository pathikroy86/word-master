import { getCollection, normalizeStatusValue, normalizeWord, ObjectId } from "../../../../lib/api-server.js";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ error: "Method not allowed" });
    }

    const id = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
    if (!id) return res.status(400).json({ error: "Word id is required." });

    try {
        const status = normalizeStatusValue(req.body?.status || "learning");
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ error: "Review updates require a MongoDB ObjectId." });
        }

        const collection = await getCollection();
        await collection.updateOne(
            { _id: new ObjectId(id) },
            { $set: { status, updatedAt: new Date() } }
        );

        const updated = await collection.findOne({ _id: new ObjectId(id) });
        return res.status(200).json(normalizeWord(updated));
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
