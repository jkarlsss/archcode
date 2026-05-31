import type { Mode } from "@archcode/database/enums";
import {
  chatStreamEventSchema,
  type SupportChatModelId,
} from "@archcode/shared";
import { EventSourceParserStream } from "eventsource-parser/stream";
import type { ClientResponse } from "hono/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "../lib/api-client";
import { getErrorMessage } from "../lib/http-errors";

export type ClientMessagePart = { type: "text"; text: string };

export type Message =
  | {
      id: string;
      role: "user";
      content: string;
      mode: Mode;
      model: SupportChatModelId;
    }
  | {
      id: string;
      role: "assistant";
      content: string;
      mode: Mode;
      model: SupportChatModelId;
      parts: ClientMessagePart[];
      duration?: string;
      interrupted?: boolean;
    }
  | { id: string; role: "error"; content: string };

type StreamState =
  | { status: "idle" }
  | {
      status: "streaming";
      parts: ClientMessagePart[];
      mode: Mode;
      model: SupportChatModelId;
    };

type ActiveStream = {
  requestId: string;
  controller: AbortController;
  mode: Mode;
  model: SupportChatModelId;
  parts: ClientMessagePart[];
  interruptedCaptured: boolean;
};

type SubmitParams = {
  userText: string;
  mode: Mode;
  model: SupportChatModelId;
};

type RunStreamParams = {
  mode: Mode;
  model: SupportChatModelId;
  request: (controller: AbortController) => Promise<ClientResponse<unknown>>;
};

export function useChat(sessionId: string, initialMessage: Message[]) {
  const [messages, setMessages] = useState<Message[]>(initialMessage);
  const [stream, setStream] = useState<StreamState>({
    status: "idle",
  });

  const activeStreamRef = useRef<ActiveStream | null>(null);

  const updateMessages = useCallback(
    (updater: (message: Message[]) => Message[]) => {
      setMessages((prev) => updater(prev));
    },
    [],
  );

  const isActiveRequest = useCallback((requestId: string) => {
    return activeStreamRef.current?.requestId === requestId;
  }, []);

  const emitParts = useCallback(
    (requestId: string, parts: ClientMessagePart[]) => {
      if (!isActiveRequest(requestId)) return;

      const snapshop = [...parts];
      const activeStream = activeStreamRef.current;

      if (!activeStream) return;

      activeStream.parts = snapshop;
      setStream({
        status: "streaming",
        mode: activeStream.mode,
        model: activeStream.model,
        parts: snapshop,
      });
    },
    [isActiveRequest],
  );

  const captureInterruptedMessage = useCallback(
    (activeStream: ActiveStream) => {
      if (activeStream.interruptedCaptured || activeStream.parts.length === 0)
        return;

      activeStream.interruptedCaptured = true;
      const parts = [...activeStream.parts];
      const fullText = parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("");

      updateMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: fullText,
          mode: activeStream.mode,
          model: activeStream.model,
          parts,
          interrupted: true,
        },
      ]);
    },
    [],
  );

  const clearStream = useCallback(
    (requestId: string) => {
      if (!isActiveRequest(requestId)) return;

      activeStreamRef.current = null;
      setStream({ status: "idle" });
    },
    [isActiveRequest],
  );

  const handleStream = useCallback(
    async (response: ClientResponse<unknown>, activeStream: ActiveStream) => {
      if (!isActiveRequest(activeStream.requestId)) return;

      if (!response.ok) {
        const message = await getErrorMessage(response);
        updateMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "error", content: message },
        ]);
        return;
      }

      const parts: ClientMessagePart[] = [];

      const stream = response
        .body!.pipeThrough(new TextDecoderStream())
        .pipeThrough(new EventSourceParserStream());

      for await (const { data } of stream) {
        if (!isActiveRequest(activeStream.requestId)) return;

        let event;

        try {
          event = chatStreamEventSchema.parse(JSON.parse(data));
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Failed to parse event";
          updateMessages((prev) => [
            ...prev,
            { id: crypto.randomUUID(), role: "error", content: message },
          ]);
          break;
        }

        switch (event.type) {
          case "text-delta": {
            const last = parts[parts.length - 1];

            if (last && last.type === "text") {
              last.text += event.text;
            } else {
              parts.push({ type: "text", text: event.text });
            }
            emitParts(activeStream.requestId, parts);
            break;
          }
          case "done": {
            if (!isActiveRequest(activeStream.requestId)) return;

            const fullText = parts
              .filter((part) => part.type === "text")
              .map((part) => part.text)
              .join("");

            updateMessages((prev) => [
              ...prev,
              {
                id: event.messageId,
                role: "assistant",
                content: fullText,
                mode: activeStream.mode,
                model: activeStream.model,
                parts: [...parts],
              },
            ]);
            break;
          }
          case "error": {
            updateMessages((prev) => [
              ...prev,
              {
                id: crypto.randomUUID(),
                role: "error",
                content: event.message,
              },
            ]);
            break;
          }
        }
      }
    },
    [emitParts, isActiveRequest, updateMessages],
  );

  const runStream = useCallback(
    async ({ mode, model, request }: RunStreamParams) => {
      const controller = new AbortController();
      const requestId = crypto.randomUUID();

      const activeStream: ActiveStream = {
        requestId,
        mode,
        model,
        parts: [],
        controller,
        interruptedCaptured: false,
      };

      activeStreamRef.current = activeStream;
      setStream({ status: "streaming", mode, model, parts: [] });

      try {
        const clientResponse = await request(controller);

        await handleStream(clientResponse, activeStream);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        if (!isActiveRequest(requestId)) return;

        const msg = error instanceof Error ? error.message : String(error);
        updateMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "error", content: msg },
        ]);
      } finally {
        clearStream(requestId);
      }
    },
    [clearStream, handleStream, isActiveRequest, updateMessages],
  );

  const stopActiveStream = useCallback((
    capturePartial: boolean
  ) => {
    const activeStream = activeStreamRef.current;
    if (!activeStream) return;

    if (capturePartial) {
      captureInterruptedMessage(activeStream);
    }

    activeStreamRef.current = null;
    setStream({ status: "idle" });
    activeStream.controller.abort();
  }, []);

  const resume = useCallback(
    async ({ mode, model }: Omit<SubmitParams, "userText">) => {
      await runStream({
        mode,
        model,
        request: async (controller) => {
          return apiClient.chat[":sessionId"].resume.$post(
            { param: { sessionId } },
            { init: { signal: controller.signal } },
          );
        },
      });
    },
    [runStream, sessionId],
  );

  const hasAutoResumeRef = useRef(false);
  useEffect(() => {
    if (hasAutoResumeRef.current) return;
    const last = initialMessage[initialMessage.length - 1];
    if (!last || last.role !== "user") return;

    hasAutoResumeRef.current = true;
    resume({ mode: last.mode, model: last.model });
  }, [resume, initialMessage]);

  const submit = useCallback(
    async ({ userText, mode, model }: SubmitParams) => {

      stopActiveStream(true);

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: userText,
        mode,
        model,
      };
      updateMessages((prev) => [...prev, userMessage]);
      await runStream({
        mode,
        model,
        request: async (controller) => {
          return apiClient.chat[":sessionId"].$post(
            {
              param: { sessionId },
              json: {
                content: userText,
                mode,
                model,
              },
            },
            {
              init: { signal: controller.signal },
            },
          );
        },
      });
    },
    [runStream, sessionId, updateMessages, stopActiveStream],
  );

  const abort = useCallback(() => {
    stopActiveStream(false);
  }, [stopActiveStream]);

  const interrupt = useCallback(() => {
    stopActiveStream(true);
  }, [stopActiveStream]);

  return { messages, stream, submit, abort, interrupt };
}
