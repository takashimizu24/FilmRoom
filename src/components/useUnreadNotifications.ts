"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { getNotifSeen } from "./notifications";

type ActivityItem = { createdAt: string; actorId: string };

// Number of activity items newer than this user's last visit to お知らせ,
// excluding their own actions. Shared by the mobile bottom nav and the desktop
// header bell so the unread badge stays consistent.
export function useUnreadNotifications(): number {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [teamId, setTeamId] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);

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

  useEffect(() => {
    if (!teamId || !session?.user?.id) return;
    let stop = false;
    let latest: ActivityItem[] = [];
    const recompute = (items: ActivityItem[]) => {
      const seen = getNotifSeen(teamId);
      setUnread(
        items.filter((i) => new Date(i.createdAt).getTime() > seen && i.actorId !== session.user!.id).length
      );
    };
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
  }, [teamId, session?.user?.id, pathname]);

  return unread;
}
