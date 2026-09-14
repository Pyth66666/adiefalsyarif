"use client";
import { useRef, useState, type PointerEvent } from "react";
import { motion, useMotionValue, useSpring, useReducedMotion } from "framer-motion";
import type { CollectionBadge } from "@/data/collection";
import { DialogSurface } from "@/components/shared/DialogSurface";
import { TextReveal } from "@/components/shared/TextReveal";
import { useCms } from "@/components/cms/CmsGate";

function Badge3D({ badge, onOpen }: { badge: CollectionBadge; onOpen: () => void }) {
  const rotation = useMotionValue(0);
  const tilt = useMotionValue(0);
  const smoothRotation = useSpring(rotation, { stiffness: 150, damping: 23 });
  const smoothTilt = useSpring(tilt, { stiffness: 180, damping: 25 });
  const reduced = useReducedMotion();
  const [back, setBack] = useState(false);
  const drag = useRef<{ x: number; y: number; angle: number; pointer: number } | null>(null);
  const flip = () => { const next = !back; setBack(next); rotation.set(next ? 180 : 0); tilt.set(0); };
  const end = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.pointer !== e.pointerId) return;
    const angle = rotation.get();
    const target = Math.round(angle / 180) * 180;
    rotation.set(target); setBack(Math.abs(Math.round(target / 180)) % 2 === 1); tilt.set(0); drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  return <div className="badge-stage">
    <motion.div className="badge-card" role="group" aria-label={badge.title + (back ? ", back" : ", front")}
      style={{ rotateY: reduced ? rotation : smoothRotation, rotateX: reduced ? 0 : smoothTilt }}
      onPointerDown={e => {
        if (e.button !== 0 || reduced) return;
        drag.current = {x:e.clientX,y:e.clientY,angle:rotation.get(),pointer:e.pointerId};
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={e => {
        if (reduced) return;
        const d=drag.current;
        if (d && d.pointer === e.pointerId) { rotation.set(d.angle + (e.clientX-d.x)*1.3); tilt.set(Math.max(-15,Math.min(15,(d.y-e.clientY)*.12))); }
        else if (e.pointerType === "mouse") { const r=e.currentTarget.getBoundingClientRect(); tilt.set((.5-(e.clientY-r.top)/r.height)*12); }
      }}
      onPointerUp={end} onPointerCancel={end} onLostPointerCapture={() => { drag.current=null; }}
      onPointerLeave={() => { if (!drag.current) tilt.set(0); }}>
      <div className="badge-face" aria-hidden={back}>
        {badge.frontImage ? <img src={badge.frontImage} alt={badge.title} draggable={false} loading="lazy" />
          : <><p className="eyebrow text-create">{badge.year}</p><p className="font-display text-2xl mt-4">{badge.title}</p><p className="mt-3 text-sm text-paper/60">{badge.event}</p></>}
      </div>
      <div className="badge-face badge-back" aria-hidden={!back}>
        {badge.backImage ? <img src={badge.backImage} alt={badge.title + " back"} draggable={false} loading="lazy" />
          : <><p className="eyebrow text-build">A MOMENT KEPT</p><p className="mt-5 text-sm leading-relaxed line-clamp-6">{badge.story || badge.event}</p><p className="mt-5 text-xs text-paper/50">{badge.year}</p></>}
      </div>
    </motion.div>
    <div className="badge-controls"><button onClick={flip} aria-label={`Flip ${badge.title} to ${back ? "front" : "back"}`}>FLIP ↻</button><button onClick={onOpen} aria-haspopup="dialog">READ STORY ↗</button></div>
  </div>;
}
function BadgeStory({ badge, onClose }: { badge: CollectionBadge; onClose: () => void }) {
  return <DialogSurface label={badge.title} onClose={onClose}>
    <article className="project-case"><button onClick={onClose} className="case-close" aria-label="Close story">CLOSE ×</button>
      <p className="eyebrow text-create">{badge.year} / {badge.event}</p><h2 className="mt-4 font-display text-3xl md:text-5xl">{badge.title}</h2>
      {badge.story && <p className="mt-6 text-lg leading-relaxed text-paper/80">{badge.story}</p>}
      <div className="mt-8 space-y-7">{[["WHAT HAPPENED",badge.whatHappened],["WHAT I BUILT",badge.whatIBuilt],["PEOPLE I MET",badge.peopleIMet]].map(([label,value]) => value && <div key={label}><h3 className="eyebrow text-create mb-2">{label}</h3><p className="text-paper/75 leading-relaxed">{value}</p></div>)}</div>
      {badge.photos.length>0 && <div className="mt-8 grid grid-cols-2 gap-4">{badge.photos.map((src,i)=><img key={src+i} src={src} alt={badge.title+" memory "+(i+1)} loading="lazy" className="w-full h-auto" />)}</div>}
      {badge.project && <p className="mt-8 text-sm text-paper/60">RELATED PROJECT / {badge.project}</p>}
    </article>
  </DialogSurface>;
}
export function Collection() {
  const { collection } = useCms();
  const [openId,setOpenId]=useState<string|null>(null);
  const openBadge=collection.find(b=>b.id===openId);
  return <section id="collection" className="mx-auto max-w-7xl px-6 py-24 md:px-10" aria-label="The collection">
    <TextReveal as="p" className="eyebrow text-create">03 / OBJECTS WITH A STORY</TextReveal>
    <TextReveal as="h2" className="mt-4 font-display text-4xl md:text-6xl tracking-tight">Collected along the way.</TextReveal>
    <p className="mt-5 text-paper/60 max-w-xl">Passes, badges, and the memories attached. Drag sideways to turn one over, or use the flip button.</p>
    <div className="mt-14 grid grid-cols-1 min-[400px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-10">{collection.map(b=><Badge3D key={b.id} badge={b} onOpen={()=>setOpenId(b.id)} />)}</div>
    {collection.length===0 && <p className="mt-10 text-paper/50">The collection is being put together.</p>}
    {openBadge && <BadgeStory badge={openBadge} onClose={()=>setOpenId(null)} />}
  </section>;
}
