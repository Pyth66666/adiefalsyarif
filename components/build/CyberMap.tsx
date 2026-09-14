"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { TextReveal } from "@/components/shared/TextReveal";
import { useCms } from "@/components/cms/CmsGate";
import { ProjectModalView } from "./ProjectExplorer";

const topics = [
  { id: "security", label: "SECURITY", terms: ["security", "cyber", "ctf", "crypto"], description: "Security projects, challenges, and the decisions behind them.", x: 140, y: 85 },
  { id: "web", label: "WEB", terms: ["web", "react", "next", "frontend", "fullstack", "full-stack"], description: "Interfaces and systems built for the web.", x: 400, y: 85 },
  { id: "ai", label: "AI", terms: ["ai", "machine learning", "llm"], description: "Experiments that turn models and data into useful tools.", x: 430, y: 260 },
  { id: "engineering", label: "ENGINEERING", terms: ["engineering", "system", "network", "tool", "python", "iot"], description: "The systems, tools, and infrastructure behind the work.", x: 110, y: 260 },
];

export function CyberMap() {
  const { projects } = useCms();
  const [selected, setSelected] = useState("security");
  const [openId, setOpenId] = useState<string | null>(null);
  const reduced = useReducedMotion();
  const topic = topics.find(t => t.id === selected)!;
  const related = projects.filter(p => {
    const words = [p.title, p.category, ...p.technologies].join(" ").toLowerCase().split(/[^a-z0-9-]+/);
    return topic.terms.some(term => term.includes(" ") ? words.join(" ").includes(term) : words.includes(term));
  });
  const opened = projects.find(p => p.id === openId);

  return <section id="cybermap" className="mx-auto max-w-7xl px-6 py-24 md:px-10" aria-label="Explore work by discipline">
    <TextReveal as="p" className="eyebrow text-build">02 / CONNECT THE DOTS</TextReveal>
    <TextReveal as="h2" className="mt-4 mb-10 font-display text-4xl md:text-6xl tracking-tight">Follow a thread.</TextReveal>
    <div className="cyber-layout">
      <svg viewBox="0 0 540 340" className="w-full" role="group" aria-label="Connected disciplines">
        {topics.map(t => <g key={t.id} role="button" tabIndex={0} aria-label={`Explore ${t.label}`} aria-pressed={selected === t.id}
          onClick={() => setSelected(t.id)} className="cursor-pointer"
          onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(t.id); } }}>
          <line x1="270" y1="170" x2={t.x} y2={t.y} stroke={selected === t.id ? "#3ddc84" : "#ffffff"} strokeOpacity={selected === t.id ? .8 : .12} />
          <circle cx={t.x} cy={t.y} r={selected === t.id ? 31 : 25} fill={selected === t.id ? "#193b2a" : "#151b18"} stroke={selected === t.id ? "#3ddc84" : "#47564d"} />
          <text x={t.x} y={t.y + 50} textAnchor="middle" fill={selected === t.id ? "#3ddc84" : "#b0b9b2"} fontSize="13" letterSpacing="1">{t.label}</text>
        </g>)}
        <circle cx="270" cy="170" r="43" fill="#15271c" stroke="#3ddc84" />
        <text x="270" y="175" fill="#eceae6" textAnchor="middle" fontSize="14" letterSpacing="2">BUILD</text>
      </svg>
      <div>
        <div className="cyber-topics" role="group" aria-label="Disciplines">
          {topics.map(t => <button key={t.id} aria-pressed={selected === t.id} onClick={() => setSelected(t.id)}>{t.label}</button>)}
        </div>
        <motion.div key={selected} initial={{ opacity: 0, y: reduced ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .2 }}>
          <h3 className="font-display text-2xl">{topic.label}</h3>
          <p className="mt-3 text-paper/60 leading-relaxed">{topic.description}</p>
          <p className="eyebrow mt-6 text-build">{related.length} RELATED {related.length === 1 ? "PROJECT" : "PROJECTS"}</p>
          {related.length ? <div className="mt-4">{related.map(p => <button key={p.id} className="w-full border-t border-white/15 py-4 text-left flex justify-between gap-4" onClick={() => setOpenId(p.id)} aria-haspopup="dialog">
            <span>{p.title}</span><span className="text-build">↗</span>
          </button>)}</div> : <p className="mt-4 text-sm text-paper/50">No published projects in this thread yet. Explore another discipline.</p>}
        </motion.div>
      </div>
    </div>
    {opened && <ProjectModalView project={opened} onClose={() => setOpenId(null)} />}
  </section>;
}
