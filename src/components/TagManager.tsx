"use client";

import { useEffect, useState } from "react";
import { contrastText } from "@/lib/color";

interface Tag {
  name: string;
  count: number;
  color: string | null;
  tagGroupId: string | null;
}

interface TagGroup {
  id: string;
  name: string;
}

const UNGROUPED = "__ungrouped__";

export default function TagManager({ teamId }: { teamId: string }) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [groups, setGroups] = useState<TagGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [newGroup, setNewGroup] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/tags?teamId=${teamId}`).then((r) => (r.ok ? r.json() : [])),
      fetch(`/api/tag-groups?teamId=${teamId}`).then((r) => (r.ok ? r.json() : [])),
    ]).then(([t, g]) => {
      setTags(Array.isArray(t) ? t : []);
      setGroups(Array.isArray(g) ? g : []);
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

  async function setGroup(name: string, tagGroupId: string | null) {
    setTags((prev) => prev.map((t) => (t.name === name ? { ...t, tagGroupId } : t)));
    await fetch(`/api/tags`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId, name, tagGroupId }),
    });
  }

  async function addGroup(e: React.FormEvent) {
    e.preventDefault();
    const name = newGroup.trim();
    if (!name || creating) return;
    setCreating(true);
    setError(null);
    const res = await fetch(`/api/tag-groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId, name }),
    });
    setCreating(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "グループを作成できませんでした");
      return;
    }
    const created: TagGroup = await res.json();
    setGroups((prev) => [...prev, created]);
    setNewGroup("");
  }

  async function removeGroup(g: TagGroup) {
    if (!window.confirm(`グループ「${g.name}」を削除しますか？（タグ自体は残ります）`)) return;
    const res = await fetch(`/api/tag-groups?id=${g.id}`, { method: "DELETE" });
    if (!res.ok) return;
    setGroups((prev) => prev.filter((x) => x.id !== g.id));
    setTags((prev) => prev.map((t) => (t.tagGroupId === g.id ? { ...t, tagGroupId: null } : t)));
  }

  // Tags listed under their group, with the ungrouped ones last.
  const sections = [
    ...groups.map((g) => ({ key: g.id, title: g.name, group: g, items: tags.filter((t) => t.tagGroupId === g.id) })),
    { key: UNGROUPED, title: "未分類", group: null, items: tags.filter((t) => !t.tagGroupId) },
  ].filter((s) => s.group !== null || s.items.length > 0);

  return (
    <div className="glass rounded-xl overflow-hidden mt-6">
      <div className="bg-white/5 px-4 py-3 border-b border-white/10">
        <h2 className="font-semibold text-neutral-300">タグ</h2>
        <p className="text-xs text-neutral-500 mt-0.5">
          グループを作ると、タグが増えても一覧が見やすくなります。
        </p>
      </div>

      {loading ? (
        <div className="px-4 py-3 text-sm text-neutral-500">Loading...</div>
      ) : (
        <>
          <div className="px-4 py-3 border-b border-white/10">
            <form onSubmit={addGroup} className="flex gap-2">
              <input
                type="text"
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value)}
                placeholder="新しいタググループ名（例：オフェンス）"
                className="flex-1 min-w-0 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-100 placeholder-neutral-500 focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
              />
              <button
                type="submit"
                disabled={creating || !newGroup.trim()}
                className="shrink-0 px-4 py-2 bg-neutral-700 hover:bg-neutral-600 disabled:opacity-40 rounded-lg text-sm text-neutral-100 transition"
              >
                追加
              </button>
            </form>
            {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
          </div>

          {tags.length === 0 ? (
            <div className="px-4 py-3 text-sm text-neutral-500">
              まだタグがありません。投稿やクリップにタグを付けるとここに表示されます。
            </div>
          ) : (
            sections.map((section) => (
              <div key={section.key}>
                <div className="px-4 py-2 bg-white/5 border-b border-white/10 flex items-center gap-2">
                  <h3 className="text-xs font-semibold text-neutral-400">
                    {section.title}{" "}
                    <span className="text-neutral-600 font-normal">({section.items.length})</span>
                  </h3>
                  <div className="flex-1" />
                  {section.group && (
                    <button
                      onClick={() => removeGroup(section.group!)}
                      className="text-xs text-neutral-500 hover:text-red-300 transition"
                    >
                      グループを削除
                    </button>
                  )}
                </div>

                {section.items.length === 0 ? (
                  <p className="px-4 py-3 text-xs text-neutral-600">
                    このグループのタグはまだありません。下のタグの「グループ」から選ぶと入ります。
                  </p>
                ) : (
                  <ul className="divide-y divide-white/10">
                    {section.items.map((t) => (
                      <li key={t.name} className="px-4 py-3 flex flex-wrap items-center gap-2">
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

                        <select
                          value={t.tagGroupId ?? ""}
                          onChange={(e) => setGroup(t.name, e.target.value || null)}
                          aria-label={`#${t.name} のグループ`}
                          className="shrink-0 max-w-[9rem] bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-neutral-300 px-2 py-1.5 focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                        >
                          <option value="">未分類</option>
                          {groups.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name}
                            </option>
                          ))}
                        </select>

                        <input
                          type="color"
                          value={t.color || "#3b82f6"}
                          onChange={(e) => setColor(t.name, e.target.value)}
                          className="w-8 h-8 rounded cursor-pointer bg-transparent border border-neutral-700 p-0 shrink-0"
                          title="色を選ぶ"
                        />
                        {t.color && (
                          <button
                            onClick={() => setColor(t.name, null)}
                            className="text-xs text-neutral-500 hover:text-neutral-300 transition shrink-0"
                          >
                            Clear
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}
