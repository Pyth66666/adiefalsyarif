import { getAdminMedia } from "@/lib/admin-data";
import { ProjectForm } from "@/components/admin/ProjectForm";

export default async function AdminProjectNew() {
  const media = await getAdminMedia();
  return (
    <div className="space-y-6">
      <h1 className="font-display text-sm uppercase tracking-[0.3em] text-zinc-400">NEW PROJECT</h1>
      <ProjectForm item={null} media={media} />
    </div>
  );
}