import { getAdminSocials } from "@/lib/admin-data";
import { SocialLinksManager } from "@/components/admin/SocialLinksManager";

export default async function AdminSocialsPage() {
  const socials = await getAdminSocials();
  return (
    <div className="space-y-6">
      <h1 className="font-display text-sm uppercase tracking-[0.3em] text-zinc-400">SOCIAL LINKS</h1>
      <SocialLinksManager items={socials} />
    </div>
  );
}

export const dynamic = "force-dynamic";