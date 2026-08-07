"use client";

import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useUnreadNotifications } from "./useUnreadNotifications";

// Icons come in a hairline outline and a solid variant: like Instagram's bar,
// the selected tab switches to the solid shape instead of changing colour.
const svg = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const HomeIcon = ({ solid = false }: { solid?: boolean }) =>
  solid ? (
    <svg {...svg} fill="currentColor" stroke="none">
      <path d="M11.3 2.6a1 1 0 0 1 1.4 0l8 7.4a1 1 0 0 1 .3.8V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9.2a1 1 0 0 1 .3-.8z" />
    </svg>
  ) : (
    <svg {...svg} fill="none" stroke="currentColor" strokeWidth={1.9}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  );

const BellIcon = ({ solid = false }: { solid?: boolean }) =>
  solid ? (
    <svg {...svg} fill="currentColor" stroke="none">
      <path d="M12 2a6 6 0 0 0-6 6c0 6-3 8.5-3 8.5a1 1 0 0 0 .8 1.5h16.4a1 1 0 0 0 .8-1.5S18 14 18 8a6 6 0 0 0-6-6z" />
      <path d="M10 20a2 2 0 0 0 4 0z" />
    </svg>
  ) : (
    <svg {...svg} fill="none" stroke="currentColor" strokeWidth={1.9}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );

// The compose action keeps the same outlined square-with-plus in both states,
// matching how Instagram draws its create button.
const PlusIcon = ({ solid = false }: { solid?: boolean }) => (
  <svg {...svg} fill="none" stroke="currentColor" strokeWidth={solid ? 2.4 : 1.9}>
    <rect x="3" y="3" width="18" height="18" rx="5.5" />
    <path d="M12 8.5v7M8.5 12h7" />
  </svg>
);

const TeamIcon = ({ solid = false }: { solid?: boolean }) =>
  solid ? (
    <svg {...svg} fill="currentColor" stroke="none">
      <circle cx="9" cy="7" r="4" />
      <path d="M2 20a7 7 0 0 1 14 0 1 1 0 0 1-1 1H3a1 1 0 0 1-1-1z" />
      <path d="M17.5 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" opacity=".75" />
      <path d="M17.5 12.5c2.6 0 4.5 2 4.5 4.5a1 1 0 0 1-1 1h-3.4c.26-.6.4-1.28.4-2a8.5 8.5 0 0 0-1.4-4.7 5 5 0 0 1 .9.2z" opacity=".75" />
    </svg>
  ) : (
    <svg {...svg} fill="none" stroke="currentColor" strokeWidth={1.9}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );

// Bottom tab bar for phones — a familiar app-style nav. Hidden on ≥sm where the
// header already carries navigation. The お知らせ tab shows an unread dot.
export default function BottomNav() {
  const { status } = useSession();
  const pathname = usePathname();
  const unread = useUnreadNotifications();

  // Only for logged-in app screens; keep it out of the auth pages.
  if (status !== "authenticated") return null;
  if (pathname === "/login" || pathname === "/register") return null;

  const tabs = [
    { href: "/", label: "ホーム", Icon: HomeIcon, active: pathname === "/" },
    { href: "/notifications", label: "お知らせ", Icon: BellIcon, active: pathname === "/notifications", badge: unread },
    { href: "/posts/new", label: "投稿", Icon: PlusIcon, active: pathname === "/posts/new" },
    { href: "/team", label: "チーム", Icon: TeamIcon, active: pathname === "/team" },
  ];

  return (
    // A floating capsule of icons, Instagram-style: no labels, and the selected
    // tab is marked by a lighter pill behind a solid icon rather than by colour.
    // `pointer-events-none` on the wrapper keeps the gaps beside the bar tappable.
    <nav
      className="sm:hidden fixed inset-x-0 z-50 flex justify-center pointer-events-none"
      style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      <ul
        className="pointer-events-auto flex items-center gap-1 px-2 py-1.5 rounded-full glass-strong border border-white/15 shadow-xl shadow-black/40"
        style={{ backgroundColor: "rgba(17, 17, 20, 0.5)" }}
      >
        {tabs.map((t) => (
          <li key={t.href}>
            <Link
              href={t.href}
              aria-label={t.label}
              aria-current={t.active ? "page" : undefined}
              className={`relative flex h-11 w-14 items-center justify-center rounded-full transition ${
                t.active ? "bg-white/15 text-white" : "text-neutral-300 hover:bg-white/5 hover:text-white"
              }`}
            >
              <t.Icon solid={t.active} />
              {!!t.badge && t.badge > 0 && (
                <span className="absolute top-1.5 right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-sky-500 text-white text-[10px] font-bold leading-4 text-center">
                  {t.badge > 9 ? "9+" : t.badge}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
