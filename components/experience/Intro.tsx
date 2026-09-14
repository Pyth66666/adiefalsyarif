"use client";

import { motion } from "framer-motion";
import { useRef, useState, type MouseEvent } from "react";
import { reduceMotion } from "@/lib/animations";
import { MagneticButton } from "@/components/shared/MagneticButton";
import { useCms } from "@/components/cms/CmsGate";
import { StarfieldBackground, type SpacePointer } from "./StarfieldBackground";
import { ThemePicker, useExperienceTheme } from "./ThemeProvider";
import { MarsScene } from "./MarsScene";

interface IntroProps {
  onEnter: () => void;
}

/**
 * Minimal entry screen: name + descriptors + ENTER.
 * The name subtly shifts tracking toward the cursor without over-animating.
 */
export function Intro({ onEnter }: IntroProps) {
  const { site } = useCms();
  const { theme } = useExperienceTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [tracking, setTracking] = useState(0.18);
  const pointer = useRef<SpacePointer>({ x: 0.5, y: 0.5, active: false, pulse: 0 });

  const onMove = (e: MouseEvent<HTMLDivElement>) => {
    if (theme === "mars" || reduceMotion() || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / rect.width - 0.5;
    setTracking(0.14 + Math.abs(cx) * 0.2);
  };

  return (
    <motion.div
      ref={containerRef}
      onMouseMove={onMove}
      onPointerMove={e => {
        const rect = e.currentTarget.getBoundingClientRect();
        pointer.current.x = (e.clientX - rect.left) / rect.width;
        pointer.current.y = 1 - (e.clientY - rect.top) / rect.height;
        pointer.current.active = true;
      }}
      onPointerDown={e => {
        const rect = e.currentTarget.getBoundingClientRect();
        pointer.current.x = (e.clientX - rect.left) / rect.width;
        pointer.current.y = 1 - (e.clientY - rect.top) / rect.height;
        pointer.current.active = true;
        pointer.current.pulse += 1;
      }}
      onPointerLeave={() => { pointer.current.active = false; }}
      onPointerCancel={() => { pointer.current.active = false; }}
      onPointerUp={e => { if (e.pointerType !== "mouse") pointer.current.active = false; }}
      className="intro-screen intro-with-themes fixed inset-0 z-[1200] isolate flex min-h-screen flex-col items-center justify-center overflow-hidden bg-ink px-6 text-center"
      exit={{ opacity: 0, scale: 1.03, filter: "blur(8px)" }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
    >
      {theme === "mars" ? <MarsScene/> : <StarfieldBackground pointer={pointer} />}
      <h1
        className="relative z-10 font-display text-center text-[14vw] font-light leading-[0.95] text-paper md:text-[9vw]"
        style={{ letterSpacing: `${theme === "mars" ? .18 : tracking}em`, transition: "letter-spacing 0.4s ease" }}
      >
        ADIEF
        <br />
        <span className="opacity-70">AL SYARIF</span>
      </h1>

      <motion.p
        className="relative z-10 mt-8 text-[0.62rem] tracking-[0.35em] text-paper/75 md:text-xs"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.8 }}
      >
        {site.descriptors}
      </motion.p>

      <motion.div
        className="relative z-10 mt-14"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1, duration: 0.8 }}
      >
        <MagneticButton
          onClick={onEnter}
          data-cursor="enter"
          className="rounded-full border border-paper/40 bg-ink/25 px-10 py-3 font-display text-xs tracking-[0.3em] text-paper transition-colors hover:border-paper hover:bg-paper/10"
        >
          ENTER
        </MagneticButton>
      </motion.div>
      <div className="intro-theme-picker"><ThemePicker /></div>
    </motion.div>
  );
}
