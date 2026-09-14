"use client";
import { useEffect, useRef } from "react";
import { planetFrame, planetStops } from "@/lib/planet-journey";

// Restore the previous cached planet artwork. No per-frame surface generation.
function planet(kind:number) {
  const image=document.createElement("canvas");image.width=image.height=256;
  const ctx=image.getContext("2d");if(!ctx)return image;
  const pixels=ctx.createImageData(256,256);
  const palettes=[[35,105,170],[181,78,38],[179,138,96],[193,169,119],[42,88,180],[143,150,161]];
  for(let y=0;y<256;y++)for(let x=0;x<256;x++) {
    const nx=(x-128)/123,ny=(y-128)/123,r=nx*nx+ny*ny;if(r>1)continue;
    const z=Math.sqrt(1-r),lon=Math.atan2(nx,z),lat=Math.asin(ny);
    const texture=Math.sin(lon*8+Math.sin(lat*9)*2)*Math.sin(lat*11+Math.cos(lon*5))+Math.sin(lon*21+lat*17)*.2;
    let color=palettes[kind].slice();
    if(kind===0) {
      if(texture>.15)color=[54,104+texture*20,66];
      const clouds=Math.sin(lon*13+lat*17+Math.sin(lat*8)*2)*Math.sin(lat*19-lon*8);
      if(clouds>.53||Math.abs(ny)>.93)color=color.map(c=>c*.35+170);
    } else if(kind===2||kind===3)color=color.map(c=>c*(.85+Math.sin(lat*38+Math.sin(lon*5)*.55)*.17+Math.sin(lat*17)*.1));
    else color=color.map(c=>c*(.8+texture*.15));
    const light=Math.max(0,-nx*.55-ny*.4+z*.72),shade=.035+Math.pow(light,1.3)*.95;
    const rim=Math.pow(1-z,5)*light*.3,i=(y*256+x)*4;
    for(let c=0;c<3;c++)pixels.data[i+c]=Math.min(255,color[c]*shade+palettes[kind][c]*rim);
    pixels.data[i+3]=Math.min(1,(1-r)*100)*255;
  }
  ctx.putImageData(pixels,0,0);return image;
}

export function PlanetJourney() {
  const ref=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const canvas=ref.current,ctx=canvas?.getContext("2d");if(!canvas||!ctx)return;
    const images=Array.from({length:6},(_,i)=>planet(i));
    const reduced=matchMedia("(prefers-reduced-motion: reduce)");
    let width=1,height=1,frame=0;
    const paint=()=>{
      frame=0;ctx.clearRect(0,0,width,height);
      for(const stop of planetStops) {
        const section=document.querySelector(stop.selector);if(!section)continue;
        const rect=section.getBoundingClientRect(),state=planetFrame(rect.top,rect.bottom,height,reduced.matches);
        if(!state)continue;
        const size=Math.min(width*.65,Math.min(width,height)*stop.size*state.scale);
        const x=width*stop.side,y=height*state.y;ctx.globalAlpha=state.opacity;
        const ring=(start:number,end:number)=>{
          ctx.save();ctx.translate(x,y);ctx.rotate(-.35);ctx.strokeStyle="#b39b6a";ctx.lineWidth=size*.09;
          ctx.beginPath();ctx.ellipse(0,0,size*.8,size*.23,0,start,end);ctx.stroke();ctx.restore();
        };
        if(stop.kind===3)ring(Math.PI,Math.PI*2);
        ctx.drawImage(images[stop.kind],x-size/2,y-size/2,size,size);
        if(stop.kind===3)ring(0,Math.PI);
        // Only one planet can be drawn, even while adjacent sections overlap.
        break;
      }
      ctx.globalAlpha=1;
    };
    const schedule=()=>{if(!frame&&!document.hidden)frame=requestAnimationFrame(paint);};
    const resize=()=>{width=canvas.clientWidth;height=canvas.clientHeight;const dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.max(1,width*dpr);canvas.height=Math.max(1,height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);schedule();};
    const sizeObserver=new ResizeObserver(resize);sizeObserver.observe(canvas);
    const contentObserver=new ResizeObserver(schedule);const main=document.getElementById("top");if(main)contentObserver.observe(main);
    window.addEventListener("scroll",schedule,{passive:true});document.addEventListener("visibilitychange",schedule);reduced.addEventListener("change",schedule);resize();
    return()=>{cancelAnimationFrame(frame);sizeObserver.disconnect();contentObserver.disconnect();window.removeEventListener("scroll",schedule);document.removeEventListener("visibilitychange",schedule);reduced.removeEventListener("change",schedule);};
  },[]);
  return <canvas ref={ref} className="planet-journey" aria-hidden="true"/>;
}
