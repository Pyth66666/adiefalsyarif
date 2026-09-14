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
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    getPublicContent()
      .then((c) => {
        if (alive) setContent(c);
      })
      .catch(() => { if (alive) setFailed(true); });
    return () => {
      alive = false;
    };
  }, [attempt]);

  useEffect(() => {
    if (!content || !window.location.hash) return;
    const target = document.getElementById(window.location.hash.slice(1));
    target?.scrollIntoView({ behavior: "instant", block: "start" });
  }, [content]);

  if (!content) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink">
        {failed ? <div className="text-center"><p className="text-paper/70">The portfolio could not load. Please try again.</p><button className="mt-5 border border-build/40 px-6 py-3 text-build" onClick={() => { setFailed(false); setAttempt(value => value + 1); }}>TRY AGAIN</button></div>
          : <p role="status" className="font-display text-sm tracking-[0.2em] text-paper/60">OPENING THE ARCHIVE…</p>}
      </div>
    );
  }

  return <CmsContext.Provider value={content}>{children}</CmsContext.Provider>;
}
