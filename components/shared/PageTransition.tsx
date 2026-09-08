"use client";

import { AnimatePresence, motion } from "framer-motion";
import { createContext, useContext, useState, type ReactNode } from "react";

interface TransitionContextValue {
  runTransition: (next: () => void) => void;
}

const TransitionContext = createContext<TransitionContextValue>({ runTransition: () => {} });

/**
 * Global page-transition overlay. runTransition(cb) plays a cinematic wipe
 * (scale + blur), calls cb (scroll/navigate), then wipes back in.
 * Respects prefers-reduced-motion by running cb immediately.
 */
export function PageTransitionProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const runTransition = (next: () => void) => {
    if (reduced) {
      next();
      return;
    }
    setActive(true);
    setTimeout(() => {
      next();
      requestAnimationFrame(() => setTimeout(() => setActive(false), 60));
    }, 500);
  };

  return (
    <TransitionContext.Provider value={{ runTransition }}>
      <AnimatePresence>
        {active && (
          <motion.div
            key="wipe"
            className="fixed inset-0 z-[1000] pointer-events-none"
            style={{ background: "var(--ink)", transformOrigin: "center" }}
            initial={{ scale: 0.96, opacity: 1 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.04, opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          />
        )}
      </AnimatePresence>
      {children}
    </TransitionContext.Provider>
  );
}

export function usePageTransition() {
  return useContext(TransitionContext);
}
