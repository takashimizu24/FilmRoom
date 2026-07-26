"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";

export interface Message {
  id: string;
  content: string;
  createdAt: string;
  user: { name: string };
  userId: string;
  parentId: string | null;
  blockRef: number | null;
}

interface CommentsContextValue {
  session: ReturnType<typeof useSession>["data"];
  messages: Message[];
  refetch: () => Promise<void>;
  postMessage: (
    content: string,
    opts: { parentId?: string; blockRef?: number | null }
  ) => Promise<boolean>;
  translations: Record<string, string>;
  translating: string | null;
  translateError: string | null;
  handleTranslate: (msg: Message) => Promise<void>;
  // Top-level comments whose target is `blockRef` (null = whole post).
  topLevelFor: (blockRef: number | null) => Message[];
  repliesFor: (id: string) => Message[];
  // Total comments (top-level + replies) targeting `blockRef`.
  countFor: (blockRef: number | null) => number;
}

const Ctx = createContext<CommentsContextValue | null>(null);

export function useComments() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useComments must be used inside <CommentsProvider>");
  return ctx;
}

export function CommentsProvider({
  postId,
  children,
}: {
  postId: string;
  children: ReactNode;
}) {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translating, setTranslating] = useState<string | null>(null);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);

  async function refetch() {
    const res = await fetch(`/api/posts/${postId}/messages`);
    if (res.ok) setMessages(await res.json());
  }

  useEffect(() => {
    refetch();
    intervalRef.current = setInterval(refetch, 4000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  async function postMessage(
    content: string,
    opts: { parentId?: string; blockRef?: number | null }
  ) {
    const res = await fetch(`/api/posts/${postId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content,
        parentId: opts.parentId,
        blockRef: opts.blockRef ?? null,
      }),
    });
    return res.ok;
  }

  async function handleTranslate(msg: Message) {
    if (translations[msg.id]) {
      setTranslations((prev) => {
        const next = { ...prev };
        delete next[msg.id];
        return next;
      });
      return;
    }
    setTranslateError(null);
    setTranslating(msg.id);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: msg.content }),
      });
      if (res.ok) {
        const { translated } = await res.json();
        setTranslations((prev) => ({ ...prev, [msg.id]: translated }));
      } else {
        setTranslateError(msg.id);
      }
    } catch {
      setTranslateError(msg.id);
    }
    setTranslating(null);
  }

  function topLevelFor(blockRef: number | null) {
    return messages.filter((m) => !m.parentId && (m.blockRef ?? null) === blockRef);
  }
  function repliesFor(id: string) {
    return messages.filter((m) => m.parentId === id);
  }
  function countFor(blockRef: number | null) {
    const tops = topLevelFor(blockRef);
    const topIds = new Set(tops.map((t) => t.id));
    const replies = messages.filter((m) => m.parentId && topIds.has(m.parentId));
    return tops.length + replies.length;
  }

  return (
    <Ctx.Provider
      value={{
        session,
        messages,
        refetch,
        postMessage,
        translations,
        translating,
        translateError,
        handleTranslate,
        topLevelFor,
        repliesFor,
        countFor,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
