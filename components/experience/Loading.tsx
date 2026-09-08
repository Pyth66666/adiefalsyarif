"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { reduceMotion } from "@/lib/animations";

/**
 * Short boot sequence: 00 — INITIALIZING → ADIEF AL SYARIF → READY.
 * Auto-hides fast; skips entirely under reduced-motion.
 */
export function LoadingSequence({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (reduceMotion()) {
      setVisible(false);
      onDone();
      return;
    }
    const timers = [
      setTimeout(() => setPhase(1), 600),
      setTimeout(() => setPhase(2), 1300),
      setTimeout(() => {
        setVisible(false);
        onDone();
      }, 2000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onDone]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[1300] flex flex-col items-center justify-center bg-ink"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          aria-label="Loading"
        >
          <div className="relative h-5 overflow-hidden">
            <AnimatePresence mode="wait">
              {phase === 0 && (
                <motion.p
                  key="init"
                  className="font-display text-sm tracking-[0.35em] text-paper/50"
                  initial={{ y: 24, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -24, opacity: 0 }}
                >
                  00 — INITIALIZING
                </motion.p>
              )}
              {phase === 1 && (
                <motion.p
                  key="name"
                  className="font-display text-xl tracking-[0.3em] text-paper"
                  initial={{ y: 24, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -24, opacity: 0 }}
                >
                  ADIEF AL SYARIF
                </motion.p>
              )}
              {phase === 2 && (
                <motion.p
                  key="ready"
                  className="font-display text-sm tracking-[0.5em] text-build"
                  initial={{ y: 24, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                >
                  READY
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}