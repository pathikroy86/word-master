import dns from "dns";
import dotenv from "dotenv";
import { MongoClient, ObjectId } from "mongodb";
import { filterAndSortWords, normalizeStatusValue as normalizeStatusFromSearch } from "./word-search.js";

dotenv.config();

if (process.env.DNS_SERVERS) {
    dns.setServers(
        process.env.DNS_SERVERS
            .split(",")
            .map((server) => server.trim())
            .filter(Boolean)
    );
}

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
    throw new Error("MONGODB_URI is required. Add it to .env before running the app.");
}

const globalForMongo = globalThis;
const mongoClient = globalForMongo._wordmasterMongoClient || new MongoClient(mongoUri);
if (!globalForMongo._wordmasterMongoClient) globalForMongo._wordmasterMongoClient = mongoClient;
let collectionPromise;

export function normalizeStatusValue(value) {
    return normalizeStatusFromSearch(value);
}

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

export function normalizeWord(doc, index = 0) {
    const word = String(pick(doc, ["word", "term", "title", "vocabulary", "name"], "Untitled"));
    const meaning = String(
        pick(doc, ["meaning", "meaning_en", "definition", "english", "en", "description", "shortMeaning"], "")
    );
    const synonyms = toArray(pick(doc, ["synonyms", "synonym", "syn", "similar", "similarWords"]));
    const antonyms = toArray(pick(doc, ["antonyms", "antonym", "ant", "opposites", "oppositeWords"]));
    const status = normalizeStatusValue(pick(doc, ["status", "mastery", "stage"], "new"));

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

export function normalizeWordInput(body) {
    const word = String(body.word || "").trim();
    const meaningEn = String(body.meaning_en || body.meaning || "").trim();
    const meaningBn = String(body.meaning_bn || body.bangla || "").trim();
    const synonyms = toArray(body.synonyms);
    const antonyms = toArray(body.antonyms);

    if (!word) {
        return { error: "Word is required." };
    }

    if (!meaningEn) {
        return { error: "English meaning is required." };
    }

    if (!meaningBn) {
        return { error: "Bangla meaning is required." };
    }

    if (!synonyms.length) {
        return { error: "At least one synonym is required." };
    }

    if (!antonyms.length) {
        return { error: "At least one antonym is required." };
    }

    return {
        doc: {
            word,
            meaning_en: meaningEn,
            meaning_bn: meaningBn,
            synonyms,
            antonyms,
            partOfSpeech: String(body.partOfSpeech || body.pos || "").trim() || "adjective",
            pronunciation: String(body.pronunciation || "").trim(),
            example: String(body.example || "").trim(),
            status: normalizeStatusValue(body.status || "new"),
            createdAt: new Date(),
            updatedAt: new Date()
        }
    };
}

export function isWordLike(doc) {
    if (!doc || typeof doc !== "object") return false;
    const keys = Object.keys(doc).map((key) => key.toLowerCase());
    const hasWord = ["word", "term", "title", "vocabulary", "name"].some((key) => keys.includes(key));
    const hasMeaning = ["meaning", "meaning_en", "definition", "english", "description", "shortmeaning"].some((key) =>
        keys.includes(key)
    );
    return hasWord && hasMeaning;
}

async function findCollection() {
    await mongoClient.connect();
    const configuredDb = process.env.MONGODB_DB;
    const configuredCollection = process.env.MONGODB_COLLECTION;

    if (configuredDb && configuredCollection) {
        return mongoClient.db(configuredDb).collection(configuredCollection);
    }

    const uriDb = new URL(mongoUri).pathname.replace("/", "");
    const fallbackDb = configuredDb || uriDb || "test";
    const fallbackCollection = configuredCollection || "words";

    try {
        const databases = configuredDb
            ? [{ name: configuredDb }]
            : (await mongoClient.db().admin().listDatabases()).databases.filter(
                (db) => !["admin", "local", "config"].includes(db.name)
            );

        for (const database of databases) {
            const db = mongoClient.db(database.name);
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

    return mongoClient.db(fallbackDb).collection(fallbackCollection);
}

export async function getCollection() {
    if (!collectionPromise) collectionPromise = findCollection();
    return collectionPromise;
}

export async function loadWords() {
    const collection = await getCollection();
    const docs = await collection.find({}).toArray();
    return docs.map(normalizeWord);
}

export function filterWords(words, query) {
    return filterAndSortWords(words, query);
}

export { ObjectId };
