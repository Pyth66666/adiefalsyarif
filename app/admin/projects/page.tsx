import Link from "next/link";
import { getAdminProjects } from "@/lib/admin-data";
import { deleteProject, duplicateProject } from "@/lib/actions/projects";
import { AdminActions } from "@/components/admin/AdminActions";

export default async function AdminProjectsPage() {
  const projects = await getAdminProjects();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-sm uppercase tracking-[0.3em] text-zinc-400">PROJECTS</h1>
        <Link
          href="/admin/projects/new"
          className="rounded bg-build px-4 py-2 text-[0.6rem] font-semibold tracking-[0.25em] text-black hover:bg-build/90"
        >
          + NEW PROJECT
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-white/10 text-[0.6rem] uppercase tracking-[0.2em] text-zinc-500">
              <th className="py-2 pr-4">Title</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Published</th>
              <th className="py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {projects.map((p) => (
              <tr key={p.id} className="text-zinc-300">
                <td className="py-3 pr-4">
                  <Link href={`/admin/projects/${p.id}`} className="text-sm text-white hover:underline">
                    {p.title}
                  </Link>
                  <p className="text-[0.6rem] text-zinc-600">{p.category}</p>
                </td>
                <td className="py-3 pr-4 text-[0.6rem] uppercase tracking-[0.15em]">
                  <span className={p.status === "completed" ? "text-build" : p.status === "ongoing" ? "text-amber-400" : "text-zinc-500"}>
                    {p.status}
                  </span>
                </td>
                <td className="py-3 pr-4 text-[0.6rem] uppercase tracking-[0.15em]">
                  {p.published ? (
                    <span className="text-build">YES</span>
                  ) : (
                    <span className="text-zinc-600">NO</span>
                  )}
                </td>
                <td className="py-3 text-right">
                  <AdminActions
                    id={p.id}
                    editHref={`/admin/projects/${p.id}`}
                    onDuplicate={async () => duplicateProject(p.id)}
                    onDelete={async () => deleteProject(p.id)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {projects.length === 0 && <p className="py-8 text-center text-sm text-zinc-600">No projects yet.</p>}
    </div>
  );
}