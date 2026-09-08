import Link from "next/link";
import { getAdminEvents } from "@/lib/admin-data";
import { deleteEvent } from "@/lib/actions/events";
import { AdminActions } from "@/components/admin/AdminActions";

export default async function AdminEventsPage() {
  const events = await getAdminEvents();
  const today = Date.now();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-sm uppercase tracking-[0.3em] text-zinc-400">EVENTS</h1>
        <Link href="/admin/events/new" className="rounded bg-build px-4 py-2 text-[0.6rem] font-semibold tracking-[0.25em] text-black hover:bg-build/90">
          + NEW EVENT
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-white/10 text-[0.6rem] uppercase tracking-[0.2em] text-zinc-500">
              <th className="py-2 pr-4">Event</th>
              <th className="py-2 pr-4">Date</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {events.map((e) => {
              const isPast = e.date && new Date(e.date).getTime() < today;
              return (
                <tr key={e.id} className="text-zinc-300">
                  <td className="py-3 pr-4">
                    <Link href={`/admin/events/${e.id}`} className="text-sm text-white hover:underline">{e.name}</Link>
                    <p className="text-[0.6rem] text-zinc-600">{e.org}</p>
                  </td>
                  <td className="py-3 pr-4 text-zinc-400">
                    {e.date ? new Date(e.date).toLocaleDateString() : "—"}
                  </td>
                  <td className="py-3 pr-4 text-[0.6rem] uppercase tracking-[0.15em]">
                    {e.status === "upcoming" && isPast ? (
                      <span className="text-zinc-500">PASSED</span>
                    ) : e.status === "completed" ? (
                      <span className="text-build">COMPLETED</span>
                    ) : e.status === "ongoing" ? (
                      <span className="text-amber-400">ONGOING</span>
                    ) : (
                      <span className="text-create">UPCOMING</span>
                    )}
                  </td>
                  <td className="py-3 text-right">
                    <AdminActions id={e.id} editHref={`/admin/events/${e.id}`} onDuplicate={async () => ({ ok: false })} onDelete={async () => deleteEvent(e.id)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {events.length === 0 && <p className="py-8 text-center text-sm text-zinc-600">No events yet.</p>}
    </div>
  );
}