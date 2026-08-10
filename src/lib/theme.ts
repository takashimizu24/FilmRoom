// Theme preference: a per-device choice between following the OS and pinning
// one of the two palettes. The palettes themselves live in globals.css; all
// this does is put `data-theme` on <html>.

export type ThemePref = "system" | "light" | "dark";

export const THEME_KEY = "filmroom-theme";

/** Background of each theme, mirrored to <meta name="theme-color"> so the
 *  iOS status bar and the browser chrome match the page. */
const THEME_COLOR = { dark: "#08080a", light: "#fbfbfd" };

export function readThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    // Private mode / storage disabled — fall through to the default.
  }
  return "system";
}

export function resolveTheme(pref: ThemePref): "light" | "dark" {
  if (pref !== "system") return pref;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

// The preference lives in localStorage rather than React state, so components
// subscribe to it as an external store.
const listeners = new Set<() => void>();

export function subscribeThemePref(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function setThemePref(pref: ThemePref) {
  try {
    localStorage.setItem(THEME_KEY, pref);
  } catch {
    // Preference just won't persist; the current page still switches.
  }
  applyTheme(pref);
  listeners.forEach((l) => l());
}

export function applyTheme(pref: ThemePref) {
  const theme = resolveTheme(pref);
  document.documentElement.setAttribute("data-theme", theme);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLOR[theme]);
}

/**
 * The same logic as a string, run at the top of the body so it lands before the
 * first paint — otherwise the page would render dark (the CSS default) and only
 * flip to light once React had hydrated, a visible flash.
 *
 * It also subscribes to the OS setting for the lifetime of the page, so
 * "follow the system" keeps working after the settings menu is closed (and
 * through iOS's scheduled light/dark switch).
 */
export const themeInitScript = `(function(){function a(){try{var p=localStorage.getItem(${JSON.stringify(
  THEME_KEY
)});if(p!=='light'&&p!=='dark')p=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';document.documentElement.setAttribute('data-theme',p);var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',p==='light'?${JSON.stringify(
  THEME_COLOR.light
)}:${JSON.stringify(
  THEME_COLOR.dark
)});}catch(e){}}a();try{window.matchMedia('(prefers-color-scheme: light)').addEventListener('change',a);}catch(e){}})();`;
