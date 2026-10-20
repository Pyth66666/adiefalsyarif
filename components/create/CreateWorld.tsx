"use client";

import { TextReveal } from "@/components/shared/TextReveal";
import { PhotoGallery } from "./PhotoGallery";

/**
 * The CREATE world — cinematic, warm, photographic.
 */
export function CreateWorld() {
  return (
    <div
      id="create"
      className="relative bg-ink world-create"
      style={{
        background:
          "radial-gradient(1200px 700px at 80% 10%, rgba(232,163,61,0.05), transparent 60%)",
      }}
    >
      {/* CREATE intro — quiet, editorial, photography-led */}
      <section className="relative flex min-h-screen flex-col justify-center px-6 md:px-10">
        <TextReveal as="p" className="text-xs tracking-[0.4em] text-create/80">
          CREATE
        </TextReveal>
        <TextReveal as="h1" delay={0.05} className="mt-3 font-display text-2xl leading-snug tracking-[0.08em] md:text-6xl">
          moments I decided
          <br />
          <span className="italic text-paper/70">were worth keeping.</span>
        </TextReveal>
        <TextReveal as="p" delay={0.2} className="mt-8 max-w-md text-sm text-paper/50 md:text-base">
          I make event photos, short videos and promotional content. Here are two
          creative collaborations I’m working on alongside my photography.
        </TextReveal>
        <div className="mt-12 grid max-w-3xl gap-6 border-t border-white/10 pt-7 md:grid-cols-2">
          <div>
            <p className="eyebrow text-create">SELECTED CREATOR / 2026</p>
            <h2 className="mt-3 font-display text-xl text-paper">ASEAN FOUNDATION</h2>
            <p className="mt-2 text-sm leading-relaxed text-paper/60">Selected for the AI Ready ASEAN creator campaign in October 2026. The campaign work is in development.</p>
          </div>
          <div>
            <p className="eyebrow text-create">CONTENT IN PROGRESS / 2026</p>
            <h2 className="mt-3 font-display text-xl text-paper">MEDLY</h2>
            <p className="mt-2 text-sm leading-relaxed text-paper/60">Developing promotional video content for Medly. The work is in preparation.</p>
          </div>
        </div>
      </section>

      <PhotoGallery />
    </div>
  );
}
