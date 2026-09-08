"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { str, num } from "./validate";

interface Result { ok: boolean; error?: string }

export async function saveHackdev(_prev: Result, form: FormData): Promise<Result> {
  await requireUser(); const sb = getSupabaseAdmin(); if (!sb) return { ok: false, error: "Not configured" };
  for (const [key, label] of [["discord_url", "Discord"], ["website_url", "Website"]] as const) {
    const v = str(form, key); if (v && !/^https?:\/\//i.test(v)) return { ok: false, error: `${label} URL must be valid.` };
  }
  const payload = { name: str(form, "name") || "HACKDEV", description: str(form, "description"), members: num(form, "members"), universities: num(form, "universities"), events: num(form, "events"), workshops: num(form, "workshops"), discord_url: str(form, "discord_url"), website_url: str(form, "website_url"), image: str(form, "image"), story: str(form, "story") };
  const { data } = await sb.from("hackdev").select("id").limit(1);
  const existing = data?.[0] as { id: string } | undefined;
  const { error } = existing ? await sb.from("hackdev").update(payload).eq("id", existing.id) : await sb.from("hackdev").insert(payload);
  if (error) return { ok: false, error: error.message }; revalidatePath("/", "layout"); return { ok: true };
}