import crypto from "node:crypto";
import http from "node:http";
import open from "open";

const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

type OAuthState = {
  nonce: string;
  port: number;
};

function toBase64Url(input: Uint8Array | string) {
  return typeof input === "string"
    ? Buffer.from(input, "utf8").toString("base64url")
    : Buffer.from(input).toString("base64url");
}

async function createPkceChallenge(verifier: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return toBase64Url(new Uint8Array(digest));
}

function encodeState(state: OAuthState) {
  return Buffer.from(JSON.stringify(state)).toString("base64url");
}

function decodeState(state: string) {
  return JSON.parse(
    Buffer.from(state, "base64url").toString("utf8"),
  ) as OAuthState;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function createAuthUrl(params: {
  frontendApi: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
}) {
  const url = new URL("/oauth/authorize", params.frontendApi);
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid profile email");
  url.searchParams.set("state", params.state);
  url.searchParams.set("prompt", "login");
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export async function performLogin() {
  const clerkFrontendApi = process.env.CLERK_FRONTEND_API;
  const clientId = process.env.CLERK_OAUTH_CLIENT_ID;
  const apiUrl = process.env.API_URI || "http://localhost:3000";

  if (!clerkFrontendApi) throw new Error("CLERK_FRONTEND_API is not defined");
  if (!clientId) throw new Error("CLERK_OAUTH_CLIENT_ID is not defined");

  const nonce = crypto.randomUUID();
  const codeVerifier = toBase64Url(crypto.randomBytes(32));
  const codeChallenge = await createPkceChallenge(codeVerifier);

  return new Promise<{ token: string }>((resolve, reject) => {
    let server: http.Server;
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error("Login timed out"));
    }, LOGIN_TIMEOUT_MS);

    server = http.createServer(async (req, res) => {
      try {
        if (!req.url) {
          res.writeHead(400).end("Invalid request");
          return;
        }

        const url = new URL(req.url, `http://localhost`);
        if (url.pathname !== "/auth/callback") {
          res.writeHead(404).end("Not found");
          return;
        }

        const returnedState = url.searchParams.get("state");
        const code = url.searchParams.get("code");
        const error = url.searchParams.get("error");

        if (error) {
          throw new Error(`OAuth error: ${error}`);
        }

        if (!returnedState || !code) {
          throw new Error("Missing state or code in OAuth callback");
        }

        const parsedState = decodeState(returnedState);
        if (parsedState.nonce !== nonce) {
          throw new Error("Invalid OAuth state");
        }

        res.writeHead(200, { "content-type": "text/html" });
        res.end("<h1>Login complete. You may close this window.</h1>");

        clearTimeout(timeout);
        server.close(async () => {
          try {
            // Exchange authorization code for Clerk tokens
            const tokenResponse = await fetch(
              new URL("/oauth/token", clerkFrontendApi).toString(),
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                  grant_type: "authorization_code",
                  code,
                  redirect_uri: `${apiUrl}/auth/callback`,
                  code_verifier: codeVerifier,
                  client_id: clientId,
                }),
              },
            );

            if (!tokenResponse.ok) {
              const details = await tokenResponse.text();
              throw new Error(
                details || "Failed to exchange authorization code for tokens",
              );
            }

            const data = (await tokenResponse.json()) as {
              token?: string;
              access_token?: string;
              oauth_token?: string;
            };
            const token = data.token ?? data.access_token ?? data.oauth_token;
            if (!token) {
              throw new Error("Token response did not include an access token");
            }
            resolve({ token });
          } catch (error) {
            reject(error);
          }
        });
      } catch (error) {
        clearTimeout(timeout);
        res.writeHead(400).end(getErrorMessage(error));
        server.close(() => reject(error));
      }
    });

    server.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    server.listen(0, "localhost", async () => {
      const address = server.address();
      if (!address || typeof address !== "object" || !address.port) {
        clearTimeout(timeout);
        return reject(new Error("Failed to bind OAuth callback server"));
      }

      const state = encodeState({ nonce, port: address.port });
      const redirectUri = `${apiUrl}/auth/callback`;
      const authUrl = createAuthUrl({
        frontendApi: clerkFrontendApi,
        clientId,
        redirectUri,
        codeChallenge,
        state,
      });

      try {
        await open(authUrl);
      } catch (error) {
        clearTimeout(timeout);
        server.close();
        reject(error);
      }
    });
  });
}
