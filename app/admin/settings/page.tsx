import { getAdminSettings } from "@/lib/admin-data";
import { SettingsForm } from "@/components/admin/SettingsForm";

export default async function AdminSettingsPage() {
  const settings = await getAdminSettings();
  return (
    <div className="space-y-6">
      <h1 className="font-display text-sm uppercase tracking-[0.3em] text-zinc-400">SITE SETTINGS</h1>
      <SettingsForm item={settings} />
    </div>
  );
}