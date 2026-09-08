import { notFound } from "next/navigation";
import { getAdminCollectionItem, getAdminProjects } from "@/lib/admin-data";
import { CollectionForm } from "@/components/admin/CollectionForm";

export default async function AdminCollectionEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [item, projects] = await Promise.all([getAdminCollectionItem(id), getAdminProjects()]);
  if (!item) notFound();
  return (
    <div className="space-y-6">
      <h1 className="font-display text-sm uppercase tracking-[0.3em] text-zinc-400">EDIT COLLECTION ITEM</h1>
      <CollectionForm item={item} projects={projects.map((p) => ({ id: p.id, title: p.title }))} />
    </div>
  );
}