"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { AnimatePresence, motion } from "framer-motion";
import { usePageTransition } from "@/components/shared/PageTransition";
import { Scene } from "@/components/three/Scene";
import { isWebGLSupported } from "@/lib/webgl";
import { reduceMotion } from "@/lib/animations";
import type { Mode } from "@/lib/modes";

type Side = "build" | "create" | null;

interface GatewayProps {
  onSelect: (mode: "build" | "create") => void;
}

/**
 * The signature split-screen world selector. The seam reacts to the cursor:
 * whichever side the cursor approaches expands, the other compresses.
 * A central morphing 3D object marks the intersection of the two worlds.
 */
export function Gateway({ onSelect }: GatewayProps) {
  const [hover, setHover] = useState<Side>(null);
  const [webgl, setWebgl] = useState(false);
  const [mode, setMode] = useState<Mode>("neutral");
  const { runTransition } = usePageTransition();
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setWebgl(isWebGLSupported());
  }, []);

  useEffect(() => {
    setMode(hover === "build" ? "build" : hover === "create" ? "create" : "neutral");
  }, [hover]);

  const buildWidth = hover === "build" ? "64%" : hover === "create" ? "36%" : "50%";
  const createWidth = hover === "create" ? "64%" : hover === "build" ? "36%" : "50%";

  const go = (mode: "build" | "create") => {
    runTransition(() => onSelect(mode));
  };

  return (
    <section
      id="gateway"
      className="relative flex h-screen w-full overflow-hidden bg-ink"
      aria-label="Choose a world to explore"
    >
      {/* Background canvas */}
      <div className="absolute inset-0 z-0">
        {webgl ? (
          <Canvas
            camera={{ position: [0, 0, 6], fov: 45 }}
            dpr={[1, 1.5]}
            gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
          >
            <Scene mode={mode} />
          </Canvas>
        ) : (
          <FallbackObject mode={mode} />
        )}
      </div>

      {/* BUILD panel */}
      <button
        onMouseEnter={() => setHover("build")}
        onMouseLeave={() => setHover(null)}
        onClick={() => go("build")}
        data-cursor="enter"
        aria-label="Enter the BUILD world"
        className="relative z-10 flex h-full items-center justify-center overflow-hidden border-r border-white/5 bg-transparent transition-[flex-basis] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ flexBasis: buildWidth, transitionTimingFunction: "cubic-bezier(0.16,1,0.3,1)" }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={hover === "create" ? "compress" : "expand"}
            className="pointer-events-none flex flex-col items-center gap-4 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: hover === "create" ? 0.25 : 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <span
              className="font-display text-[16vw] font-light leading-none text-build md:text-[7vw]"
              style={{ textShadow: hover === "build" ? "0 0 60px rgba(61,220,132,0.3)" : "none" }}
            >
              BUILD
            </span>
            <span className="text-[0.6rem] tracking-[0.4em] text-paper/60 md:text-xs">
              CYBERSECURITY · ENGINEERING · TECHNOLOGY · COMMUNITY
            </span>
          </motion.div>
        </AnimatePresence>
      </button>

      {/* CREATE panel */}
      <button
        onMouseEnter={() => setHover("create")}
        onMouseLeave={() => setHover(null)}
        onClick={() => go("create")}
        data-cursor="enter"
        aria-label="Enter the CREATE world"
        className="relative z-10 flex h-full items-center justify-center overflow-hidden bg-transparent transition-[flex-basis] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ flexBasis: createWidth }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={hover === "build" ? "compress" : "expand"}
            className="pointer-events-none flex flex-col items-center gap-4 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: hover === "build" ? 0.25 : 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <span
              className="font-display text-[16vw] font-light leading-none text-create md:text-[7vw]"
              style={{ textShadow: hover === "create" ? "0 0 60px rgba(232,163,61,0.3)" : "none" }}
            >
              CREATE
            </span>
            <span className="text-[0.6rem] tracking-[0.4em] text-paper/60 md:text-xs">
              PHOTOGRAPHY · DESIGN · EXPERIMENTS · VISUAL STORIES
            </span>
          </motion.div>
        </AnimatePresence>
      </button>

      {/* Center hint on desktop */}
      {!reduceMotion() && hover === null && (
        <motion.div
          className="pointer-events-none absolute left-1/2 top-16 z-20 -translate-x-1/2"
          animate={{ opacity: [0, 1, 0] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          <div ref={gridRef} className="text-center text-[0.6rem] tracking-[0.35em] text-paper/40">
            MOVE TOWARD A WORLD
          </div>
        </motion.div>
      )}
    </section>
  );
}

function FallbackObject({ mode }: { mode: Mode }) {
  const color = mode === "build" ? "#3ddc84" : mode === "create" ? "#e8a33d" : "#b0b4bd";
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <motion.div
        className="h-[34vmin] w-[34vmin] rounded-[30%]"
        style={{
          background: `radial-gradient(circle at 30% 30%, ${color}55, ${color}11 60%, transparent)`,
          border: `1px solid ${color}44`,
          boxShadow: `0 0 80px ${color}22`,
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
      />
    </div>
  );
}
