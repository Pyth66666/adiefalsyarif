"use client";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Photo } from "@/data/photos";
import { PhotoMetadata } from "./PhotoMetadata";
import { DialogSurface } from "@/components/shared/DialogSurface";
import { ExpandingImage, type ImageOrigin } from "@/components/shared/ExpandingImage";
interface PhotoViewerProps { photo: Photo | null; onClose: () => void; onNavigate: (id: string) => void; all: Photo[]; origin?: ImageOrigin; }
export function PhotoViewer(props: PhotoViewerProps) {
  return props.photo ? <Viewer {...props} photo={props.photo} /> : null;
}
function Viewer({ photo, onClose, onNavigate, all, origin }: PhotoViewerProps & { photo: Photo }) {
  const [details, setDetails] = useState(false);
  const [direction, setDirection] = useState(1);
  const touch = useRef<{x: number; y: number} | null>(null);
  const idx = all.findIndex(p => p.id === photo.id);
  const reduced = useReducedMotion();
  const navigate = (step: number) => {
    const next = all[idx + step];
    if (next) { setDirection(step); onNavigate(next.id); }
  };
  const latest = useRef(navigate);
  latest.current = navigate;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); latest.current(e.key === "ArrowLeft" ? -1 : 1); }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, []);
  return <DialogSurface label={photo.title || "Photograph"} onClose={onClose}>
    <div className="photo-viewer">
      <div className="viewer-toolbar"><span className="eyebrow text-create">THE ARCHIVE / {String(idx+1).padStart(2,"0")} — {String(all.length).padStart(2,"0")}</span>
        <div className="flex gap-2"><button onClick={() => setDetails(!details)} aria-expanded={details} aria-controls="photo-details">{details ? "HIDE DETAILS" : "FRAME DETAILS"}</button><button onClick={onClose} aria-label="Close photograph">CLOSE ×</button></div></div>
      <div className="viewer-image"
        onTouchStart={e => { touch.current = e.touches.length === 1 ? {x:e.touches[0].clientX,y:e.touches[0].clientY} : null; }}
        onTouchCancel={() => { touch.current = null; }}
        onTouchEnd={e => {
          const start = touch.current; touch.current = null;
          if (!start || !e.changedTouches[0]) return;
          const dx=e.changedTouches[0].clientX-start.x, dy=e.changedTouches[0].clientY-start.y;
          if (Math.abs(dx)>60 && Math.abs(dx)>Math.abs(dy)*1.5) navigate(dx<0?1:-1);
        }}>
        <AnimatePresence mode="wait" initial={false}>
          {photo.src && origin ? <ExpandingImage key={photo.id} src={photo.src} alt={photo.title} origin={origin} /> : photo.src ? <motion.img key={photo.id} src={photo.src} alt={photo.title}
            initial={{ opacity: 0, x: reduced ? 0 : direction * 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : .2 }} />
            : <p className="text-paper/50">{photo.title}</p>}
        </AnimatePresence>
      </div>
      <div className="viewer-footer"><button disabled={idx<=0} onClick={() => navigate(-1)}>← PREVIOUS</button>
        <div className="text-center" aria-live="polite"><p className="font-display text-lg">{photo.title}</p><p className="mt-1 text-sm text-paper/50">{photo.location}{photo.date ? " / " + photo.date : ""}</p></div>
        <button disabled={idx>=all.length-1} onClick={() => navigate(1)}>NEXT →</button></div>
      {details && <div id="photo-details" className="mt-6 max-w-xl mx-auto"><PhotoMetadata photo={photo} /></div>}
    </div>
  </DialogSurface>;
}
