import { createAuthClient } from "better-auth/react";

const getAuthBaseURL = () => {
  // In browser, use window.location for accurate origin
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api/auth`;
  }

  // Server-side fallback (shouldn't happen for client)
  return process.env.NEXT_PUBLIC_AUTH_URL || "/api/auth";
};

export const authClient = createAuthClient({
  baseURL: getAuthBaseURL()
});
