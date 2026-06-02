import { sentry } from "@sentry/hono/node";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import * as Sentry from "@sentry/hono/node";
import chat from "./routes/chat.js";
import sessions from "./routes/sessions.js";

const app = new Hono();

Sentry.init({
  dsn: "https://08474d033b25ef9c0340d41776b923c8@o4510955683774464.ingest.de.sentry.io/4511479424417872",
  tracesSampleRate: 1.0,
  enableLogs: true,
  sendDefaultPii: true,
});

app.use(sentry(app));

app.get("/debug-sentry", () => {
  // Send a log before throwing the error
  Sentry.logger.info("User triggered test error", {
    action: "test_error_endpoint",
  });
  // Send a test metric before throwing the error
  Sentry.metrics.count("test_counter", 1);
  throw new Error("My first Sentry error!");
});

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    Sentry.logger.warn("Handled HTTP error", {
      status: error.status,
      message: error.message || "Request failed",
      path: c.req.path,
      method: c.req.method,
    });
    return c.json(
      { error: error.message || "Something went wrong" },
      error.status,
    );
  }

  return c.json({ error: "Something went wrong" }, 500);
});

const routes = app.route("/sessions", sessions).route("/chat", chat);

export type AppType = typeof routes;

export default app;
