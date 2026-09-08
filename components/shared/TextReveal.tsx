"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface TextRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  as?: "h1" | "h2" | "h3" | "p" | "span" | "div";
}

/**
 * Reveals children with a masked rise-in animation (translateY + clip).
 */
export function TextReveal({ children, className, delay = 0, as = "div" }: TextRevealProps) {
  const Tag = motion[as] as typeof motion.div;
  return (
    <Tag
      className={className}
      initial={{ y: "110%", opacity: 0 }}
      whileInView={{ y: "0%", opacity: 1 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay }}
    >
      {children}
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
