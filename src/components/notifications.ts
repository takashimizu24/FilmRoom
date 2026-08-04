// Client-side "seen" tracking for the お知らせ (notifications) feed. We derive
// notifications from existing posts/comments, so "unread" is just: created after
// the last time this user opened the notifications screen. Stored per team in
// localStorage — no server state or migration needed.

export function notifSeenKey(teamId: string): string {
  return `filmroom:notifSeen:${teamId}`;
}

export function getNotifSeen(teamId: string): number {
  try {
    return Number(localStorage.getItem(notifSeenKey(teamId)) ?? 0);
  } catch {
    return 0;
  }
}

export function markNotificationsSeen(teamId: string): void {
  try {
    localStorage.setItem(notifSeenKey(teamId), String(Date.now()));
    // Let the bottom-nav badge update immediately in this tab.
    window.dispatchEvent(new Event("filmroom:notifSeen"));
  } catch {
    /* ignore */
  }
}
