"use client";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
const TransitionContext = createContext<{ runTransition: (next: () => void) => void }>({ runTransition: next => next() });
export function PageTransitionProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busy = useRef(false);
  const reduced = useReducedMotion();
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const runTransition = useCallback((next: () => void) => {
    if (busy.current) return;
    if (reduced) { next(); return; }
    busy.current = true; setActive(true);
    timer.current = setTimeout(() => { next(); setActive(false); busy.current = false; }, 500);
  }, [reduced]);
  return <TransitionContext.Provider value={{ runTransition }}>
    <AnimatePresence>{active && <motion.div className="fixed inset-0 z-[1000] pointer-events-none bg-ink" aria-hidden="true" initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.04, opacity: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} />}</AnimatePresence>{children}
  </TransitionContext.Provider>;
}
export function usePageTransition() { return useContext(TransitionContext); }
