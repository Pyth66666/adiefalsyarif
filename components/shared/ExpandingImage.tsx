"use client";
import { useCallback, useEffect, useRef } from "react";
import { motion, useAnimationControls, useReducedMotion } from "framer-motion";

export type ImageOrigin = { left: number; top: number; width: number; height: number };
export function imageOrigin(element: Element | null): ImageOrigin | undefined {
  if (!element) return undefined;
  const { left, top, width, height } = element.getBoundingClientRect();
  return width && height && top < window.innerHeight && top + height > 0 ? { left, top, width, height } : undefined;
}

/** Geometry-based expansion works across the native dialog's top layer. */
export function ExpandingImage({ src, alt, className, origin }: { src: string; alt: string; className?: string; origin?: ImageOrigin }) {
  const ref = useRef<HTMLImageElement>(null);
  const played = useRef(false);
  const frame = useRef(0);
  const controls = useAnimationControls();
  const reduced = useReducedMotion();
  const reveal = useCallback(() => {
    if (played.current) return;
    cancelAnimationFrame(frame.current);
    // Wait for showModal() and final image dimensions before measuring.
    frame.current = requestAnimationFrame(() => {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect?.width || !rect.height) { controls.set({ opacity: 1 }); return; }
      played.current = true;
      if (origin && !reduced) {
        controls.set({ x: origin.left - rect.left, y: origin.top - rect.top, scaleX: origin.width / rect.width, scaleY: origin.height / rect.height, opacity: 1 });
        void controls.start({ x: 0, y: 0, scaleX: 1, scaleY: 1, opacity: 1, transition: { duration: .45, ease: [.16, 1, .3, 1] } });
      } else { controls.set({ opacity: 1 }); }
    });
  }, [controls, origin, reduced]);
  useEffect(() => {
    if (ref.current?.complete) reveal();
    return () => cancelAnimationFrame(frame.current);
  }, [reveal]);
  return <motion.img ref={ref} src={src} alt={alt} className={className} onLoad={reveal}
    onError={() => controls.set({ opacity: 1 })} initial={{ opacity: 0 }} animate={controls} style={{ transformOrigin: "top left" }} />;
}
