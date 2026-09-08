import { getAdminProfile } from "@/lib/admin-data";
import { ProfileForm } from "@/components/admin/ProfileForm";

export default async function AdminProfilePage() {
  const profile = await getAdminProfile();
  return (
    <div className="space-y-6">
      <h1 className="font-display text-sm uppercase tracking-[0.3em] text-zinc-400">PROFILE · ABOUT</h1>
      <ProfileForm item={profile} />
    </div>
  );
}