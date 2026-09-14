"use client";
import { Component, type ReactNode, type RefObject } from "react";
import { Canvas } from "@react-three/fiber";
import { Scene } from "./Scene";
import type { Mode } from "@/lib/modes";
import { useExperienceTheme } from "@/components/experience/ThemeProvider";

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}
export default function GatewayCanvas({ mode, active, pointer }: { mode: Mode; active: boolean; pointer: RefObject<{ x: number; y: number }> }) {
  const { theme } = useExperienceTheme();
  return <SceneBoundary><Canvas camera={{ position: [0, 0, 6], fov: 45 }} dpr={[1, 1.5]} frameloop={active ? "always" : "never"}
    gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}><Scene mode={mode} pointer={pointer} theme={theme} /></Canvas></SceneBoundary>;
}
