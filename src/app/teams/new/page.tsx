"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";

export default function NewTeamPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [teamName, setTeamName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (status === "loading") {
    return <div className="max-w-md mx-auto px-4 py-12 text-center text-neutral-500">Loading...</div>;
  }

  if (!session) {
    return (
      <div className="max-w-md mx-auto px-4 py-12 text-center text-neutral-500">
        Please{" "}
        <Link href="/login" className="text-neutral-300 hover:text-neutral-100 transition">
          log in
        </Link>{" "}
        first.
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const res =
      mode === "create"
        ? await fetch("/api/teams", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: teamName }),
          })
        : await fetch("/api/teams/join", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ inviteCode }),
          });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Something went wrong");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-neutral-100 mb-6 text-center">Add a Team</h1>

      <div className="flex gap-2 mb-6 bg-neutral-900 border border-neutral-800 rounded-lg p-1">
        <button
          type="button"
          onClick={() => setMode("create")}
          className={`flex-1 py-2 rounded-md text-sm transition ${
            mode === "create" ? "bg-neutral-700 text-neutral-100" : "text-neutral-400 hover:text-neutral-200"
          }`}
        >
          Create Team
        </button>
        <button
          type="button"
          onClick={() => setMode("join")}
          className={`flex-1 py-2 rounded-md text-sm transition ${
            mode === "join" ? "bg-neutral-700 text-neutral-100" : "text-neutral-400 hover:text-neutral-200"
          }`}
        >
          Join Team
        </button>
      </div>

      {error && (
        <div className="bg-red-900/30 text-red-400 p-3 rounded-lg mb-4 text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "create" ? (
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-1">Team Name</label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              required
              placeholder="e.g. UENOHARA SUNRISE"
              className="w-full px-4 py-2 border border-neutral-700 rounded-lg text-neutral-100 bg-neutral-800 placeholder-neutral-500 focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
            />
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-neutral-400 mb-1">Invite Code</label>
            <input
              type="text"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              required
              placeholder="e.g. A1B2C3D4"
              className="w-full px-4 py-2 border border-neutral-700 rounded-lg text-neutral-100 bg-neutral-800 placeholder-neutral-500 focus:ring-2 focus:ring-neutral-500 focus:border-transparent uppercase"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-neutral-700 text-neutral-100 py-2 rounded-lg hover:bg-neutral-600 disabled:opacity-50 transition"
        >
          {submitting ? "Please wait..." : mode === "create" ? "Create Team" : "Join Team"}
        </button>
      </form>
    </div>
  );
}
