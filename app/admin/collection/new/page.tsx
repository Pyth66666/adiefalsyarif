import { getAdminProjects } from "@/lib/admin-data";
import { CollectionForm } from "@/components/admin/CollectionForm";

export default async function AdminCollectionNew() {
  const projects = await getAdminProjects();
  return (
    <div className="space-y-6">
      <h1 className="font-display text-sm uppercase tracking-[0.3em] text-zinc-400">NEW COLLECTION ITEM</h1>
      <CollectionForm item={null} projects={projects.map((p) => ({ id: p.id, title: p.title }))} />
    </div>
  );
}