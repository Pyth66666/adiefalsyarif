import { createClient } from "@supabase/supabase-js";
import { supabaseEnv, isSupabaseConfigured } from "./env";

/**
 * Read-only public client for server-side content reads. Uses the anon/publishable key.
 */
export function getSupabasePublic() {
  if (!isSupabaseConfigured()) return null;
  const { url, anonKey } = supabaseEnv();
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

/**
 * Service-role client — SERVER ONLY. Bypasses RLS. Never import into a client component.
 * Accepts either the JWT service role key or the new `sb_secret_` format.
 */
export function getSupabaseAdmin() {
  if (!isSupabaseConfigured()) return null;
  const { url, serviceRoleKey, anonKey } = supabaseEnv();
  const key = serviceRoleKey || anonKey;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}