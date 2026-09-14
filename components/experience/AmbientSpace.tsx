"use client";

import { useEffect, useRef } from "react";
import { NebulaJourney } from "./NebulaJourney";
import { useExperienceTheme } from "./ThemeProvider";
import { MarsScene } from "./MarsScene";

/** One subtle 2D star field for the whole reading journey; no extra WebGL scene. */
export function AmbientSpace({ journey = false }: { journey?: boolean }) {
  const { theme } = useExperienceTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const touch = window.matchMedia("(pointer: coarse)").matches;
    const stars = Array.from({ length: touch ? 65 : 125 }, (_, i) => ({
      x: ((i * 127.13 + 17.2) % 997) / 997,
      y: ((i * 233.71 + 53.3) % 991) / 991,
      radius: i % 11 === 0 ? 1.1 : .5,
      phase: i * 2.39,
    }));
    let width = 1, height = 1, frame = 0, last = 0, time = 0, scroll = window.scrollY, travel = 0;
    const paint = () => {
      context.clearRect(0, 0, width, height);
      for (const star of stars) {
        const offset = reduced.matches ? 0 : scroll * (star.radius + .3) * .035;
        const y = ((star.y * height + time * (star.radius + .3) - offset) % height + height) % height;
        const alpha = .2 + .14 * Math.sin(time * .3 + star.phase);
        context.fillStyle = `rgba(205,222,240,${alpha})`;
        context.beginPath(); context.arc(star.x * width, y, star.radius, 0, Math.PI * 2); context.fill();
        if (!reduced.matches && Math.abs(travel)>1) {
          context.strokeStyle=`rgba(205,222,240,${alpha*.35})`; context.lineWidth=.6;
          context.beginPath();context.moveTo(star.x*width,y);context.lineTo(star.x*width,y+Math.sign(travel)*Math.min(12,Math.abs(travel)*.1));context.stroke();
        }
      }
    };
    const resize = () => {
      width = canvas.clientWidth; height = canvas.clientHeight;
      const ratio = Math.min(window.devicePixelRatio || 1, 1.25);
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0); paint();
    };
    const tick = (now: number) => {
      frame = 0;
      if (document.hidden || reduced.matches) return;
      if (now - last >= 1000 / 20) { time += Math.min((now - last) / 1000, .1); last = now; travel*=.8; paint(); }
      frame = requestAnimationFrame(tick);
    };
    const resume = () => {
      cancelAnimationFrame(frame); last = performance.now(); paint();
      if (!document.hidden && !reduced.matches) frame = requestAnimationFrame(tick);
    };
    const observer = new ResizeObserver(resize); observer.observe(canvas); resize(); resume();
    const onScroll=()=>{const next=window.scrollY;travel=Math.max(-120,Math.min(120,next-scroll));scroll=next;};
    window.addEventListener("scroll",onScroll,{passive:true});
    document.addEventListener("visibilitychange", resume); reduced.addEventListener("change", resume);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); window.removeEventListener("scroll",onScroll);document.removeEventListener("visibilitychange", resume); reduced.removeEventListener("change", resume); };
  }, [theme]);
  if(theme === "mars") return <div className="ambient-space ambient-mars" aria-hidden="true"><MarsScene subtle/>{journey && <NebulaJourney/>}<div className="ambient-vignette"/></div>;
  return <div className="ambient-space" aria-hidden="true"><div className="ambient-nebula" /><canvas ref={canvasRef} />{journey && <NebulaJourney />}<div className="ambient-vignette" /></div>;
}
