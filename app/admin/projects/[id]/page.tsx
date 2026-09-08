import { notFound } from "next/navigation";
import { getAdminProject, getAdminMedia } from "@/lib/admin-data";
import { ProjectForm } from "@/components/admin/ProjectForm";

export default async function AdminProjectEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [project, media] = await Promise.all([getAdminProject(id), getAdminMedia()]);
  if (!project) notFound();
  return (
    <div className="space-y-6">
      <h1 className="font-display text-sm uppercase tracking-[0.3em] text-zinc-400">EDIT PROJECT</h1>
      <ProjectForm item={project} media={media} />
    </div>
  );
}