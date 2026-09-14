"use client";
import { Component, useEffect, type ReactNode, type RefObject } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Scene } from "./Scene";
import type { Mode } from "@/lib/modes";
import { useExperienceTheme } from "@/components/experience/ThemeProvider";

class SceneBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback ?? null : this.props.children; }
}
function MobileFrames({ active }: { active: boolean }) {
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    if (!active) return;
    invalidate();
    const timer = window.setInterval(() => invalidate(), 1000 / 30);
    return () => window.clearInterval(timer);
  }, [active, invalidate]);
  return null;
}
export default function GatewayCanvas({ mode, active, pointer, compact = false, fallback }: { mode: Mode; active: boolean; pointer: RefObject<{ x: number; y: number }>; compact?: boolean; fallback?: ReactNode }) {
  const { theme } = useExperienceTheme();
  return <SceneBoundary fallback={fallback}><Canvas fallback={fallback} style={compact ? { touchAction: "pan-y" } : undefined} camera={{ position: [0, 0, 6], fov: 45 }} dpr={compact ? 1 : [1, 1.5]} frameloop={active ? compact ? "demand" : "always" : "never"}
    gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}>
    {compact && <MobileFrames active={active} />}
    <Scene mode={mode} pointer={pointer} theme={theme} compact={compact} />
  </Canvas></SceneBoundary>;
}
