"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { getNotifSeen } from "./notifications";

const HomeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></svg>
);
const BellIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
);
const PlusIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
);
const TeamIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
);

type ActivityItem = { createdAt: string; actorId: string };

// Bottom tab bar for phones — a familiar app-style nav. Hidden on ≥sm where the
// header already carries navigation. The お知らせ tab shows an unread dot.
export default function BottomNav() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [teamId, setTeamId] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);

  // Resolve the active team once logged in.
  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/teams")
      .then((r) => r.json())
      .then((teams: { id: string }[]) => {
        if (!teams.length) return;
        const activeId = document.cookie.match(/activeTeamId=([^;]+)/)?.[1];
        setTeamId(teams.some((t) => t.id === activeId) ? activeId! : teams[0].id);
      })
      .catch(() => {});
  }, [status, pathname]);

  // Poll activity and count items newer than "seen" (excluding my own actions).
  useEffect(() => {
    if (!teamId || !session?.user?.id) return;
    let stop = false;
    const recompute = (items: ActivityItem[]) => {
      const seen = getNotifSeen(teamId);
      setUnread(
        items.filter((i) => new Date(i.createdAt).getTime() > seen && i.actorId !== session.user!.id).length
      );
    };
    let latest: ActivityItem[] = [];
    async function tick() {
      try {
        const items = await fetch(`/api/activity?teamId=${teamId}`).then((r) => (r.ok ? r.json() : []));
        if (stop) return;
        latest = Array.isArray(items) ? items : [];
        recompute(latest);
      } catch {
        /* ignore */
      }
    }
    tick();
    const interval = setInterval(tick, 45000);
    const onSeen = () => recompute(latest);
    window.addEventListener("filmroom:notifSeen", onSeen);
    return () => {
      stop = true;
      clearInterval(interval);
      window.removeEventListener("filmroom:notifSeen", onSeen);
    };
  }, [teamId, session?.user?.id]);

  // Only for logged-in app screens; keep it out of the auth pages.
  if (status !== "authenticated") return null;
  if (pathname === "/login" || pathname === "/register") return null;

  const tabs = [
    { href: "/", label: "ホーム", icon: <HomeIcon />, active: pathname === "/" },
    { href: "/notifications", label: "お知らせ", icon: <BellIcon />, active: pathname === "/notifications", badge: unread },
    { href: "/posts/new", label: "投稿", icon: <PlusIcon />, active: pathname === "/posts/new" },
    { href: "/team", label: "チーム", icon: <TeamIcon />, active: pathname === "/team" },
  ];

  return (
    <nav
      className="sm:hidden fixed inset-x-3 z-50 rounded-2xl glass-strong border border-white/15 shadow-xl shadow-black/40 overflow-hidden"
      style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      <ul className="flex items-stretch">
        {tabs.map((t) => (
          <li key={t.href} className="flex-1">
            <Link
              href={t.href}
              className={`relative flex flex-col items-center justify-center gap-0.5 py-2.5 transition ${
                t.active ? "text-sky-300" : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              <span className="relative">
                {t.icon}
                {!!t.badge && t.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-sky-500 text-white text-[10px] font-bold leading-4 text-center">
                    {t.badge > 9 ? "9+" : t.badge}
                  </span>
                )}
              </span>
              <span className="text-[10px] font-medium">{t.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
