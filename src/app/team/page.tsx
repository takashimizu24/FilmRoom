"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import TagManager from "@/components/TagManager";
import GroupManager from "@/components/GroupManager";

interface TeamDetail {
  id: string;
  name: string;
  inviteCode: string;
  memberships: { id: string; user: { id: string; name: string; email: string } }[];
}

export default function TeamPage() {
  const { data: session, status } = useSession();
  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;

    async function load() {
      const teamsRes = await fetch("/api/teams");
      const teams = await teamsRes.json();
      if (!teams.length) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      const activeId = document.cookie.match(/activeTeamId=([^;]+)/)?.[1];
      const activeTeam = teams.find((t: { id: string }) => t.id === activeId) ?? teams[0];

      const res = await fetch(`/api/teams/${activeTeam.id}`);
      if (res.ok) {
        const data = await res.json();
        setTeam(data);
        setNameInput(data.name);
      }
      setLoading(false);
    }
    load();
  }, [status]);

  async function handleCopy() {
    if (!team) return;
    await navigator.clipboard.writeText(team.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSaveName() {
    if (!team || !nameInput.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/teams/${team.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nameInput.trim() }),
    });
    setSaving(false);
    if (res.ok) {
      const data = await res.json();
      setTeam({ ...team, name: data.name });
      setEditingName(false);
    }
  }

  if (status === "loading" || loading) {
    return <div className="max-w-2xl mx-auto px-4 py-12 text-center text-neutral-500">Loading...</div>;
  }

  if (!session) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center text-neutral-500">
        Please{" "}
        <Link href="/login" className="text-neutral-300 hover:text-neutral-100 transition">
          log in
        </Link>{" "}
        first.
      </div>
    );
  }

  if (notFound || !team) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center text-neutral-500">
        <p className="mb-2">You don&apos;t have a team yet.</p>
        <Link href="/teams/new" className="text-neutral-300 hover:text-neutral-100 transition">
          Create or join a team
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 mb-6">
        {editingName ? (
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="flex-1 px-3 py-1.5 border border-neutral-700 rounded-lg text-neutral-100 bg-neutral-800 focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
            />
            <button
              onClick={handleSaveName}
              disabled={saving}
              className="px-3 py-1.5 bg-neutral-700 hover:bg-neutral-600 rounded-lg text-sm text-neutral-100 transition"
            >
              Save
            </button>
            <button
              onClick={() => {
                setEditingName(false);
                setNameInput(team.name);
              }}
              className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm text-neutral-300 transition"
            >
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-2xl font-bold text-neutral-100">{team.name}</h1>
            <button
              onClick={() => setEditingName(true)}
              className="text-xs text-neutral-500 hover:text-neutral-300 transition"
            >
              Rename
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 mt-4">
          <span className="text-sm text-neutral-500">Invite Code:</span>
          <code className="px-2 py-1 bg-neutral-800 rounded text-neutral-200 text-sm tracking-wider">
            {team.inviteCode}
          </code>
          <button
            onClick={handleCopy}
            className="px-3 py-1 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-xs text-neutral-300 transition"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="text-xs text-neutral-600 mt-2">
          Share this code with teammates so they can join.
        </p>
      </div>

      <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
        <div className="bg-neutral-800 px-4 py-3 border-b border-neutral-700">
          <h2 className="font-semibold text-neutral-300">
            Members ({team.memberships.length})
          </h2>
        </div>
        <ul className="divide-y divide-neutral-800">
          {team.memberships.map((m) => (
            <li key={m.id} className="px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center text-neutral-300 text-sm font-bold shrink-0">
                {m.user.name[0]}
              </div>
              <div>
                <div className="text-sm font-medium text-neutral-200">{m.user.name}</div>
                <div className="text-xs text-neutral-600">{m.user.email}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <GroupManager teamId={team.id} />
      <TagManager teamId={team.id} />

      <div className="mt-6 text-center">
        <Link href="/teams/new" className="text-sm text-neutral-500 hover:text-neutral-300 transition">
          + Join or create another team
        </Link>
      </div>
    </div>
  );
}
