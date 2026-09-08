import { requireUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import type { DbProject, DbPhoto, DbEvent, DbCollectionItem, DbHackdev, DbStatistic, DbSocialLink, DbSiteSettings, DbProfile, DbMediaItem } from "@/lib/types";

export const byOrder = <T extends { display_order: number; created_at: string }>(rows: T[]) =>
  [...rows].sort((a, b) => a.display_order - b.display_order || a.created_at.localeCompare(b.created_at));

async function admin() {
  await requireUser();
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Supabase not configured");
  return sb;
}

export async function getAdminProjects(): Promise<DbProject[]> {
  const sb = await admin();
  const { data } = await sb.from("projects").select("*").order("display_order");
  return byOrder((data as DbProject[]) ?? []);
}

export async function getAdminProject(id: string): Promise<DbProject | null> {
  const sb = await admin();
  const { data } = await sb.from("projects").select("*").eq("id", id).single();
  return (data as DbProject) ?? null;
}

export async function getAdminPhotos(): Promise<DbPhoto[]> {
  const sb = await admin();
  const { data } = await sb.from("photos").select("*").order("display_order");
  return byOrder((data as DbPhoto[]) ?? []);
}

export async function getAdminPhoto(id: string): Promise<DbPhoto | null> {
  const sb = await admin();
  const { data } = await sb.from("photos").select("*").eq("id", id).single();
  return (data as DbPhoto) ?? null;
}

export async function getAdminEvents(): Promise<DbEvent[]> {
  const sb = await admin();
  const { data } = await sb.from("events").select("*").order("display_order");
  return byOrder((data as DbEvent[]) ?? []);
}

export async function getAdminEvent(id: string): Promise<DbEvent | null> {
  const sb = await admin();
  const { data } = await sb.from("events").select("*").eq("id", id).single();
  return (data as DbEvent) ?? null;
}

export async function getAdminCollection(): Promise<DbCollectionItem[]> {
  const sb = await admin();
  const { data } = await sb.from("collection_items").select("*").order("display_order");
  return byOrder((data as DbCollectionItem[]) ?? []);
}

export async function getAdminCollectionItem(id: string): Promise<DbCollectionItem | null> {
  const sb = await admin();
  const { data } = await sb.from("collection_items").select("*").eq("id", id).single();
  return (data as DbCollectionItem) ?? null;
}

export async function getAdminHackdev(): Promise<DbHackdev | null> {
  const sb = await admin();
  const { data } = await sb.from("hackdev").select("*").limit(1);
  return (data?.[0] as DbHackdev) ?? null;
}

export async function getAdminStatistics(): Promise<DbStatistic[]> {
  const sb = await admin();
  const { data } = await sb.from("statistics").select("*").order("display_order");
  return (data as DbStatistic[]) ?? [];
}

export async function getAdminSocials(): Promise<DbSocialLink[]> {
  const sb = await admin();
  const { data } = await sb.from("social_links").select("*").order("display_order");
  return (data as DbSocialLink[]) ?? [];
}

export async function getAdminSettings(): Promise<DbSiteSettings | null> {
  const sb = await admin();
  const { data } = await sb.from("site_settings").select("*").limit(1);
  return (data?.[0] as DbSiteSettings) ?? null;
}

export async function getAdminProfile(): Promise<DbProfile | null> {
  const sb = await admin();
  const { data } = await sb.from("profiles").select("*").limit(1);
  return (data?.[0] as DbProfile) ?? null;
}

export async function getAdminMedia(): Promise<DbMediaItem[]> {
  const sb = await admin();
  const { data } = await sb.from("media").select("*").order("created_at", { ascending: false }).limit(500);
  return (data as DbMediaItem[]) ?? [];
}

export type { DbProject, DbPhoto, DbEvent, DbCollectionItem, DbHackdev, DbStatistic, DbSocialLink, DbSiteSettings, DbProfile, DbMediaItem };