"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import type { Mode } from "@/lib/modes";

/**
 * Realistic gateway objects, built from physically based materials (no external models):
 * BUILD is a processor package, CREATE is a camera lens. Hovering a side brings its object forward.
 */
function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void, srgb = true) {
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!; draw(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
function seeded(seed: number) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

/* ---------------- BUILD: processor ---------------- */
function useChipTextures() {
  return useMemo(() => {
    const pcb = canvasTexture(1024, (ctx, s) => {
      const rand = seeded(7);
      ctx.fillStyle = "#0d2219"; ctx.fillRect(0, 0, s, s);
      // Copper traces under solder mask: orthogonal runs ending in vias.
      ctx.lineCap = "round";
      for (let i = 0; i < 140; i++) {
        let x = rand() * s, y = rand() * s; ctx.strokeStyle = `rgba(120,170,110,${0.25 + rand() * 0.25})`; ctx.lineWidth = 2 + rand() * 3;
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let k = 0; k < 3; k++) { if (rand() > .5) x += (rand() - .5) * 260; else y += (rand() - .5) * 260; ctx.lineTo(x, y); }
        ctx.stroke(); ctx.fillStyle = "#b99a4a"; ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = "rgba(230,235,225,.75)"; ctx.font = "600 26px monospace";
      ctx.fillText("HDV-01  REV A", 40, s - 44); ctx.fillText("C12  C13", s - 190, 70);
    });
    const lid = canvasTexture(1024, (ctx, s) => {
      const rand = seeded(11);
      const g = ctx.createLinearGradient(0, 0, s, s); g.addColorStop(0, "#c9ccd0"); g.addColorStop(1, "#a9adb3");
      ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
      for (let i = 0; i < 1600; i++) { ctx.fillStyle = `rgba(255,255,255,${rand() * .06})`; ctx.fillRect(0, rand() * s, s, 1); } // brushed metal
      ctx.fillStyle = "rgba(40,44,48,.85)"; ctx.textAlign = "left";
      ctx.font = "700 92px sans-serif"; ctx.fillText("ADIEF", 90, 430);
      ctx.font = "500 40px monospace"; ctx.fillText("BUILD-01  KL 2026", 94, 510);
      ctx.fillText("CS · SECURITY · SYSTEMS", 94, 570);
      ctx.font = "500 30px monospace"; ctx.fillText("A25 7781 MYS", 94, 860);
      ctx.beginPath(); ctx.arc(110, 110, 18, 0, Math.PI * 2); ctx.fill(); // pin-1 marker
    });
    return { pcb, lid };
  }, []);
}

function Chip({ compact }: { compact: boolean }) {
  const { pcb, lid } = useChipTextures();
  const pads = useMemo(() => {
    const list: [number, number, number, number][] = []; const n = compact ? 10 : 16, span = 2.1;
    for (let i = 0; i < n; i++) {
      const t = -span / 2 + (i + .5) * span / n;
      list.push([t, 1.18, .05, .09], [t, -1.18, .05, .09], [1.18, t, .09, .05], [-1.18, t, .09, .05]);
    }
    return list;
  }, [compact]);
  const gold = useMemo(() => new THREE.MeshStandardMaterial({ color: "#d9ad48", metalness: 1, roughness: .22 }), []);
  return <group>
    <RoundedBox args={[2.5, 2.5, .14]} radius={.04} smoothness={3}>
      <meshPhysicalMaterial map={pcb} roughness={.42} metalness={.1} clearcoat={.6} clearcoatRoughness={.25} />
    </RoundedBox>
    {pads.map(([x, y, w, h], i) => <mesh key={i} position={[x, y, .075]} material={gold}><boxGeometry args={[w, h, .012]} /></mesh>)}
    {/* Small surface-mount capacitors around the die */}
    {[[-.95, .95], [.95, .95], [-.95, -.95], [.95, -.95], [0, -1.0]].map(([x, y], i) => <group key={i} position={[x, y, .1]}>
      <mesh><boxGeometry args={[.16, .08, .06]} /><meshStandardMaterial color="#8a6a3c" roughness={.5} /></mesh>
      <mesh position={[-.07, 0, 0]} material={gold}><boxGeometry args={[.03, .085, .065]} /></mesh>
      <mesh position={[.07, 0, 0]} material={gold}><boxGeometry args={[.03, .085, .065]} /></mesh>
    </group>)}
    <RoundedBox args={[1.6, 1.6, .16]} radius={.05} smoothness={4} position={[0, 0, .15]}>
      <meshPhysicalMaterial map={lid} metalness={.95} roughness={.32} clearcoat={.3} />
    </RoundedBox>
  </group>;
}

/* ---------------- CREATE: camera lens ---------------- */
function useLensTextures() {
  return useMemo(() => {
    const knurl = canvasTexture(512, (ctx, s) => {
      ctx.fillStyle = "#808080"; ctx.fillRect(0, 0, s, s);
      for (let x = 0; x < s; x += 8) { ctx.fillStyle = "#ffffff"; ctx.fillRect(x, 0, 4, s); }
    }, false);
    knurl.wrapS = knurl.wrapT = THREE.RepeatWrapping; knurl.repeat.set(10, 1);
    const ring = canvasTexture(1024, (ctx, s) => {
      ctx.fillStyle = "#0b0b0c"; ctx.fillRect(0, 0, s, s);
      ctx.translate(s / 2, s / 2); ctx.fillStyle = "#e9e9ea"; ctx.font = "600 34px sans-serif"; ctx.textAlign = "center";
      const text = "ADIEF · CREATE  35mm  1:1.4  ⌀62  ·  MADE IN KUALA LUMPUR  ·  ";
      const radius = s * .43;
      [...text].forEach((ch, i) => { ctx.save(); ctx.rotate(-Math.PI / 2 + i * (Math.PI * 2 / text.length)); ctx.translate(0, -radius); ctx.fillText(ch, 0, 0); ctx.restore(); });
    });
    return { knurl, ring };
  }, []);
}

function Lens() {
  const { knurl, ring } = useLensTextures();
  const barrel = useMemo(() => {
    // Profile from the mount (back) to the front lip, revolved around the optical axis.
    const pts = [[.0, -1.05], [.86, -1.05], [.9, -1.0], [.9, -.86], [.98, -.84], [1.0, -.2], [.96, -.18], [.96, .48], [1.03, .5], [1.04, .78], [.98, .82], [.84, .82], [.82, .74]]
      .map(([r, y]) => new THREE.Vector2(r, y));
    return new THREE.LatheGeometry(pts, 128);
  }, []);
  const anodised = useMemo(() => new THREE.MeshPhysicalMaterial({ color: "#151517", metalness: .55, roughness: .42, clearcoat: .4, clearcoatRoughness: .4 }), []);
  return <group>
    <mesh geometry={barrel} material={anodised} />
    {/* Rubber-gripped focus ring */}
    <mesh position={[0, .15, 0]}>
      <cylinderGeometry args={[1.07, 1.07, .55, 128, 1, true]} />
      <meshStandardMaterial color="#0e0e0f" roughness={.85} bumpMap={knurl} bumpScale={4} side={THREE.DoubleSide} />
    </mesh>
    {/* Red accent ring */}
    <mesh position={[0, .52, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.035, .012, 12, 128]} /><meshStandardMaterial color="#c4262e" roughness={.35} metalness={.3} /></mesh>
    {/* Silver mount */}
    <mesh position={[0, -.96, 0]}><cylinderGeometry args={[.9, .9, .1, 96, 1, true]} /><meshStandardMaterial color="#cfd2d6" metalness={1} roughness={.25} side={THREE.DoubleSide} /></mesh>
    {/* Engraved front ring */}
    <mesh position={[0, .821, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[.84, .98, 128]} /><meshStandardMaterial map={ring} roughness={.5} metalness={.3} /></mesh>
    {/* Dark interior and aperture */}
    <mesh position={[0, .45, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[.8, 64]} /><meshStandardMaterial color="#050608" roughness={.9} /></mesh>
    <mesh position={[0, .55, 0]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[.32, .8, 6]} /><meshStandardMaterial color="#1a1b1e" metalness={.6} roughness={.5} /></mesh>
    {/* Front element: coated glass with the purple/green reflections real lenses have */}
    {/* Shallow dome: 1.6 radius sphere cap, so it sits just proud of the front ring like real glass. */}
    <mesh position={[0, -.74, 0]}>
      <sphereGeometry args={[1.6, 96, 48, 0, Math.PI * 2, 0, .538]} />
      <meshPhysicalMaterial color="#ffffff" metalness={0} roughness={.02} transmission={0} ior={1.52}
        transparent opacity={.38} clearcoat={1} clearcoatRoughness={.02} iridescence={1} iridescenceIOR={1.6} iridescenceThicknessRange={[180, 520]} envMapIntensity={1.4} />
    </mesh>
  </group>;
}

/* ---------------- Composition ---------------- */
const TARGETS: Record<Mode, { chip: [number, number, number, number]; lens: [number, number, number, number] }> = {
  // [x, y, z, scale]
  // Objects float above the BUILD / CREATE titles so the words stay readable.
  neutral: { chip: [-1.55, 1.05, 0, .5], lens: [1.55, 1.05, 0, .55] },
  build: { chip: [-.9, .95, .5, .78], lens: [3.4, 1.3, -2.5, .38] },
  create: { chip: [-3.4, 1.3, -2.5, .36], lens: [.9, .95, .5, .82] },
};

// Phones are portrait, so the camera sees a narrow strip: keep both objects close to the centre.
const COMPACT_TARGETS: typeof TARGETS = {
  neutral: { chip: [-.6, 1.25, 0, .34], lens: [.62, 1.25, 0, .38] },
  build: { chip: [0, 1.15, .4, .55], lens: [1.5, 1.7, -2.5, .26] },
  create: { chip: [-1.5, 1.7, -2.5, .24], lens: [0, 1.15, .4, .58] },
};

export function GatewayObjects({ mode, compact = false }: { mode: Mode; compact?: boolean }) {
  const chip = useRef<THREE.Group>(null), lens = useRef<THREE.Group>(null);
  useFrame((state, delta) => {
    const t = state.clock.elapsedTime, k = 1 - Math.exp(-delta * 4), target = (compact ? COMPACT_TARGETS : TARGETS)[mode];
    for (const [ref, [x, y, z, s], base] of [[chip, target.chip, [-.5, .3, -.12]], [lens, target.lens, [.3, -.45, 0]]] as const) {
      const g = ref.current; if (!g) continue;
      g.position.lerp(new THREE.Vector3(x, y + Math.sin(t * .8 + x) * .05, z), k);
      g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x, s, k));
      g.rotation.x = base[0] + Math.sin(t * .4) * .06;
      g.rotation.y = base[1] + Math.sin(t * .3 + 1) * .12;
      g.rotation.z = base[2];
    }
  });
  return <>
    <group ref={chip} scale={.5} position={[-1.55, 1.05, 0]}><Chip compact={compact} /></group>
    {/* The lens axis is Y in its own space; rotate so it faces the viewer. */}
    <group ref={lens} scale={.55} position={[1.55, 1.05, 0]}><group rotation={[Math.PI / 2, 0, 0]}><Lens /></group></group>
  </>;
}
