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
      className="relative bg-ink"
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
          Light, people, places, and the in-between. No noise — just the frames
          that earned their place in the archive.
        </TextReveal>
      </section>

      <PhotoGallery />
    </div>
  );
}
