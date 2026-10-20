"use client";

import { useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Environment, Lightformer } from "@react-three/drei";
import { GatewayObjects } from "./RealObjects";
import { ParticleField } from "./ParticleField";
import type { Mode } from "@/lib/modes";
import type { ExperienceTheme } from "@/components/experience/ThemeProvider";

interface SceneProps {
  mode: Mode;
  pointer?: RefObject<{ x: number; y: number }>;
  theme?: ExperienceTheme;
  compact?: boolean;
}

function SceneContent({ mode, pointer, compact }: SceneProps) {
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!group.current) return;
    const { x, y } = pointer?.current ?? state.pointer;
    group.current.rotation.y = x * 0.25;
    group.current.rotation.x = -y * 0.18;
  });

  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight position={[-3, 4, 5]} intensity={1.6} />
      <pointLight position={[4, 3, 5]} intensity={mode === "build" ? 14 : 6} color={"#3ddc84"} />
      <pointLight position={[-4, -2, 3]} intensity={mode === "create" ? 12 : 5} color={"#e8a33d"} />
      {/* Studio softboxes for realistic reflections, generated locally (no HDR download). */}
      <Environment resolution={compact ? 64 : 128} frames={1}>
        <Lightformer form="rect" intensity={3} position={[0, 4, 3]} scale={[8, 2, 1]} />
        <Lightformer form="rect" intensity={1.6} position={[-5, 0, 2]} rotation-y={Math.PI / 2} scale={[4, 6, 1]} />
        <Lightformer form="rect" intensity={1.2} position={[5, 1, 1]} rotation-y={-Math.PI / 2} scale={[3, 5, 1]} color="#ffe2c4" />
        <Lightformer form="ring" intensity={2} position={[0, 0, 6]} scale={2.5} />
      </Environment>
      <group ref={group}>
        <GatewayObjects mode={mode} compact={compact} />
      </group>
      <ParticleField mode={mode} count={compact ? 240 : 700} />
    </>
  );
}

export function Scene(props: SceneProps) {
  return <SceneContent {...props} />;
}
