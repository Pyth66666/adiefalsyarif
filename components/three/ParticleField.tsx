"use client";

import * as THREE from "three";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mode } from "@/lib/modes";

interface ParticleFieldProps {
  mode: Mode;
  count?: number;
}

/**
 * Ambient point cloud. In BUILD mode particles tighten into a cool grid-ish
 * field; in CREATE mode they drift warmly like dust/bokeh. Cheap, one draw call.
 */
export function ParticleField({ mode, count = 700 }: ParticleFieldProps) {
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, base } = useMemo(() => {
    const base = new Float32Array(count * 3);
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 2.5 + Math.random() * 5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      base[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      base[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      base[i * 3 + 2] = r * Math.cos(phi);
      positions.set(new Float32Array([base[i * 3], base[i * 3 + 1], base[i * 3 + 2]]), i * 3);
    }
    return { positions, base };
  }, [count]);

  const targetColor = mode === "build" ? "#3ddc84" : mode === "create" ? "#e8a33d" : "#9aa0ab";

  useFrame((state) => {
    if (!pointsRef.current) return;
    const attr = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const t = state.clock.elapsedTime;
    const spreadMode = mode === "build" ? 0.6 : mode === "create" ? 0.4 : 0.2;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] = base[i] + Math.sin(t * 0.4 + base[i] * 3) * spreadMode;
      arr[i + 1] = base[i + 1] + Math.cos(t * 0.3 + base[i + 1] * 3) * spreadMode;
      arr[i + 2] = base[i + 2] + Math.sin(t * 0.5 + base[i + 2] * 3) * spreadMode;
    }
    attr.needsUpdate = true;
    const mat = pointsRef.current.material as THREE.PointsMaterial;
    mat.color.set(targetColor);
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.03}
        transparent
        opacity={0.7}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}
