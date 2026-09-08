import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { AdminShell } from "@/components/admin/AdminShell";

export const metadata = { title: "ADIEF CMS" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { pathname } = { pathname: (await headers()).get("x-pathname") ?? "" };
  const isLoginPage = pathname === "/admin/login";

  if (!isSupabaseConfigured()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-6 text-center text-zinc-100">
        <div className="max-w-md">
          <h1 className="font-display text-xl tracking-[0.3em]">ADIEF CMS</h1>
          <p className="mt-4 text-sm text-zinc-400">
            Supabase is not configured. Copy <code className="text-create">.env.example</code> to{" "}
            <code className="text-create">.env.local</code>, add your Supabase keys, run{" "}
            <code className="text-create">supabase/schema.sql</code>, then restart.
          </p>
        </div>
      </div>
    );
  }

  if (isLoginPage) return <>{children}</>;

  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  return <AdminShell email={user?.email ?? ""}>{children}</AdminShell>;
}