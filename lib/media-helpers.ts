import { supabaseEnv } from "@/lib/supabase/env";

export function getStorageBucket() {
  return supabaseEnv().bucket;
}

export function publicUrlFor(bucket: string, path: string): string {
  const { url } = supabaseEnv();
  return `${url}/storage/v1/object/public/${bucket}/${encodeURIComponent(path)}`;
}

export function stripPublicUrl(raw: string | null | undefined): string {
  if (!raw) return "";
  const { url } = supabaseEnv();
  const prefix = `${url}/storage/v1/object/public/`;
  return raw.startsWith(prefix) ? raw.slice(prefix.length) : raw;
}