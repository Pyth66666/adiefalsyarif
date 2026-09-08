import Link from "next/link";
import { getAdminHackdev } from "@/lib/admin-data";
import { HackdevForm } from "@/components/admin/HackdevForm";

export default async function AdminHackdevPage() {
  const hackdev = await getAdminHackdev();
  const counts = hackdev
    ? [
        ["MEMBERS", `${hackdev.members.toLocaleString()}+`],
        ["UNIVERSITIES", String(hackdev.universities)],
        ["EVENTS", String(hackdev.events)],
        ["WORKSHOPS", String(hackdev.workshops)],
      ]
    : [];

  return (
    <div className="space-y-8">
      <h1 className="font-display text-sm uppercase tracking-[0.3em] text-zinc-400">HACKDEV</h1>

      {counts.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {counts.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-white/10 bg-white/[0.03] p-4 text-center">
              <p className="font-display text-2xl text-white">{value}</p>
              <p className="mt-1 text-[0.55rem] uppercase tracking-[0.3em] text-zinc-500">{label}</p>
            </div>
          ))}
        </div>
      )}

      <HackdevForm item={hackdev} />

      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
        <p className="text-[0.65rem] text-zinc-600">
          The public HackDev section reads these numbers directly. Public website preview:{" "}
          <Link href="/#hackdev" target="_blank" className="text-build hover:underline">/#hackdev</Link>
        </p>
      </div>
    </div>
  );
}