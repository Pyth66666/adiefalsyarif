"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getPublicContent } from "@/lib/data";
import type { PublicContent } from "@/lib/types";

const CmsContext = createContext<PublicContent | null>(null);

export function useCms(): PublicContent {
  const ctx = useContext(CmsContext);
  if (!ctx) {
    throw new Error("useCms must be used inside CmsGate");
  }
  return ctx;
}

/**
 * Loads CMS content from the server (single source of truth) and provides it
 * to the whole public experience. Falls back to dev placeholders when Supabase
 * is not configured.
 */
export function CmsGate({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<PublicContent | null>(null);

  useEffect(() => {
    let alive = true;
    getPublicContent()
      .then((c) => {
        if (alive) setContent(c);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!content) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink">
        <p className="font-display text-xs tracking-[0.4em] text-paper/50">LOADING…</p>
      </div>
    );
  }

  return <CmsContext.Provider value={content}>{children}</CmsContext.Provider>;
}