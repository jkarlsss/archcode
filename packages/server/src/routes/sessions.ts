import { db } from "@archcode/database/client";
import { findSupportChatModel } from "@archcode/shared";
import { zValidator } from "@hono/zod-validator";
import * as Sentry from "@sentry/hono/node";
import { Hono } from "hono";
import { z } from "zod";
import type { AuthenticatedEnv } from "../middleware/require-auth";

const createSessionSchema = z.object({
  title: z.string(),
});

const createSessionValidator = zValidator(
  "json",
  createSessionSchema,
  (result, c) => {
    if (!result.success) {
      const errorResult = result as unknown as { error: { issues: unknown[] } };
      Sentry.logger.warn("Session creation failed", {
        path: c.req.path,
        issues: (errorResult.error.issues ?? []).length,
      });
      return c.json({ error: "Invalid request body" }, 400);
    }
  },
);

const app = new Hono<AuthenticatedEnv>()
  .get("/", async (c) => {
    const sessions = await db.session.findMany({
      where: {
        userId: c.get("userId"),
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
      },
    });

    Sentry.logger.info("List sessions", {
      count: sessions.length,
    });

    return c.json(sessions);
  })

  .get("/:id", async (c) => {
    // await new Promise((resolve) => setTimeout(resolve, 1000));

    // throw new HTTPException(500, {
    //   message: "Mock error: Something went wrong",
    // })

    const id = c.req.param("id");
    const userId = c.get("userId");
    const session = await db.session.findFirst({
      where: {
        id,
        userId
      },
      include: {
        messages: {
          orderBy: {
            createdAt: "asc",
          }
        },
      },
    });
    if (!session) {
      Sentry.logger.warn("Session not found", {
        sessionId: id,
        userId,
      });
      return c.json({ error: "Session not found" }, 404);
    }

    Sentry.logger.info("Load session", {
      sessionId: id,
      userId,
    });

    

    return c.json(session);
  })
  .post("/", createSessionValidator, async (c) => {
    // await new Promise((resolve) => setTimeout(resolve, 5000));

    // throw new HTTPException(500, {
    //   message: "Mock error: Something went wrong",
    // })

    try {
      const userId = c.get("userId");
      const data = c.req.valid("json");

      const session = await db.session.create({
        data: {
          ...data,
          userId,
        }
      });

      Sentry.logger.info("Create session", {
        sessionId: session.id,
        title: session.title,
      });

      return c.json(session, 201);
    } catch (error) {
      console.error(error);
      return c.json({ error: "Something went wrong" }, 500);
    }
  });

export default app;
