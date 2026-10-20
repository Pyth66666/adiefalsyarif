"use client";
import { Component, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { Group } from "three";
import { useSceneActive } from "@/components/shared/useSceneActive";

class Boundary extends Component<{children: ReactNode}, {failed: boolean}> {
  state = {failed: false};
  static getDerivedStateFromError() { return {failed: true}; }
  render() { return this.state.failed ? <p className="orbit-loading">3D is unavailable on this device. Choose Still artwork below.</p> : this.props.children; }
}
function Sculpture({ playing }: { playing: boolean }) {
  const group = useRef<Group>(null);
  useFrame((_, delta) => { if (group.current && playing) group.current.rotation.y += Math.min(delta, .05) * .15; });
  return <group ref={group} rotation={[.35, .25, -.25]}>
    {[0,1,2].map(i => <mesh key={i} rotation={[i * Math.PI / 3, i * .6, i * .2]}><torusGeometry args={[1.35 + i * .17, .065, 12, 96]}/><meshStandardMaterial color={i === 1 ? "#b9764b" : "#c7c3b8"} metalness={.75} roughness={.25}/></mesh>)}
    <mesh><sphereGeometry args={[.46, 40, 32]}/><meshStandardMaterial color="#ef7c36" emissive="#d94a13" emissiveIntensity={.65} metalness={.25} roughness={.2}/></mesh>
  </group>;
}
export default function StudioOrbit({ reduced }: { reduced: boolean }) {
  const {ref, active} = useSceneActive();
  const [paused, setPaused] = useState(false);
  const [view, setView] = useState(0);
  const playing = active && !reduced && !paused;
  return <div ref={ref} className="studio-orbit"><Boundary><Canvas key={view} camera={{position:[0,0,6], fov:42}} dpr={[1,1.5]} frameloop={playing ? "always" : "demand"} gl={{alpha:true, powerPreference:"low-power"}} fallback={<p className="orbit-loading">3D is unavailable. Choose Still artwork below.</p>}>
    <ambientLight intensity={1.5}/><directionalLight position={[3,4,5]} intensity={4} color="#ffdfbf"/><directionalLight position={[-4,1,2]} intensity={3} color="#d1e9ff"/><pointLight position={[0,0,1]} intensity={3} color="#ff6a22"/>
    <Sculpture playing={playing}/><OrbitControls enableZoom={false} enablePan={false} enableDamping={!reduced}/>
  </Canvas></Boundary><div className="studio-orbit-controls"><span>DRAG TO ROTATE</span><button onClick={() => setPaused(!paused)} aria-pressed={paused} disabled={reduced}>{reduced ? "Motion reduced" : paused ? "Resume" : "Pause"}</button><button onClick={() => setView(v => v + 1)}>Reset view</button><a href="/art/adief-orbital-sculpture.glb" download>Download model ↓</a></div></div>;
}
