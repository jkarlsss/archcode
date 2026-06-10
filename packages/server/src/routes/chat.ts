import { Prisma } from "@archcode/database";
import { db } from "@archcode/database/client";
import { getToolContracts, modeSchema, type ModeType } from "@archcode/shared";
import { zValidator } from "@hono/zod-validator";
import {
  convertToModelMessages,
  generateText,
  streamText,
  type LanguageModelUsage,
  type UIMessage,
} from "ai";
import { Hono } from "hono";
import { z } from "zod";
import { isSupportedChatModel, resolveChatModel } from "../lib/model.js";
import type { AuthenticatedEnv } from "../middleware/require-auth.js";
import { buildSystemPrompt } from "../system-prompt.js";

// --------------------- Types ---------------------
type ChatMessageMetadata = {
  mode?: string;
  model?: string;
  durationMs?: number;
  usage?: LanguageModelUsage;
};

type ArchcodeUIMessage = UIMessage<ChatMessageMetadata> & {
  createdAt?: Date | string;
};

// --------------------- Validation ---------------------
const submitSchema = z.object({
  id: z.string(),
  messages: z.array(z.custom<ArchcodeUIMessage>()).min(1).max(100),
  mode: modeSchema,
  model: z.string().refine(isSupportedChatModel),
});

const submitValidator = zValidator("json", submitSchema, (result, c) => {
  if (!result.success) {
    const errorResult = result as unknown as { error: { issues: unknown[] } };
    return c.json(errorResult.error.issues, 400);
  }
});

// --------------------- Helpers ---------------------
function hasPendingToolCalls(message: ArchcodeUIMessage): boolean {
  return (
    message.parts?.some(
      (part: any) =>
        part.type === "tool-call" &&
        part.state !== "result" &&
        part.state !== "error",
    ) ?? false
  );
}

async function getLatestSummary(sessionId: string) {
  return db.messageSummary.findFirst({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
  });
}

// Prevent overlapping summarisations for the same session
const summarisationLocks = new Map<string, Promise<void>>();

async function maybeSummarise(
  sessionId: string,
  mode: ModeType,
  model: string,
) {
  // Non‑blocking guard: if a summarisation is already running, skip.
  if (summarisationLocks.has(sessionId)) return;

  const UNSUMMARISED_LIMIT = 1;

  const lock = (async () => {
    try {
      const latestSummary = await getLatestSummary(sessionId);
      const unsummarisedCount = await db.message.count({
        where: {
          sessionId,
          createdAt: latestSummary
            ? { gt: latestSummary.createdAt }
            : undefined,
        },
      });

      if (unsummarisedCount < UNSUMMARISED_LIMIT) return;

      const messagesToSummarise = await db.message.findMany({
        where: {
          sessionId,
          ...(latestSummary
            ? { createdAt: { gt: latestSummary.createdAt } }
            : {}),
        },
        orderBy: { createdAt: "asc" },
        take: UNSUMMARISED_LIMIT,
      });

      if (messagesToSummarise.length === 0) return;

      const conversationText = messagesToSummarise
        .map((m) => {
          const data = m.data as any;
          const textParts = data.parts
            ?.filter((p: any) => p.type === "text")
            .map((p: any) => p.text)
            .join("\n");
          return `${data.role ?? "unknown"}: ${textParts}`;
        })
        .join("\n");

      const summaryModel = resolveChatModel(model);
      const { text } = await generateText({
        model: summaryModel.model,
        system:
          "Summarise this conversation concisely, preserving key facts and decisions.",
        prompt: conversationText,
      });

      await db.messageSummary.create({
        data: {
          sessionId,
          summary: text,
          upToMessageId:
            messagesToSummarise[messagesToSummarise.length - 1]!.id,
        },
      });
    } finally {
      summarisationLocks.delete(sessionId);
    }
  })();

  summarisationLocks.set(sessionId, lock);
  await lock; // fire‑and‑forget in the parent (we call it with .catch)
}

// --------------------- Route ---------------------
const app = new Hono<AuthenticatedEnv>().post(
  "/",
  submitValidator,
  async (c) => {
    const { id, messages, mode, model } = c.req.valid("json");
    const userId = c.get("userId");

    // 1. Verify session ownership (lightweight query)
    const sessionExists = await db.session.findUnique({
      where: { id, userId },
      select: { id: true },
    });
    if (!sessionExists) return c.json({ error: "Session not found" }, 404);

    // 2. Fetch only existing message IDs – we trust the client sends the full conversation.
    const existingIds = await db.message.findMany({
      where: { sessionId: id },
      select: { id: true },
    });
    const savedIds = new Set(existingIds.map((m) => m.id));

    // 3. Sort incoming messages by createdAt (fallback to 0 for safety)
    const sortedMessages = [...messages].sort(
      (a, b) =>
        new Date(a.createdAt ?? 0).getTime() -
        new Date(b.createdAt ?? 0).getTime(),
    );

    let lastMessage;

    if (sortedMessages.length !== 0) {
      lastMessage = sortedMessages[sortedMessages.length - 1];
    }

    // 4. Build model messages, injecting summary if one exists
    const systemPrompt = buildSystemPrompt({ mode });
    const tools = getToolContracts(mode);
    const latestSummary = await getLatestSummary(id);

    let modelMessages;
    if (latestSummary) {
      const summaryMessage = {
        role: "system" as const,
        content: `${lastMessage ? `Here is the recent conversation data:\n${JSON.stringify(lastMessage)}` : ""} Previous conversation history summary:\n${latestSummary.summary}`,
      };
      modelMessages = [
        summaryMessage,
        ...(await convertToModelMessages(sortedMessages, { tools })),
      ];
    } else {
      modelMessages = await convertToModelMessages(sortedMessages, { tools });
    }

    // 5. Stream response
    const startTime = Date.now();
    const resolvedModel = resolveChatModel(model);
    let completeUsage: LanguageModelUsage | null = null;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    const result = streamText({
      model: resolvedModel.model,
      system: systemPrompt,
      messages: modelMessages,
      tools,
      providerOptions: resolvedModel.providerOptions,
      abortSignal: controller.signal,
      onFinish(event) {
        clearTimeout(timeout);
        completeUsage = event.usage;
      },
    });

    return result.toUIMessageStreamResponse<ArchcodeUIMessage>({
      originalMessages: sortedMessages,
      messageMetadata({ part }) {
        if (part.type === "start") return { mode, model };
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

        // Never persist a message that still has unresolved tool calls.
        if (hasPendingToolCalls(event.responseMessage)) return;

        const assistantMessages = event.messages.filter(
          (m) => !savedIds.has(m.id),
        );

        if (assistantMessages.length) {
          await db.message.createMany({
            data: assistantMessages.map((message) => ({
              id: message.id,
              sessionId: id,
              data: message as unknown as Prisma.InputJsonValue,
            })),
            skipDuplicates: true,
          });

          // Summarise asynchronously – do not block the response.
          maybeSummarise(id, mode, model).catch(console.error);
        }
      },
      onError(error) {
        clearTimeout(timeout);
        return error instanceof Error ? error.message : String(error);
      },
    });
  },
);

export default app;
