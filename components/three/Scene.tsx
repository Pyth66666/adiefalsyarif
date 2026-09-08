"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { CentralObject } from "./CentralObject";
import { ParticleField } from "./ParticleField";
import type { Mode } from "@/lib/modes";

interface SceneProps {
  mode: Mode;
}

function SceneContent({ mode }: SceneProps) {
  const group = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!group.current) return;
    const { x, y } = state.pointer;
    group.current.rotation.y = x * 0.25;
    group.current.rotation.x = -y * 0.18;
  });

  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[4, 3, 5]} intensity={20} color={"#3ddc84"} />
      <pointLight position={[-4, -2, 3]} intensity={14} color={"#e8a33d"} />
      <group ref={group}>
        <CentralObject mode={mode} />
      </group>
      <ParticleField mode={mode} />
    </>
  );
}

export function Scene({ mode }: SceneProps) {
  return <SceneContent mode={mode} />;
}
