"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Photo } from "@/data/photos";
import { PhotoMetadata } from "./PhotoMetadata";

interface PhotoViewerProps {
  photo: Photo | null;
  onClose: () => void;
  onNavigate: (id: string) => void;
  all: Photo[];
}

/**
 * Cinematic full-screen photo viewer. The photo expands from the gallery,
 * dark background, prev/next/ESC controls, keyboard + swipe navigation.
 */
export function PhotoViewer({ photo, onClose, onNavigate, all }: PhotoViewerProps) {
  useEffect(() => {
    if (!photo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") {
        const idx = all.findIndex((p) => p.id === photo.id);
        if (idx > 0) onNavigate(all[idx - 1].id);
      }
      if (e.key === "ArrowRight") {
        const idx = all.findIndex((p) => p.id === photo.id);
        if (idx < all.length - 1) onNavigate(all[idx + 1].id);
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [photo, onClose, onNavigate, all]);

  const idx = photo ? all.findIndex((p) => p.id === photo.id) : -1;

  return (
    <AnimatePresence>
      {photo && (
        <motion.div
          className="fixed inset-0 z-[980] flex items-center justify-center bg-ink/95 p-6"
          data-lenis-prevent
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={photo.title}
        >
          <motion.div
            className="relative flex max-h-[85vh] w-full max-w-5xl items-center justify-center"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            {photo.src ? (
              <img
                src={photo.src}
                alt={photo.title}
                className="max-h-[85vh] w-auto max-w-full rounded-lg object-contain shadow-2xl"
              />
            ) : (
              <div
                className="flex w-full max-w-2xl items-center justify-center rounded-lg"
                style={{
                  aspectRatio: `${photo.width} / ${photo.height}`,
                  background:
                    "linear-gradient(135deg, rgba(232,163,61,0.2), rgba(20,20,24,0.8))",
                }}
              >
                <p className="font-display text-lg tracking-[0.3em] text-paper/50">
                  {photo.title}
                </p>
              </div>
            )}

            {/* metadata overlay */}
            <div className="absolute bottom-4 left-4 right-4 flex justify-center">
              <div className="scale-90">
                <PhotoMetadata photo={photo} />
              </div>
            </div>

            {/* controls */}
            <button
              onClick={onClose}
              className="absolute right-4 top-4 z-10 rounded-full border border-white/15 px-4 py-2 text-[0.55rem] tracking-[0.3em] text-paper/70 hover:border-white/40"
              aria-label="Close viewer"
            >
              ESC ⌫
            </button>
            {idx > 0 && (
              <button
                onClick={() => onNavigate(all[idx - 1].id)}
                className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/15 px-4 py-3 text-[0.55rem] tracking-[0.3em] text-paper/70 hover:border-white/40 md:left-6"
              >
                ← PREV
              </button>
            )}
            {idx < all.length - 1 && (
              <button
                onClick={() => onNavigate(all[idx + 1].id)}
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/15 px-4 py-3 text-[0.55rem] tracking-[0.3em] text-paper/70 hover:border-white/40 md:right-6"
              >
                NEXT →
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}