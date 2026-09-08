"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Photo } from "@/data/photos";
import { PhotoMetadata } from "./PhotoMetadata";
import { PhotoViewer } from "./PhotoViewer";
import { TextReveal } from "@/components/shared/TextReveal";
import { useCms } from "@/components/cms/CmsGate";
import { readPhotoExif } from "@/lib/exif";
import type { PhotoExif } from "@/lib/exif";

const PHOTO_CATEGORIES = ["ALL", "PEOPLE", "PLACES", "EVENTS", "STREET", "TRAVEL"] as const;
export type PhotoCategory = (typeof PHOTO_CATEGORIES)[number];

const exifCache = new Map<string, PhotoExif>();

/** Merge live EXIF over static photo data when a src is set. */
async function enrichPhoto(p: Photo): Promise<Photo> {
  if (!p.src || exifCache.has(p.id)) return p;
  try {
    const exif = await readPhotoExif(p.src);
    exifCache.set(p.id, exif);
    return {
      ...p,
      camera: p.camera || exif.camera,
      lens: p.lens || exif.lens,
      aperture: p.aperture || exif.aperture,
      shutterSpeed: p.shutterSpeed || exif.shutterSpeed,
      iso: p.iso || exif.iso,
      date: p.date || exif.date,
    };
  } catch {
    return p;
  }
}

function PhotoFrame({
  photo,
  dominant,
  onHover,
  onOpen,
}: {
  photo: Photo;
  dominant: boolean;
  onHover: (id: string | null) => void;
  onOpen: () => void;
}) {
  const hasImage = photo.src.length > 0;
  return (
    <motion.div
      onMouseEnter={() => onHover(photo.id)}
      onMouseLeave={() => onHover(null)}
      onClick={onOpen}
      data-cursor="open"
      className="group relative overflow-hidden rounded-lg"
      animate={{
        opacity: dominant ? 1 : 0.32,
        scale: dominant ? 1.04 : 0.98,
        filter: dominant ? "blur(0px)" : "blur(2px)",
      }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{ filter: "blur(0px)" }}
    >
      <div
        className="flex items-center justify-center"
        style={{
          aspectRatio: `${photo.width} / ${photo.height}`,
          background:
            "linear-gradient(135deg, rgba(232,163,61,0.18), rgba(232,163,61,0.03) 45%, rgba(20,20,24,0.6))",
        }}
      >
        {hasImage ? (
          <img
            src={photo.src}
            alt={`${photo.title} — ${photo.location}`}
            width={photo.width}
            height={photo.height}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <span className="px-6 text-center font-display text-sm tracking-[0.25em] text-paper/40">
            {photo.title}
          </span>
        )}
      </div>

      {/* inline metadata (non-blocking, compact) */}
      <div className="absolute inset-x-0 top-0 flex justify-between p-3 text-[0.55rem] tracking-[0.2em] text-paper/80">
        <span>{photo.category}</span>
        <span className={dominant ? "opacity-100" : "opacity-0"}>
          OPEN →
        </span>
      </div>
    </motion.div>
  );
}

/**
 * Interactive photography exhibition. Hovering a frame makes it dominant
 * while the rest dim; clicking opens the full-screen viewer.
 */
export function PhotoGallery() {
  const { photos } = useCms();
  const [filter, setFilter] = useState<PhotoCategory>("ALL");
  const [active, setActive] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const [live, setLive] = useState<Record<string, Photo>>({});

  const enrich = (id: string) => {
    const p = photos.find((x) => x.id === id);
    if (!p) return;
    void enrichPhoto(p).then((enriched) =>
      setLive((prev) => (prev[id] === enriched ? prev : { ...prev, [id]: enriched }))
    );
  };

  const filtered = filter === "ALL" ? photos : photos.filter((p) => p.category === filter);
  const openPhoto = (live[openId ?? ""] as Photo | undefined) ?? photos.find((p) => p.id === openId) ?? null;

  return (
    <section
      id="gallery"
      className="relative mx-auto w-full max-w-7xl px-6 py-24 md:px-10"
      aria-label="Photography gallery"
    >
      <TextReveal as="p" className="text-xs tracking-[0.4em] text-create/80">
        CREATE
      </TextReveal>
      <TextReveal as="h2" delay={0.05} className="mt-3 font-display text-4xl tracking-[0.1em] md:text-6xl">
        MOMENTS WORTH KEEPING
      </TextReveal>

      {/* categories */}
      <div className="mt-8 flex flex-wrap gap-2" role="tablist" aria-label="Photo categories">
        {PHOTO_CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            role="tab"
            aria-selected={filter === c}
            className={`rounded-full px-4 py-1.5 text-[0.6rem] tracking-[0.3em] transition-colors ${
              filter === c
                ? "bg-paper text-ink"
                : "border border-white/15 text-paper/60 hover:border-create/50"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* exhibition: variable sizes, no masonry monotony */}
      <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:[&>*:first-child]:col-span-2 lg:[&>*:last-child]:col-span-2">
        {filtered.map((p) => (
          <PhotoFrame
            key={p.id}
            photo={p}
            dominant={active === null || active === p.id}
            onHover={(id) => {
              setActive(id);
              if (id) enrich(id);
            }}
            onOpen={() => setOpenId(p.id)}
          />
        ))}
      </div>

      {/* hover metadata panel for active photo */}
      <AnimatePresence>
        {active && (
          <motion.div
            key={active}
            className="pointer-events-none fixed bottom-6 left-6 z-40"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.35 }}
          >
            <PhotoMetadata
              photo={(live[active] as Photo | undefined) ?? photos.find((p) => p.id === active)!}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <PhotoViewer
        photo={openPhoto}
        onClose={() => setOpenId(null)}
        onNavigate={setOpenId}
        all={filtered}
      />
    </section>
  );
}