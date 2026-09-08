"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { str, strList, bool, num } from "./validate";

interface Result { ok: boolean; error?: string; id?: string }

export async function saveCollectionItem(_prev: Result, form: FormData): Promise<Result> {
  await requireUser(); const sb = getSupabaseAdmin(); if (!sb) return { ok: false, error: "Not configured" };
  const title = str(form, "title"); if (!title) return { ok: false, error: "NAME required." };
  const ext = str(form, "external_link");
  if (ext && !/^https?:\/\//i.test(ext)) return { ok: false, error: "EXTERNAL LINK must be valid." };
  const payload = { title, event: str(form, "event"), organization: str(form, "organization"), year: str(form, "year"), front_image: str(form, "front_image"), back_image: str(form, "back_image"), story: str(form, "story"), what_happened: str(form, "what_happened"), what_i_built: str(form, "what_i_built"), people_i_met: str(form, "people_i_met"), photos: strList(form, "photos", true), related_project: str(form, "related_project") || null, external_link: ext, featured: bool(form, "featured"), published: bool(form, "published"), display_order: num(form, "display_order") };
  const id = str(form, "id");
  if (id) { const { error } = await sb.from("collection_items").update(payload).eq("id", id); if (error) return { ok: false, error: error.message }; }
  else { const { data, error } = await sb.from("collection_items").insert(payload).select("id").single(); if (error) return { ok: false, error: error.message }; return { ok: true, id: (data  as { id?: string })?.id }; }
  revalidatePath("/", "layout"); return { ok: true, id };
}

export async function deleteCollectionItem(id: string): Promise<Result> {
  const sb = getSupabaseAdmin(); if (!sb) return { ok: false, error: "Not configured" };
  const { error } = await sb.from("collection_items").delete().eq("id", id);
  if (error) return { ok: false, error: error.message }; revalidatePath("/", "layout"); return { ok: true };
}