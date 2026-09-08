import { getAdminStatistics } from "@/lib/admin-data";
import { StatisticsManager } from "@/components/admin/StatisticsManager";

export default async function AdminStatisticsPage() {
  const stats = await getAdminStatistics();
  return (
    <div className="space-y-6">
      <h1 className="font-display text-sm uppercase tracking-[0.3em] text-zinc-400">STATISTICS · SYSTEM STATUS</h1>
      <StatisticsManager items={stats} />
    </div>
  );
}