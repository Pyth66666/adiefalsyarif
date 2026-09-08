"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { str, bool, num } from "./validate";

interface Result { ok: boolean; error?: string; id?: string }

export async function saveProfile(_prev: Result, form: FormData): Promise<Result> {
  const user = await requireUser(); const sb = getSupabaseAdmin(); if (!sb) return { ok: false, error: "Not configured" };
  const payload = { id: user.id, email: str(form, "email"), name: str(form, "name"), title: str(form, "title"), short_bio: str(form, "short_bio"), long_bio: str(form, "long_bio"), location: str(form, "location"), email_public: str(form, "email_public"), profile_image: str(form, "profile_image"), resume_url: str(form, "resume_url") };
  if (payload.resume_url && !/^https?:\/\//i.test(payload.resume_url)) return { ok: false, error: "CV URL must be valid." };
  const { error } = await sb.from("profiles").upsert(payload, { onConflict: "id" });
  if (error) return { ok: false, error: error.message }; revalidatePath("/", "layout"); return { ok: true };
}

export async function saveStatistics(_prev: Result, form: FormData): Promise<Result> {
  await requireUser(); const sb = getSupabaseAdmin(); if (!sb) return { ok: false, error: "Not configured" };
  const payload = { label: str(form, "label"), value: num(form, "value"), prefix: str(form, "prefix"), suffix: str(form, "suffix"), description: str(form, "description"), visual_type: str(form, "visual_type") || "number", display_order: num(form, "display_order"), visible: bool(form, "visible") };
  if (!payload.label) return { ok: false, error: "LABEL required." };
  const id = str(form, "id");
  if (id) { const { error } = await sb.from("statistics").update(payload).eq("id", id); if (error) return { ok: false, error: error.message }; }
  else { const { data, error } = await sb.from("statistics").insert(payload).select("id").single(); if (error) return { ok: false, error: error.message }; return { ok: true, id: (data  as { id?: string })?.id }; }
  revalidatePath("/", "layout"); return { ok: true, id };
}

export async function deleteStatistic(id: string): Promise<Result> {
  const sb = getSupabaseAdmin(); if (!sb) return { ok: false, error: "Not configured" };
  const { error } = await sb.from("statistics").delete().eq("id", id);
  if (error) return { ok: false, error: error.message }; revalidatePath("/", "layout"); return { ok: true };
}

export async function saveSocial(_prev: Result, form: FormData): Promise<Result> {
  await requireUser(); const sb = getSupabaseAdmin(); if (!sb) return { ok: false, error: "Not configured" };
  const payload = { platform: str(form, "platform"), label: str(form, "label"), url: str(form, "url"), icon: str(form, "icon"), group_name: str(form, "group_name") === "creative" ? "creative" : "tech", visible: bool(form, "visible"), display_order: num(form, "display_order") };
  if (!payload.platform) return { ok: false, error: "PLATFORM required." };
  if (payload.url && !/^https?:\/\//i.test(payload.url)) return { ok: false, error: "URL must be valid." };
  const id = str(form, "id");
  if (id) { const { error } = await sb.from("social_links").update(payload).eq("id", id); if (error) return { ok: false, error: error.message }; }
  else { const { data, error } = await sb.from("social_links").insert(payload).select("id").single(); if (error) return { ok: false, error: error.message }; return { ok: true, id: (data  as { id?: string })?.id }; }
  revalidatePath("/", "layout"); return { ok: true, id };
}

export async function deleteSocial(id: string): Promise<Result> {
  const sb = getSupabaseAdmin(); if (!sb) return { ok: false, error: "Not configured" };
  const { error } = await sb.from("social_links").delete().eq("id", id);
  if (error) return { ok: false, error: error.message }; revalidatePath("/", "layout"); return { ok: true };
}

export async function saveSiteSettings(_prev: Result, form: FormData): Promise<Result> {
  await requireUser(); const sb = getSupabaseAdmin(); if (!sb) return { ok: false, error: "Not configured" };
  const payload = { name: str(form, "name"), family: str(form, "family"), domain: str(form, "domain"), descriptors: str(form, "descriptors"), intro: str(form, "intro"), about: str(form, "about"), contact_email: str(form, "contact_email") };
  const { data } = await sb.from("site_settings").select("id").limit(1);
  const existing = data?.[0] as { id: string } | undefined;
  const { error } = existing ? await sb.from("site_settings").update(payload).eq("id", existing.id) : await sb.from("site_settings").insert(payload);
  if (error) return { ok: false, error: error.message }; revalidatePath("/", "layout"); return { ok: true };
}