"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import type { CollectionBadge } from "@/data/collection";
import { GlassPanel } from "@/components/shared/GlassPanel";
import { TextReveal } from "@/components/shared/TextReveal";
import { useCms } from "@/components/cms/CmsGate";

/**
 * A physical-feeling badge with an interactive 3D tilt/flip.
 * Falls back to stylized front/back faces when no images are configured.
 */
function Badge3D({ badge, onOpen }: { badge: CollectionBadge; onOpen: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const hasImage = badge.frontImage.length > 0;

  const onMove = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: -py * 18, y: px * 24 });
  };

  return (
    <div style={{ perspective: "800px" }}>
      <motion.div
        ref={ref}
        onMouseMove={onMove}
        onMouseLeave={() => setTilt({ x: 0, y: 0 })}
        onClick={onOpen}
        data-cursor="drag"
        className="relative block h-48 w-40 cursor-grab select-none md:h-56 md:w-44"
        animate={{ rotateX: tilt.x, rotateY: tilt.y }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        style={{ transformStyle: "preserve-3d" }}
        aria-label={`${badge.title} — inspect`}
      >
        {/* Front face */}
        <div
          className="absolute inset-0 flex flex-col items-center justify-center rounded-lg border border-white/15 bg-graphite/70 p-3 text-center shadow-2xl"
          style={{ backfaceVisibility: "hidden" }}
        >
          {hasImage ? (
            <img src={badge.frontImage} alt={badge.title} className="h-full w-full rounded object-cover" />
          ) : (
            <>
              <span className="font-display text-[0.6rem] tracking-[0.3em] text-create">
                {badge.year}
              </span>
              <span className="mt-2 font-display text-sm leading-tight text-paper">
                {badge.title}
              </span>
              <span className="mt-1 text-[0.5rem] tracking-[0.2em] text-paper/50">
                {badge.event}
              </span>
            </>
          )}
          <span className="absolute bottom-2 text-[0.45rem] tracking-[0.25em] text-paper/40">
            {badge.backImage ? "DRAG TO FLIP" : "DRAG · CLICK TO OPEN"}
          </span>
        </div>

        {/* Back face (only if back image available) */}
        {badge.backImage && (
          <div
            className="absolute inset-0 rounded-lg border border-white/15 bg-graphite/90 shadow-2xl"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <img src={badge.backImage} alt={`${badge.title} back`} className="h-full w-full rounded object-cover" />
          </div>
        )}
      </motion.div>
    </div>
  );
}

function BadgeStory({ badge, onClose }: { badge: CollectionBadge; onClose: () => void }) {
  const sections = [
    ["WHAT HAPPENED", badge.whatHappened],
    ["WHAT I BUILT", badge.whatIBuilt],
    ["PEOPLE I MET", badge.peopleIMet],
  ] as const;
  return (
    <motion.div
      className="fixed inset-0 z-[980] flex items-center justify-center bg-ink/90 p-4 backdrop-blur-md"
      data-lenis-prevent
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={badge.title}
    >
      <motion.div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto"
        initial={{ scale: 0.92, y: 24, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.96, y: 16, opacity: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <GlassPanel className="p-8 md:p-10">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-[0.6rem] tracking-[0.3em] text-paper/60 hover:text-paper"
            aria-label="Close"
          >
            CLOSE
          </button>
          <p className="font-display text-xs tracking-[0.4em] text-create">{badge.year}</p>
          <h3 className="mt-2 font-display text-2xl md:text-4xl">{badge.title}</h3>
          <p className="mt-1 text-sm text-paper/60">{badge.event}</p>

          <p className="mt-6 text-sm italic text-paper/70">{badge.story}</p>

          <div className="mt-8 space-y-6">
            {sections.map(([label, content]) => (
              <div key={label}>
                <h4 className="mb-1 text-[0.6rem] tracking-[0.35em] text-paper/50">{label}</h4>
                <p className="text-sm text-paper/80">{content}</p>
              </div>
            ))}
          </div>

          {badge.photos.length > 0 && (
            <div className="mt-8">
              <h4 className="mb-3 text-[0.6rem] tracking-[0.35em] text-paper/50">PHOTOS</h4>
              <div className="grid grid-cols-2 gap-2">
                {badge.photos.map((src, i) => (
                  <img key={i} src={src} alt={`${badge.title} ${i + 1}`} className="h-28 w-full rounded object-cover" />
                ))}
              </div>
            </div>
          )}

          {badge.project && (
            <p className="mt-8 text-xs tracking-[0.2em] text-paper/50">
              PROJECT: <span className="text-paper/80">{badge.project}</span>
            </p>
          )}
        </GlassPanel>
      </motion.div>
    </motion.div>
  );
}

/**
 * THE COLLECTION — physical memorabilia (badges, lanyards, passes),
 * inspectable like objects, opened like stories.
 */
export function Collection() {
  const { collection } = useCms();
  const [openId, setOpenId] = useState<string | null>(null);
  const openBadge = collection.find((b) => b.id === openId) ?? null;

  return (
    <section
      id="collection"
      className="relative mx-auto w-full max-w-6xl px-6 py-24 md:px-10"
      aria-label="The collection"
    >
      <TextReveal as="h2" className="font-display text-xs tracking-[0.4em] text-paper/80">
        THE COLLECTION
      </TextReveal>
      <TextReveal as="h3" delay={0.05} className="mt-2 font-display text-3xl tracking-[0.1em] md:text-5xl">
        THINGS I&apos;VE COLLECTED ALONG THE WAY
      </TextReveal>

      <div className="mt-14 flex flex-wrap gap-8 md:gap-12">
        {collection.map((b) => (
          <Badge3D key={b.id} badge={b} onOpen={() => setOpenId(b.id)} />
        ))}
      </div>

      {openBadge && <BadgeStory badge={openBadge} onClose={() => setOpenId(null)} />}
    </section>
  );
}