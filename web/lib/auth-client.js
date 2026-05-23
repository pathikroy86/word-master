import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined"
    ? window.location.origin + "/api/auth"
    : process.env.NEXT_PUBLIC_AUTH_URL || "http://localhost:3000/api/auth"
});

// export const authClient = new Proxy({}, {
//   get(target, prop) {
//     return initAuthClient()[prop];
//   }
// })