"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { signIn } from "@/lib/actions/auth";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError("Enter both email and password.");
      return;
    }
    start(async () => {
      const res = await signIn(email, password);
      if (res.error) {
        setError(res.error);
      } else {
        router.push(params.get("next") || "/admin");
        router.refresh();
      }
    });
  };

  const input =
    "w-full rounded-md border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors focus:border-build/60 focus:ring-1 focus:ring-build/40";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-[0.6rem] uppercase tracking-[0.25em] text-zinc-500">EMAIL</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          className={input}
          placeholder="admin@adiefalsyarif.com"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-[0.6rem] uppercase tracking-[0.25em] text-zinc-500">PASSWORD</label>
        <div className="relative">
          <input
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className={`${input} pr-20`}
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShow(!show)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[0.55rem] tracking-[0.2em] text-zinc-500 hover:text-zinc-200"
          >
            {show ? "HIDE" : "SHOW"}
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-md border border-red-500/30 bg-red-950/30 px-3 py-2 text-[0.7rem] text-red-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-build/90 py-2.5 text-[0.7rem] font-semibold tracking-[0.3em] text-black transition-colors hover:bg-build disabled:opacity-60"
      >
        {pending ? "SIGNING IN…" : "LOG IN"}
      </button>
    </form>
  );
}