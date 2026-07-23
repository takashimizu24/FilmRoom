"use client";

import { useEffect, useState } from "react";

interface Group {
  id: string;
  name: string;
  color: string | null;
  count: number;
}

export default function GroupManager({ teamId }: { teamId: string }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#3b82f6");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/groups?teamId=${teamId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        setGroups(Array.isArray(d) ? d : []);
        setLoading(false);
      });
  }, [teamId]);

  async function create() {
    if (!newName.trim()) return;
    setCreating(true);
    setError("");
    const res = await fetch(`/api/groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId, name: newName.trim(), color: newColor }),
    });
    setCreating(false);
    if (res.ok) {
      const g = await res.json();
      setGroups((prev) => [...prev, { id: g.id, name: g.name, color: g.color, count: 0 }]);
      setNewName("");
    } else {
      const d = await res.json();
      setError(d.error || "Failed to create group");
    }
  }

  async function updateColor(id: string, color: string) {
    setGroups((prev) => prev.map((g) => (g.id === id ? { ...g, color } : g)));
    await fetch(`/api/groups/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ color }),
    });
  }

  async function rename(id: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    await fetch(`/api/groups/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
  }

  async function remove(id: string) {
    if (!confirm("Delete this group? Its posts are kept (they just become ungrouped).")) return;
    await fetch(`/api/groups/${id}`, { method: "DELETE" });
    setGroups((prev) => prev.filter((g) => g.id !== id));
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden mt-6">
      <div className="bg-neutral-800 px-4 py-3 border-b border-neutral-700">
        <h2 className="font-semibold text-neutral-300">Groups</h2>
      </div>

      {loading ? (
        <div className="px-4 py-3 text-sm text-neutral-500">Loading...</div>
      ) : (
        <ul className="divide-y divide-neutral-800">
          {groups.map((g) => (
            <li key={g.id} className="px-4 py-3 flex items-center gap-3">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: g.color || "#525252" }}
              />
              <input
                type="text"
                defaultValue={g.name}
                onBlur={(e) => rename(g.id, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                className="flex-1 min-w-0 bg-transparent text-sm text-neutral-200 border-b border-transparent focus:border-neutral-600 focus:outline-none px-1 py-0.5"
              />
              <span className="text-xs text-neutral-600 shrink-0">({g.count})</span>
              <input
                type="color"
                value={g.color || "#3b82f6"}
                onChange={(e) => updateColor(g.id, e.target.value)}
                className="w-8 h-8 rounded cursor-pointer bg-transparent border border-neutral-700 p-0 shrink-0"
                title="Pick a color"
              />
              <button
                onClick={() => remove(g.id)}
                className="text-xs text-neutral-500 hover:text-red-400 transition shrink-0"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Add group */}
      <div className="px-4 py-3 border-t border-neutral-800 flex items-center gap-2">
        <input
          type="color"
          value={newColor}
          onChange={(e) => setNewColor(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer bg-transparent border border-neutral-700 p-0 shrink-0"
          title="Group color"
        />
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") create();
          }}
          placeholder="New group name (e.g. Games, Practice)"
          className="flex-1 min-w-0 px-3 py-1.5 border border-neutral-700 rounded-lg text-sm text-neutral-100 bg-neutral-800 placeholder-neutral-500 focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
        />
        <button
          onClick={create}
          disabled={creating || !newName.trim()}
          className="px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50 rounded-lg text-sm text-neutral-100 transition shrink-0"
        >
          Add
        </button>
      </div>
      {error && <div className="px-4 pb-3 text-xs text-red-400">{error}</div>}
    </div>
  );
}
