import { notFound } from "next/navigation";
import { getAdminEvent } from "@/lib/admin-data";
import { EventForm } from "@/components/admin/EventForm";

export default async function AdminEventEdit({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await getAdminEvent(id);
  if (!event) notFound();
  return (
    <div className="space-y-6">
      <h1 className="font-display text-sm uppercase tracking-[0.3em] text-zinc-400">EDIT EVENT</h1>
      <EventForm item={event} />
    </div>
  );
}