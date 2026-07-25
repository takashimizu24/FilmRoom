"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import type { Block } from "@/lib/types";
import { blockLabel, blockAnchorId } from "@/lib/blocks";

interface Message {
  id: string;
  content: string;
  createdAt: string;
  user: { name: string };
  userId: string;
  parentId: string | null;
  blockRef: number | null;
}

export default function Chat({ postId, blocks }: { postId: string; blocks: Block[] }) {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [composerBlockRef, setComposerBlockRef] = useState<number | "">("");
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyInput, setReplyInput] = useState("");
  const [openThreads, setOpenThreads] = useState<Record<string, boolean>>({});
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translating, setTranslating] = useState<string | null>(null);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);

  async function fetchMessages() {
    const res = await fetch(`/api/posts/${postId}/messages`);
    if (res.ok) setMessages(await res.json());
  }

  useEffect(() => {
    fetchMessages();
    intervalRef.current = setInterval(fetchMessages, 4000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [postId]);

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

  async function postMessage(content: string, opts: { parentId?: string; blockRef?: number | null }) {
    const res = await fetch(`/api/posts/${postId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, parentId: opts.parentId, blockRef: opts.blockRef ?? null }),
    });
    return res.ok;
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;
    setSending(true);
    const ok = await postMessage(input, { blockRef: composerBlockRef === "" ? null : composerBlockRef });
    if (ok) {
      setInput("");
      setComposerBlockRef("");
      await fetchMessages();
    }
    setSending(false);
  }

  async function handleReply(threadId: string) {
    if (!replyInput.trim() || sending) return;
    setSending(true);
    const ok = await postMessage(replyInput, { parentId: threadId });
    if (ok) {
      setReplyInput("");
      setReplyingTo(null);
      setOpenThreads((p) => ({ ...p, [threadId]: true }));
      await fetchMessages();
    }
    setSending(false);
  }

  function startReply(threadId: string, mentionName?: string) {
    setReplyingTo(threadId);
    setReplyInput(mentionName ? `@${mentionName} ` : "");
  }

  function scrollToBlock(idx: number) {
    document.getElementById(blockAnchorId(idx))?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const topLevel = messages.filter((m) => !m.parentId);
  const repliesByParent = new Map<string, Message[]>();
  for (const m of messages) {
    if (m.parentId) {
      const arr = repliesByParent.get(m.parentId) ?? [];
      arr.push(m);
      repliesByParent.set(m.parentId, arr);
    }
  }

  function Comment({ msg, threadId, isReply }: { msg: Message; threadId: string; isReply?: boolean }) {
    const targeted = msg.blockRef != null && blocks[msg.blockRef];
    return (
      <div className="flex gap-3">
        <div
          className={`${isReply ? "w-6 h-6 text-xs" : "w-8 h-8 text-sm"} rounded-full bg-neutral-700 flex items-center justify-center text-neutral-300 font-bold shrink-0`}
        >
          {msg.user.name[0]}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm font-medium text-neutral-200">{msg.user.name}</span>
            <span className="text-xs text-neutral-600">
              {new Date(msg.createdAt).toLocaleString("en-US")}
            </span>
          </div>
          {targeted && (
            <button
              type="button"
              onClick={() => scrollToBlock(msg.blockRef!)}
              className="mt-1 inline-block max-w-full truncate text-xs text-neutral-400 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded px-1.5 py-0.5 transition"
              title="Jump to this part of the post"
            >
              ↳ {blockLabel(blocks[msg.blockRef!], msg.blockRef!)}
            </button>
          )}
          <p className="text-neutral-300 text-sm mt-0.5 break-words whitespace-pre-line">{msg.content}</p>
          {translations[msg.id] && (
            <p className="text-neutral-500 text-sm mt-1 break-words italic whitespace-pre-line">
              {translations[msg.id]}
            </p>
          )}
          {translateError === msg.id && (
            <p className="text-red-400 text-xs mt-1">Translation failed. Try again.</p>
          )}
          <div className="flex items-center gap-3 mt-1">
            <button
              type="button"
              onClick={() => handleTranslate(msg)}
              disabled={translating === msg.id}
              className="text-xs text-neutral-500 hover:text-neutral-300 transition disabled:opacity-50"
            >
              {translating === msg.id ? "Translating..." : translations[msg.id] ? "Hide translation" : "Translate"}
            </button>
            {session && (
              <button
                type="button"
                onClick={() => startReply(threadId, isReply ? msg.user.name : undefined)}
                className="text-xs text-neutral-500 hover:text-neutral-300 transition"
              >
                Reply
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
      <div className="bg-neutral-800 px-4 py-3 border-b border-neutral-700">
        <h3 className="font-semibold text-neutral-300">Comments</h3>
      </div>
      <div className="max-h-[28rem] overflow-y-auto p-4 space-y-5">
        {topLevel.length === 0 && (
          <p className="text-center text-neutral-600 text-sm py-8">
            No comments yet. Be the first to say something!
          </p>
        )}
        {topLevel.map((top) => {
          const replies = repliesByParent.get(top.id) ?? [];
          const open = openThreads[top.id];
          return (
            <div key={top.id} className="space-y-3">
              <Comment msg={top} threadId={top.id} />

              {replies.length > 0 && (
                <div className="pl-9">
                  <button
                    type="button"
                    onClick={() => setOpenThreads((p) => ({ ...p, [top.id]: !p[top.id] }))}
                    className="text-xs text-neutral-400 hover:text-neutral-200 transition mb-2"
                  >
                    {open ? "Hide" : "View"} {replies.length} {replies.length === 1 ? "reply" : "replies"}
                  </button>
                  {open && (
                    <div className="space-y-3">
                      {replies.map((r) => (
                        <Comment key={r.id} msg={r} threadId={top.id} isReply />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {replyingTo === top.id && session && (
                <div className="pl-9 flex gap-2">
                  <input
                    type="text"
                    autoFocus
                    value={replyInput}
                    onChange={(e) => setReplyInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleReply(top.id);
                      }
                    }}
                    placeholder="Write a reply..."
                    className="flex-1 min-w-0 px-3 py-1.5 border border-neutral-700 rounded-lg text-sm text-neutral-100 bg-neutral-800 placeholder-neutral-500 focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => handleReply(top.id)}
                    disabled={sending || !replyInput.trim()}
                    className="shrink-0 bg-neutral-700 text-neutral-100 px-3 py-1.5 rounded-lg text-sm hover:bg-neutral-600 disabled:opacity-50 transition"
                  >
                    Reply
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReplyingTo(null);
                      setReplyInput("");
                    }}
                    className="shrink-0 text-xs text-neutral-500 hover:text-neutral-300 px-1"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSend} className="border-t border-neutral-700 p-3 space-y-2">
        {blocks.length > 0 && (
          <select
            value={composerBlockRef}
            onChange={(e) => setComposerBlockRef(e.target.value === "" ? "" : Number(e.target.value))}
            aria-label="What is this comment about?"
            className="w-full px-3 py-2 border border-neutral-700 rounded-lg text-sm text-neutral-300 bg-neutral-800 focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
          >
            <option value="">💬 About the whole post</option>
            {blocks.map((b, i) => (
              <option key={i} value={i}>
                {blockLabel(b, i)}
              </option>
            ))}
          </select>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Write a comment..."
            className="flex-1 min-w-0 px-3 py-2 border border-neutral-700 rounded-lg text-sm text-neutral-100 bg-neutral-800 placeholder-neutral-500 focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="shrink-0 bg-neutral-700 text-neutral-100 px-4 py-2 rounded-lg text-sm hover:bg-neutral-600 disabled:opacity-50 transition"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
