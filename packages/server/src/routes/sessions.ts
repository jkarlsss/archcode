import { db } from "@archcode/database/client";
import { MessageStatus, Mode, Role } from "@archcode/database/enums";
import { findSupportChatModel } from "@archcode/shared";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";

const createSessionSchema = z.object({
  title: z.string(),
  cwd: z.string().optional(),
  initialMessage: z
    .object({
      role: z.enum(Role),
      content: z.string(),
      mode: z.enum(Mode),
      model: z
        .string()
        .refine((id) => !!findSupportChatModel(id), "Unsupported model"),
    })
    .optional(),
});

const createSessionValidator = zValidator(
  "json",
  createSessionSchema,
  (result, c) => {
    if (!result.success) {
      return c.json({ error: "Invalid request body" }, 400);
    }
  },
);

const app = new Hono()
  .get("/", async (c) => {
    const sessions = await db.session.findMany({
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
      },
    });

    return c.json(sessions);
  })

  .get("/:id", async (c) => {
    // await new Promise((resolve) => setTimeout(resolve, 1000));

    // throw new HTTPException(500, {
    //   message: "Mock error: Something went wrong",
    // })

    const id = c.req.param("id");
    const session = await db.session.findFirst({
      where: {
        id,
      },
      include: {
        messages: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });
    if (!session) {
      throw new HTTPException(404, { message: "Session not found" });
    }
    return c.json(session);
  })
  .post("/", createSessionValidator, async (c) => {
    // await new Promise((resolve) => setTimeout(resolve, 5000));

    // throw new HTTPException(500, {
    //   message: "Mock error: Something went wrong",
    // })

    try {
      const { initialMessage, ...data } = c.req.valid("json");

      const session = await db.session.create({
        data: {
          ...data,
          userId: "mock-user",
          ...(initialMessage && {
            messages: {
              create: {
                ...initialMessage,
                status: MessageStatus.COMPLETE,
              },
            },
          }),
        },
        include: {
          messages: true,
        },
      });

      return c.json(session, 201);
    } catch (error) {
      console.error(error);
      return c.json({ error: "Something went wrong" }, 500);
    }
  });

export default app;
