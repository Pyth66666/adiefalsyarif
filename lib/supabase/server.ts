import { createServerClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";
import { cookies } from "next/headers";

export async function getSupabaseServer() {
  const { url, anonKey } = supabaseEnv();
  if (!url || !anonKey) return null;
  const cookieStore = await cookies();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server component — safe to ignore
        }
      },
    },
  });
}