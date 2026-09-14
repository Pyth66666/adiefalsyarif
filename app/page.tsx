"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
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
import { reduceMotion } from "@/lib/animations";
import { navItems } from "@/data/site";
import { CmsGate } from "@/components/cms/CmsGate";
import { ScrollFlow } from "@/components/shared/ScrollFlow";
import { Lab } from "@/components/experience/Lab";
import { AmbientSpace } from "@/components/experience/AmbientSpace";

export default function Home() {
  const [loaded, setLoaded] = useState(false);
  const [showIntro, setShowIntro] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [returning, setReturning] = useState(false);
  const isTouch = useIsTouch();
  const finishLoading = useCallback(() => setLoaded(true), []);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("from") === "arcade") {
      setReturning(true); setLoaded(true); setShowIntro(false);
      window.history.replaceState(null, "", "/#lab");
    }
  }, []);

  const handleNav = useCallback((ref: string) => {
    setMenuOpen(false);
    // Let the navigation dialog restore focus before moving to the destination.
    requestAnimationFrame(() => document.querySelector(ref)?.scrollIntoView({
      behavior: reduceMotion() ? "instant" : "smooth", block: "start",
    }));
  }, []);
  const selectWorld = useCallback((mode: "build" | "create") => {
    document.getElementById(mode)?.scrollIntoView({ behavior: "instant", block: "start" });
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = showIntro ? "hidden" : "";
    return () => { document.body.style.overflow = previous; };
  }, [showIntro]);

  return (
    <MotionConfig reducedMotion="user">
      <main id="top" className="portfolio-universe relative min-h-screen isolate">
        {!returning && <LoadingSequence onDone={finishLoading} />}
        <CmsGate>
          <AnimatePresence>
            {loaded && showIntro && <Intro key="intro" onEnter={() => {
              window.scrollTo({ top: 0, behavior: "instant" });
              setShowIntro(false);
            }} />}
          </AnimatePresence>
          {!showIntro && <>
            <AmbientSpace journey />
            <NavigationBar onOpenMenu={() => setMenuOpen(true)} />
            <MenuOverlay open={menuOpen} onClose={() => setMenuOpen(false)}>
              {navItems.map((item, i) => (
                <motion.button key={item.id} onClick={() => handleNav(item.ref)}
                  className="group flex items-baseline gap-4 border-b border-white/10 py-4 text-left"
                  initial={{ x: -40, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.1 + i * 0.06, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  data-cursor="enter">
                  <span className="font-display text-xs text-paper/40">{item.index}</span>
                  <span className="font-display text-4xl tracking-[0.1em] text-paper transition-transform duration-300 group-hover:translate-x-3 md:text-6xl">{item.label}</span>
                </motion.button>
              ))}
            </MenuOverlay>
            {isTouch ? <MobileGateway onSelect={selectWorld} /> : <Gateway onSelect={selectWorld} />}
            <ScrollFlow>
            <BuildWorld />
            <CreateWorld />
            <Collection />
            <Lab />
            <About />
            <ContactFooter />
            </ScrollFlow>
          </>}
        </CmsGate>
      </main>
    </MotionConfig>
  );
}
