"use client";
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Real 3D planets for the reading journey. Each section has its own planet, which scrolls past
 * in the page margin as you read. Textures: NASA Blue/Black Marble (Earth), NASA SVS (Moon),
 * Solar System Scope CC BY 4.0 (Jupiter, Saturn + ring, Neptune).
 */
type Kind = "earth" | "moon" | "jupiter" | "saturn" | "neptune";
type Stop = { selector: string; kind: Kind; side: number; size: number; tilt: number };
// All planets live in the right margin: almost every section's text is left-aligned.
export const PLANET_STOPS: Stop[] = [
  { selector: "#build > section:first-child", kind: "earth", side: .88, size: .5, tilt: -.41 },
  { selector: "#telemetry", kind: "moon", side: .95, size: .22, tilt: .1 },
  { selector: "#projects", kind: "jupiter", side: .93, size: .46, tilt: .05 },
  { selector: "#cybermap", kind: "neptune", side: .96, size: .28, tilt: .5 },
  { selector: "#timeline", kind: "saturn", side: .86, size: .34, tilt: .47 },
  { selector: "#create > section:first-child", kind: "jupiter", side: .84, size: .44, tilt: -.05 },
  { selector: "#collection", kind: "neptune", side: .95, size: .26, tilt: .4 },
  { selector: "#lab", kind: "saturn", side: .92, size: .3, tilt: -.4 },
  { selector: "#about", kind: "moon", side: .93, size: .28, tilt: 0 },
  { selector: "#contact", kind: "earth", side: .88, size: .42, tilt: -.41 },
];
const TEXTURES: Record<Kind, string> = {
  earth: "/space/earth-day.jpg", moon: "/space/planets/moon.jpg", jupiter: "/space/planets/jupiter.jpg",
  saturn: "/space/planets/saturn.jpg", neptune: "/space/planets/neptune.jpg",
};
const ATMOSPHERE: Partial<Record<Kind, string>> = { earth: "#6fb6ff", neptune: "#7aa8ff", jupiter: "#d9b48a", saturn: "#e6d2a2" };
const SUN = new THREE.Vector3(-0.85, 0.35, 0.55).normalize();
const CAMERA_Z = 10, FOV = 35;

const vertex = /* glsl */`
  varying vec2 vUv; varying vec3 vWorldNormal; varying vec3 vViewDir;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
const surface = /* glsl */`
  uniform sampler2D map; uniform sampler2D nightMap; uniform bool hasNight;
  uniform vec3 sunDir; uniform vec3 rimColor; uniform float rimStrength; uniform float specular;
  varying vec2 vUv; varying vec3 vWorldNormal; varying vec3 vViewDir;
  void main() {
    vec3 n = normalize(vWorldNormal);
    float light = dot(n, sunDir);
    float dayMix = smoothstep(-0.12, 0.28, light);
    vec3 color = texture2D(map, vUv).rgb * (0.035 + max(light, 0.0) * 1.3);
    if (hasNight) color += texture2D(nightMap, vUv).rgb * vec3(1.0, 0.82, 0.55) * 1.6 * (1.0 - dayMix);
    vec3 halfDir = normalize(sunDir + vViewDir);
    color += pow(max(dot(n, halfDir), 0.0), 220.0) * specular * dayMix;
    float fresnel = pow(1.0 - max(dot(n, vViewDir), 0.0), 3.0);
    color += rimColor * fresnel * rimStrength * (0.15 + dayMix * 0.6);
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
const haloVertex = /* glsl */`
  varying vec3 vNormal; varying vec3 vWorldNormal; varying vec3 vViewPos;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    vViewPos = view.xyz;
    gl_Position = projectionMatrix * view;
  }
`;
const haloFragment = /* glsl */`
  uniform vec3 rimColor; uniform vec3 sunDir; uniform float strength; uniform float edge;
  varying vec3 vNormal; varying vec3 vWorldNormal; varying vec3 vViewPos;
  void main() {
    // Measure against the real direction to the camera, so the glow stays centred on planets
    // that sit off to the side of the screen (perspective would otherwise shift it).
    // f is 0 at the halo's outer edge and reaches "edge" where the planet's limb is,
    // so the glow is brightest against the planet and fades smoothly to nothing.
    float f = -dot(normalize(vNormal), normalize(-vViewPos));
    float intensity = pow(clamp(f / edge, 0.0, 1.0), 1.8) * 0.55;
    float lit = 0.25 + 0.75 * smoothstep(-0.3, 0.6, dot(normalize(vWorldNormal), sunDir));
    // Premultiplied glow with matching alpha, so it fades into the page instead of
    // painting the transparent canvas black around the planet.
    float a = clamp(intensity * lit * strength, 0.0, 1.0);
    gl_FragColor = vec4(rimColor * a, a);
  }
`;
const ringVertex = /* glsl */`
  varying vec2 vUv; varying vec3 vWorldPos;
  void main() { vUv = uv; vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vWorldPos, 1.0); }
`;
const ringFragment = /* glsl */`
  uniform sampler2D map; uniform vec3 sunDir; uniform vec3 planetCenter; uniform float planetRadius;
  varying vec2 vUv; varying vec3 vWorldPos;
  void main() {
    vec4 tex = texture2D(map, vec2(vUv.x, 0.5));
    // Planet shadow on the ring: is the sun blocked by the sphere along this point's sun ray?
    vec3 toCenter = planetCenter - vWorldPos;
    float along = dot(toCenter, sunDir);
    float dist = length(toCenter - sunDir * along);
    float shadow = (along > 0.0 && dist < planetRadius) ? 0.18 : 1.0;
    gl_FragColor = vec4(tex.rgb * 0.95 * shadow, tex.a * 0.92);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

// Section positions are measured only when layout changes, never per frame.
// Reading getBoundingClientRect for 10 sections every frame forced constant layout work (the lag).
const layout = new Map<string, { top: number; height: number }>();
function measureSections() {
  const y = window.scrollY;
  for (const stop of PLANET_STOPS) {
    const el = document.querySelector(stop.selector);
    if (!el) { layout.delete(stop.selector); continue; }
    const r = el.getBoundingClientRect();
    layout.set(stop.selector, { top: r.top + y, height: r.height });
  }
}
const SPHERE = new THREE.SphereGeometry(1, 64, 64);
const HALO_SPHERE = new THREE.SphereGeometry(1, 40, 40);

/** Renders only while at least one planet is on screen, at ~30fps, instead of every frame forever. */
function Ticker({ animate }: { animate: boolean }) {
  const invalidate = useThree(state => state.invalidate);
  useEffect(() => {
    let frame = 0, last = 0;
    const anyVisible = () => {
      const y = window.scrollY, h = window.innerHeight;
      for (const box of layout.values()) {
        const center = box.top - y + Math.min(box.height, h) * 0.45;
        if (center > -h * 0.6 && center < h * 1.6) return true;
      }
      return false;
    };
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop);
      if (!animate || now - last < 33) return;
      last = now; if (anyVisible()) invalidate();
    };
    const onScroll = () => { if (anyVisible()) invalidate(); };
    const onResize = () => { measureSections(); invalidate(); };
    measureSections();
    const observer = new ResizeObserver(onResize); observer.observe(document.body);
    window.addEventListener("scroll", onScroll, { passive: true }); window.addEventListener("resize", onResize);
    frame = requestAnimationFrame(loop);
    // Sections mount progressively; re-measure a few times early on.
    const timers = [400, 1200, 3000].map(t => window.setTimeout(onResize, t));
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onResize); timers.forEach(clearTimeout); };
  }, [animate, invalidate]);
  return null;
}

function useScreenToWorld() {
  const { viewport, size } = useThree();
  return { worldHeight: 2 * CAMERA_Z * Math.tan(THREE.MathUtils.degToRad(FOV / 2)), width: size.width, height: size.height, aspect: viewport.aspect };
}

function Planet({ stop, index, animate, nightMap }: { stop: Stop; index: number; animate: boolean; nightMap: THREE.Texture }) {
  const map = useLoader(THREE.TextureLoader, TEXTURES[stop.kind]);
  const ringMap = useLoader(THREE.TextureLoader, "/space/planets/saturn-ring.png");
  useMemo(() => { for (const t of [map, ringMap]) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; } }, [map, ringMap]);
  const group = useRef<THREE.Group>(null), body = useRef<THREE.Mesh>(null);
  // Earth starts turned toward Asia and Africa rather than the dark Pacific.
  const spin = useRef(stop.kind === "earth" ? 2.4 + index * 0.4 : index * 1.7);
  const { worldHeight, width, height } = useScreenToWorld();
  const rim = ATMOSPHERE[stop.kind] ?? "#ffffff";
  const uniforms = useMemo(() => ({
    map: { value: map }, nightMap: { value: nightMap }, hasNight: { value: stop.kind === "earth" }, sunDir: { value: SUN },
    rimColor: { value: new THREE.Color(rim) }, rimStrength: { value: ATMOSPHERE[stop.kind] ? 1 : 0.25 }, specular: { value: stop.kind === "earth" ? 0.05 : 0.0 },
  }), [map, nightMap, stop.kind, rim]);
  const haloScale = stop.kind === "earth" ? 1.12 : 1.07;
  const halo = useMemo(() => ({ rimColor: { value: new THREE.Color(rim) }, sunDir: { value: SUN }, strength: { value: stop.kind === "earth" ? 1.3 : 0.8 },
    edge: { value: Math.sqrt(1 - 1 / (haloScale * haloScale)) } }), [rim, stop.kind, haloScale]);
  const ring = useMemo(() => {
    const geometry = new THREE.RingGeometry(1.25, 2.3, 96, 1);
    // Map U across the ring's radius so the strip texture reads from inner to outer edge.
    const pos = geometry.attributes.position, uv = geometry.attributes.uv, v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); uv.setXY(i, (v.length() - 1.25) / (2.3 - 1.25), 0.5); }
    return geometry;
  }, []);
  const ringUniforms = useMemo(() => ({ map: { value: ringMap }, sunDir: { value: SUN }, planetCenter: { value: new THREE.Vector3() }, planetRadius: { value: 1 } }), [ringMap]);
  useFrame((_, delta) => {
    if (!group.current) return;
    const box = layout.get(stop.selector);
    if (!box) { group.current.visible = false; return; }
    const rect = { top: box.top - window.scrollY, height: box.height };
    const compact = width < 768;
    // Planet centre follows its section, so it drifts past as you scroll.
    const screenY = rect.top + Math.min(rect.height, height) * 0.45;
    const visible = screenY > -height * 0.6 && screenY < height * 1.6;
    group.current.visible = visible;
    if (!visible) return;
    const worldWidth = worldHeight * (width / height);
    const radius = (worldHeight * stop.size * (compact ? .42 : 1)) / 2;
    const side = compact ? 1.1 : stop.side;
    group.current.position.set((side - .5) * worldWidth, -(screenY / height - .5) * worldHeight, 0);
    group.current.scale.setScalar(radius);
    if (animate) spin.current += Math.min(delta, .05) * (stop.kind === "jupiter" || stop.kind === "saturn" ? .07 : .035);
    if (body.current) body.current.rotation.y = spin.current + window.scrollY * 0.00025;
    ringUniforms.planetCenter.value.copy(group.current.position); ringUniforms.planetRadius.value = radius;
  });
  return <group ref={group}>
    <group rotation={[0.18, 0, stop.tilt]}>
      <mesh ref={body}>
        <primitive object={SPHERE} attach="geometry" />
        <shaderMaterial vertexShader={vertex} fragmentShader={surface} uniforms={uniforms} />
      </mesh>
      {ATMOSPHERE[stop.kind] && <mesh scale={haloScale}>
        <primitive object={HALO_SPHERE} attach="geometry" />
        <shaderMaterial vertexShader={haloVertex} fragmentShader={haloFragment} uniforms={halo} side={THREE.BackSide} transparent depthWrite={false}
          blending={THREE.CustomBlending} blendSrc={THREE.OneFactor} blendDst={THREE.OneMinusSrcAlphaFactor} blendSrcAlpha={THREE.OneFactor} blendDstAlpha={THREE.OneMinusSrcAlphaFactor} />
      </mesh>}
      {stop.kind === "saturn" && <mesh geometry={ring} rotation={[-Math.PI / 2 + 0.32, 0, 0]}>
        <shaderMaterial vertexShader={ringVertex} fragmentShader={ringFragment} uniforms={ringUniforms} side={THREE.DoubleSide} transparent depthWrite={false} />
      </mesh>}
    </group>
  </group>;
}

function Planets({ animate, onReady }: { animate: boolean; onReady: () => void }) {
  const nightMap = useLoader(THREE.TextureLoader, "/space/earth-night.jpg");
  useMemo(() => { nightMap.colorSpace = THREE.SRGBColorSpace; }, [nightMap]);
  useEffect(() => { onReady(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <>{PLANET_STOPS.map((stop, i) => <Suspense key={stop.selector} fallback={null}><Planet stop={stop} index={i} animate={animate} nightMap={nightMap} /></Suspense>)}</>;
}

class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function HeroPlanet() {
  const [reduced, setReduced] = useState(false);
  const [visible, setVisible] = useState(true);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    const onVisibility = () => setVisible(!document.hidden);
    sync(); query.addEventListener("change", sync); document.addEventListener("visibilitychange", onVisibility);
    return () => { query.removeEventListener("change", sync); document.removeEventListener("visibilitychange", onVisibility); };
  }, []);
  return <div className={`planet-system${ready ? " is-ready" : ""}`} aria-hidden="true">
    <Boundary>
      <Canvas camera={{ position: [0, 0, CAMERA_Z], fov: FOV }} dpr={[1, 1.25]}
        frameloop={visible ? "demand" : "never"}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}>
        <Ticker animate={!reduced} />
        <Suspense fallback={null}><Planets animate={!reduced} onReady={() => setReady(true)} /></Suspense>
      </Canvas>
    </Boundary>
  </div>;
}
