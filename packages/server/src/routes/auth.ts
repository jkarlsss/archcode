import { createClerkClient } from "@clerk/backend";
import { Hono } from "hono";

if (!process.env.CLERK_SECRET_KEY) {
  throw new Error("CLERK_SECRET_KEY is not defined");
}

if (!process.env.CLERK_OAUTH_CLIENT_ID) {
  throw new Error("CLERK_OAUTH_CLIENT_ID is not defined");
}

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

const app = new Hono()
  .get("/callback", (c) => {
    const code = c.req.query("code");
    const state = c.req.query("state");
    const error = c.req.query("error");

    const errorDescription = c.req.query("error_description");

    if (error) {
      return c.text(errorDescription ?? error, 400);
    }

    if (!code || !state) {
      return c.text("Missing code or state", 400);
    }

    try {
      const [encoded] = state.split(".");
      if (!encoded) {
        throw new Error("Invalid state");
      }

      const payload = JSON.parse(Buffer.from(encoded, "base64url").toString());
      const port = payload.port;

      if (!port || typeof port !== "number") {
        throw new Error("Invalid port in state");
      }

      const redirectUrl = `http://localhost:${port}/auth/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;

      return c.redirect(redirectUrl);
    } catch (error) {
      return c.text("Invalid authentication state", 400);
    }
  })
  // .post("/token", async (c) => {
  //   try {
  //     const { code, codeVerifier } = (await c.req.json()) as {
  //       code: string;
  //       codeVerifier: string;
  //     };

  //     if (!code || !codeVerifier) {
  //       return c.json({ error: "Missing code or codeVerifier" }, 400);
  //     }

  //     const apiUrl = process.env.API_URI || "http://localhost:3000";
  //     const tokenResponse = await fetch(
  //       `${process.env.APP_URI}oauth/token`,
  //       {
  //         method: "POST",
  //         headers: { "Content-Type": "application/x-www-form-urlencoded" },
  //         body: new URLSearchParams({
  //           client_id: process.env.CLERK_OAUTH_CLIENT_ID!,
  //           code,
  //           code_verifier: codeVerifier,
  //           grant_type: "authorization_code",
  //           redirect_uri: `${apiUrl}/auth/callback`,
  //         }).toString(),
  //       },
  //     );

  //     if (!tokenResponse.ok) {
  //       const error = await tokenResponse.text();
  //       console.error("Token exchange failed:", error);
  //       return c.json({ error: "Token exchange failed" }, 400);
  //     }

  //     const data = (await tokenResponse.json()) as { access_token: string };
  //     return c.json({ token: data.access_token });
  //   } catch (error) {
  //     const message = error instanceof Error ? error.message : "Unknown error";
  //     console.error("Token endpoint error:", message);
  //     return c.json({ error: message }, 500);
  //   }
  // });

export default app;
