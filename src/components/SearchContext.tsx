"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

// Shared title-search term so the box can live in the (global) header while the
// home page does the actual filtering.
const SearchCtx = createContext<{
  titleQuery: string;
  setTitleQuery: (v: string) => void;
}>({ titleQuery: "", setTitleQuery: () => {} });

export function useSearch() {
  return useContext(SearchCtx);
}

export function SearchProvider({ children }: { children: ReactNode }) {
  const [titleQuery, setTitleQuery] = useState("");
  return (
    <SearchCtx.Provider value={{ titleQuery, setTitleQuery }}>
      {children}
    </SearchCtx.Provider>
  );
}
