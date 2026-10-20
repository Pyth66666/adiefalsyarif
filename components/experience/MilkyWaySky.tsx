"use client";
import { useEffect, useRef, type RefObject } from "react";
import type { SpacePointer } from "./StarfieldBackground";

/**
 * Splash sky: a real photographic Milky Way (Solar System Scope, built from ESO imagery, CC BY 4.0).
 * It is a plain image moved with GPU transforms only — no WebGL — so it costs almost nothing,
 * and it drifts a little toward the cursor for depth.
 */
export function MilkyWaySky({ pointer }: { pointer: RefObject<SpacePointer> }) {
  const layer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = layer.current; if (!el) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0, x = 0, y = 0;
    const tick = () => {
      frame = requestAnimationFrame(tick);
      const p = pointer.current;
      const tx = p?.active ? (p.x - .5) * -26 : 0, ty = p?.active ? (p.y - .5) * 16 : 0;
      if (Math.abs(tx - x) < .05 && Math.abs(ty - y) < .05) return;
      x += (tx - x) * .05; y += (ty - y) * .05;
      el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [pointer]);
  return <div className="milky-sky" aria-hidden="true">
    <div ref={layer} className="milky-sky-layer">
      <picture>
        <source media="(max-aspect-ratio: 3/4)" srcSet="/space/milky-way-portrait.jpg" />
        <img src="/space/milky-way.jpg" alt="" decoding="async" fetchPriority="high" />
      </picture>
    </div>
    <div className="milky-sky-shade" />
  </div>;
}
