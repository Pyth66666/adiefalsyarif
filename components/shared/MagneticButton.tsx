"use client";

import { useRef, type ReactNode, type MouseEvent } from "react";
import { reduceMotion } from "@/lib/animations";

interface MagneticButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  strength?: number;
}

/**
 * Magnetic button: element is attracted toward the cursor while hovered,
 * springs back on leave. Disabled under reduced motion.
 */
export function MagneticButton({ children, strength = 0.4, style, ...props }: MagneticButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);

  const onMove = (e: MouseEvent<HTMLButtonElement>) => {
    if (reduceMotion() || !ref.current) return;
    const el = ref.current;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) * strength;
    const y = (e.clientY - rect.top - rect.height / 2) * strength;
    el.style.transform = `translate(${x}px, ${y}px)`;
  };

  const onLeave = () => {
    if (!ref.current) return;
    ref.current.style.transform = "translate(0,0)";
  };

  return (
    <button
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ transition: "transform 0.4s cubic-bezier(0.16,1,0.3,1)", ...style }}
      {...props}
    >
      {children}
    </button>
  );
}
