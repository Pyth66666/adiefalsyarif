"use client";

import { TextReveal } from "@/components/shared/TextReveal";
import { useCms } from "@/components/cms/CmsGate";

const verbs = [
  { word: "BUILDING", desc: "web prototypes and local tools" },
  { word: "LEARNING", desc: "Computer Science at UTM Kuala Lumpur" },
  { word: "EXPLORING", desc: "CTFs, AI agents & digital forensics" },
  { word: "CREATING", desc: "photography, talks & community events" },
];

/**
 * Personal statement — no résumé boilerplate, just what's true.
 */
export function About() {
  const { site } = useCms();
  return (
    <section
      id="about"
      className="relative mx-auto min-h-screen w-full max-w-6xl px-6 py-24 md:px-10"
      aria-label="About"
    >
      <TextReveal as="p" className="font-display text-xs tracking-[0.4em] text-paper/60">
        ABOUT
      </TextReveal>

      <TextReveal as="h2" delay={0.05} className="mt-10 font-display text-4xl leading-tight tracking-[0.05em] md:text-7xl">
        {site.fullName}
      </TextReveal>
      <TextReveal as="p" delay={0.12} className="mt-4 text-[0.6rem] tracking-[0.35em] text-paper/50 md:text-xs">
        COMPUTER SCIENCE STUDENT / COMMUNITY LEADER
      </TextReveal>

      <div className="mt-12 max-w-3xl">
        <TextReveal as="p" delay={0.15} className="text-xl leading-relaxed text-paper/80 md:text-3xl">
          {site.about}
        </TextReveal>
      </div>

      <div className="mt-20 grid grid-cols-1 gap-8 md:grid-cols-2">
        {verbs.map((v, i) => (
          <TextReveal key={v.word} delay={0.05 * i}>
            <div className="flex items-baseline gap-4 border-b border-white/10 py-4">
              <span className="font-display text-3xl text-paper md:text-5xl">{v.word}</span>
              <span className="text-sm text-paper/50">{v.desc}</span>
            </div>
          </TextReveal>
        ))}
      </div>
    </section>
  );
}