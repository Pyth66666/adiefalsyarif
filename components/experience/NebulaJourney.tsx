"use client";
import { useEffect, useRef } from "react";
import { atmosphereAt, atmosphereStops } from "@/lib/ambient-journey";

/** One continuous light field; no separate planets, rocks, or constellation lines. */
export function NebulaJourney() {
  const ref=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const root=ref.current;if(!root)return;
    const reduced=matchMedia("(prefers-reduced-motion: reduce)");
    let frame=0,anchors:number[]=[];
    const measure=()=>{anchors=atmosphereStops.map(stop=>{
      const node=document.querySelector(stop.selector);
      return node?node.getBoundingClientRect().top+window.scrollY:document.documentElement.scrollHeight;
    });schedule();};
    const paint=()=>{
      frame=0;
      const color=atmosphereAt(window.scrollY+window.innerHeight*.35,anchors);
      root.style.setProperty("--journey-color",color.join(","));
      root.style.transform=reduced.matches?"none":`translate3d(0,${Math.sin(window.scrollY*.0003)*18}px,0)`;
    };
    const schedule=()=>{if(!frame && !document.hidden)frame=requestAnimationFrame(paint);};
    const observer=new ResizeObserver(measure);const main=document.getElementById("top");if(main)observer.observe(main);
    window.addEventListener("resize",measure);window.addEventListener("scroll",schedule,{passive:true});
    document.addEventListener("visibilitychange",schedule);reduced.addEventListener("change",schedule);measure();
    return()=>{cancelAnimationFrame(frame);observer.disconnect();window.removeEventListener("resize",measure);window.removeEventListener("scroll",schedule);document.removeEventListener("visibilitychange",schedule);reduced.removeEventListener("change",schedule);};
  },[]);
  return <div ref={ref} className="nebula-journey" aria-hidden="true"/>;
}
