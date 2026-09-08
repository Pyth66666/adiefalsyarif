"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";

let cached: ReturnType<typeof createBrowserClient> | null = null;

export function getSupabaseBrowser() {
  const { url, anonKey } = supabaseEnv();
  if (!url || !anonKey) return null;
  if (cached) return cached;
  cached = createBrowserClient(url, anonKey);
  return cached;
}