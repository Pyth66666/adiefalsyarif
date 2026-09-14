"use client";
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { Photo } from "@/data/photos";
import { PhotoViewer } from "./PhotoViewer";
import { useCms } from "@/components/cms/CmsGate";
import type { PhotoExif } from "@/lib/exif";
import { imageOrigin, type ImageOrigin } from "@/components/shared/ExpandingImage";
const PHOTO_CATEGORIES = ["ALL", "PEOPLE", "PLACES", "EVENTS", "STREET", "TRAVEL"] as const;
export type PhotoCategory = (typeof PHOTO_CATEGORIES)[number];
const exifCache = new Map<string, Promise<PhotoExif>>();
export function PhotoGallery() {
  const { photos } = useCms();
  const [filter, setFilter] = useState<PhotoCategory>("ALL");
  const [view, setView] = useState<"grid" | "desk">("grid");
  const [active, setActive] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [origin, setOrigin] = useState<ImageOrigin>();
  const [live, setLive] = useState<Record<string, Photo>>({});
  const reduced = useReducedMotion();
  const filtered = filter === "ALL" ? photos : photos.filter(p => p.category === filter);
  const openPhoto = live[openId ?? ""] ?? photos.find(p => p.id === openId) ?? null;
  const navigate = (id: string) => {
    setOpenId(id);
    const p = photos.find(x => x.id === id);
    if (!p?.src || live[p.id]) return;
    let request = exifCache.get(p.src);
    if (!request) { request = import("@/lib/exif").then(({ readPhotoExif }) => readPhotoExif(p.src)); exifCache.set(p.src, request); }
    void request.then(exif => setLive(prev => ({ ...prev, [id]: {
      ...p, camera: p.camera || exif.camera, lens: p.lens || exif.lens,
      aperture: p.aperture || exif.aperture, shutterSpeed: p.shutterSpeed || exif.shutterSpeed,
      iso: p.iso || exif.iso, date: p.date || exif.date,
    } }))).catch(() => { exifCache.delete(p.src); });
  };
  return <section id="gallery" className="mx-auto max-w-7xl px-6 pt-8 pb-24 md:px-10" aria-label="Photography gallery">
    <div className="flex justify-between items-center gap-4"><h2 className="eyebrow text-create">CONTACT SHEET</h2><p className="eyebrow text-paper/50" aria-live="polite">{filtered.length} FRAMES</p></div>
    <div className="photo-toolbar">
      <div className="photo-filters" role="group" aria-label="Photo categories">
        {PHOTO_CATEGORIES.map(c => <button key={c} aria-pressed={filter === c} onClick={() => { setFilter(c); setActive(null); }}>{c}</button>)}
      </div>
      <div className="view-switch" role="group" aria-label="Gallery layout">
        <button aria-pressed={view === "grid"} onClick={() => setView("grid")}>GRID</button>
        <button aria-pressed={view === "desk"} onClick={() => setView("desk")}>ON THE DESK</button>
      </div>
    </div>
    <div className="photo-grid" data-view={view}>
      {filtered.map((p, i) => <motion.button key={p.id} type="button" className="photo-card"
        layout={!reduced} onClick={e => { setOrigin(imageOrigin(e.currentTarget.querySelector(".photo-card-image"))); navigate(p.id); }} data-cursor="open" aria-haspopup="dialog"
        aria-label={`Open ${p.title || "photograph"}${p.location ? " — " + p.location : ""}`}
        onMouseEnter={() => setActive(p.id)} onMouseLeave={() => setActive(null)}
        onFocus={() => setActive(p.id)} onBlur={() => setActive(null)}
        animate={{ rotate: view === "desk" && !reduced ? (active === p.id ? 0 : [-3, 2, -1, 3, -2][i % 5]) : 0,
          y: active === p.id && !reduced ? -6 : 0, opacity: active && active !== p.id ? .65 : 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 26 }}
        style={{ zIndex: active === p.id ? 2 : 1 }}>
        <span className="photo-card-image" style={{ aspectRatio: view === "desk" ? "4 / 5" : `${Math.max(1,p.width)} / ${Math.max(1,p.height)}` }}>
          {p.src ? <img src={p.src} alt="" width={p.width} height={p.height} loading="lazy" decoding="async" />
            : <span className="p-6 text-paper/40 text-sm text-center">{p.title}</span>}
        </span>
        <span className="photo-card-caption"><span>{String(i + 1).padStart(2,"0")} / {p.title}</span><span>{p.location || p.category} ↗</span></span>
      </motion.button>)}
    </div>
    {filtered.length === 0 && <p className="py-20 text-paper/60">No photographs in this category yet. Try another collection.</p>}
    <PhotoViewer photo={openPhoto} origin={origin} onClose={() => setOpenId(null)} onNavigate={id => { setOrigin(undefined); navigate(id); }} all={filtered} />
  </section>;
}
