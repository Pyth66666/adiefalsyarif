"use client";

import { useState, useTransition } from "react";
import { deleteMediaItem } from "@/lib/media";
import { TextInput } from "./fields";
import type { DbMediaItem } from "@/lib/types";

function fmtSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaManager({ items: initial }: { items: DbMediaItem[] }) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const filtered = items.filter(
    (m) => !query || (m.filename ?? "").toLowerCase().includes(query.toLowerCase())
  );

  const remove = (m: DbMediaItem) => {
    setMsg(null);
    start(async () => {
      const res = await deleteMediaItem(m.path);
      if (res.ok) {
        setItems((prev) => prev.filter((x) => x.id !== m.id));
        setMsg({ ok: true, text: "Deleted." });
      } else {
        setMsg({ ok: false, text: res.reason ?? "Could not delete." });
      }
    });
  };

  return (
    <div className="space-y-5">
      <TextInput name="search" label="SEARCH" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filename…" />
      {msg && (
        <p className={`text-[0.7rem] ${msg.ok ? "text-build" : "text-red-400"}`}>{msg.text}</p>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {filtered.map((m) => (
          <div key={m.id} className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
            {m.url ? (
                            <img src={m.url} alt={m.filename ?? ""} className="h-24 w-full object-cover" />
            ) : (
              <div className="flex h-24 items-center justify-center bg-zinc-900 text-[0.55rem] text-zinc-600">NO THUMB</div>
            )}
            <div className="space-y-1 p-2">
              <p className="truncate text-[0.65rem] text-zinc-300" title={m.filename ?? ""}>{m.filename}</p>
              <p className="text-[0.55rem] text-zinc-500">{m.mime ?? "—"} · {fmtSize(m.size)}</p>
              <p className="text-[0.5rem] text-zinc-600">
                {m.created_at ? new Date(m.created_at).toLocaleDateString() : ""}
              </p>
              <div className="flex gap-1 pt-1">
                {m.url && (
                  <button
                    onClick={() => {
                      void navigator.clipboard?.writeText(m.url ?? "");
                      setMsg({ ok: true, text: "URL copied." });
                    }}
                    className="flex-1 rounded border border-white/10 px-2 py-1 text-[0.55rem] text-zinc-400 hover:text-white"
                  >
                    COPY URL
                  </button>
                )}
              </div>
              <button
                onClick={() => remove(m)}
                disabled={pending}
                className="w-full rounded border border-red-500/25 px-2 py-1 text-[0.55rem] tracking-[0.15em] text-red-400 hover:bg-red-500/10 disabled:opacity-50"
              >
                DELETE
              </button>
            </div>
          </div>
        ))}
      </div>
      {filtered.length === 0 && <p className="py-8 text-center text-sm text-zinc-600">No media found.</p>}
      <p className="text-[0.55rem] text-zinc-600">
        Deleting is blocked while the image is used by projects, photos, events or collection items.
      </p>
    </div>
  );
}