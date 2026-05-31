import {
  DEFAULT_CHAT_MODEL_ID,
  type SupportChatModelId,
} from "@archcode/shared";
import type { InferResponseType } from "hono";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { z } from "zod";
import { BotMessage, ErrorMessage, UserMessage } from "../components/messages";
import { SessionShell } from "../components/session-shell";
import { useChat, type Message } from "../hooks/use-chat";
import { apiClient } from "../lib/api-client";
import { getErrorMessage } from "../lib/http-errors";
import { useToast } from "../providers/toast";
import { MessageStatus } from "@archcode/database/enums";
import prettyMs from "pretty-ms";
import { useKeyboardLayer } from "../providers/keyboard-layer";
import { useKeyboard } from "@opentui/react";

type SessionData = InferResponseType<
  (typeof apiClient.sessions)[":id"]["$get"],
  200
>;

const sessionLocationSchema = z.object({
  session: z.custom<SessionData>(
    (val) => val != null && typeof val === "object" && "id" in val,
  ),
});

function mapDbMessages(dbMessages: SessionData["messages"]): Message[] {
  return dbMessages.map((msg): Message => {
    if (msg.role === "ERROR") {
      return {
        id: msg.id,
        role: "error",
        content: msg.content,
      };
    }

    if (msg.role === "USER") {
      return {
        id: msg.id,
        role: "user",
        content: msg.content,
        mode: msg.mode,
        model: msg.model as SupportChatModelId,
      };
    }

    return {
      id: msg.id,
      role: "assistant",
      content: msg.content,
      mode: msg.mode,
      model: msg.model as SupportChatModelId,
      parts: [{ type: "text", text: msg.content }],
      ...(msg.duration != null ? { duration: prettyMs(msg.duration * 1000) } : {}),
      interrupted: msg.status === MessageStatus.INTERRUPTED,
    };
  });
}

function ChatMessage({ msg }: { msg: Message }) {
  if (msg.role === "error") {
    return <ErrorMessage message={msg.content} />;
  }
  if (msg.role === "user") {
    return <UserMessage message={msg.content} />;
  }

  return (
    <BotMessage
      parts={msg.parts}
      model={msg.model}
      mode={msg.mode}
      duration={msg.duration}
      streaming={false}
      interrupted={msg.interrupted}
    />
  );
}

function SessionChat({ session }: { session: SessionData }) {
  const [initialMessages] = useState(() => mapDbMessages(session.messages));

  const { isTopLayer } = useKeyboardLayer();

  const { messages, stream, submit, abort, interrupt } = useChat(
    session.id,
    initialMessages,
  );

  useEffect(() => {
    return () => {
      abort();
    };
  }, [abort]);

  useKeyboard((key) => {
    if (key.name === "escape" && isTopLayer("base") && stream.status === "streaming") {
      key.preventDefault();
      interrupt();
    }
  })

  return (
    <SessionShell
      onSubmit={(text) => {
        submit({ userText: text, mode: "BUILD", model: DEFAULT_CHAT_MODEL_ID });
      }}
      loading={stream.status === "streaming"}
      interruptible={stream.status === "streaming"}
    >
      {messages.map((msg) => (
        <ChatMessage key={msg.id} msg={msg} />
      ))}
      {stream.status === "streaming" && stream.parts.length > 0 && (
        <BotMessage
          parts={stream.parts}
          model={stream.model}
          mode={stream.mode}
          streaming
        />
      )}
    </SessionShell>
  );
}

export function Session() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  const prefetch = useMemo(() => {
    const parsed = sessionLocationSchema.safeParse(location.state);
    return parsed.success ? parsed.data.session : null;
  }, [location.state]);

  const [session, setSession] = useState<SessionData | null>(prefetch);

  useEffect(() => {
    if (prefetch) return;

    setSession(null);

    if (!id) return;

    let ignore = false;

    const fetchSession = async () => {
      try {
        const res = await apiClient.sessions[":id"].$get({
          param: {
            id,
          },
        });

        if (ignore) return;

        if (!res.ok) {
          throw new Error(await getErrorMessage(res));
        }

        const session = await res.json();
        setSession(session);
      } catch (error) {
        if (ignore) return;
        toast.show({
          message:
            error instanceof Error ? error.message : "Failed to fetch session",
          variant: "error",
        });
        navigate("/", { replace: true });
      }
    };

    fetchSession();

    return () => {
      ignore = true;
    };
  }, [id, navigate, toast]);

  if (!session) {
    return <SessionShell onSubmit={() => {}} inputDisabled />;
  }

  return <SessionChat key={session.id} session={session} />;
}
