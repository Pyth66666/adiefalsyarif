"use client";

import { motion } from "framer-motion";
import { usePageTransition } from "@/components/shared/PageTransition";

interface MobileGatewayProps {
  onSelect: (mode: "build" | "create") => void;
}

/**
 * Mobile world selector — replaces the cursor-split on coarse pointers.
 * Vertical BUILD / CREATE chooser, kept minimal.
 */
export function MobileGateway({ onSelect }: MobileGatewayProps) {
  const { runTransition } = usePageTransition();
  const go = (m: "build" | "create") => runTransition(() => onSelect(m));

  return (
    <section
      id="gateway"
      className="relative flex min-h-screen w-full flex-col overflow-hidden bg-ink"
      aria-label="Choose a world to explore"
    >
      <p className="pt-16 text-center text-[0.55rem] tracking-[0.35em] text-paper/50">
        BEST EXPERIENCED ON DESKTOP
      </p>
      <p className="mt-2 text-center text-[0.5rem] tracking-[0.3em] text-paper/30">
        — TAP TO CHOOSE —
      </p>

      <div className="flex flex-1 flex-col items-center justify-center gap-12">
        <motion.button
          onClick={() => go("build")}
          data-cursor="enter"
          className="font-display text-6xl text-build"
          whileTap={{ scale: 0.97 }}
        >
          BUILD
        </motion.button>
        <span className="text-xs tracking-[0.4em] text-paper/40">
          TWO WORLDS · ONE PERSON
        </span>
        <motion.button
          onClick={() => go("create")}
          data-cursor="enter"
          className="font-display text-6xl text-create"
          whileTap={{ scale: 0.97 }}
        >
          CREATE
        </motion.button>
      </div>

      <div className="pointer-events-none pb-16 text-center text-[0.6rem] tracking-[0.3em] text-paper/30">
        ← BUILD · CREATE →
      </div>
    </section>
  );
}
