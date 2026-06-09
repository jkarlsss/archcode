import type { Prisma } from "@archcode/database";
import { db } from "@archcode/database/client";
import {
  getToolContracts,
  modeSchema,
  type ModeType,
  type ToolContracts,
} from "@archcode/shared";
import { zValidator } from "@hono/zod-validator";
import {
  convertToModelMessages,
  streamText,
  validateUIMessages,
  type InferUITools,
  type LanguageModelUsage,
  type UIMessage,
} from "ai";
import { Hono } from "hono";
import { z } from "zod";
import { isSupportedChatModel, resolveChatModel } from "../lib/model";
import type { AuthenticatedEnv } from "../middleware/require-auth";
import { buildSystemPrompt } from "../system-prompt";

type ChatMessageMetadata = {
  mode?: ModeType;
  model?: string;
  durationMs?: number;
  usage?: LanguageModelUsage;
};

type ArchcodeUIMessage = UIMessage<
  ChatMessageMetadata,
  never,
  InferUITools<ToolContracts>
>;

const submitSchema = z.object({
  id: z.string(),
  messages: z
    .array(
      z.custom<ArchcodeUIMessage>((value) => {
        return (
          typeof value === "object" &&
          value != null &&
          "id" in value &&
          "parts" in value
        );
      }),
    )
    .min(1),
  mode: modeSchema,
  model: z.string().refine(isSupportedChatModel, "Unsupported model"),
});

const submitValidator = zValidator("json", submitSchema, (result, c) => {
  if (!result.success) {
    const errorResult = result as unknown as { error: { issues: unknown[] } };
    c.json(errorResult.error.issues, 400);
  }
});

function hasPendingToolCalls(message: ArchcodeUIMessage): boolean {
  return message.parts.some((part) => {
    if (part.type === "dynamic-tool" || part.type.startsWith("tool-")) {
      const state = (part as { state?: string }).state;
      return state !== "output-available" && state !== "output-error";
    }

    return false;
  });
}

const app = new Hono<AuthenticatedEnv>().post(
  "/",
  submitValidator,
  async (c) => {
    const { id, messages, mode, model } = c.req.valid("json");

    const userId = c.get("userId");

    const session = await db.session.findUnique({
      where: {
        id,
        userId,
      },
    });

    if (!session) {
      return c.json({ error: "Session not found" }, 404);
    }

    const startTime = Date.now();
    const tools = getToolContracts(mode);
    const resolvedModel = resolveChatModel(model);
    const previousMessages = Array.isArray(session.messages)
      ? (session.messages as unknown as ArchcodeUIMessage[])
      : [];
    const mergedMessages = [...previousMessages];

    for (const message of messages) {
      const incomingMessage = {
        ...message,
        metadata: {
          ...message.metadata,
          mode,
          model,
        },
      } satisfies ArchcodeUIMessage;

      const existingMessageIndex = mergedMessages.findIndex(
        (m) => m.id === message.id,
      );
      if (existingMessageIndex !== -1) {
        mergedMessages[existingMessageIndex] = incomingMessage;
      } else {
        mergedMessages.push(incomingMessage);
      }
    }

    const nextMessages = await validateUIMessages<ArchcodeUIMessage>({
      messages: mergedMessages,
      tools,
    });

    const modelMessages = await convertToModelMessages(nextMessages, {
      tools,
    });
    let completeUsage: LanguageModelUsage | null = null;

    const result = streamText({
      model: resolvedModel.model,
      system: buildSystemPrompt({ mode }),
      messages: modelMessages,
      tools,
      providerOptions: resolvedModel.providerOptions,
      abortSignal: c.req.raw.signal,
      onFinish(event) {
        completeUsage = event.usage;
      },
    });

    return result.toUIMessageStreamResponse<ArchcodeUIMessage>({
      originalMessages: nextMessages,
      messageMetadata({ part }) {
        if (part.type === "start") {
          return {
            mode,
            model,
          };
        }

        if (part.type !== "finish") return undefined;

        return {
          mode,
          model,
          durationMs: Date.now() - startTime,
          ...(completeUsage ? { usage: completeUsage } : {}),
        };
      },
      async onFinish(event) {
        if (event.isAborted) return;

        if (hasPendingToolCalls(event.responseMessage)) return;

        await db.session.update({
          where: {
            id,
            userId,
          },
          data: {
            messages: event.messages as unknown as Prisma.InputJsonValue,
          },
        });

        if (!completeUsage) return;
      },
      onError(error) {
        return error instanceof Error ? error.message : String(error);
      },
    });
  },
);

export default app;
