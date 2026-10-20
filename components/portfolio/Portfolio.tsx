"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { MotionConfig, useReducedMotion } from "framer-motion";
import { useCms } from "@/components/cms/CmsGate";
import { DialogSurface } from "@/components/shared/DialogSurface";
import { ProjectModalView } from "@/components/build/ProjectExplorer";
import { PhotoGallery } from "@/components/create/PhotoGallery";
import { Collection } from "@/components/collection/Collection";
import { workbench } from "@/data/workbench";
import type { Project } from "@/data/projects";

const Orbit = dynamic(() => import("@/components/three/StudioOrbit"), { ssr: false, loading: () => <p className="orbit-loading" role="status">Opening the orbit…</p> });
const links = [["Work", "#work"], ["Visuals", "#create"], ["About", "#about"], ["Contact", "#contact"]];

export function Portfolio() {
  const { site, projects, photos, collection, socials, profile } = useCms();
  const [menu, setMenu] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [category, setCategory] = useState("All work");
  const [interactive, setInteractive] = useState(false);
  const [current, setCurrent] = useState("#top");
  const reduced = useReducedMotion();
  const published = projects.filter(p => p.title && !p.title.includes("["));
  const selected = published.length ? published : workbench;
  const shown = category === "All work" ? selected : selected.filter(p => category === "Experiments" ? p.accent === "create" : p.accent === "build");
  const realPhotos = photos.filter(p => p.src);
  const realSocials = socials.filter(s => /^https?:\/\//.test(s.url));
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) setCurrent("#" + entry.target.id);
    }, { rootMargin: "-15% 0px -65% 0px" });
    document.querySelectorAll(".studio > section[id], .studio > footer[id]").forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);
  return <MotionConfig reducedMotion="user"><main className="studio" id="top">
    <a className="studio-skip" href="#work">Skip to selected work</a>
    <header className="studio-nav">
      <a href="#top" className="studio-logo" aria-label="Adief, home">adief<span aria-hidden="true">✳</span></a>
      <nav aria-label="Main navigation" className="studio-desktop-nav">{links.map(([name, href]) => <a key={href} href={href} aria-current={current === href ? "location" : undefined}>{name}</a>)}</nav>
      <a className="studio-nav-contact" href="#contact">Let’s talk <span aria-hidden="true">↗</span></a>
      <button className="studio-menu-toggle" onClick={() => setMenu(true)} aria-expanded={menu} aria-label="Open navigation">Menu <span aria-hidden="true">＋</span></button>
    </header>
    {menu && <DialogSurface label="Navigation" onClose={() => setMenu(false)} className="studio-menu"><button onClick={() => setMenu(false)} className="studio-menu-close">Close ×</button><nav aria-label="Mobile navigation">{links.map(([name, href], i) => <a href={href} key={href} onClick={() => setMenu(false)}><small>0{i + 1}</small>{name} ↗</a>)}</nav></DialogSurface>}

    <section className="studio-hero" aria-labelledby="hero-title">
      <div className="studio-hero-meta"><span><i /> A PERSONAL EXPLORATION</span><span>CODE · CURIOSITY · CAMERA</span></div>
      <div className="studio-hero-grid">
        <div className="studio-hero-copy"><p className="studio-kicker">HELLO, I’M {site.name}.</p><h1 id="hero-title">A builder’s mind.<br /><em>A creator’s eye.</em></h1><p className="studio-intro">{site.intro}</p><div className="studio-hero-actions"><a href="#work" className="studio-button">Explore my work <span aria-hidden="true">↗</span></a><a href="#about" className="studio-text-link">A little about me <span aria-hidden="true">↓</span></a></div><p className="studio-hero-signature">{site.fullName} <span>PORTFOLIO / 2026</span></p></div>
        <div className="studio-art"><span className="studio-art-cross" aria-hidden="true">＋</span>{interactive ? <Orbit reduced={Boolean(reduced)} /> : <Image src="/art/orbit-studio.webp" alt="Conceptual titanium orbital sculpture surrounding a glowing amber core" fill priority sizes="(max-width: 760px) 100vw, 55vw" quality={85} />}
          <div className="studio-art-caption"><span>FIG. 01 — BETWEEN TWO WORLDS</span><button onClick={() => setInteractive(!interactive)} aria-pressed={interactive}>{interactive ? "Still artwork ↗" : "Explore in 3D ↗"}</button></div>
        </div>
      </div>
      <div className="studio-discipline-strip"><span>Computer science</span><span aria-hidden="true">✳</span><span>Cybersecurity</span><span aria-hidden="true">✳</span><span>Creative technology</span><span aria-hidden="true">✳</span><span>Photography</span><Link href="/experience">Enter the universe ↗</Link></div>
    </section>

    <section id="work" className="studio-work" aria-labelledby="work-title"><div className="studio-section-heading"><div><p className="studio-kicker">01 / THE WORKBENCH</p><h2 id="work-title">Ideas, taking shape<span>.</span></h2></div><p>Tools I’m building. Questions I’m exploring.<br />A few things made along the way.</p></div>
      <div className="studio-work-toolbar"><div role="group" aria-label="Filter projects">{["All work", "Tools & systems", "Experiments"].map(label => <button key={label} aria-pressed={category === label} onClick={() => setCategory(label)}>{label}</button>)}</div><span aria-live="polite">{String(shown.length).padStart(2, "0")} PROJECTS</span></div>
      <div className="studio-projects">{shown.map((p, i) => <button key={p.id} className={`studio-project studio-project-${p.id}`} onClick={() => setProject(p)} aria-haspopup="dialog" aria-label={`Explore ${p.title}`}><div className="studio-project-art">{p.image ? <img src={p.image} alt="" loading="lazy" decoding="async" /> : <ProjectArt id={p.id} title={p.title} />}<span className="studio-project-arrow" aria-hidden="true">↗</span></div><div className="studio-project-info"><div><p>{p.category}</p><h3>{p.title}</h3></div><span>{String(i + 1).padStart(2, "0")}</span></div><p className="studio-project-description">{p.tagline}</p></button>)}</div>
      {!shown.length && <p className="studio-empty">Nothing in this filter yet. Choose All work to explore the collection.</p>}
    </section>

    <section id="create" className="studio-create" aria-labelledby="create-title"><div className="studio-create-copy"><p className="studio-kicker">02 / THE OTHER SIDE</p><h2 id="create-title">Sometimes,<br />I think in <em>images.</em></h2><p>Photography, atmosphere, and the small details that make you look twice. This is where the technical gives way to the visual.</p><a href={realPhotos.length ? "#gallery" : "/experience"} className="studio-text-link">{realPhotos.length ? "Explore the photographs" : "Explore the visual universe"} ↗</a></div><figure><Image src={realPhotos[0]?.src || "/space/mars-curiosity.jpg"} alt={realPhotos[0]?.title || "Layered Martian terrain photographed by NASA’s Curiosity rover"} width={1200} height={800} sizes="(max-width: 760px) 100vw, 50vw" unoptimized={Boolean(realPhotos[0])} /><figcaption>{realPhotos[0] ? realPhotos[0].title : <>VISUAL INSPIRATION / MARS <a href="https://www.jpl.nasa.gov/images/pia19839-strata-at-base-of-mount-sharp/" target="_blank" rel="noreferrer">NASA/JPL-Caltech/MSSS ↗</a></>}</figcaption></figure></section>
    {realPhotos.length > 0 && <PhotoGallery />}
    {collection.some(c => c.frontImage && !c.title.includes("[")) && <Collection />}

    <section id="about" className="studio-about" aria-labelledby="about-title"><div><p className="studio-kicker">03 / BEHIND THE WORK</p><h2 id="about-title">Curiosity is<br />the common thread<span>.</span></h2><p className="studio-about-name">{site.fullName}<br /><span>COMPUTER SCIENCE STUDENT</span></p>{profile?.resume_url && <a className="studio-text-link" href={profile.resume_url} target="_blank" rel="noreferrer">View résumé ↗</a>}</div><div className="studio-about-body"><p>{site.about}</p><p>My work moves between useful software, security, and visual storytelling. I’m interested in tools that make complicated things easier to understand—and experiences that leave room for exploration.</p><div className="studio-practices">{[["01", "Building", "Local tools, web experiences, and systems."], ["02", "Exploring", "Cybersecurity, computer science, and new ideas."], ["03", "Creating", "Photography, design, and visual experiments."]].map(([n, title, desc]) => <div key={n}><span>{n}</span><h3>{title}</h3><p>{desc}</p></div>)}</div></div></section>

    <section id="lab" className="studio-lab"><p className="studio-kicker">A SMALL DETOUR</p><div><h2>All work. <em>A little play.</em></h2><Link href="/play" className="studio-button">Play Pocket Orbit <span aria-hidden="true">↗</span></Link></div><p>A tiny ship, an asteroid field, and one more try. Keyboard and touch friendly.</p></section>
    <footer id="contact" className="studio-footer"><p className="studio-kicker">04 / WHAT’S NEXT?</p><h2>Good things start<br />with <em>a conversation.</em></h2>{site.contactEmail ? <a className="studio-email" href={`mailto:${site.contactEmail}`}>{site.contactEmail} ↗</a> : <p className="studio-contact-note">A place for future collaborations, creative ideas, and interesting problems.<br />Direct contact details will be added here soon.</p>}<div className="studio-footer-links">{realSocials.map(s => <a key={s.id} href={s.url} target="_blank" rel="noreferrer">{s.label} ↗</a>)}<a href="#top">Back to top ↑</a></div><div className="studio-footer-bottom"><a href="#top" className="studio-logo">adief<span aria-hidden="true">✳</span></a><span>© {new Date().getFullYear()} {site.fullName}</span><span>BUILT WITH CURIOSITY.</span></div></footer>
    {project && <ProjectModalView project={project} onClose={() => setProject(null)} />}
  </main></MotionConfig>;
}

function ProjectArt({ id, title }: { id: string; title: string }) {
  if (id === "second-brain") return <div className="brain-art" aria-hidden="true"><div className="brain-paper back"><span>COLLECT / CONNECT</span></div><div className="brain-paper"><span>KNOWLEDGE CAPTURE</span><b>Make room<br />for the next idea.</b><div className="brain-lines"/><small>LOCAL FIRST · A WORK IN PROGRESS</small></div><span className="brain-spark">✳</span></div>;
  if (id === "netbeans-bridge") return <div className="bridge-art" aria-hidden="true"><div className="bridge-title">Human intent.<br /><span>Local action.</span></div><div className="bridge-nodes"><span>AI</span><i>↔</i><span>IDE</span></div><small>NETBEANS / MCP BRIDGE</small></div>;
  if (id === "pocket-orbit") return <div className="pocket-art" aria-hidden="true"><span className="pocket-orbit-ring"/><span className="pocket-ship">▲</span><span className="pocket-star">✦</span><b>POCKET<br />ORBIT</b><small>A PLAYABLE SIDE QUEST</small></div>;
  return <div className="generic-project-art" aria-hidden="true"><span>EXPLORATION / 2026</span><b>{title}</b><i>↗</i></div>;
}
