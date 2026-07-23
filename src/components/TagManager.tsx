"use client";

import { useEffect, useState } from "react";
import { contrastText } from "@/lib/color";

interface Tag {
  name: string;
  count: number;
  color: string | null;
}

export default function TagManager({ teamId }: { teamId: string }) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/tags?teamId=${teamId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        setTags(Array.isArray(d) ? d : []);
        setLoading(false);
      });
  }, [teamId]);

  async function setColor(name: string, color: string | null) {
    setTags((prev) => prev.map((t) => (t.name === name ? { ...t, color } : t)));
    await fetch(`/api/tags`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId, name, color }),
    });
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden mt-6">
      <div className="bg-neutral-800 px-4 py-3 border-b border-neutral-700">
        <h2 className="font-semibold text-neutral-300">Tag Colors</h2>
      </div>
      {loading ? (
        <div className="px-4 py-3 text-sm text-neutral-500">Loading...</div>
      ) : tags.length === 0 ? (
        <div className="px-4 py-3 text-sm text-neutral-500">
          No tags yet. Tags appear here once you add them to posts or clips.
        </div>
      ) : (
        <ul className="divide-y divide-neutral-800">
          {tags.map((t) => (
            <li key={t.name} className="px-4 py-3 flex items-center gap-3">
              <span
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs"
                style={{
                  backgroundColor: t.color || "#262626",
                  color: t.color ? contrastText(t.color) : "#a3a3a3",
                }}
              >
                #{t.name}
              </span>
              <span className="text-xs text-neutral-600">({t.count})</span>
              <div className="flex-1" />
              <input
                type="color"
                value={t.color || "#3b82f6"}
                onChange={(e) => setColor(t.name, e.target.value)}
                className="w-8 h-8 rounded cursor-pointer bg-transparent border border-neutral-700 p-0"
                title="Pick a color"
              />
              {t.color && (
                <button
                  onClick={() => setColor(t.name, null)}
                  className="text-xs text-neutral-500 hover:text-neutral-300 transition"
                >
                  Clear
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
