import { betterAuth } from "better-auth";
import dns from "dns";
import dotenv from "dotenv";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { MongoClient } from "mongodb";

dotenv.config();

if (process.env.DNS_SERVERS) {
  dns.setServers(process.env.DNS_SERVERS.split(",").map((server) => server.trim()).filter(Boolean));
}

const authClient = new MongoClient(process.env.AUTH_MONGODB_URI || process.env.MONGODB_URI);
await authClient.connect();

const authDb = authClient.db(process.env.AUTH_MONGODB_DB || "wordmaster_auth");

export const auth = betterAuth({
  appName: "WordMaster",
  database: mongodbAdapter(authDb, {
    client: authClient
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:4000",
  trustedOrigins: [process.env.WEB_ORIGIN || "http://localhost:3000"],
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    autoSignIn: true
  }
});
