"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { signOut } from "@/lib/actions/auth";

const groups: { title?: string; links: { href: string; label: string }[] }[] = [
  {
    links: [{ href: "/admin", label: "OVERVIEW" }],
  },
  {
    title: "CONTENT",
    links: [
      { href: "/admin/projects", label: "Projects" },
      { href: "/admin/photography", label: "Photography" },
      { href: "/admin/events", label: "Events" },
      { href: "/admin/collection", label: "Collection" },
      { href: "/admin/hackdev", label: "HackDev" },
    ],
  },
  {
    title: "PROFILE",
    links: [
      { href: "/admin/profile", label: "About" },
      { href: "/admin/statistics", label: "Statistics" },
      { href: "/admin/socials", label: "Social Links" },
    ],
  },
  {
    title: "MEDIA",
    links: [{ href: "/admin/media", label: "Media Library" }],
  },
  {
    title: "SETTINGS",
    links: [{ href: "/admin/settings", label: "Site Settings" }],
  },
];

export function AdminShell({ email, children }: { email: string; children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const nav = (
    <nav className="flex flex-1 flex-col gap-6 overflow-y-auto py-8">
      {groups.map((g) => (
        <div key={g.title ?? "top"}>
          {g.title && (
            <p className="mb-1.5 px-4 text-[0.55rem] uppercase tracking-[0.3em] text-zinc-600">{g.title}</p>
          )}
          <div className="flex flex-col">
            {g.links.map((l) => {
              const active = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className={`px-4 py-2 text-sm transition-colors ${
                    active ? "border-l-2 border-build bg-white/[0.04] text-white" : "border-l-2 border-transparent text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-200"
                  }`}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  const footer = (
    <div className="border-t border-white/10 p-4">
      <p className="text-[0.55rem] uppercase tracking-[0.25em] text-zinc-500">{email}</p>
      <button
        onClick={() => {
          start(async () => {
            await signOut();
          });
        }}
        disabled={pending}
        className="mt-3 w-full rounded-md border border-white/10 px-3 py-2 text-[0.6rem] tracking-[0.25em] text-zinc-400 transition-colors hover:border-white/30 hover:text-white disabled:opacity-50"
      >
        LOG OUT
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-200">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-black/90 px-4 py-3 md:hidden">
        <span className="font-display text-[0.7rem] tracking-[0.3em] text-white">ADIEF CMS</span>
        <button onClick={() => setOpen(!open)} className="text-[0.6rem] tracking-[0.25em] text-zinc-400">
          {open ? "CLOSE" : "MENU"}
        </button>
      </header>

      <div className="flex">
        {/* Sidebar (fixed on desktop, drawer on mobile) */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-white/10 bg-black transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0 ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex h-[52px] items-center border-b border-white/10 px-4 font-display text-[0.7rem] tracking-[0.3em] text-white">
            ADIEF CMS
          </div>
          {nav}
          {footer}
        </aside>
        {open && <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={() => setOpen(false)} />}

        {/* Main */}
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 md:py-8">
          <div className="flex items-center justify-between">
            <span className="hidden items-center gap-2 text-[0.6rem] tracking-[0.25em] text-zinc-500 md:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-build" />
              WEBSITE · ONLINE
            </span>
            <div className="ml-auto flex items-center gap-3">
              <a
                href="/"
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-white/15 px-3 py-1.5 text-[0.6rem] tracking-[0.2em] text-zinc-400 transition-colors hover:border-white/40 hover:text-white"
              >
                VIEW WEBSITE
              </a>
            </div>
          </div>
          <div className="mt-6">{children}</div>
        </main>
      </div>
    </div>
  );
}