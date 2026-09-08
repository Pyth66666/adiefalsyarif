"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { str, strList, bool, num } from "./validate";
import { EVENT_STATUSES } from "@/lib/types";

interface Result { ok: boolean; error?: string; id?: string }
function status(v: string): string { return (EVENT_STATUSES as readonly string[]).includes(v) ? v : "upcoming"; }

export async function saveEvent(_prev: Result, form: FormData): Promise<Result> {
  await requireUser(); const sb = getSupabaseAdmin(); if (!sb) return { ok: false, error: "Not configured" };
  const name = str(form, "name"); if (!name) return { ok: false, error: "EVENT NAME required." };
  const date = str(form, "date") || null;
  if (date && isNaN(Date.parse(date))) return { ok: false, error: "Invalid DATE." };
  const ext = str(form, "external_link");
  if (ext && !/^https?:\/\//i.test(ext)) return { ok: false, error: "EXTERNAL LINK must be a valid URL." };
  const payload = { name, org: str(form, "org"), location: str(form, "location"), date, status: status(str(form, "status")), result: str(form, "result"), description: str(form, "description"), project: str(form, "project"), images: strList(form, "images", true), external_link: ext, featured: bool(form, "featured"), published: bool(form, "published"), display_order: num(form, "display_order") };
  const id = str(form, "id");
  if (id) { const { error } = await sb.from("events").update(payload).eq("id", id); if (error) return { ok: false, error: error.message }; }
  else { const { data, error } = await sb.from("events").insert(payload).select("id").single(); if (error) return { ok: false, error: error.message }; return { ok: true, id: (data  as { id?: string })?.id }; }
  revalidatePath("/", "layout"); return { ok: true, id };
}

export async function deleteEvent(id: string): Promise<Result> {
  const sb = getSupabaseAdmin(); if (!sb) return { ok: false, error: "Not configured" };
  const { error } = await sb.from("events").delete().eq("id", id);
  if (error) return { ok: false, error: error.message }; revalidatePath("/", "layout"); return { ok: true };
}