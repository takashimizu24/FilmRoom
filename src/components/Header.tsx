"use client";

import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";

interface Team {
  id: string;
  name: string;
}

interface TagCount {
  name: string;
  count: number;
}

const PlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className="block">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const GearIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="block">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export default function Header() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [activeTagParam, setActiveTagParam] = useState("");

  useEffect(() => {
    setActiveTagParam(new URLSearchParams(window.location.search).get("tag") ?? "");
  }, [pathname]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [tags, setTags] = useState<TagCount[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!session) return;
    fetch("/api/teams")
      .then((res) => res.json())
      .then((data: Team[]) => {
        setTeams(data);
        const cookieId = document.cookie.match(/activeTeamId=([^;]+)/)?.[1];
        setActiveTeamId(cookieId && data.some((t) => t.id === cookieId) ? cookieId : data[0]?.id ?? null);
      });
  }, [session, pathname]);

  useEffect(() => {
    if (!activeTeamId) return;
    fetch(`/api/tags?teamId=${activeTeamId}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: TagCount[]) => setTags(data))
      .catch(() => setTags([]));
  }, [activeTeamId, pathname]);

  // Close the settings menu when clicking outside.
  useEffect(() => {
    if (!menuOpen) return;
    function onDocMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [menuOpen]);

  async function handleTeamChange(teamId: string) {
    setActiveTeamId(teamId);
    await fetch("/api/teams/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId }),
    });
    window.location.href = "/";
  }

  function handleTagSearch(name: string) {
    if (!name) return;
    // Picking the tag that's already the active filter resets it instead of re-applying it.
    const alreadyActive = pathname === "/" && activeTagParam === name;
    window.location.href = alreadyActive ? "/" : `/?tag=${encodeURIComponent(name)}`;
  }

  return (
    <header className="bg-neutral-900 border-b border-neutral-800 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2 sm:gap-4">
        <Link href="/" className="shrink-0 flex items-center" aria-label="FilmRoom home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="FilmRoom" className="h-7 sm:h-8 w-auto" />
        </Link>
        <nav className="flex items-center gap-2 sm:gap-3 min-w-0">
          {session ? (
            <>
              {tags.length > 0 && (
                <select
                  value=""
                  onChange={(e) => handleTagSearch(e.target.value)}
                  aria-label="Search by tag"
                  className="h-9 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-300 px-2 focus:ring-2 focus:ring-neutral-500 focus:border-transparent shrink-0 max-w-[7.5rem]"
                >
                  <option value="" disabled>
                    🔍 Tags
                  </option>
                  {tags.map((t) => (
                    <option key={t.name} value={t.name}>
                      #{t.name} ({t.count})
                    </option>
                  ))}
                </select>
              )}

              <Link
                href="/posts/new"
                aria-label="New Post"
                className="bg-neutral-700 text-neutral-100 h-9 w-9 sm:w-auto sm:pl-2.5 sm:pr-3 rounded-lg text-sm hover:bg-neutral-600 transition inline-flex items-center justify-center sm:justify-start gap-1.5 shrink-0"
              >
                <PlusIcon />
                <span className="hidden sm:inline">New Post</span>
              </Link>

              {/* Settings menu — contains account, team, and log out */}
              <div className="relative shrink-0" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-label="Settings"
                  aria-expanded={menuOpen}
                  className="inline-flex items-center justify-center h-9 w-9 rounded-lg text-neutral-300 hover:text-white hover:bg-neutral-800 transition"
                >
                  <GearIcon />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-60 bg-neutral-900 border border-neutral-800 rounded-lg shadow-xl overflow-hidden z-50 text-sm">
                    <div className="px-4 py-3 border-b border-neutral-800">
                      <div className="text-neutral-200 font-medium truncate">{session.user?.name}</div>
                      {session.user?.email && (
                        <div className="text-xs text-neutral-500 truncate">{session.user.email}</div>
                      )}
                    </div>

                    {teams.length > 1 && activeTeamId && (
                      <div className="px-4 py-3 border-b border-neutral-800">
                        <div className="text-xs text-neutral-500 mb-1">Active team</div>
                        <select
                          value={activeTeamId}
                          onChange={(e) => handleTeamChange(e.target.value)}
                          className="w-full bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-200 px-2 py-1.5 focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                        >
                          {teams.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <Link
                      href="/team"
                      onClick={() => setMenuOpen(false)}
                      className="block px-4 py-2.5 text-neutral-300 hover:bg-neutral-800 transition"
                    >
                      Team settings
                    </Link>
                    <button
                      onClick={() => signOut()}
                      className="block w-full text-left px-4 py-2.5 text-neutral-300 hover:bg-neutral-800 transition"
                    >
                      Log Out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <Link href="/login" className="text-sm text-neutral-400 hover:text-neutral-200 transition">
              Log In
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
