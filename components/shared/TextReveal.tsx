"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef, type ReactNode } from "react";

interface TextRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "h1" | "h2" | "h3" | "p" | "span" | "div";
}

/**
 * Replays the rise-in each time content enters view, in either scroll direction.
 */
export function TextReveal({ children, className, delay = 0, as = "div" }: TextRevealProps) {
  const Tag = as;
  const ref = useRef<HTMLElement | null>(null);
  // Observe a stationary outer element so a repeated transform cannot move its
  // own visibility threshold and retrigger at the edge of the viewport.
  const inView = useInView(ref, { once: false, margin: "-8% 0px -8% 0px", amount: "some" });
  const Inner = as === "div" ? motion.div : motion.span;
  const reduced = useReducedMotion();
  return (
    <Tag ref={node => { ref.current = node; }} className={className}>
    <Inner
      style={{ display: "block" }}
      initial={reduced ? false : { y: "110%", opacity: 0 }}
      animate={reduced || inView ? { y: "0%", opacity: 1 } : { y: "110%", opacity: 0 }}
      transition={{ duration: reduced ? 0 : 0.8, ease: [0.16, 1, 0.3, 1], delay: reduced ? 0 : delay }}
    >
      {children}
    </Inner>
    </Tag>
  );
}

interface RevealMaskProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

/**
 * Wraps content in a clipping mask so TextReveal can animate from inside it.
 */
export function RevealMask({ children, className, delay = 0 }: RevealMaskProps) {
  return (
    <div className={`overflow-hidden ${className ?? ""}`}>
      <TextReveal delay={delay}>{children}</TextReveal>
    </div>
  );
}
