"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Repeat section entrances without a scroll listener or a continuous render loop. */
export function ScrollFlow({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = root.current;
    if (!container) return;

    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const animations = new Map<Element, Animation>();
    let observer: IntersectionObserver | undefined;

    const configure = () => {
      observer?.disconnect();
      animations.forEach(animation => animation.cancel());
      animations.clear();
      if (preference.matches || !("IntersectionObserver" in window)) return;

      // Observe the stationary section, and only animate its opacity. The heading
      // components supply movement; fixed viewers and sticky content stay stable.
      observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          const previous = animations.get(entry.target);
          if (!entry.isIntersecting) {
            previous?.cancel();
            animations.delete(entry.target);
            continue;
          }
          if (typeof entry.target.animate !== "function") continue;
          previous?.cancel();
          const animation = entry.target.animate(
            [{ opacity: 0.45 }, { opacity: 1 }],
            { duration: 750, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
          );
          animations.set(entry.target, animation);
          animation.onfinish = () => {
            if (animations.get(entry.target) === animation) animations.delete(entry.target);
          };
        }
      }, { rootMargin: "-10% 0px -10% 0px", threshold: 0 });

      container.querySelectorAll("section:not(#gateway), footer").forEach(section => observer?.observe(section));
    };

    configure();
    preference.addEventListener("change", configure);
    return () => {
      observer?.disconnect();
      animations.forEach(animation => animation.cancel());
      preference.removeEventListener("change", configure);
    };
  }, []);

  return <div ref={root}>{children}</div>;
}
