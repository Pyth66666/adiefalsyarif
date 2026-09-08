"use client";

import { useState, useTransition } from "react";
import { UploadDropzone, type DroppedPhoto } from "@/components/admin/UploadDropzone";
import { createPhotoBatch } from "@/lib/actions/photos";

interface PendingPhoto extends DroppedPhoto {
  title: string;
  location: string;
  category: string;
  published: boolean;
  remove: boolean;
}

export function NewPhotoManager() {
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);

  const addPhoto = (p: DroppedPhoto) => {
    setPhotos((prev) => [
      ...prev,
      {
        ...p,
        title: p.filename.replace(/\.[^.]+$/, ""),
        location: "",
        category: "STREET",
        published: true,
        remove: false,
      },
    ]);
  };

  const update = (key: string, patch: Partial<PendingPhoto>) =>
    setPhotos((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  const submit = () => {
    if (photos.length === 0) return;
    start(async () => {
      const res = await createPhotoBatch(photos.map((p) => ({
        id: p.key,
        src: p.url,
        title: p.title,
        location: p.location,
        category: p.category,
        published: p.published,
        camera: p.exif.camera,
        lens: p.exif.lens,
        aperture: p.exif.aperture,
        shutterSpeed: p.exif.shutterSpeed,
        iso: p.exif.iso,
        date: p.exif.date,
        remove: p.remove,
      })));
      setResult(res);
      if (res.ok) setPhotos([]);
    });
  };

  const visible = photos.filter((p) => !p.remove);

  return (
    <div className="space-y-6">
      <UploadDropzone onFile={addPhoto} />

      {photos.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((p) => (
              <div key={p.key} className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]">
                <img src={p.url} alt={p.title} className="h-40 w-full object-cover" />
                <div className="space-y-2 p-3">
                  <input
                    value={p.title}
                    onChange={(e) => update(p.key, { title: e.target.value })}
                    className="w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-zinc-100 outline-none focus:border-build/60"
                    placeholder="TITLE"
                  />
                  <input
                    value={p.location}
                    onChange={(e) => update(p.key, { location: e.target.value })}
                    className="w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-zinc-100 outline-none focus:border-build/60"
                    placeholder="LOCATION"
                  />
                  <select
                    value={p.category}
                    onChange={(e) => update(p.key, { category: e.target.value })}
                    className="w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-zinc-100 outline-none"
                  >
                    {["PEOPLE", "PLACES", "EVENTS", "STREET", "TRAVEL"].map((c) => (
                      <option key={c} value={c} className="bg-zinc-900">{c}</option>
                    ))}
                  </select>
                  {p.hasGps && (
                    <p className="text-[0.55rem] tracking-[0.1em] text-amber-400/90">
                      ⚠ GPS present — coordinates are NOT published. Set a readable location instead.
                    </p>
                  )}
                  {p.exif.camera && <p className="text-[0.6rem] text-zinc-500">EXIF: {p.exif.camera} · {p.exif.lens ?? "—"}</p>}
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-[0.6rem] text-zinc-400">
                      <input
                        type="checkbox"
                        checked={p.published}
                        onChange={(e) => update(p.key, { published: e.target.checked })}
                      />
                      PUBLISH
                    </label>
                    <button
                      onClick={() => update(p.key, { remove: true })}
                      className="text-[0.6rem] tracking-[0.2em] text-red-400 hover:text-red-300"
                    >
                      REMOVE
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={submit}
              disabled={pending || visible.length === 0}
              className="rounded bg-build/90 px-5 py-2 text-[0.65rem] font-semibold tracking-[0.25em] text-black hover:bg-build disabled:opacity-60"
            >
              {pending ? "SAVING…" : `PUBLISH ${visible.length} PHOTO${visible.length === 1 ? "" : "S"}`}
            </button>
            {result?.error && <p className="text-sm text-red-400">{result.error}</p>}
            {result?.ok && <p className="text-sm text-build">Photos published.</p>}
          </div>
        </>
      )}
      {photos.length === 0 && (
        <p className="text-[0.65rem] text-zinc-600">
          Supported: multiple images at once. EXIF (camera, lens, ISO, aperture, shutter, date) is read automatically.
          GPS coordinates are never published.
        </p>
      )}
    </div>
  );
}