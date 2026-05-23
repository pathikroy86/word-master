import { toNodeHandler } from "better-auth/node";
import { auth } from "../../../lib/auth-server.js";

const handler = toNodeHandler(auth);

export default async function authHandler(req, res) {
  try {
    // Set CORS headers to allow requests from the same origin
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
    res.setHeader("Access-Control-Allow-Headers", "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.status(200).end();
      return;
    }

    // Pass through to better-auth handler
    await handler(req, res);
  } catch (error) {
    console.error("Auth handler error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
}
