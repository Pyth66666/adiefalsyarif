"use client";

import { motion } from "framer-motion";
import { useRef, useState, type MouseEvent } from "react";
import { reduceMotion } from "@/lib/animations";
import { MagneticButton } from "@/components/shared/MagneticButton";
import { useCms } from "@/components/cms/CmsGate";

interface IntroProps {
  onEnter: () => void;
}

/**
 * Minimal entry screen: name + descriptors + ENTER.
 * The name subtly shifts tracking toward the cursor without over-animating.
 */
export function Intro({ onEnter }: IntroProps) {
  const { site } = useCms();
  const containerRef = useRef<HTMLDivElement>(null);
  const [tracking, setTracking] = useState(0.18);

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    if (reduceMotion() || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / rect.width - 0.5;
    setTracking(0.14 + Math.abs(cx) * 0.2);
  };

  return (
    <motion.div
      ref={containerRef}
      onMouseMove={onMove}
      className="fixed inset-0 z-[1200] flex min-h-screen flex-col items-center justify-center bg-ink px-6 text-center"
      exit={{ opacity: 0, scale: 1.03, filter: "blur(8px)" }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
    >
      <h1
        className="font-display text-center text-[14vw] font-light leading-[0.95] text-paper md:text-[9vw]"
        style={{ letterSpacing: `${tracking}em`, transition: "letter-spacing 0.4s ease" }}
      >
        ADIEF
        <br />
        <span className="opacity-70">AL SYARIF</span>
      </h1>

      <motion.p
        className="mt-8 text-[0.62rem] tracking-[0.35em] text-paper/60 md:text-xs"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.8 }}
      >
        {site.descriptors}
      </motion.p>

      <motion.div
        className="mt-14"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1, duration: 0.8 }}
      >
        <MagneticButton
          onClick={onEnter}
          data-cursor="enter"
          className="rounded-full border border-paper/30 px-10 py-3 font-display text-xs tracking-[0.3em] text-paper transition-colors hover:border-paper"
        >
          ENTER
        </MagneticButton>
      </motion.div>
    </motion.div>
  );
}
