import { getAdminMedia } from "@/lib/admin-data";
import { MediaManager } from "@/components/admin/MediaManager";

export default async function AdminMediaPage() {
  const items = await getAdminMedia();
  return (
    <div className="space-y-6">
      <h1 className="font-display text-sm uppercase tracking-[0.3em] text-zinc-400">MEDIA LIBRARY</h1>
      <MediaManager items={items} />
    </div>
  );
}