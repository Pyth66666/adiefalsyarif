"use client";

import { useState } from "react";
import type { DbMediaItem } from "@/lib/types";

interface MediaPickerProps {
  items: Pick<DbMediaItem, "id" | "url" | "filename">[];
  onPick: (url: string) => void;
  onClose: () => void;
}

/** Choose an already-uploaded media file from the library. */
export function MediaPicker({ items, onPick, onClose }: MediaPickerProps) {
  const [q, setQ] = useState("");
  const filtered = items.filter(
    (m) => !q || (m.filename ?? "").toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-xl border border-white/10 bg-zinc-950 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xs font-medium uppercase tracking-[0.3em] text-zinc-300">MEDIA LIBRARY</h3>
          <button onClick={onClose} className="text-[0.6rem] tracking-[0.2em] text-zinc-500 hover:text-zinc-200">
            CLOSE
          </button>
        </div>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search media…"
          className="mb-4 w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-build/60"
        />
        <div className="grid grid-cols-3 gap-3 overflow-y-auto sm:grid-cols-4">
          {filtered.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onPick(m.url ?? "")}
              className="group overflow-hidden rounded-md border border-white/10 text-left focus:outline-none focus:ring-1 focus:ring-build"
            >
              {m.url ? (
                                <img src={m.url} alt={m.filename ?? ""} className="h-20 w-full object-cover transition-transform group-hover:scale-105" />
              ) : (
                <div className="flex h-20 items-center justify-center bg-zinc-900 text-[0.55rem] text-zinc-600">{m.filename}</div>
              )}
              <p className="truncate bg-black/60 px-2 py-1 text-[0.55rem] text-zinc-500">{m.filename}</p>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full py-8 text-center text-xs text-zinc-600">No media found.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function MediaPickerButton({
  items,
  onPick,
  label = "CHOOSE FROM MEDIA",
}: {
  items: Pick<DbMediaItem, "id" | "url" | "filename">[];
  onPick: (url: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border border-white/15 px-3 py-2 text-[0.6rem] tracking-[0.2em] text-zinc-300 transition-colors hover:border-build/50"
      >
        {label}
      </button>
      {open && <MediaPicker items={items} onPick={(u) => { onPick(u); setOpen(false); }} onClose={() => setOpen(false)} />}
    </>
  );
}