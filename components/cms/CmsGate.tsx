"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getLocalContent, getPublicContent } from "@/lib/data";
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
export function CmsGate({ children, initialContent }: { children: ReactNode; initialContent?: PublicContent }) {
  const [content, setContent] = useState<PublicContent>(() => initialContent ?? getLocalContent());

  useEffect(() => {
    if (initialContent) return;
    let alive = true;
    getPublicContent()
      .then((c) => {
        if (alive) setContent(c);
      })
      .catch(() => { /* Keep the local content visible when the CMS is offline. */ });
    return () => {
      alive = false;
    };
  }, [initialContent]);

  useEffect(() => {
    if (!content || !window.location.hash) return;
    const target = document.getElementById(window.location.hash.slice(1));
    target?.scrollIntoView({ behavior: "instant", block: "start" });
  }, [content]);

  return <CmsContext.Provider value={content}>{children}</CmsContext.Provider>;
}
