"use client";

import { useState } from "react";
import { ProjectRow, ProjectModalView } from "@/components/build/ProjectExplorer";
import type { Project } from "@/data/projects";

/**
 * LIVE preview that reuses the real public project components.
 * Renders the current form values exactly as the public BUILD page will.
 */
export function PreviewProject() {
  const [open, setOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [project, setProject] = useState<Project | null>(null);

  const gather = (): Project => {
    const form = document.querySelector("form");
    const f = form ? new FormData(form) : new FormData();
    const g = (k: string) => ((f.get(k) as string | null)?.trim() ?? "");
    const tech = (f.getAll("technologies") as string[]).filter(Boolean);
    return {
      id: "preview",
      index: "01",
      title: g("title") || "[PROJECT NAME]",
      tagline: g("tagline") || "[SHORT DESCRIPTION]",
      category: g("category") || "[CATEGORY]",
      year: g("year") || "[YEAR]",
      description: g("description"),
      problem: g("problem") || "[PROBLEM]",
      solution: g("solution") || "[SOLUTION]",
      technologies: tech,
      image: g("hero_image"),
      gallery: [],
      github: g("github"),
      demo: g("demo"),
      accent: "build",
    };
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setProject(gather());
          setOpen(true);
          setShowModal(false);
        }}
        className="rounded border border-white/20 px-5 py-2 text-[0.65rem] tracking-[0.2em] text-zinc-300 hover:border-build/60 hover:text-white"
      >
        PREVIEW
      </button>

      {open && project && (
        <div className="fixed inset-0 z-[900] overflow-y-auto bg-[#050505] px-6 py-12 md:px-16">
          <div className="mx-auto max-w-6xl">
            <div className="mb-8 flex items-center justify-between">
              <p className="text-[0.6rem] uppercase tracking-[0.3em] text-zinc-500">
                PREVIEW — as shown on the public BUILD page · click the row to open the full view
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded border border-white/15 px-4 py-2 text-[0.6rem] tracking-[0.2em] text-zinc-300 hover:border-white/40"
              >
                CLOSE
              </button>
            </div>
            <ProjectRow project={project} expanded onHover={() => {}} onOpen={() => setShowModal(true)} />
          </div>
        </div>
      )}

      {showModal && project && (
        <ProjectModalView project={project} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}