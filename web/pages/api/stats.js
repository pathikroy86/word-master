import { loadWords } from "../../lib/api-server.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const words = await loadWords();
    const total = words.length;
    const mastered = words.filter((item) => item.status === "mastered").length;
    const learning = words.filter((item) => item.status === "learning").length;
    const newWords = Math.max(total - mastered - learning, 0);
    const reviewed = mastered + learning;

    return res.status(200).json({
      total,
      mastered,
      learning,
      new: newWords,
      learned: mastered,
      accuracy: reviewed ? Math.round((mastered / reviewed) * 100) : 0,
      dueToday: learning,
      streak: 7
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
