import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import sessions from "./routes/sessions";

const app = new Hono();

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    return c.json(
      { error: error.message || "Something went wrong" },
      error.status,
    );
  }

  return c.json({ error: "Something went wrong" }, 500);
});

const routes = app.route("/sessions", sessions);


export type AppType = typeof routes;

export default { port: 3000, fetch: app.fetch, idleTimeout: 255 };
