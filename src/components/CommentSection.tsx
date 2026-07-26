"use client";

import { useState } from "react";
import { useComments, type Message } from "./CommentsContext";

// A threaded comment list + composer scoped to one target: a specific block
// (`blockRef` = index) or the whole post (`blockRef` = null). Replies are kept
// two levels deep, YouTube-style, with a View/Hide toggle.
export default function CommentSection({
  blockRef,
  placeholder = "Write a comment...",
  emptyText = "No comments yet.",
  autoFocusComposer = false,
}: {
  blockRef: number | null;
  placeholder?: string;
  emptyText?: string;
  autoFocusComposer?: boolean;
}) {
  const {
    session,
    postAuthorId,
    postMessage,
    deleteMessage,
    refetch,
    translations,
    translating,
    translateError,
    handleTranslate,
    topLevelFor,
    repliesFor,
  } = useComments();

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyInput, setReplyInput] = useState("");
  const [openThreads, setOpenThreads] = useState<Record<string, boolean>>({});

  const topLevel = topLevelFor(blockRef);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;
    setSending(true);
    const ok = await postMessage(input, { blockRef });
    if (ok) {
      setInput("");
      await refetch();
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
      await refetch();
    }
    setSending(false);
  }

  function startReply(threadId: string, mentionName?: string) {
    setReplyingTo(threadId);
    setReplyInput(mentionName ? `@${mentionName} ` : "");
  }

  async function handleDelete(msg: Message) {
    const replyCount = msg.parentId ? 0 : repliesFor(msg.id).length;
    const message =
      replyCount > 0
        ? `Delete this comment and its ${replyCount} ${replyCount === 1 ? "reply" : "replies"}?`
        : "Delete this comment?";
    if (!window.confirm(message)) return;
    await deleteMessage(msg.id);
  }

  function Comment({
    msg,
    threadId,
    isReply,
  }: {
    msg: Message;
    threadId: string;
    isReply?: boolean;
  }) {
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
          <p className="text-neutral-300 text-sm mt-0.5 break-words whitespace-pre-line">
            {msg.content}
          </p>
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
              {translating === msg.id
                ? "Translating..."
                : translations[msg.id]
                  ? "Hide translation"
                  : "Translate"}
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
            {session?.user?.id &&
              (session.user.id === msg.userId || session.user.id === postAuthorId) && (
                <button
                  type="button"
                  onClick={() => handleDelete(msg)}
                  className="text-xs text-neutral-600 hover:text-red-400 transition"
                >
                  Delete
                </button>
              )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {topLevel.length === 0 ? (
        <p className="text-center text-neutral-600 text-sm py-4">{emptyText}</p>
      ) : (
        topLevel.map((top) => {
          const replies = repliesFor(top.id);
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
                    {open ? "Hide" : "View"} {replies.length}{" "}
                    {replies.length === 1 ? "reply" : "replies"}
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
        })
      )}

      {session && (
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="text"
            value={input}
            autoFocus={autoFocusComposer}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            className="flex-1 min-w-0 px-3 py-2 border border-neutral-700 rounded-lg text-sm text-neutral-100 bg-neutral-800 placeholder-neutral-500 focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="shrink-0 bg-neutral-700 text-neutral-100 px-4 py-2 rounded-lg text-sm hover:bg-neutral-600 disabled:opacity-50 transition"
          >
            Send
          </button>
        </form>
      )}
    </div>
  );
}
