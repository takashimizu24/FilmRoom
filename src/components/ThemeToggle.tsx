"use client";

import { useSyncExternalStore } from "react";
import { readThemePref, setThemePref, subscribeThemePref, type ThemePref } from "@/lib/theme";

const MonitorIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="block">
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
);

const SunIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="block">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

const MoonIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="block">
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);

const OPTIONS: { value: ThemePref; label: string; icon: () => React.ReactElement }[] = [
  { value: "system", label: "自動", icon: MonitorIcon },
  { value: "light", label: "ライト", icon: SunIcon },
  { value: "dark", label: "ダーク", icon: MoonIcon },
];

const serverPref = (): ThemePref => "system";

export default function ThemeToggle() {
  // The preference lives in localStorage, which the server can't see — so it's
  // read as an external store, with "system" as the server-side snapshot.
  // Following the OS live is handled by the init script in the layout, which
  // stays subscribed whether or not this menu is open.
  const pref = useSyncExternalStore(subscribeThemePref, readThemePref, serverPref);

  return (
    <div>
      <div className="text-xs text-neutral-500 mb-1.5">外観</div>
      <div className="flex gap-1 p-1 rounded-lg bg-lift border border-line">
        {OPTIONS.map((o) => {
          const active = pref === o.value;
          const Icon = o.icon;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => setThemePref(o.value)}
              aria-pressed={active}
              className={`flex-1 flex flex-col items-center gap-1 py-1.5 rounded-md text-[11px] transition ${
                active
                  ? "bg-lift-3 text-neutral-100"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-lift-2"
              }`}
            >
              <Icon />
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
