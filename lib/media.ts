"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { getStorageBucket, publicUrlFor, stripPublicUrl } from "@/lib/media-helpers";

export async function deleteMediaItem(pathOrUrl: string): Promise<{ ok: boolean; reason?: string }> {
  await requireUser();
  const path = stripPublicUrl(pathOrUrl);
  if (!path) return { ok: false, reason: "Missing path" };
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, reason: "Supabase not configured" };
  const usage = await findUsage(pathOrUrl);
  if (usage.length > 0) return { ok: false, reason: `In use by: ${usage.join(", ")}` };
  const { error: storageError } = await admin.storage.from(getStorageBucket()).remove([path]);
  if (storageError && storageError.message !== "Object not found") {
    return { ok: false, reason: `Storage error: ${storageError.message}` };
  }
  await admin.from("media").delete().eq("path", path);
  revalidatePath("/admin/media");
  return { ok: true };
}

async function findUsage(urlOrPath: string): Promise<string[]> {
  const admin = getSupabaseAdmin();
  if (!admin) return [];
  const value = (urlOrPath ?? "").trim();
  if (!value) return [];
  const url = publicUrlFor(getStorageBucket(), stripPublicUrl(value));
  const used: string[] = [];
  type Row = Record<string, unknown>;
  const near = (row: Row, col: string) => {
    const v = row[col];
    if (typeof v === "string") return v === value || v === url;
    if (Array.isArray(v)) return (v as unknown[]).some((x) => x === value || x === url);
    return false;
  };
  const scans: { table: string; cols: string[]; title: string }[] = [
    { table: "projects", cols: ["hero_image", "gallery"], title: "title" },
    { table: "photos", cols: ["src"], title: "title" },
    { table: "events", cols: ["images"], title: "name" },
    { table: "collection_items", cols: ["front_image", "back_image", "photos"], title: "title" },
    { table: "profiles", cols: ["profile_image"], title: "name" },
    { table: "hackdev", cols: ["image"], title: "name" },
  ];
  for (const scan of scans) {
    const { data } = await admin.from(scan.table as "projects").select(`${scan.cols.join(",")},${scan.title}`);
    if (!data) continue;
    for (const row of data as unknown as Row[]) {
      if (scan.cols.some((c) => near(row, c))) {
        const label = typeof row[scan.title] === "string" && row[scan.title] ? String(row[scan.title]) : scan.table;
        if (!used.includes(label)) used.push(label);
      }
    }
  }
  return used;
}

export async function recordMediaUpload(args: { path: string; filename: string; mime: string; size: number }): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser();
  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false, error: "Supabase not configured" };
  const { error } = await admin.from("media").upsert({
    path: args.path,
    url: publicUrlFor(getStorageBucket(), args.path),
    filename: args.filename,
    mime: args.mime,
    size: args.size,
    bucket: getStorageBucket(),
    uploaded_by: user.id,
  }, { onConflict: "path" });
  return { ok: !error, error: error?.message };
}