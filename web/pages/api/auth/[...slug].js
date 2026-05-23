import { toNodeHandler } from "better-auth/node";
import { auth } from "../../../lib/auth-server.js";

const handler = toNodeHandler(auth);

export default async function authHandler(req, res) {
  console.log("Auth handler called:", {
    url: req.url,
    method: req.method,
    query: req.query,
    baseUrl: req.baseUrl,
    originalUrl: req.originalUrl,
    path: req.path
  });

  // For Pages API routes, the request URL may already include the full path.
  if (!req.baseUrl) req.baseUrl = "/api/auth";

  const requestedUrl = req.url || "";
  const hasBaseUrl = requestedUrl.startsWith(req.baseUrl);
  const pathSegment = hasBaseUrl ? requestedUrl.slice(req.baseUrl.length) : requestedUrl;

  // Preserve the original request URL for BetterAuth, but avoid doubling the base path.
  if (!req.originalUrl) req.originalUrl = hasBaseUrl ? requestedUrl : req.baseUrl + requestedUrl;

  // Ensure req.url is the route-relative path segment expected by the handler.
  req.url = pathSegment || "/";

  console.log("After setup:", {
    baseUrl: req.baseUrl,
    originalUrl: req.originalUrl,
    url: req.url
  });

  try {
    const result = await handler(req, res);
    console.log("Handler completed successfully");
    return result;
  } catch (error) {
    console.error("Handler error:", error);
    throw error;
  }
}
