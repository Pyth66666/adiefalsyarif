"use client";

import { useId, type ReactNode } from "react";

interface GlassPanelProps {
  children: ReactNode;
  className?: string;
  tone?: "build" | "create" | "neutral";
  interactive?: boolean;
}

/**
 * Selectively-applied glass surface. Not for wrapping the whole UI —
 * used for telemetry, modal, navigation, metadata overlays, floating controls.
 */
export function GlassPanel({ children, className = "", tone = "neutral", interactive = false }: GlassPanelProps) {
  const id = useId();
  const border =
    tone === "build"
      ? "rgba(61,220,132,0.25)"
      : tone === "create"
        ? "rgba(232,163,61,0.28)"
        : "rgba(255,255,255,0.12)";
  return (
    <div
      id={`glass-${id}`}
      data-interactive={interactive}
      className={`glass relative rounded-2xl border backdrop-blur-xl transition-colors ${className}`}
      style={{
        borderColor: border,
        background: "rgba(20,20,24,0.55)",
        backgroundImage: "radial-gradient(120% 120% at 0% 0%, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 60%)",
        boxShadow: "0 20px 60px -20px rgba(0,0,0,0.6)",
      }}
    >
      {children}
    </div>
  );
}
