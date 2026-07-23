"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

interface Message {
  id: string;
  content: string;
  createdAt: string;
  user: { name: string };
  userId: string;
}

export default function Chat({ postId }: { postId: string }) {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);
  const prevCountRef = useRef(0);

  async function fetchMessages() {
    const res = await fetch(`/api/posts/${postId}/messages`);
    if (res.ok) {
      const data = await res.json();
      const isNew = data.length > prevCountRef.current;
      prevCountRef.current = data.length;
      setMessages(data);
      if (isNew && chatContainerRef.current) {
        requestAnimationFrame(() => {
          const el = chatContainerRef.current;
          if (el) el.scrollTop = el.scrollHeight;
        });
      }
    }
  }

  useEffect(() => {
    fetchMessages();
    intervalRef.current = setInterval(fetchMessages, 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [postId]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || sending) return;

    setSending(true);
    const res = await fetch(`/api/posts/${postId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: input }),
    });

    if (res.ok) {
      setInput("");
      await fetchMessages();
    }
    setSending(false);
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
      <div className="bg-neutral-800 px-4 py-3 border-b border-neutral-700">
        <h3 className="font-semibold text-neutral-300">Comments</h3>
      </div>
      <div ref={chatContainerRef} className="h-80 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-neutral-600 text-sm py-8">
            No comments yet. Be the first to say something!
          </p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center text-neutral-300 text-sm font-bold shrink-0">
              {msg.user.name[0]}
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium text-neutral-200">{msg.user.name}</span>
                <span className="text-xs text-neutral-600">
                  {new Date(msg.createdAt).toLocaleString("en-US")}
                </span>
              </div>
              <p className="text-neutral-300 text-sm mt-0.5 break-words">{msg.content}</p>
            </div>
          </div>
        ))}
        <div />
      </div>
      <form onSubmit={handleSend} className="border-t border-neutral-700 p-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Write a comment..."
          className="flex-1 px-3 py-2 border border-neutral-700 rounded-lg text-sm text-neutral-100 bg-neutral-800 placeholder-neutral-500 focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
        />
        <button
          type="submit"
          disabled={sending || !input.trim()}
          className="bg-neutral-700 text-neutral-100 px-4 py-2 rounded-lg text-sm hover:bg-neutral-600 disabled:opacity-50 transition"
        >
          Send
        </button>
      </form>
    </div>
  );
}
