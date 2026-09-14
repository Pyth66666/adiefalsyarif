"use client";

import dynamic from "next/dynamic";
import { useRef, useState, type PointerEvent } from "react";
import { useReducedMotion } from "framer-motion";
import { usePageTransition } from "@/components/shared/PageTransition";
import { useSceneActive } from "@/components/shared/useSceneActive";

const GatewayCanvas = dynamic(() => import("@/components/three/GatewayCanvas"), { ssr: false });

export function MobileGateway({ onSelect }: { onSelect: (mode: "build" | "create") => void }) {
  const [mode, setMode] = useState<"build" | "create">("build");
  const { runTransition } = usePageTransition();
  const { ref, active } = useSceneActive();
  const reduced = useReducedMotion();
  const pointer = useRef({ x: 0, y: 0 });
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.buttons) return;
    const rect = event.currentTarget.getBoundingClientRect();
    pointer.current = { x: ((event.clientX - rect.left) / rect.width) * 2 - 1, y: 1 - ((event.clientY - rect.top) / rect.height) * 2 };
  };
  const reset = () => { pointer.current = { x: 0, y: 0 }; };
  const fallback = <div className="touch-gateway-orb" aria-hidden="true" />;

  return (
    <section id="gateway" className="touch-gateway" data-world={mode} aria-label="Choose a world to explore">
      <p className="touch-gateway-eyebrow">TWO WORLDS · ONE PERSON</p>
      <div ref={ref} className="touch-gateway-scene" aria-hidden="true"
        onPointerDown={move} onPointerMove={move} onPointerUp={reset} onPointerCancel={reset} onPointerLeave={reset}>
        {reduced === false ? <GatewayCanvas compact mode={mode} active={active} pointer={pointer} fallback={fallback} /> : fallback}
      </div>
      <div className="touch-gateway-choices" role="group" aria-label="Preview a world">
        <button type="button" aria-pressed={mode === "build"} onClick={() => setMode("build")}>BUILD</button>
        <span aria-hidden="true">/</span>
        <button type="button" aria-pressed={mode === "create"} onClick={() => setMode("create")}>CREATE</button>
      </div>
      <p className="touch-gateway-description" aria-live="polite">
        {mode === "build" ? "Systems. Experiments. Things that work." : "Images. Stories. A different way of seeing."}
      </p>
      <button type="button" className="touch-gateway-enter" onClick={() => runTransition(() => onSelect(mode))}>
        ENTER {mode.toUpperCase()} <span aria-hidden="true">↗</span>
      </button>
      <p className="touch-gateway-hint">TAP A WORLD TO PREVIEW · SCROLL TO EXPLORE</p>
    </section>
  );
}
