import { getAdminMedia } from "@/lib/admin-data";
import { NewPhotoManager } from "@/components/admin/NewPhotoManager";

export default async function AdminPhotoNew() {
  const media = await getAdminMedia();
  void media;
  return (
    <div className="space-y-6">
      <h1 className="font-display text-sm uppercase tracking-[0.3em] text-zinc-400">NEW PHOTOGRAPHY</h1>
      <NewPhotoManager />
    </div>
  );
}