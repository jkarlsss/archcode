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
    return c.json((result as any).error.issues, 400);
  }
});

// --------------------- Helpers ---------------------
function hasPendingToolCalls(message: ArchcodeUIMessage): boolean {
  return message.parts?.some(
    (part: any) =>
      part.type === "tool-call" &&
      part.state !== "result" &&
      part.state !== "error",
  ) ?? false;
}

async function getLatestSummary(sessionId: string) {
  return db.messageSummary.findFirst({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    select: { summary: true, upToMessageId: true, createdAt: true },
  });
}

// Use a simple Set + timestamp for locking (faster than Map + Promise)
const summarisationLocks = new Set<string>();

async function maybeSummarise(
  sessionId: string,
  mode: ModeType,
  model: string,
): Promise<void> {
  if (summarisationLocks.has(sessionId)) return;

  summarisationLocks.add(sessionId);

  try {
    const latestSummary = await getLatestSummary(sessionId);
    const boundary = latestSummary
      ? await db.message
          .findUnique({
            where: { id: latestSummary.upToMessageId },
            select: { createdAt: true },
          })
          .then((m) => m?.createdAt ?? latestSummary.createdAt)
      : undefined;

    const UNSUMMARISED_LIMIT = 10;

    const messagesToSummarise = await db.message.findMany({
      where: {
        sessionId,
        ...(boundary && { createdAt: { gt: boundary } }),
      },
      orderBy: { createdAt: "asc" },
      take: UNSUMMARISED_LIMIT,
      select: {
        id: true,
        data: true,
        createdAt: true,
      },
    });

    if (messagesToSummarise.length < UNSUMMARISED_LIMIT) return;

    const conversationText = messagesToSummarise
      .map((m) => {
        const data = m.data as any;
        const text = data.parts
          ?.filter((p: any) => p.type === "text")
          .map((p: any) => p.text)
          .join("\n");
        return `${data.role ?? "unknown"}: ${text ?? ""}`;
      })
      .join("\n\n");

    const summaryModel = resolveChatModel(model);
    const { text: summary } = await generateText({
      model: summaryModel.model,
      system: "Summarise this conversation concisely, preserving key facts, decisions, and open questions.",
      prompt: conversationText,
      maxOutputTokens: 500,
    });

    await db.messageSummary.create({
      data: {
        sessionId,
        summary,
        upToMessageId: messagesToSummarise.at(-1)!.id,
      },
    });
  } finally {
    summarisationLocks.delete(sessionId);
  }
}

// --------------------- Route ---------------------
const app = new Hono<AuthenticatedEnv>().post(
  "/",
  submitValidator,
  async (c) => {
    const { id, messages, mode, model } = c.req.valid("json");
    const userId = c.get("userId");
    const startTime = Date.now();

    // 1. Parallel ownership + existing messages check
    const [sessionExists, existingIdsResult] = await Promise.all([
      db.session.findUnique({
        where: { id, userId },
        select: { id: true },
      }),
      db.message.findMany({
        where: { sessionId: id },
        select: { id: true },
      }),
    ]);

    if (!sessionExists) return c.json({ error: "Session not found" }, 404);

    const savedIds = new Set(existingIdsResult.map((m) => m.id));

    // 2. Sort once
    const sortedMessages = [...messages].sort(
      (a, b) =>
        new Date(a.createdAt ?? 0).getTime() -
        new Date(b.createdAt ?? 0).getTime(),
    );

    // 3. Get latest summary + build context (optimized)
    const latestSummary = await getLatestSummary(id);

    const resolvedModel = resolveChatModel(model);
    const tools = getToolContracts(mode);
    const systemPrompt = buildSystemPrompt({ mode });

    let modelMessages: any[];

    if (latestSummary) {
      // Fetch boundary once
      const boundaryMessage = await db.message.findUnique({
        where: { id: latestSummary.upToMessageId },
        select: { createdAt: true },
      });

      const boundaryDate = boundaryMessage?.createdAt ?? latestSummary.createdAt;

      // Only send messages after the summary + the summary itself
      const recentMessages = sortedMessages.filter(
        (msg) => new Date(msg.createdAt ?? 0) > boundaryDate,
      );

      modelMessages = [
        {
          role: "system" as const,
          content: `Previous conversation summary:\n${latestSummary.summary}`,
        },
        ...(await convertToModelMessages(recentMessages, { tools })),
      ];
    } else {
      modelMessages = await convertToModelMessages(sortedMessages, { tools });
    }

    // 4. Stream
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 500_000);

    let completeUsage: LanguageModelUsage | null = null;

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
          ...(completeUsage && { usage: completeUsage }),
        };
      },
      async onFinish(event) {
        if (event.isAborted || hasPendingToolCalls(event.responseMessage)) {
          return;
        }

        const newAssistantMessages = event.messages.filter(
          (m) => !savedIds.has(m.id),
        );

        if (newAssistantMessages.length === 0) return;

        await db.message.createMany({
          data: newAssistantMessages.map((message) => ({
            id: message.id,
            sessionId: id,
            data: message as unknown as Prisma.InputJsonValue,
          })),
          skipDuplicates: true,
        });

        // Fire-and-forget summarization
        maybeSummarise(id, mode, model).catch(console.error);
      },
      onError(error) {
        clearTimeout(timeout);
        return error instanceof Error ? error.message : String(error);
      },
    });
  },
);

export default app;