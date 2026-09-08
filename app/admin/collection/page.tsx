import Link from "next/link";
import { getAdminCollection } from "@/lib/admin-data";
import { deleteCollectionItem } from "@/lib/actions/collection";
import { AdminActions } from "@/components/admin/AdminActions";

export default async function AdminCollectionPage() {
  const items = await getAdminCollection();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-sm uppercase tracking-[0.3em] text-zinc-400">COLLECTION</h1>
        <Link href="/admin/collection/new" className="rounded bg-build px-4 py-2 text-[0.6rem] font-semibold tracking-[0.25em] text-black hover:bg-build/90">
          + NEW ITEM
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((c) => (
          <div key={c.id} className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
            {c.front_image ? (
                            <img src={c.front_image} alt={c.title} className="h-28 w-full object-cover" />
            ) : (
              <div className="flex h-28 items-center justify-center bg-zinc-900 text-[0.55rem] text-zinc-600">BADGE / LANYARD</div>
            )}
            <div className="p-3">
              <p className="truncate text-sm text-white">{c.title}</p>
              <p className="text-[0.6rem] text-zinc-600">{c.organization || c.event} · {c.published ? <span className="text-build">PUBLISHED</span> : <span className="text-zinc-500">DRAFT</span>}</p>
              <div className="mt-2">
                <AdminActions id={c.id} editHref={`/admin/collection/${c.id}`} onDuplicate={async () => ({ ok: false })} onDelete={async () => deleteCollectionItem(c.id)} />
              </div>
            </div>
          </div>
        ))}
      </div>
      {items.length === 0 && <p className="py-8 text-center text-sm text-zinc-600">Nothing collected yet.</p>}
    </div>
  );
}