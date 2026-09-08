import Link from "next/link";
import { getAdminProjects, getAdminPhotos, getAdminEvents, getAdminCollection } from "@/lib/admin-data";

export default async function AdminOverviewPage() {
  const [projects, photos, events, collection] = await Promise.all([
    getAdminProjects(),
    getAdminPhotos(),
    getAdminEvents(),
    getAdminCollection(),
  ]);

  const stat = (label: string, value: number, href: string) => (
    <Link
      href={href}
      className="rounded-lg border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-white/20"
    >
      <p className="text-[0.55rem] uppercase tracking-[0.3em] text-zinc-500">{label}</p>
      <p className="mt-2 font-display text-2xl text-white">{value}</p>
    </Link>
  );

  return (
    <div className="space-y-8">
      <h1 className="font-display text-sm uppercase tracking-[0.3em] text-zinc-400">OVERVIEW</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stat("PROJECTS", projects.length, "/admin/projects")}
        {stat("PHOTOS", photos.length, "/admin/photography")}
        {stat("EVENTS", events.length, "/admin/events")}
        {stat("COLLECTION", collection.length, "/admin/collection")}
      </div>
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <h2 className="mb-3 text-[0.6rem] uppercase tracking-[0.3em] text-zinc-500">QUICK ACTIONS</h2>
        <div className="flex flex-wrap gap-2">
          {[
            ["/admin/projects/new", "+ NEW PROJECT"],
            ["/admin/photography/new", "+ NEW PHOTO"],
            ["/admin/events/new", "+ NEW EVENT"],
            ["/admin/collection/new", "+ NEW ITEM"],
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="rounded border border-white/15 px-3 py-1.5 text-[0.6rem] tracking-[0.2em] text-zinc-300 transition-colors hover:border-build/60 hover:text-white"
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
      <p className="text-[0.65rem] text-zinc-600">
        Content shown here is managed in your database. The public website at{" "}
        <a href="/" target="_blank" className="text-build hover:underline" rel="noreferrer">
          /
        </a>{" "}
        reads directly from the CMS.
      </p>
    </div>
  );
}