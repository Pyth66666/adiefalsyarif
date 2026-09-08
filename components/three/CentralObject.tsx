"use client";

import * as THREE from "three";
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import type { Mode } from "@/lib/modes";

// Classic 3D simplex-ish noise (compact GLSL port) for organic displacement.
const vertexShader = `
uniform float uMode;       // 0 neutral, 1 build, 2 create
uniform float uTime;
uniform float uDisplace;
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vPos;
varying float vDisp;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
        mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
        mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
    f.z);
}

void main() {
  float n = noise(normal * 3.0 + uTime * 0.12);
  float n2 = noise(normal * 8.0 - uTime * 0.2);

  // BUILD: sharp cellular displacement along a few directions.
  float buildMask = smoothstep(0.4, 0.9, uMode);
  float buildDisp = (n2 * 0.6 + sin(normal.y * 20.0) * 0.1) * buildMask;

  // CREATE: soft rounded lensing displacement.
  float createMask = smoothstep(0.4, 0.9, uMode - 1.0);
  float createDisp = sin(n * 6.28 + uTime * 0.3) * 0.35 * (1.0 - createMask);

  float neutralDisp = n * 0.25 * (1.0 - max(buildMask, createMask));

  float disp = (neutralDisp + buildDisp + createDisp) * uDisplace;

  vec3 newPos = position + normal * disp;
  vNormal = normalize(mix(normalMatrix * normal, normalMatrix * (normal + vec3(0.0, disp, 0.0)), 0.0));
  vec4 mv = modelViewMatrix * vec4(newPos, 1.0);
  vViewDir = normalize(-mv.xyz);
  vPos = newPos;
  vDisp = disp;

  gl_Position = projectionMatrix * mv;
}
`;

const fragmentShader = `
uniform float uMode;
uniform float uTime;
uniform vec3 uColorBuild;
uniform vec3 uColorCreate;
varying vec3 vNormal;
varying vec3 vViewDir;
varying vec3 vPos;
varying float vDisp;

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(vViewDir);
  float ndv = max(dot(N, V), 0.0);

  // Fresnel rim for glass/metallic feel.
  float fresnel = pow(1.0 - ndv, 2.5);

  vec3 build = uColorBuild;
  vec3 create = uColorCreate;
  vec3 neutral = vec3(0.75, 0.76, 0.8);

  vec3 col = mix(neutral, build, smoothstep(0.3, 0.9, uMode));
  col = mix(col, create, smoothstep(1.3, 1.9, uMode));

  // Specular highlight (warm for create, cool for build).
  vec3 specBase = mix(vec3(0.9), vec3(1.0, 0.7, 0.4), smoothstep(1.2, 1.8, uMode));
  float spec = pow(ndv, 32.0);
  col += specBase * spec * 0.8;

  // Subtle displacement shading.
  col += vDisp * 0.6;

  col = col * (0.25 + fresnel * 1.6);

  gl_FragColor = vec4(col, 1.0);
}
`;

export type CentralObjectMode = Mode;

export function CentralObject({ mode }: { mode: CentralObjectMode }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uMode: { value: 0 },
      uTime: { value: 0 },
      uDisplace: { value: 0.6 },
      uColorBuild: { value: new THREE.Color("#3ddc84") },
      uColorCreate: { value: new THREE.Color("#e8a33d") },
    }),
    []
  );

  const modeValue = mode === "build" ? 1 : mode === "create" ? 2 : 0;

  useFrame((state, delta) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value += delta;
      // Smoothly drive mode toward target.
      const cur = matRef.current.uniforms.uMode.value;
      matRef.current.uniforms.uMode.value += (modeValue - cur) * Math.min(delta * 3, 1);
    }
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.15;
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.2) * 0.15;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <icosahedronGeometry args={[1.6, 24]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </mesh>
  );
}
