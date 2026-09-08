"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { str, bool, num } from "./validate";
import { PHOTO_CATEGORIES } from "@/lib/types";

interface Result { ok: boolean; error?: string; id?: string }
async function admin() { await requireUser(); const sb = getSupabaseAdmin(); if (!sb) throw new Error("Supabase not configured"); return sb; }
function category(v: string): string { return (PHOTO_CATEGORIES as readonly string[]).includes(v) ? v : "STREET"; }

export async function savePhoto(_prev: Result, form: FormData): Promise<Result> {
  const sb = await admin(); const src = str(form, "src");
  if (!src) return { ok: false, error: "Image is required." };
  const payload = { src, title: str(form, "title"), description: str(form, "description"), location: str(form, "location"), date: str(form, "date"), category: category(str(form, "category")), camera: str(form, "camera"), lens: str(form, "lens"), aperture: str(form, "aperture"), shutter_speed: str(form, "shutter_speed"), iso: str(form, "iso"), featured: bool(form, "featured"), published: bool(form, "published"), show_location: bool(form, "show_location"), width: num(form, "width", 1200) || null, height: num(form, "height", 800) || null, display_order: num(form, "display_order") };
  const id = str(form, "id");
  if (id) { const { error } = await sb.from("photos").update(payload).eq("id", id); if (error) return { ok: false, error: error.message }; }
  else { const { data, error } = await sb.from("photos").insert(payload).select("id").single(); if (error) return { ok: false, error: error.message }; return { ok: true, id: (data  as { id?: string })?.id }; }
  revalidatePath("/", "layout"); return { ok: true, id };
}

export async function deletePhoto(id: string): Promise<Result> {
  const sb = await admin(); const { error } = await sb.from("photos").delete().eq("id", id);
  if (error) return { ok: false, error: error.message }; revalidatePath("/", "layout"); return { ok: true };
}

export async function reorderPhotos(orderedIds: string[]): Promise<Result> {
  const sb = await admin();
  for (let i = 0; i < orderedIds.length; i++) await sb.from("photos").update({ display_order: i }).eq("id", orderedIds[i]);
  revalidatePath("/", "layout"); return { ok: true };
}

export async function createPhotoBatch(inputs: { id: string; src: string; title: string; location: string; category: string; published: boolean; camera?: string; lens?: string; aperture?: string; shutterSpeed?: string; iso?: string; date?: string; remove: boolean }[]): Promise<{ ok: boolean; error?: string }> {
  const sb = await admin();
  const rows = inputs.filter((i) => !i.remove && i.src).map((i) => ({ src: i.src, title: i.title || null, location: i.location || null, category: category(i.category), published: i.published, camera: i.camera || null, lens: i.lens || null, aperture: i.aperture || null, shutter_speed: i.shutterSpeed || null, iso: i.iso || null, date: i.date || null, show_location: false, display_order: 0 }));
  if (!rows.length) return { ok: false, error: "No valid photos." };
  const { data: max } = await sb.from("photos").select("display_order").order("display_order", { ascending: false }).limit(1);
  const start = ((max?.[0] as { display_order?: number })?.display_order ?? -1) + 1;
  rows.forEach((r: Record<string, unknown>, i: number) => { r.display_order = start + i; });
  const { error } = await sb.from("photos").insert(rows);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout"); return { ok: true };
}