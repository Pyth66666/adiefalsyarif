"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { DialogSurface } from "@/components/shared/DialogSurface";

export function NavigationBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  return (
    <header className="mobile-safe-nav fixed left-0 right-0 top-0 z-[900] flex items-center justify-between px-6 py-5 mix-blend-difference md:px-10">
      <a
        href="#top"
        data-cursor="view"
        className="font-display text-sm tracking-[0.25em] text-paper"
      >
        ADIEF
      </a>
      <button
        onClick={onOpenMenu}
        data-cursor="enter"
        className="font-display text-sm tracking-[0.25em] text-paper transition-opacity hover:opacity-60"
      >
        MENU
      </button>
    </header>
  );
}

const overlayEase = [0.16, 1, 0.3, 1] as const;

export function MenuOverlay({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <DialogSurface label="Navigation" onClose={onClose} className="classic-menu-dialog">
        <motion.div
          key="menu"
          className="fixed inset-0 z-[950] flex flex-col bg-ink"
          initial={{ clipPath: "inset(0 0 100% 0)" }}
          animate={{ clipPath: "inset(0 0 0% 0)" }}
          exit={{ clipPath: "inset(0 0 100% 0)" }}
          transition={{ duration: 0.6, ease: overlayEase }}
        >
          <div className="mobile-menu-header flex items-center justify-between px-6 py-5 md:px-10">
            <span className="font-display text-sm tracking-[0.25em] text-paper">ADIEF</span>
            <button
              onClick={onClose}
              data-cursor="enter"
              className="font-display text-sm tracking-[0.25em] text-paper transition-opacity hover:opacity-60"
            >
              CLOSE
            </button>
          </div>
          <nav className="mobile-menu-scroll flex flex-1 flex-col justify-center px-6 md:px-10">
            {children}
          </nav>
        </motion.div>
        </DialogSurface>
      )}
    </AnimatePresence>
  );
}
