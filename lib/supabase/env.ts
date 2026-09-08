export function supabaseEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    bucket: process.env.SUPABASE_STORAGE_BUCKET ?? "cms-media",
  };
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = supabaseEnv();
  return Boolean(url && anonKey && url.startsWith("https://"));
}