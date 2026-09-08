import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function getCurrentUser() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await getSupabaseServer();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  return user;
}

export async function signIn(email: string, password: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local." };
  }
  const supabase = await getSupabaseServer();
  if (!supabase) return { error: "Supabase client unavailable" };
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  return { error: null };
}

export async function signOut() {
  const supabase = await getSupabaseServer();
  await supabase?.auth.signOut();
  redirect("/admin/login");
}

export async function refreshPublicSite() {}