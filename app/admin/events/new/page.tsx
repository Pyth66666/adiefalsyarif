import { EventForm } from "@/components/admin/EventForm";

export default async function AdminEventNew() {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-sm uppercase tracking-[0.3em] text-zinc-400">NEW EVENT</h1>
      <EventForm item={null} />
    </div>
  );
}