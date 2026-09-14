"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { experienceThemes, useExperienceTheme } from "./ThemeProvider";

export interface SpacePointer {
  x: number;
  y: number;
  active: boolean;
  pulse: number;
}

const vertexSource = `
attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;

// A single, resolution-capped shader: flowing nebula + two layers of stars.
// This is a visual flow field, not a costly multi-pass fluid simulation.
const fragmentSource = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2 u_resolution;
uniform vec2 u_pointer;
uniform vec2 u_velocity;
uniform float u_time;
uniform float u_interaction;
uniform float u_pulse;
uniform float u_theme;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x), f.y);
}
float field(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += noise(p) * a;
    p = mat2(1.6, 1.2, -1.2, 1.6) * p + 3.7;
    a *= 0.5;
  }
  return v;
}
float stars(vec2 p, float scale, float seed) {
  vec2 grid = p * scale;
  vec2 cell = floor(grid);
  vec2 local = fract(grid);
  float h = hash(cell + seed);
  vec2 center = vec2(0.2) + 0.6 * vec2(hash(cell + seed + 4.0), hash(cell + seed + 19.0));
  float d = length(local - center);
  float radius = mix(0.018, 0.047, h);
  float core = 1.0 - smoothstep(0.0, radius, d);
  float glow = exp(-d * 22.0) * 0.22;
  float twinkle = 0.74 + 0.26 * sin(u_time * (0.4 + h) + h * 38.0);
  return (core + glow) * step(0.79, h) * twinkle;
}
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  float aspect = u_resolution.x / u_resolution.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
  vec2 mouse = (u_pointer - 0.5) * vec2(aspect, 1.0);
  vec2 delta = p - mouse;
  float influence = exp(-dot(delta, delta) * 6.0) * u_interaction;
  vec2 swirl = vec2(-delta.y, delta.x) * influence;
  vec2 flow = p * 2.15 + swirl * 1.35 - u_velocity * influence * 0.6;
  float t = u_time * 0.035;
  vec2 warp = vec2(field(flow + vec2(t, -t)), field(flow + vec2(4.2, 1.7 + t)));
  float mist = field(flow + 2.8 * warp + vec2(-t, t * 0.4));
  float ribbon = smoothstep(0.29, 0.72, mist);
  float bandDistance = (p.y + 0.28 * sin(p.x * 2.0 + t)) * 1.8;
  float band = exp(-bandDistance * bandDistance);
  vec3 blue = vec3(0.025, 0.11, 0.20);
  vec3 teal = vec3(0.045, 0.24, 0.24);
  vec3 violet = vec3(0.19, 0.09, 0.29);
  vec3 nebula = mix(blue, teal, warp.x);
  nebula = mix(nebula, violet, smoothstep(-0.1, 0.9, p.x + warp.y));
  vec3 color = vec3(0.009, 0.016, 0.03) + nebula * ribbon * band * 2.1;
  color += vec3(0.06, 0.15, 0.17) * influence * ribbon;
  // A quiet ripple on pointer-down; no flashes or strobing.
  float ringDistance = (length(delta) - (1.0 - u_pulse) * 0.5) * 22.0;
  float ring = exp(-ringDistance * ringDistance) * u_pulse;
  color += vec3(0.045, 0.095, 0.11) * ring;
  vec2 parallax = mouse * u_interaction * 0.022;
  float nearStars = stars(p + parallax + swirl * 0.035 + vec2(t * 0.025, 0.0), 25.0, 7.0);
  float farStars = stars(p + parallax * 0.4 - vec2(0.0, t * 0.015), 43.0, 31.0);
  color += vec3(0.72, 0.87, 1.0) * nearStars * 0.85;
  color += vec3(0.56, 0.69, 0.85) * farStars * 0.4;
  if (u_theme > 0.5 && u_theme < 1.5) {
    float curtainDistance = p.y - 0.17 * sin(p.x * 3.5 + t * 2.0 + warp.x);
    float curtain = exp(-curtainDistance * curtainDistance * 16.0) * (0.35 + ribbon);
    color = color * vec3(0.55, 1.05, 0.8) + vec3(0.025, 0.15, 0.075) * curtain;
  }
  if (u_theme > 1.5) {
    float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
    color = vec3(luminance) * vec3(0.84, 0.91, 1.0);
  }
  // Keep the center quiet for the name and ENTER control.
  color *= 0.60 + 0.40 * smoothstep(0.0, 0.52, length(p));
  float vignette = 1.0 - smoothstep(0.3, 1.15, length((uv - 0.5) * vec2(1.1, 1.0)));
  gl_FragColor = vec4(color * (0.45 + 0.55 * vignette), 1.0);
}
`;

export function StarfieldBackground({ pointer }: { pointer: RefObject<SpacePointer> }) {
  const { theme } = useExperienceTheme();
  const themeRef = useRef(0);
  themeRef.current = experienceThemes[theme].index;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const touch = window.matchMedia("(pointer: coarse)").matches;
    // The CSS star field also serves as the reduced-motion/WebGL fallback.
    if (reduced.matches) {
      const restart = () => setGeneration(value => value + 1);
      reduced.addEventListener("change", restart);
      return () => reduced.removeEventListener("change", restart);
    }
    const gl = canvas.getContext("webgl", { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: "low-power" });
    if (!gl) return;

    let program: WebGLProgram | null = null;
    let buffer: WebGLBuffer | null = null;
    const shaders: WebGLShader[] = [];
    let frame = 0;
    let lastFrame = 0;
    let time = 0;
    let interaction = 0;
    let pulse = 0;
    let lastPulse = pointer.current.pulse;
    let lost = false;
    const mouse = { x: 0.5, y: 0.5 };
    const velocity = { x: 0, y: 0 };

    const dispose = () => {
      cancelAnimationFrame(frame);
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
      shaders.forEach(shader => gl.deleteShader(shader));
    };
    try {
      const compile = (type: number, source: string) => {
        const shader = gl.createShader(type);
        if (!shader) throw new Error("Shader unavailable");
        shaders.push(shader);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error("Shader unsupported");
        return shader;
      };
      program = gl.createProgram();
      if (!program) throw new Error("WebGL unavailable");
      gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexSource));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentSource));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("Shader unsupported");
      gl.useProgram(program);
      buffer = gl.createBuffer();
      if (!buffer) throw new Error("Buffer unavailable");
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, "a_position");
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    } catch {
      dispose();
      return;
    }

    const uniforms = {
      resolution: gl.getUniformLocation(program, "u_resolution"),
      pointer: gl.getUniformLocation(program, "u_pointer"),
      velocity: gl.getUniformLocation(program, "u_velocity"),
      time: gl.getUniformLocation(program, "u_time"),
      interaction: gl.getUniformLocation(program, "u_interaction"),
      pulse: gl.getUniformLocation(program, "u_pulse"),
      theme: gl.getUniformLocation(program, "u_theme"),
    };
    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect();
      const scale = Math.min(1, Math.sqrt((touch ? 360000 : 800000) / Math.max(1, width * height)));
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    const draw = (now: number) => {
      frame = 0;
      if (document.hidden || reduced.matches || lost) return;
      const elapsed = now - lastFrame;
      if (elapsed < 1000 / (touch ? 24 : 30)) { frame = requestAnimationFrame(draw); return; }
      const dt = Math.min(elapsed / 1000, 0.05);
      lastFrame = now;
      time += dt;
      const input = pointer.current;
      const smoothing = 1 - Math.exp(-dt * 4);
      const dx = input.x - mouse.x, dy = input.y - mouse.y;
      mouse.x += dx * smoothing;
      mouse.y += dy * smoothing;
      velocity.x += (dx - velocity.x) * smoothing;
      velocity.y += (dy - velocity.y) * smoothing;
      interaction += ((input.active ? 1 : 0) - interaction) * smoothing;
      if (input.pulse !== lastPulse) { pulse = 1; lastPulse = input.pulse; }
      pulse = Math.max(0, pulse - dt * 0.6);
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
      gl.uniform2f(uniforms.pointer, mouse.x, mouse.y);
      gl.uniform2f(uniforms.velocity, velocity.x, velocity.y);
      gl.uniform1f(uniforms.time, time);
      gl.uniform1f(uniforms.interaction, interaction);
      gl.uniform1f(uniforms.pulse, pulse);
      gl.uniform1f(uniforms.theme, themeRef.current);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      frame = requestAnimationFrame(draw);
    };
    const resume = () => {
      cancelAnimationFrame(frame);
      lastFrame = performance.now();
      if (!document.hidden && !reduced.matches && !lost) frame = requestAnimationFrame(draw);
    };
    const onPreference = () => { setReady(!reduced.matches && !lost); resume(); };
    const onLost = (event: Event) => { event.preventDefault(); lost = true; cancelAnimationFrame(frame); setReady(false); };
    const onRestored = () => { setReady(false); setGeneration(value => value + 1); };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    setReady(true);
    resume();
    document.addEventListener("visibilitychange", resume);
    reduced.addEventListener("change", onPreference);
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", resume);
      reduced.removeEventListener("change", onPreference);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      dispose();
    };
  }, [pointer, generation]);

  return <div className="intro-space" aria-hidden="true">
    <div className="intro-space-fallback" />
    <canvas ref={canvasRef} className="intro-space-canvas" style={{ opacity: ready ? 1 : 0 }} />
    <div className="intro-space-shade" />
  </div>;
}
