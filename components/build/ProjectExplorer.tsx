"use client";
import { useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import type { Project } from "@/data/projects";
import { TextReveal } from "@/components/shared/TextReveal";
import { DialogSurface } from "@/components/shared/DialogSurface";
import { useCms } from "@/components/cms/CmsGate";
import { ExpandingImage, imageOrigin, type ImageOrigin } from "@/components/shared/ExpandingImage";
export type { Project as PublicProject };
const imagesFor = (project: Project) => [...new Set([project.image, ...project.gallery].filter(Boolean))];

export function ProjectExplorer() {
  const { projects } = useCms();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [frame, setFrame] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [origin, setOrigin] = useState<ImageOrigin>();
  const [openFrame, setOpenFrame] = useState(0);
  const active = projects.find(p => p.id === activeId) ?? projects[0];
  const opened = projects.find(p => p.id === openId);
  const images = active ? imagesFor(active) : [];
  const reduced = useReducedMotion();
  const select = (id: string) => { if (id !== activeId) { setActiveId(id); setFrame(0); } };
  const open = (id: string) => {
    setOrigin(id === active?.id ? imageOrigin(previewRef.current?.querySelector("img") ?? null) : undefined);
    setOpenFrame(id === active?.id ? frame : 0);
    select(id); setOpenId(id);
  };
  return <LayoutGroup id="projects"><section id="projects" className="mx-auto max-w-7xl px-6 py-20 md:px-10" aria-label="Projects">
    <TextReveal as="p" className="eyebrow text-build">01 / SELECTED WORK</TextReveal>
    <TextReveal as="h2" className="mt-4 mb-12 font-display text-4xl md:text-6xl tracking-tight">Ideas made tangible.</TextReveal>
    {active ? <div className="project-layout">
      <div>{projects.map(p => <ProjectRow key={p.id} project={p} expanded={active.id === p.id}
        onHover={v => { if (v) select(p.id); }} onOpen={() => open(p.id)} />)}</div>
      <div className="project-preview">
        <div ref={previewRef} className="project-preview-media" onPointerMove={e => {
          if (e.pointerType !== "mouse" || images.length < 2) return;
          const r = e.currentTarget.getBoundingClientRect();
          setFrame(Math.min(images.length - 1, Math.max(0, Math.floor((e.clientX - r.left) / r.width * images.length))));
        }}>
          <AnimatePresence mode="wait" initial={false}>
            {images.length ? <motion.img key={active.id + frame} src={images[frame] ?? images[0]} alt={active.title + " preview"}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : .15 }} />
              : <motion.span key={active.id} className="project-preview-number" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{active.index}</motion.span>}
          </AnimatePresence>
        </div>
        {images.length > 1 && <div className="preview-scrubber" aria-label="Project preview images">{images.map((_, i) =>
          <button key={i} aria-label={`View screenshot ${i + 1}`} aria-pressed={frame === i} onClick={() => setFrame(i)} />)}</div>}
        <div className="project-preview-caption"><p>{active.tagline}</p><button onClick={() => open(active.id)}>EXPLORE PROJECT ↗</button>
          {images.length > 1 && <p className="mt-3 !text-xs">Move across the image or choose a frame above.</p>}</div>
      </div>
    </div> : <p className="text-paper/60">Projects will appear here as they are published.</p>}
    {opened && <ProjectModalView project={opened} origin={origin} initialFrame={openFrame} onClose={() => setOpenId(null)} />}
  </section></LayoutGroup>;
}
export function ProjectRow({ project, expanded, onHover, onOpen }: {
  project: Project; expanded: boolean; onHover: (v: boolean) => void; onOpen: () => void;
}) {
  return <button type="button" onMouseEnter={() => onHover(true)} onFocus={() => onHover(true)} onClick={onOpen}
    className="project-row" data-active={expanded} data-cursor="view" aria-haspopup="dialog">
    <span className="project-row-number">{project.index}</span>
    <span className="project-row-copy"><span className="project-row-title">{project.title}</span>
      <span className="project-row-meta">{project.category} · {project.year}</span>
      {expanded && <span className="project-row-desc">{project.tagline}</span>}</span><span aria-hidden="true">↗</span>
  </button>;
}
export function ProjectModalView({ project, onClose, origin, initialFrame = 0 }: { project: Project; onClose: () => void; origin?: ImageOrigin; initialFrame?: number }) {
  const images = imagesFor(project);
  const [frame, setFrame] = useState(Math.min(initialFrame, Math.max(0, images.length - 1)));
  const [openingOrigin, setOpeningOrigin] = useState(origin);
  const reduced = useReducedMotion();
  return <DialogSurface label={project.title} onClose={onClose}>
    <motion.article className="project-case" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: reduced ? 0 : .15 }}>
      <button className="case-close" onClick={onClose} aria-label="Close project">CLOSE ×</button>
      <p className="eyebrow text-build">{project.index} / {project.category} / {project.year}</p>
      <h2 className="mt-4 font-display text-3xl md:text-6xl tracking-tight">{project.title}</h2>
      {project.description && <p className="mt-5 max-w-2xl text-paper/70 leading-relaxed">{project.description}</p>}
      {images.length > 0 && <div><ExpandingImage key={frame} src={images[frame]} alt={project.title + " screenshot " + (frame + 1)} className="case-hero" origin={openingOrigin} />
        {images.length > 1 && <div className="preview-scrubber">{images.map((_, i) => <button key={i} onClick={() => { setOpeningOrigin(undefined); setFrame(i); }} aria-label={`Screenshot ${i + 1}`} aria-pressed={frame === i} />)}</div>}</div>}
      <div className="mt-10 grid gap-8 md:grid-cols-2">{[["THE PROBLEM", project.problem], ["THE APPROACH", project.solution]].map(([label, value]) =>
        value && <div key={label}><h3 className="eyebrow text-build mb-3">{label}</h3><p className="text-paper/80 leading-relaxed">{value}</p></div>)}</div>
      {project.technologies.length > 0 && <div className="mt-10"><h3 className="eyebrow text-paper/50">BUILT WITH</h3><div className="mt-4 flex flex-wrap gap-2">{project.technologies.map(t => <span key={t} className="border border-white/20 px-3 py-2 text-sm">{t}</span>)}</div></div>}
      <div className="mt-10 flex flex-wrap gap-4">
        {project.demo && <a href={project.demo} target="_blank" rel="noreferrer" className="bg-build px-5 py-3 text-sm text-ink">TRY THE PROJECT ↗</a>}
        {project.github && <a href={project.github} target="_blank" rel="noreferrer" className="border border-white/20 px-5 py-3 text-sm">VIEW SOURCE ↗</a>}
      </div>
    </motion.article>
  </DialogSurface>;
}
