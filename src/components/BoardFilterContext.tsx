"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";

// Everything that narrows the board: the title search, the group filter and the
// tag filter. It lives here rather than on the page because the controls are in
// the header's menu (which is rendered by the layout) while the filtering is
// done by the board itself.
type BoardFilter = {
  titleQuery: string;
  setTitleQuery: (v: string) => void;

  activeGroupId: string | null;
  setActiveGroupId: (id: string | null) => void;

  activeTags: string[];
  setActiveTags: (tags: string[]) => void;
  toggleTag: (name: string) => void;

  matchMode: "and" | "or";
  setMatchMode: (m: "and" | "or") => void;

  /** True when anything is narrowing the board. */
  filtering: boolean;
  clearFilters: () => void;
};

const Ctx = createContext<BoardFilter>({
  titleQuery: "",
  setTitleQuery: () => {},
  activeGroupId: null,
  setActiveGroupId: () => {},
  activeTags: [],
  setActiveTags: () => {},
  toggleTag: () => {},
  matchMode: "and",
  setMatchMode: () => {},
  filtering: false,
  clearFilters: () => {},
});

export function useBoardFilter() {
  return useContext(Ctx);
}

export function BoardFilterProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [titleQuery, setTitleQuery] = useState("");
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [matchMode, setMatchMode] = useState<"and" | "or">("and");

  const toggleTag = useCallback((name: string) => {
    setActiveTags((prev) => (prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name]));
  }, []);

  const clearFilters = useCallback(() => {
    setActiveTags([]);
    setTitleQuery("");
    setActiveGroupId(null);
  }, []);

  // ?tag= is a board URL, so a filtered board survives a reload and can be
  // shared. Only written while the board is the page being looked at — picking a
  // tag from somewhere else navigates here first, and this then catches up.
  const urlAdopted = useRef(false);
  useEffect(() => {
    if (pathname !== "/") return;
    // On the very first pass the filter state is still empty while the board is
    // reading ?tag= out of the URL. Writing here would erase the parameter
    // before it has been read, so a shared link would come up unfiltered.
    if (!urlAdopted.current) {
      urlAdopted.current = true;
      return;
    }
    const url = new URL(window.location.href);
    const next = activeTags.join(",");
    if ((url.searchParams.get("tag") ?? "") === next) return;
    if (next) url.searchParams.set("tag", next);
    else url.searchParams.delete("tag");
    // Keep the existing state object: it holds the App Router's own history
    // entry, and replacing it with null leaves router.push() unable to navigate.
    window.history.replaceState(window.history.state, "", url.pathname + url.search);
  }, [activeTags, pathname]);

  const filtering = activeTags.length > 0 || titleQuery.trim() !== "" || activeGroupId !== null;

  return (
    <Ctx.Provider
      value={{
        titleQuery,
        setTitleQuery,
        activeGroupId,
        setActiveGroupId,
        activeTags,
        setActiveTags,
        toggleTag,
        matchMode,
        setMatchMode,
        filtering,
        clearFilters,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
