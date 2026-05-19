const cors = require("cors");
const dns = require("dns");
const dotenv = require("dotenv");
const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");

dotenv.config();

if (process.env.DNS_SERVERS) {
  dns.setServers(process.env.DNS_SERVERS.split(",").map((server) => server.trim()).filter(Boolean));
}

const app = express();
const port = Number(process.env.PORT || 4000);
const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  throw new Error("MONGODB_URI is required. Add it to .env before starting the server.");
}

app.use(cors({ origin: process.env.WEB_ORIGIN || "http://localhost:3000" }));
app.use(express.json());

const client = new MongoClient(mongoUri);
let collectionPromise;

const synonymKeys = ["synonyms", "synonym", "syn", "similar", "similarWords"];
const antonymKeys = ["antonyms", "antonym", "ant", "opposites", "oppositeWords"];

function toArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/[,;|]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function pick(doc, keys, fallback = "") {
  for (const key of keys) {
    if (doc[key] !== undefined && doc[key] !== null && doc[key] !== "") return doc[key];
  }
  return fallback;
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeWord(doc, index = 0) {
  const word = String(pick(doc, ["word", "term", "title", "vocabulary", "name"], "Untitled"));
  const meaning = String(
    pick(doc, ["meaning", "meaning_en", "definition", "english", "en", "description", "shortMeaning"], "")
  );
  const synonyms = toArray(pick(doc, synonymKeys));
  const antonyms = toArray(pick(doc, antonymKeys));
  const status = String(pick(doc, ["status", "mastery", "stage"], index % 5 === 0 ? "mastered" : index % 3 === 0 ? "learning" : "new"))
    .toLowerCase()
    .replace("learned", "mastered");

  return {
    id: String(doc._id),
    slug: slugify(word),
    word,
    partOfSpeech: String(pick(doc, ["partOfSpeech", "pos", "type"], "adjective")),
    pronunciation: String(pick(doc, ["pronunciation", "phonetic", "ipa"], "")),
    meaning,
    bangla: String(pick(doc, ["bangla", "meaning_bn", "bengali", "bn", "বাংলা"], "")),
    synonyms,
    antonyms,
    example: String(pick(doc, ["example", "sentence", "exampleSentence"], "")),
    status,
    frequencyRank: Number(pick(doc, ["frequencyRank", "rank", "serial", "index"], index + 1)),
    raw: doc
  };
}

function isWordLike(doc) {
  if (!doc || typeof doc !== "object") return false;
  const keys = Object.keys(doc).map((key) => key.toLowerCase());
  const hasWord = ["word", "term", "title", "vocabulary", "name"].some((key) => keys.includes(key));
  const hasMeaning = ["meaning", "meaning_en", "definition", "english", "description", "shortmeaning"].some((key) => keys.includes(key));
  return hasWord && hasMeaning;
}

async function findCollection() {
  await client.connect();

  const configuredDb = process.env.MONGODB_DB;
  const configuredCollection = process.env.MONGODB_COLLECTION;

  if (configuredDb && configuredCollection) {
    return client.db(configuredDb).collection(configuredCollection);
  }

  const uriDb = new URL(mongoUri).pathname.replace("/", "");
  const fallbackDb = configuredDb || uriDb || "test";
  const fallbackCollection = configuredCollection || "words";

  try {
    const databases = configuredDb
      ? [{ name: configuredDb }]
      : (await client.db().admin().listDatabases()).databases.filter(
          (db) => !["admin", "local", "config"].includes(db.name)
        );

    for (const database of databases) {
      const db = client.db(database.name);
      const collections = configuredCollection
        ? [{ name: configuredCollection }]
        : await db.listCollections({}, { nameOnly: true }).toArray();

      for (const collectionInfo of collections) {
        const candidate = db.collection(collectionInfo.name);
        const sample = await candidate.findOne({});
        if (isWordLike(sample)) return candidate;
      }
    }
  } catch (error) {
    console.warn("Collection auto-detect failed; falling back to configured defaults.", error.message);
  }

  return client.db(fallbackDb).collection(fallbackCollection);
}

async function getCollection() {
  if (!collectionPromise) collectionPromise = findCollection();
  return collectionPromise;
}

async function loadWords() {
  const collection = await getCollection();
  const docs = await collection.find({}).limit(3000).toArray();
  return docs.map(normalizeWord);
}

function filterWords(words, query) {
  let results = words;
  const search = String(query.search || "").trim().toLowerCase();
  const status = String(query.status || "all").toLowerCase();
  const sort = String(query.sort || "rank").toLowerCase();

  if (search) {
    results = results.filter((item) => {
      const haystack = [
        item.word,
        item.meaning,
        item.bangla,
        item.partOfSpeech,
        item.synonyms.join(" "),
        item.antonyms.join(" ")
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    });
  }

  if (status !== "all") {
    results = results.filter((item) => item.status === status);
  }

  return results.sort((a, b) => {
    if (sort === "alpha-desc") return b.word.localeCompare(a.word);
    if (sort === "alpha-asc" || sort === "alphabetical") return a.word.localeCompare(b.word);
    return a.frequencyRank - b.frequencyRank || a.word.localeCompare(b.word);
  });
}

app.get("/api/health", async (_req, res) => {
  try {
    const collection = await getCollection();
    const count = await collection.estimatedDocumentCount();
    res.json({
      ok: true,
      database: collection.dbName,
      collection: collection.collectionName,
      count
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/api/words", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 20), 200);
    const skip = Math.max(Number(req.query.skip || 0), 0);
    const allWords = await loadWords();
    const filtered = filterWords(allWords, req.query);

    res.json({
      items: filtered.slice(skip, skip + limit),
      total: filtered.length,
      skip,
      limit,
      page: Math.floor(skip / limit) + 1,
      pages: Math.max(Math.ceil(filtered.length / limit), 1)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/words/:id", async (req, res) => {
  try {
    const collection = await getCollection();
    const { id } = req.params;
    let doc = ObjectId.isValid(id) ? await collection.findOne({ _id: new ObjectId(id) }) : null;

    if (!doc) {
      const allWords = await loadWords();
      const match = allWords.find((item) => item.id === id || item.slug === id);
      if (!match) return res.status(404).json({ error: "Word not found" });
      return res.json(match);
    }

    res.json(normalizeWord(doc));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/stats", async (_req, res) => {
  try {
    const words = await loadWords();
    const total = words.length;
    const mastered = words.filter((item) => item.status === "mastered").length;
    const learning = words.filter((item) => item.status === "learning" || item.status === "review").length;
    const newWords = Math.max(total - mastered - learning, 0);

    res.json({
      total,
      mastered,
      learning,
      new: newWords,
      learned: mastered + learning,
      accuracy: total ? Math.round((mastered / total) * 100) : 0,
      dueToday: Math.min(52, learning + newWords),
      streak: 7
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/words/:id/review", async (req, res) => {
  try {
    const collection = await getCollection();
    const { id } = req.params;
    const status = String(req.body.status || "learning").toLowerCase();

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Review updates require a MongoDB ObjectId." });
    }

    await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status, updatedAt: new Date() } }
    );

    const updated = await collection.findOne({ _id: new ObjectId(id) });
    res.json(normalizeWord(updated));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`GRE WordMaster API listening on http://localhost:${port}`);
});
