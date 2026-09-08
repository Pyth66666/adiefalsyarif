import Link from "next/link";
import { getAdminPhotos } from "@/lib/admin-data";
import { deletePhoto } from "@/lib/actions/photos";
import { AdminActions } from "@/components/admin/AdminActions";
import { PhotoReorder } from "@/components/admin/PhotoEditor";

export default async function AdminPhotographyPage() {
  const photos = await getAdminPhotos();

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-sm uppercase tracking-[0.3em] text-zinc-400">PHOTOGRAPHY</h1>
        <Link
          href="/admin/photography/new"
          className="rounded bg-build px-4 py-2 text-[0.6rem] font-semibold tracking-[0.25em] text-black hover:bg-build/90"
        >
          + UPLOAD PHOTOS
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((p) => (
          <div key={p.id} className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
            {p.src ? (
                            <img src={p.src} alt={p.title ?? ""} className="h-28 w-full object-cover" />
            ) : (
              <div className="flex h-28 items-center justify-center bg-zinc-900 text-[0.55rem] text-zinc-600">NO IMAGE</div>
            )}
            <div className="p-3">
              <p className="truncate text-sm text-white">{p.title || "Untitled"}</p>
              <p className="text-[0.6rem] text-zinc-600">{p.category} · {p.published ? <span className="text-build">PUBLISHED</span> : <span className="text-zinc-500">DRAFT</span>}</p>
              <div className="mt-2">
                <AdminActions
                  id={p.id}
                  editHref={`/admin/photography/${p.id}`}
                  onDuplicate={async () => ({ ok: false })}
                  onDelete={async () => deletePhoto(p.id)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      {photos.length === 0 && <p className="py-8 text-center text-sm text-zinc-600">No photos yet.</p>}

      {photos.length > 1 && (
        <div className="space-y-4">
          <h2 className="text-[0.6rem] uppercase tracking-[0.3em] text-zinc-500">PHOTO ORDER</h2>
          <PhotoReorder items={photos} />
        </div>
      )}
    </div>
  );
}