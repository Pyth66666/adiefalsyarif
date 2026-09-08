"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LoadingSequence } from "@/components/experience/Loading";
import { Intro } from "@/components/experience/Intro";
import { Gateway } from "@/components/experience/Gateway";
import { MobileGateway } from "@/components/experience/MobileGateway";
import { BuildWorld } from "@/components/build/BuildWorld";
import { CreateWorld } from "@/components/create/CreateWorld";
import { Collection } from "@/components/collection/Collection";
import { About } from "@/components/about/About";
import { ContactFooter } from "@/components/contact/ContactFooter";
import { NavigationBar, MenuOverlay } from "@/components/navigation/Menu";
import { useIsTouch } from "@/lib/device";
import { navItems } from "@/data/site";
import { CmsGate } from "@/components/cms/CmsGate";

export default function Home() {
  const [loaded, setLoaded] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const isTouch = useIsTouch();

  const handleNav = useCallback((ref: string) => {
    setMenuOpen(false);
    const el = document.querySelector(ref);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const selectWorld = useCallback((mode: "build" | "create") => {
    const el = document.getElementById(mode);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Lock body scroll while intro is showing
  useEffect(() => {
    document.body.style.overflow = showIntro ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [showIntro]);

  return (
    <main id="top" className="relative min-h-screen">
      <LoadingSequence onDone={() => setLoaded(true)} />

      {/* Intro overlay + ENTER */}
      <AnimatePresence>
        {showIntro && (
          <CmsGate>
            <Intro onEnter={() => setShowIntro(false)} />
          </CmsGate>
        )}
      </AnimatePresence>

      {/* Persistent minimal nav */}
      {loaded && !showIntro && (
        <NavigationBar onOpenMenu={() => setMenuOpen(true)} />
      )}

      <MenuOverlay open={menuOpen} onClose={() => setMenuOpen(false)}>
        {navItems.map((item, i) => (
          <motion.button
            key={item.id}
            onClick={() => handleNav(item.ref)}
            className="group flex items-baseline gap-4 border-b border-white/10 py-4 text-left"
            initial={{ x: -40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.1 + i * 0.06, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            data-cursor="enter"
          >
            <span className="font-display text-xs text-paper/40">{item.index}</span>
            <span className="font-display text-4xl tracking-[0.1em] text-paper transition-transform duration-300 group-hover:translate-x-3 md:text-6xl">
              {item.label}
            </span>
          </motion.button>
        ))}
      </MenuOverlay>

      {/* Worlds */}
      <div className={showIntro ? "invisible" : ""}>
        <CmsGate>
          {isTouch ? (
            <MobileGateway onSelect={selectWorld} />
          ) : (
            <Gateway onSelect={selectWorld} />
          )}

          <BuildWorld />
          <CreateWorld />
          <Collection />
          <About />
          <ContactFooter />
        </CmsGate>
      </div>
    </main>
  );
}