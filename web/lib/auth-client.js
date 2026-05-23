import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: "/api/auth"
});

// export const authClient = new Proxy({}, {
//   get(target, prop) {
//     return initAuthClient()[prop];
//   }
// })