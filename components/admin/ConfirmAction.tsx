"use client";

import { useRef, useState, useTransition } from "react";

interface ConfirmActionProps {
  action: () => Promise<{ ok: boolean; error?: string }>;
  label?: string;
  confirmLabel?: string;
}

/**
 * Confirmation-wrapped delete button. Requires a typed (or double-click)
 * confirmation before invoking the destructive action.
 */
export function ConfirmAction({
  action,
  label = "DELETE",
  confirmLabel = "CONFIRM DELETE",
}: ConfirmActionProps) {
  const [arm, setArm] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const run = () => {
    const typed = inputRef.current?.value.trim() ?? "";
    if (typed.toLowerCase() !== "delete") {
      setError('Type "delete" to confirm.');
      return;
    }
    setError(null);
    start(async () => {
      const res = await action();
      if (!res.ok && res.error) setError(res.error);
    });
  };

  if (!arm) {
    return (
      <button
        type="button"
        onClick={() => setArm(true)}
        className="rounded-md border border-red-500/30 px-3 py-2 text-[0.6rem] tracking-[0.2em] text-red-400 transition-colors hover:bg-red-500/10"
      >
        {label}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-red-500/40 bg-red-950/30 p-2">
      <input
        ref={inputRef}
        placeholder='type "delete"'
        className="w-28 rounded border border-white/10 bg-black/50 px-2 py-1 text-[0.65rem] text-zinc-200 outline-none focus:border-red-400"
        aria-label="Confirmation text"
      />
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="rounded bg-red-500/80 px-3 py-1.5 text-[0.6rem] font-semibold tracking-[0.15em] text-white hover:bg-red-500 disabled:opacity-50"
      >
        {pending ? "…" : confirmLabel}
      </button>
      <button
        type="button"
        onClick={() => setArm(false)}
        className="text-[0.6rem] tracking-[0.2em] text-zinc-500 hover:text-zinc-200"
      >
        CANCEL
      </button>
      {error && <span className="text-[0.6rem] text-red-400">{error}</span>}
    </div>
  );
}