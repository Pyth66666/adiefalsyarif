"use client";
import Link from "next/link";
import { TextReveal } from "@/components/shared/TextReveal";

export function Lab() {
  return <section id="lab" className="mx-auto max-w-7xl px-6 py-24 md:px-10" aria-label="Pocket Orbit arcade">
    <TextReveal as="p" className="eyebrow text-build mb-6">SIDE QUEST / THE LAB</TextReveal>
    <div className="lab-panel arcade-teaser"><div><p className="eyebrow text-paper/40">INCOMING TRANSMISSION</p>
      <h2 className="font-display text-4xl tracking-tight mt-5">The signal is out there.</h2>
      <p className="mt-5 text-paper/60 leading-relaxed">Take a detour. Pilot a tiny ship through an asteroid field, collect lost signals, and see how long you can stay in orbit.</p>
      <Link href="/play" className="arcade-launch" data-cursor="enter">LAUNCH POCKET ORBIT <span>↗</span></Link>
      <p className="mt-5 text-xs text-paper/40">PLAYABLE ARCADE / KEYBOARD + TOUCH / NO DOWNLOAD</p>
    </div><Link href="/play" className="mini-console" aria-label="Play Space Dodger"><span className="mini-screen"><span>SPACE DODGER</span><b>✦<br/>· &nbsp; ◇ &nbsp; ·<br/>▲</b><span>PRESS START</span></span><span className="mini-controls" aria-hidden="true">✚ <span>● ●</span></span><span className="mini-brand">pocket orbit / 01</span></Link></div>
  </section>;
}
