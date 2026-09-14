"use client";

import { motion } from "framer-motion";
import { TextReveal } from "@/components/shared/TextReveal";
import { Telemetry } from "./Telemetry";
import { ProjectExplorer } from "./ProjectExplorer";
import { CyberMap } from "./CyberMap";
import { HackDev } from "./HackDev";
import { EventTimeline } from "./EventTimeline";
import { useCms } from "@/components/cms/CmsGate";

/**
 * The BUILD world — everything technical. An engineering cockpit feel,
 * not a hacker-movie UI.
 */
export function BuildWorld() {
  const { site } = useCms();
  return (
    <div
      id="build"
      className="relative bg-ink"
      style={{
        background:
          "radial-gradient(1200px 800px at 20% 0%, rgba(61,220,132,0.04), transparent 60%), radial-gradient(900px 600px at 90% 30%, rgba(90,169,230,0.03), transparent 60%)",
      }}
    >
      {/* BUILD hero */}
      <section className="relative flex min-h-screen flex-col justify-center px-6 md:px-10">
        <TextReveal as="p" className="text-xs tracking-[0.4em] text-build/80">
          BUILD
        </TextReveal>
        <TextReveal as="h1" delay={0.05} className="mt-3 font-display text-6xl tracking-[0.1em] md:text-[11vw]">
          BUILD
        </TextReveal>
        <TextReveal as="p" delay={0.1} className="mt-2 text-[0.6rem] tracking-[0.35em] text-paper/50 md:text-xs">
          COMPUTER SCIENCE / CYBERSECURITY / ENGINEERING
        </TextReveal>

        <TextReveal as="div" delay={0.2} className="mt-16 max-w-2xl">
          <p className="text-base text-paper/80 md:text-2xl">
            <span className="font-display text-paper">{site.fullName}</span>
            <br />
            {site.intro}
          </p>
        </TextReveal>

        <motion.div
          className="absolute bottom-10 left-6 text-xs tracking-[0.3em] text-paper/30 md:left-10"
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          SCROLL
        </motion.div>
      </section>

      <Telemetry />
      <ProjectExplorer />
      <CyberMap />
      <HackDev />
      <EventTimeline />
    </div>
  );
}
