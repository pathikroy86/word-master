import { createAuthClient } from "better-auth/react";

const defaultAuthBaseURL =
  process.env.NEXT_PUBLIC_AUTH_URL ||
  (process.env.NODE_ENV === "development" ? "http://localhost:3000/api/auth" : undefined);

export const authClient = createAuthClient({
  baseURL: defaultAuthBaseURL
});
