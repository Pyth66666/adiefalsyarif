"use client";

import Link from "next/link";
import { useTransition } from "react";
import { ConfirmAction } from "./ConfirmAction";

interface AdminActionsProps {
  id: string;
  editHref: string;
  onDuplicate: () => Promise<{ ok: boolean; error?: string }>;
  onDelete: () => Promise<{ ok: boolean; error?: string }>;
}

export function AdminActions({ editHref, onDuplicate, onDelete }: AdminActionsProps) {
  const [pending, start] = useTransition();

  return (
    <div className="flex items-center justify-end gap-2">
      <Link
        href={editHref}
        className="rounded border border-white/15 px-2.5 py-1 text-[0.6rem] tracking-[0.15em] text-zinc-400 transition-colors hover:border-build/60 hover:text-white"
      >
        EDIT
      </Link>
      <button
        onClick={() => start(async () => { await onDuplicate(); })}
        disabled={pending}
        className="rounded border border-white/15 px-2.5 py-1 text-[0.6rem] tracking-[0.15em] text-zinc-500 transition-colors hover:border-white/40 hover:text-zinc-200 disabled:opacity-50"
      >
        {pending ? "…" : "DUP"}
      </button>
      <ConfirmAction action={onDelete} />
    </div>
  );
}