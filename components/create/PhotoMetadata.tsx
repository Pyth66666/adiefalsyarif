"use client";

import type { Photo } from "@/data/photos";
import { GlassPanel } from "@/components/shared/GlassPanel";

const fields = [
  ["CAMERA", "camera"],
  ["LENS", "lens"],
  ["APERTURE", "aperture"],
  ["SHUTTER", "shutterSpeed"],
  ["ISO", "iso"],
] as const;

/**
 * Compact glass metadata strip. Only renders rows whose value exists —
 * EXIF fields that are absent gracefully hide.
 */
export function PhotoMetadata({ photo }: { photo: Photo }) {
  const hasExif = fields.some(([, key]) => photo[key]);
  return (
    <GlassPanel tone="create" interactive className="pointer-events-none">
      <div className="px-5 py-4">
        <p className="font-display text-sm tracking-[0.15em] text-paper">{photo.title}</p>
        <p className="mt-1 text-[0.6rem] tracking-[0.3em] text-paper/60">
          {photo.location}
          {photo.date ? ` · ${photo.date}` : ""}
        </p>
        {hasExif ? (
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1">
            {fields.map(([label, key]) =>
              photo[key] ? (
                <div key={label} className="flex justify-between gap-4">
                  <span className="text-[0.55rem] tracking-[0.2em] text-paper/40">{label}</span>
                  <span className="text-[0.6rem] tracking-[0.1em] text-paper/80">{photo[key]}</span>
                </div>
              ) : null
            )}
          </div>
        ) : (
          <p className="mt-2 text-[0.55rem] italic tracking-[0.15em] text-paper/35">
            [ADD EXIF IN data/photos.ts, OR IT LOADS AUTOMATICALLY WHEN SRC IS SET]
          </p>
        )}
      </div>
    </GlassPanel>
  );
}