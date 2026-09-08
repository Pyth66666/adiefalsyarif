import { notFound } from "next/navigation";
import { getAdminPhoto, getAdminMedia } from "@/lib/admin-data";
import { PhotoEditor } from "@/components/admin/PhotoEditor";

export default async function AdminPhotoEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [photo, media] = await Promise.all([getAdminPhoto(id), getAdminMedia()]);
  if (!photo) notFound();
  return (
    <div className="space-y-6">
      <h1 className="font-display text-sm uppercase tracking-[0.3em] text-zinc-400">EDIT PHOTO</h1>
      <PhotoEditor item={photo} media={media} />
    </div>
  );
}