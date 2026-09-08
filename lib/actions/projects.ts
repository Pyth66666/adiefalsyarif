"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { str, strList, bool, num } from "./validate";
import type { DbProject } from "@/lib/types";

interface Result { ok: boolean; error?: string; id?: string }

async function admin() { await requireUser(); const sb = getSupabaseAdmin(); if (!sb) throw new Error("Supabase not configured"); return sb; }
async function nextOrder(): Promise<number> { const sb = await admin(); const { data } = await sb.from("projects").select("display_order").order("display_order", { ascending: false }).limit(1); return ((data?.[0] as { display_order: number })?.display_order ?? 0) + 1; }

function parse(form: FormData) {
  return { title: str(form, "title"), tagline: str(form, "tagline"), description: str(form, "description"), problem: str(form, "problem"), solution: str(form, "solution"), year: str(form, "year"), category: str(form, "category"), status: str(form, "status") || "completed", technologies: strList(form, "technologies"), role: str(form, "role"), hero_image: str(form, "hero_image"), gallery: strList(form, "gallery", true), github: str(form, "github"), demo: str(form, "demo"), featured: bool(form, "featured"), published: bool(form, "published"), display_order: num(form, "display_order") };
}

export async function saveProject(_prev: Result, form: FormData): Promise<Result> {
  await requireUser(); const sb = await admin(); const payload = parse(form);
  if (!payload.title) return { ok: false, error: "PROJECT NAME is required." };
  const id = str(form, "id");
  if (id) { const { error } = await sb.from("projects").update(payload).eq("id", id); if (error) return { ok: false, error: error.message }; }
  else { const { data, error } = await sb.from("projects").insert({ ...payload, display_order: payload.display_order > 0 ? payload.display_order : await nextOrder() }).select("id").single(); if (error) return { ok: false, error: error.message }; return { ok: true, id: (data  as { id?: string })?.id }; }
  revalidatePath("/", "layout"); return { ok: true, id };
}

export async function duplicateProject(id: string): Promise<Result> {
  await requireUser(); const sb = await admin(); const { data } = await sb.from("projects").select("*").eq("id", id).single();
  if (!data) return { ok: false, error: "Not found" };
  const { data: created, error } = await sb.from("projects").insert({ ...data, id: undefined, title: `${(data as DbProject).title} (Copy)`, published: false, display_order: await nextOrder() }).select("id").single();
  if (error) return { ok: false, error: error.message }; revalidatePath("/admin/projects"); return { ok: true, id: (created  as { id?: string })?.id };
}

export async function deleteProject(id: string): Promise<Result> {
  await requireUser(); const sb = await admin(); const { error } = await sb.from("projects").delete().eq("id", id);
  if (error) return { ok: false, error: error.message }; revalidatePath("/", "layout"); return { ok: true };
}