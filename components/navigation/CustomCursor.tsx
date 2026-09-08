"use client";

import { useEffect, useRef, useState } from "react";
import { isFinePointer, isTouchDevice } from "@/lib/device";
import { reduceMotion } from "@/lib/animations";

type CursorState = "default" | "view" | "open" | "drag" | "enter" | "text" | "hidden";

/**
 * Custom cursor that follows the pointer with a trailing lag. Reacts to
 * elements marked with data-cursor="view|open|drag|enter|text|hidden".
 * Auto-disabled on touch/coarse pointers and under reduced motion.
 */
export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState<CursorState>("default");
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!isFinePointer() || isTouchDevice() || reduceMotion()) return;
    setEnabled(true);
    document.documentElement.classList.add("custom-cursor-on");

    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let rx = mx;
    let ry = my;
    let raf = 0;
    let target: Element | null = null;

    const onMove = (e: PointerEvent) => {
      mx = e.clientX;
      my = e.clientY;
      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${mx - 2}px, ${my - 2}px)`;
      }
      target = (e.target as Element | null)?.closest?.("[data-cursor]") ?? null;
      const state = target
        ? (target.getAttribute("data-cursor") as CursorState | null)
        : null;
      setLabel((state as CursorState) ?? "default");
    };

    const loop = () => {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      if (ringRef.current) {
        ringRef.current.style.transform = `translate(${rx - 24}px, ${ry - 24}px)`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    window.addEventListener("pointermove", onMove, { passive: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.classList.remove("custom-cursor-on");
      setEnabled(false);
    };
  }, []);

  if (!enabled) return null;

  const showLabel = label === "view" || label === "open" || label === "drag" || label === "enter";

  return (
    <>
      <div
        ref={dotRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[2000] h-[4px] w-[4px] rounded-full bg-paper transition-colors duration-300"
      />
      <div
        ref={ringRef}
        aria-hidden
        className={`pointer-events-none fixed left-0 top-0 z-[1999] flex h-[48px] w-[48px] items-center justify-center rounded-full border transition-all duration-300 ${
          showLabel
            ? "border-transparent bg-paper text-ink"
            : "border-paper/40 bg-transparent"
        }`}
        style={{ fontSize: 10, letterSpacing: "0.1em", transition: "background 0.3s, border-color 0.3s, color 0.3s" }}
      >
        <span
          className={`whitespace-nowrap transition-opacity duration-300 ${
            showLabel ? "opacity-100" : "opacity-0"
          }`}
        >
          {label.toUpperCase()}
          {label === "view" ? " →" : ""}
        </span>
      </div>
    </>
  );
}
