import bcrypt from "bcryptjs";
import cors from "cors";
import crypto from "crypto";
import express from "express";
import jwt from "jsonwebtoken";
import { ObjectId } from "mongodb";
import {
  filterWords,
  getCollection,
  loadWords,
  normalizeStatusValue,
  normalizeWord,
  normalizeWordInput
} from "../web/lib/api-server.js";

const app = express();
const port = Number(process.env.PORT || 4000);
const jwtSecret = process.env.JWT_SECRET || "wordmaster-dev-secret-change-me";
const authDbName = process.env.AUTH_MONGODB_DB || process.env.MONGODB_DB || "gre_word_master";
const usersCollectionName = process.env.AUTH_USERS_COLLECTION || "users";
const progressCollectionName = process.env.AUTH_PROGRESS_COLLECTION || "word_progress";
const verificationCollectionName = process.env.AUTH_VERIFICATION_COLLECTION || "auth_verifications";
const emailFrom = process.env.EMAIL_FROM || "WordMaster <onboarding@resend.dev>";

app.use(cors());
app.use(express.json({ limit: "1mb" }));

async function getDb() {
  const words = await getCollection();
  return words.db.client.db(authDbName);
}

async function getUsersCollection() {
  return (await getDb()).collection(usersCollectionName);
}

async function getProgressCollection() {
  return (await getDb()).collection(progressCollectionName);
}

async function getVerificationCollection() {
  return (await getDb()).collection(verificationCollectionName);
}

function publicUser(user) {
  return {
    id: String(user._id || user.id),
    email: user.email,
    name: user.name || "",
    image: user.image || "",
    streakGoal: Number(user.streakGoal || 7),
    emailVerified: Boolean(user.emailVerified)
  };
}

function signToken(user) {
  return jwt.sign(publicUser(user), jwtSecret, { expiresIn: "30d" });
}

function isDatabaseConnectionError(error) {
  return /querySrv|ENOTFOUND|ETIMEOUT|ECONNREFUSED|server selection/i.test(error?.message || "");
}

function sendServerError(res, error, fallback = "Server error.") {
  const databaseError = isDatabaseConnectionError(error);
  res.status(databaseError ? 503 : 500).json({
    error: databaseError
      ? "Database connection unavailable. Check your MongoDB Atlas connection and DNS settings."
      : error?.message || fallback
  });
}

function createVerificationCode() {
  return String(crypto.randomInt(100000, 1000000));
}

async function sendEmail({ to, subject, text }) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[dev email] ${subject} for ${to}: ${text}`);
    return { devOnly: true };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: emailFrom,
      to,
      subject,
      text
    })
  });

  if (!response.ok) {
    throw new Error(`Email delivery failed: ${await response.text()}`);
  }

  return response.json();
}

async function saveVerificationCode(email, purpose) {
  const code = createVerificationCode();
  const codes = await getVerificationCollection();
  await codes.createIndex({ email: 1, purpose: 1, used: 1, expiresAt: 1 });
  await codes.insertOne({
    email,
    purpose,
    codeHash: await bcrypt.hash(code, 10),
    used: false,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    createdAt: new Date()
  });
  return code;
}

async function verifyCode(email, purpose, code) {
  const codes = await getVerificationCollection();
  const record = await codes.findOne(
    { email, purpose, used: false, expiresAt: { $gt: new Date() } },
    { sort: { createdAt: -1 } }
  );

  if (!record || !(await bcrypt.compare(String(code || ""), record.codeHash || ""))) {
    return false;
  }

  await codes.updateOne({ _id: record._id }, { $set: { used: true, usedAt: new Date() } });
  return true;
}

async function authMiddleware(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return next();

  try {
    req.user = jwt.verify(token, jwtSecret);
  } catch {
    req.user = null;
  }

  next();
}

function requireAuth(req, res, next) {
  if (!req.user?.id) return res.status(401).json({ error: "Authentication required." });
  next();
}

async function mergeUserProgress(words, userId) {
  if (!userId) return words;
  const progress = await (await getProgressCollection()).find({ userId }).toArray();
  const byWordId = new Map(progress.map((item) => [item.wordId, item]));

  return words.map((word) => {
    const item = byWordId.get(word.id);
    return item
      ? { ...word, status: item.status || word.status, saved: Boolean(item.saved) }
      : word;
  });
}

async function getMergedWord(id, userId) {
  const collection = await getCollection();
  const doc = ObjectId.isValid(id) ? await collection.findOne({ _id: new ObjectId(id) }) : null;

  let word = doc ? normalizeWord(doc) : null;
  if (!word) {
    const allWords = await loadWords();
    word = allWords.find((item) => item.id === id || item.slug === id) || null;
  }
  if (!word || !userId) return word;

  const item = await (await getProgressCollection()).findOne({ userId, wordId: word.id });
  return item ? { ...word, status: item.status || word.status, saved: Boolean(item.saved) } : word;
}

app.use(authMiddleware);

app.get("/api", (_req, res) => {
  res.json({
    ok: true,
    name: "WordMaster API",
    routes: [
      "GET /api/health",
      "POST /api/auth/send-verification",
      "POST /api/auth/register",
      "POST /api/auth/login",
      "POST /api/auth/forgot-password",
      "POST /api/auth/reset-password",
      "GET /api/auth/me",
      "GET /api/words",
      "GET /api/words/:id",
      "POST /api/words/:id/review",
      "POST /api/words/:id/save",
      "GET /api/stats"
    ]
  });
});

app.post("/api/auth/send-verification", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) return res.status(400).json({ error: "A valid email is required." });

    const users = await getUsersCollection();
    await users.createIndex({ email: 1 }, { unique: true });
    const existing = await users.findOne({ email });
    if (existing) return res.status(409).json({ error: "An account already exists for this email." });

    const code = await saveVerificationCode(email, "register");
    const result = await sendEmail({
      to: email,
      subject: "Verify your WordMaster email",
      text: `Your WordMaster verification code is ${code}. It expires in 10 minutes.`
    });

    res.json({
      ok: true,
      message: "Verification code sent.",
      devCode: result?.devOnly ? code : undefined
    });
  } catch (error) {
    sendServerError(res, error, "Could not send verification code.");
  }
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const name = String(req.body?.name || "").trim();
    const verificationCode = String(req.body?.verificationCode || "").trim();

    if (!email || !email.includes("@")) return res.status(400).json({ error: "A valid email is required." });
    if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });
    if (!verificationCode) return res.status(400).json({ error: "Email verification code is required." });

    const users = await getUsersCollection();
    await users.createIndex({ email: 1 }, { unique: true });

    const existing = await users.findOne({ email });
    if (existing) return res.status(409).json({ error: "An account already exists for this email." });
    if (!(await verifyCode(email, "register", verificationCode))) {
      return res.status(400).json({ error: "Invalid or expired verification code." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await users.insertOne({
      email,
      name,
      passwordHash,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const user = await users.findOne({ _id: result.insertedId });

    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (error) {
    sendServerError(res, error, "Registration failed.");
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const user = await (await getUsersCollection()).findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.passwordHash || ""))) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (error) {
    sendServerError(res, error, "Login failed.");
  }
});

app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) return res.status(400).json({ error: "A valid email is required." });

    const users = await getUsersCollection();
    const existing = await users.findOne({ email });

    if (existing) {
      const code = await saveVerificationCode(email, "reset");
      const result = await sendEmail({
        to: email,
        subject: "Reset your WordMaster password",
        text: `Your WordMaster password reset code is ${code}. It expires in 10 minutes.`
      });

      return res.json({
        ok: true,
        message: "Password reset code sent.",
        devCode: result?.devOnly ? code : undefined
      });
    }

    res.json({ ok: true, message: "If this email has an account, a reset code has been sent." });
  } catch (error) {
    sendServerError(res, error, "Could not send reset code.");
  }
});

app.post("/api/auth/reset-password", async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const verificationCode = String(req.body?.verificationCode || "").trim();

    if (!email || !email.includes("@")) return res.status(400).json({ error: "A valid email is required." });
    if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });
    if (!verificationCode) return res.status(400).json({ error: "Reset code is required." });
    if (!(await verifyCode(email, "reset", verificationCode))) {
      return res.status(400).json({ error: "Invalid or expired reset code." });
    }

    const users = await getUsersCollection();
    const result = await users.updateOne(
      { email },
      { $set: { passwordHash: await bcrypt.hash(password, 12), updatedAt: new Date() } }
    );

    if (!result.matchedCount) return res.status(404).json({ error: "Account not found." });
    res.json({ ok: true, message: "Password updated. You can log in now." });
  } catch (error) {
    sendServerError(res, error, "Could not reset password.");
  }
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  res.json({ user: req.user });
});

app.patch("/api/auth/profile", requireAuth, async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const image = String(req.body?.image || "").trim();
    const password = String(req.body?.password || "");
    const streakGoal = Number(req.body?.streakGoal);
    const update = { updatedAt: new Date() };

    if (name) update.name = name;
    if (image || req.body?.image === "") update.image = image;
    if (email) {
      if (!email.includes("@")) return res.status(400).json({ error: "A valid email is required." });
      const existing = await (await getUsersCollection()).findOne({ email, _id: { $ne: new ObjectId(req.user.id) } });
      if (existing) return res.status(409).json({ error: "That email is already used by another account." });
      update.email = email;
    }
    if (password) {
      if (password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });
      update.passwordHash = await bcrypt.hash(password, 12);
    }
    if (Number.isFinite(streakGoal)) {
      if (streakGoal < 1 || streakGoal > 365) {
        return res.status(400).json({ error: "Streak goal must be between 1 and 365 days." });
      }
      update.streakGoal = Math.round(streakGoal);
    }

    const users = await getUsersCollection();
    await users.updateOne({ _id: new ObjectId(req.user.id) }, { $set: update });
    const user = await users.findOne({ _id: new ObjectId(req.user.id) });
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (error) {
    sendServerError(res, error, "Profile update failed.");
  }
});

app.get("/api/health", async (_req, res) => {
  try {
    await getCollection();
    res.json({ ok: true, database: "connected" });
  } catch (error) {
    res.status(isDatabaseConnectionError(error) ? 503 : 500).json({
      ok: false,
      error: isDatabaseConnectionError(error)
        ? "Database connection unavailable. Check your MongoDB Atlas connection and DNS settings."
        : error.message
    });
  }
});

app.get("/api/words", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit || 200), 5000);
    const skip = Math.max(Number(req.query.skip || 0), 0);
    const allWords = await mergeUserProgress(await loadWords(), req.user?.id);
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

app.post("/api/words", requireAuth, async (req, res) => {
  try {
    const parsed = normalizeWordInput(req.body || {});
    if (parsed.error) return res.status(400).json({ error: parsed.error });

    const collection = await getCollection();
    const escaped = parsed.doc.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const existing = await collection.findOne({ word: new RegExp(`^${escaped}$`, "i") });
    if (existing) return res.status(409).json({ error: "This word already exists." });

    const result = await collection.insertOne(parsed.doc);
    const inserted = await collection.findOne({ _id: result.insertedId });
    res.status(201).json(normalizeWord(inserted));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/words/:id", async (req, res) => {
  try {
    const word = await getMergedWord(req.params.id, req.user?.id);
    if (!word) return res.status(404).json({ error: "Word not found" });
    res.json(word);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/words/:id/review", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const status = normalizeStatusValue(req.body?.status || "learning");
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Review updates require a MongoDB ObjectId." });
    }

    const progress = await getProgressCollection();
    await progress.updateOne(
      { userId: req.user.id, wordId: id },
      {
        $set: { userId: req.user.id, wordId: id, status, updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true }
    );

    res.json(await getMergedWord(id, req.user.id));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/words/:id/save", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const saved = Boolean(req.body?.saved);
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Save updates require a MongoDB ObjectId." });
    }

    const progress = await getProgressCollection();
    await progress.updateOne(
      { userId: req.user.id, wordId: id },
      {
        $set: { userId: req.user.id, wordId: id, saved, updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true }
    );

    res.json(await getMergedWord(id, req.user.id));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/stats", async (req, res) => {
  try {
    const words = await mergeUserProgress(await loadWords(), req.user?.id);
    const total = words.length;
    const mastered = words.filter((item) => item.status === "mastered").length;
    const learning = words.filter((item) => item.status === "learning").length;
    const newWords = Math.max(total - mastered - learning, 0);
    const reviewed = mastered + learning;

    res.json({
      total,
      mastered,
      learning,
      new: newWords,
      learned: mastered,
      accuracy: reviewed ? Math.round((mastered / reviewed) * 100) : 0,
      dueToday: learning,
      streak: 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`WordMaster API listening on http://localhost:${port}`);
});
