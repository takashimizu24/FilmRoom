"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useBoardFilter } from "./BoardFilterContext";
import { useUnreadNotifications } from "./useUnreadNotifications";
import FilterDrawer from "./FilterDrawer";

interface Team {
  id: string;
  name: string;
}

const PlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className="block">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="block">
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

const BellIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="block">
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </svg>
);

const MenuIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="block">
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
);

export default function Header() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const { titleQuery, setTitleQuery } = useBoardFilter();
  const unread = useUnreadNotifications();
  const [teams, setTeams] = useState<Team[]>([]);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false); // mobile: reveal title box

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

  async function handleTeamChange(teamId: string) {
    setActiveTeamId(teamId);
    await fetch("/api/teams/active", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamId }),
    });
    window.location.href = "/";
  }

  return (
    <>
      <header className="bg-neutral-900/50 backdrop-blur-xl border-b border-line sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between gap-2 sm:gap-4">
          <Link href="/" className="shrink-0 flex items-center" aria-label="FilmRoom home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="FilmRoom" className="app-logo h-7 sm:h-8 w-auto" />
          </Link>
          <nav className="flex items-center gap-2 min-w-0 flex-1 justify-end">
            {session ? (
              <>
                {/* Title search: inline box on desktop, magnifier-only on mobile
                    (tapping it reveals a full-width box below the header). */}
                {pathname === "/" && (
                  <>
                    <div className="relative hidden sm:block flex-1 min-w-0 max-w-xs">
                      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500">
                        <SearchIcon />
                      </span>
                      <input
                        type="text"
                        value={titleQuery}
                        onChange={(e) => setTitleQuery(e.target.value)}
                        placeholder="Search titles"
                        aria-label="Search by title"
                        className="w-full h-9 pl-8 pr-2 bg-neutral-800/70 border border-neutral-700 rounded-lg text-sm text-neutral-100 placeholder-neutral-500 focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setSearchOpen((o) => !o)}
                      aria-label="Search titles"
                      aria-expanded={searchOpen}
                      className={`sm:hidden inline-flex items-center justify-center h-9 w-9 rounded-lg transition shrink-0 ${
                        searchOpen || titleQuery
                          ? "bg-neutral-800 text-neutral-100"
                          : "text-neutral-300 hover:text-neutral-100 hover:bg-neutral-800"
                      }`}
                    >
                      <SearchIcon />
                    </button>
                  </>
                )}

                {/* Notifications — desktop only (phones use the bottom nav). */}
                <Link
                  href="/notifications"
                  aria-label="お知らせ"
                  className={`hidden sm:inline-flex relative items-center justify-center h-9 w-9 rounded-lg transition shrink-0 ${
                    pathname === "/notifications"
                      ? "bg-neutral-800 text-neutral-100"
                      : "text-neutral-300 hover:text-neutral-100 hover:bg-neutral-800"
                  }`}
                >
                  <BellIcon />
                  {unread > 0 && (
                    <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-sky-500 text-white text-[10px] font-bold leading-4 text-center">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </Link>

                <Link
                  href="/posts/new"
                  aria-label="New Post"
                  className="bg-cta text-cta-ink h-9 w-9 sm:w-auto sm:pl-2.5 sm:pr-3 rounded-lg text-sm hover:bg-cta-hover transition inline-flex items-center justify-center sm:justify-start gap-1.5 shrink-0"
                >
                  <PlusIcon />
                  <span className="hidden sm:inline">New Post</span>
                </Link>

                {/* The menu: group and tag filters, appearance, team, account. */}
                <button
                  type="button"
                  onClick={() => setMenuOpen(true)}
                  aria-label="メニュー"
                  aria-expanded={menuOpen}
                  className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-lg text-neutral-300 hover:text-neutral-100 hover:bg-neutral-800 transition"
                >
                  <MenuIcon />
                </button>
              </>
            ) : (
              <Link href="/login" className="text-sm text-neutral-400 hover:text-neutral-200 transition">
                Log In
              </Link>
            )}
          </nav>
        </div>

        {/* Mobile: the title-search box drops in below the bar when toggled. */}
        {session && pathname === "/" && searchOpen && (
          <div className="sm:hidden border-t border-line px-3 pb-2 pt-2">
            <div className="relative max-w-5xl mx-auto">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500">
                <SearchIcon />
              </span>
              <input
                type="text"
                autoFocus
                value={titleQuery}
                onChange={(e) => setTitleQuery(e.target.value)}
                placeholder="Search titles"
                aria-label="Search by title"
                className="w-full h-10 pl-8 pr-9 bg-neutral-800/70 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
              />
              {titleQuery && (
                <button
                  type="button"
                  onClick={() => setTitleQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded text-neutral-400 hover:text-neutral-100 text-lg leading-none"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        )}

      </header>

      {/* Outside the header: its backdrop-blur makes it a containing block, so a
          fixed drawer nested inside would be trapped in the 56px-tall bar. */}
      {session && (
        <FilterDrawer
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          teamId={activeTeamId}
          teams={teams}
          onTeamChange={handleTeamChange}
          user={session.user ?? undefined}
        />
      )}
    </>
  );
}
