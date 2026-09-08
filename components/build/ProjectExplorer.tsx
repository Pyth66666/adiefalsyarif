"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Project } from "@/data/projects";
import { TextReveal } from "@/components/shared/TextReveal";
import { GlassPanel } from "@/components/shared/GlassPanel";
import { useCms } from "@/components/cms/CmsGate";

export type { Project as PublicProject };

/**
 * Projects as interactive case studies: each row expands on hover to reveal
 * more, and opens a full-screen experience on click.
 */
export function ProjectExplorer() {
  const { projects } = useCms();
  const [active, setActive] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const openProject = projects.find((p) => p.id === openId) ?? null;

  return (
    <section
      id="projects"
      className="relative mx-auto w-full max-w-6xl px-6 py-24 md:px-10"
      aria-label="Projects"
    >
      <TextReveal as="h2" className="mb-2 font-display text-xs tracking-[0.4em] text-paper/80">
        PROJECT EXPERIENCE
      </TextReveal>
      <TextReveal as="h3" delay={0.05} className="mb-12 font-display text-3xl tracking-[0.1em] md:text-5xl">
        EXPLORE THE WORK
      </TextReveal>

      <div className="flex flex-col gap-3">
        {projects.map((p) => (
          <ProjectRow
            key={p.id}
            project={p}
            expanded={active === p.id}
            onHover={(v) => setActive(v ? p.id : null)}
            onOpen={() => setOpenId(p.id)}
          />
        ))}
      </div>

      <AnimatePresence>
        {openProject && (
          <ProjectModal project={openProject} onClose={() => setOpenId(null)} />
        )}
      </AnimatePresence>
    </section>
  );
}

export function ProjectRow({
  project,
  expanded,
  onHover,
  onOpen,
}: {
  project: Project;
  expanded: boolean;
  onHover: (v: boolean) => void;
  onOpen: () => void;
}) {
  const hasImage = project.image.length > 0;
  return (
    <motion.button
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onClick={onOpen}
      data-cursor="view"
      className="group relative w-full overflow-hidden rounded-xl border border-white/8 bg-graphite/40 text-left transition-colors hover:border-white/20"
      animate={{ height: expanded ? "auto" : "5rem", padding: expanded ? "3rem 2rem" : "0 2rem" }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{ minHeight: "5rem", padding: "0 2rem" }}
      aria-haspopup="dialog"
    >
      <div className="flex flex-col gap-4">
        <span className="font-display text-xs tracking-[0.4em] text-build">{project.index}</span>
        <span className="font-display text-2xl md:text-4xl">{project.title}</span>
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.4 }}
              className="flex items-end justify-between gap-4"
            >
              <div className="max-w-xl text-sm text-paper/70">
                {project.category} · {project.year}
                <p className="mt-2 text-paper/50">{project.tagline}</p>
              </div>
              <span className="mb-1 hidden shrink-0 text-xs tracking-[0.3em] text-paper/40 md:block">
                {hasImage ? "" : ""}OPEN →
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.button>
  );
}

function ProjectModal({ project, onClose }: { project: Project; onClose: () => void }) {
  return <ProjectModalView project={project} onClose={onClose} />;
}

export function ProjectModalView({ project, onClose }: { project: Project; onClose: () => void }) {
  const hasGitHub = project.github.length > 0;
  const hasDemo = project.demo.length > 0;
  return (
    <motion.div
      className="fixed inset-0 z-[980] flex items-center justify-center bg-ink/90 p-4 backdrop-blur-md"
      style={{ cursor: "pointer" }}
      data-lenis-prevent
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={project.title}
    >
      <motion.div
        className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto"
        initial={{ scale: 0.9, y: 30, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, y: 20, opacity: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
      >
        <GlassPanel tone="build" className="p-6 md:p-10">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 font-display text-xs tracking-[0.3em] text-paper/60 hover:text-paper"
            aria-label="Close"
          >
            ESC
          </button>
          <p className="font-display text-xs tracking-[0.4em] text-build">{project.index}</p>
          <h3 className="mt-2 font-display text-3xl md:text-5xl">{project.title}</h3>
          <p className="mt-1 text-sm text-paper/60">{project.category} · {project.year}</p>

          <div className="mt-8 grid gap-8 md:grid-cols-2">
            <div>
              <SectionLabel>PROBLEM</SectionLabel>
              <p className="text-sm text-paper/80">{project.problem}</p>
            </div>
            <div>
              <SectionLabel>SOLUTION</SectionLabel>
              <p className="text-sm text-paper/80">{project.solution}</p>
            </div>
          </div>

          <div className="mt-8">
            <SectionLabel>TECHNOLOGY</SectionLabel>
            <div className="mt-3 flex flex-wrap gap-2">
              {project.technologies.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-white/15 px-3 py-1 text-xs text-paper/80"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {hasDemo && (
              <a
                href={project.demo}
                target="_blank"
                rel="noreferrer"
                className="rounded-full bg-paper px-5 py-2 text-xs tracking-[0.2em] text-ink"
              >
                LIVE DEMO
              </a>
            )}
            {hasGitHub && (
              <a
                href={project.github}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-white/20 px-5 py-2 text-xs tracking-[0.2em] text-paper"
              >
                GITHUB
              </a>
            )}
          </div>

          {/* Placeholder notice when no links configured */}
          {!hasDemo && !hasGitHub && (
            <p className="mt-6 text-xs italic text-paper/40">
              [ADD DEMO / GITHUB LINKS IN data/projects.ts WHEN AVAILABLE]
            </p>
          )}
        </GlassPanel>
      </motion.div>
    </motion.div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h4 className="mb-2 text-[0.6rem] tracking-[0.35em] text-paper/50">{children}</h4>;
}
