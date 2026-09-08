import { Suspense } from "react";
import { LoginForm } from "@/components/admin/LoginForm";

export const metadata = { title: "Sign in — ADIEF CMS" };

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#050505] px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="font-display text-[0.7rem] tracking-[0.4em] text-zinc-500">ADIEF CMS</p>
          <h1 className="mt-2 font-display text-lg tracking-[0.25em] text-white">SIGN IN</h1>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
        <p className="mt-8 text-center text-[0.55rem] tracking-[0.2em] text-zinc-700">
          PRIVATE · AUTHORIZED ADMIN ONLY
        </p>
      </div>
    </main>
  );
}