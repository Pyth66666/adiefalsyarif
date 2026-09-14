"use client";
import { useEffect, useRef, type RefObject } from "react";
import type { Mode } from "@/lib/modes";

/** A bounded, offscreen-paused 2D layer; no extra WebGL context. */
export function GatewaySparks({ mode, pointer }: { mode: Mode; pointer: RefObject<{ x:number; y:number }> }) {
  const ref=useRef<HTMLCanvasElement>(null), modeRef=useRef(mode);
  modeRef.current=mode;
  useEffect(()=>{
    const canvas=ref.current,ctx=canvas?.getContext("2d");if(!canvas || !ctx)return;
    const reduced=matchMedia("(prefers-reduced-motion: reduce)"),touch=matchMedia("(pointer: coarse)").matches;
    const sparks=Array.from({length:touch?60:130},(_,i)=>({side:i%2===0?-1:1,seed:((i*137.7)%997)/997,phase:((i*237.3)%991)/991,r:i%9===0?1.7:.7}));
    let width=1,height=1,frame=0,last=0,time=0,visible=false,energy=0;
    const paint=()=>{
      ctx.clearRect(0,0,width,height);
      for(const spark of sparks) {
        const on=modeRef.current===(spark.side<0?"build":"create");
        const life=(spark.phase+time*(.025+spark.seed*.035))%1;
        const spread=(.025+spark.seed*.31)*width;
        const x=(spark.side<0?spread:width-spread)+Math.sin(life*4+spark.seed*8)*20+pointer.current.x*8;
        const y=height*(1.1-life*1.3)+pointer.current.y*5;
        const alpha=Math.sin(life*Math.PI)*(.25+(on?.5:.1));
        ctx.strokeStyle=`rgba(${spark.side<0?"89,231,190":"255,150,79"},${alpha})`;
        ctx.lineWidth=spark.r;
        ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-spark.side*(2+energy*5),y+spark.r*(3+energy*8));ctx.stroke();
        if(spark.r>1) { ctx.fillStyle=`rgba(${spark.side<0?"186,255,227":"255,220,162"},${alpha})`;ctx.beginPath();ctx.arc(x,y,1.3,0,Math.PI*2);ctx.fill(); }
      }
    };
    const tick=(now:number)=>{
      frame=0;if(!visible || document.hidden || reduced.matches)return;
      if(now-last>=1000/30){const dt=Math.min((now-last)/1000,.08);last=now;time+=dt;energy+=((modeRef.current==="neutral"?0:1)-energy)*dt*4;paint();}
      frame=requestAnimationFrame(tick);
    };
    const resume=()=>{cancelAnimationFrame(frame);frame=0;last=performance.now();paint();if(visible&&!document.hidden&&!reduced.matches)frame=requestAnimationFrame(tick);};
    const resize=()=>{width=canvas.clientWidth;height=canvas.clientHeight;const dpr=Math.min(devicePixelRatio||1,1.25);canvas.width=width*dpr;canvas.height=height*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);paint();};
    const sizeObserver=new ResizeObserver(resize);sizeObserver.observe(canvas);
    const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;resume();});observer.observe(canvas);
    document.addEventListener("visibilitychange",resume);reduced.addEventListener("change",resume);resize();
    return()=>{cancelAnimationFrame(frame);sizeObserver.disconnect();observer.disconnect();document.removeEventListener("visibilitychange",resume);reduced.removeEventListener("change",resume);};
  },[pointer]);
  return <canvas ref={ref} className="gateway-sparks" aria-hidden="true"/>;
}
