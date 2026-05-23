import dns from "dns";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";

dotenv.config();

if (process.env.DNS_SERVERS) {
    dns.setServers(
        process.env.DNS_SERVERS
            .split(",")
            .map((server) => server.trim())
            .filter(Boolean)
    );
}

const authMongoUri = process.env.AUTH_MONGODB_URI || process.env.MONGODB_URI;
if (!authMongoUri) {
    throw new Error("AUTH_MONGODB_URI or MONGODB_URI is required. Add it to .env before running the app.");
}

const globalForAuthMongo = globalThis;
const authClient = globalForAuthMongo._wordmasterAuthMongoClient || new MongoClient(authMongoUri);
if (!globalForAuthMongo._wordmasterAuthMongoClient) globalForAuthMongo._wordmasterAuthMongoClient = authClient;
await authClient.connect();

const authDb = authClient.db(process.env.AUTH_MONGODB_DB || "wordmaster_auth");
const vercelOrigin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
const appOrigin = process.env.WEB_ORIGIN || vercelOrigin || "http://localhost:3000";
const authBaseURL = process.env.BETTER_AUTH_URL || `${appOrigin}/api/auth`;

export const auth = betterAuth({
    appName: "WordMaster",
    database: mongodbAdapter(authDb, {
        client: authClient
    }),
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: authBaseURL,
    trustedOrigins: [appOrigin],
    emailAndPassword: {
        enabled: true,
        minPasswordLength: 8,
        autoSignIn: true
    }
});
