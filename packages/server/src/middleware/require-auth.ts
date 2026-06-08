import { createMiddleware } from "hono/factory";
import { authenticateOAuthRequest } from "../lib/auth.js";

export type AuthenticatedEnv = {
  Variables: {
      userId: string;
  };
}

export const requireAuth = createMiddleware<AuthenticatedEnv>(async (c, next) => {
  try {
    const auth = await authenticateOAuthRequest(c.req.raw);
    console.log(auth);
    if (!auth) {
      return c.json({ error: "Unauthorized. Run /login to continue" }, 401);
    }

    c.set("userId", auth.userId);
    await next();
  } catch (error) {
    return c.json({ error: "Unauthorized. Run /login to continue" }, 401);
  }
})