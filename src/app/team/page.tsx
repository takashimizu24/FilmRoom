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
  memberships: { id: string; role: string; user: { id: string; name: string; email: string } }[];
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`transition-transform ${open ? "rotate-180" : ""}`}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
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
  const [editMembers, setEditMembers] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);

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

  async function handleRemoveMember(userId: string, name: string) {
    if (!team) return;
    if (!window.confirm(`Remove ${name} from the team?`)) return;
    const res = await fetch(`/api/teams/${team.id}/members/${userId}`, { method: "DELETE" });
    if (res.ok) {
      setTeam({
        ...team,
        memberships: team.memberships.filter((m) => m.user.id !== userId),
      });
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Couldn't remove that member.");
    }
  }

  async function handleDeleteTeam() {
    if (!team || confirmName.trim() !== team.name) return;
    setDeleting(true);
    const res = await fetch(`/api/teams/${team.id}`, { method: "DELETE" });
    if (res.ok) {
      // Drop the active-team cookie so the home page re-selects another team.
      document.cookie = "activeTeamId=; path=/; max-age=0";
      window.location.href = "/";
    } else {
      setDeleting(false);
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Couldn't delete the team.");
    }
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

  const iAmAdmin =
    team.memberships.find((m) => m.user.id === session.user?.id)?.role === "admin";

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="glass rounded-xl p-6 mb-6">
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

      <div className="glass rounded-xl overflow-hidden">
        <div className="bg-white/5 px-4 py-3 border-b border-white/10 flex items-center justify-between gap-2">
          <h2 className="font-semibold text-neutral-300">
            Members ({team.memberships.length})
          </h2>
          {iAmAdmin && team.memberships.length > 1 && (
            <button
              onClick={() => setEditMembers((v) => !v)}
              className="text-xs text-neutral-400 hover:text-neutral-100 transition inline-flex items-center gap-1"
            >
              {editMembers ? "Done" : (<><EditIcon /> Edit</>)}
            </button>
          )}
        </div>
        <ul className="divide-y divide-white/10">
          {team.memberships.map((m) => {
            const isMe = m.user.id === session.user?.id;
            return (
              <li key={m.id} className="px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center text-neutral-300 text-sm font-bold shrink-0">
                  {m.user.name[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-neutral-200 truncate">{m.user.name}</span>
                    {m.role === "admin" && (
                      <span className="shrink-0 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-neutral-700 text-neutral-200">
                        Admin
                      </span>
                    )}
                    {isMe && <span className="shrink-0 text-xs text-neutral-600">(you)</span>}
                  </div>
                  <div className="text-xs text-neutral-600 truncate">{m.user.email}</div>
                </div>
                {iAmAdmin && !isMe && editMembers && (
                  <button
                    onClick={() => handleRemoveMember(m.user.id, m.user.name)}
                    className="shrink-0 text-xs font-medium text-red-400 hover:text-red-300 border border-red-400/40 hover:border-red-300/70 rounded-md px-2.5 py-1 transition"
                  >
                    Remove
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <GroupManager teamId={team.id} />
      <TagManager teamId={team.id} />

      {iAmAdmin && (
        <div className="mt-6 glass rounded-xl overflow-hidden">
          <button
            onClick={() => {
              setShowSettings((v) => {
                const next = !v;
                if (!next) {
                  // Collapsing settings disarms the delete flow.
                  setShowDelete(false);
                  setConfirmName("");
                }
                return next;
              });
            }}
            className="w-full flex items-center justify-between px-4 py-3 text-neutral-300 hover:bg-white/5 transition"
            aria-expanded={showSettings}
          >
            <span className="font-semibold inline-flex items-center gap-2">
              <GearIcon /> 設定
            </span>
            <ChevronIcon open={showSettings} />
          </button>

          {showSettings && (
            <div className="px-4 pb-4 pt-2 border-t border-white/10">
              <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
                <h3 className="text-sm font-semibold text-red-300">チームを削除</h3>
                <p className="text-xs text-neutral-400 mt-1 mb-3">
                  投稿・動画・コメント・タグ・グループがすべて完全に削除されます。元に戻せません。
                </p>

                {!showDelete ? (
                  <button
                    onClick={() => setShowDelete(true)}
                    className="text-xs font-medium text-red-400 hover:text-red-300 border border-red-400/40 hover:border-red-300/70 rounded-md px-3 py-1.5 transition"
                  >
                    チームを削除する
                  </button>
                ) : (
                  <div className="space-y-2">
                    <label className="block text-xs text-neutral-400">
                      最終確認：チーム名{" "}
                      <span className="text-neutral-200 font-medium">{team.name}</span>{" "}
                      を正確に入力すると削除ボタンが押せます。
                    </label>
                    <input
                      type="text"
                      value={confirmName}
                      onChange={(e) => setConfirmName(e.target.value)}
                      placeholder={team.name}
                      autoComplete="off"
                      className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-100 placeholder-neutral-600 focus:ring-2 focus:ring-red-500/50 focus:border-transparent"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleDeleteTeam}
                        disabled={deleting || confirmName.trim() !== team.name}
                        className="text-xs font-medium text-white bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-md px-3 py-1.5 transition"
                      >
                        {deleting ? "削除中…" : "完全に削除する"}
                      </button>
                      <button
                        onClick={() => {
                          setShowDelete(false);
                          setConfirmName("");
                        }}
                        className="text-xs text-neutral-400 hover:text-neutral-200 px-3 py-1.5"
                      >
                        キャンセル
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 text-center">
        <Link href="/teams/new" className="text-sm text-neutral-500 hover:text-neutral-300 transition">
          + Join or create another team
        </Link>
      </div>
    </div>
  );
}
