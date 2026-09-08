"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { EventItem } from "@/data/events";
import { TextReveal } from "@/components/shared/TextReveal";
import { useCms } from "@/components/cms/CmsGate";

interface TimeLeft {
  d: string;
  h: string;
  m: string;
  s: string;
}

function useCountdown(date: string | undefined): TimeLeft | null {
  const [left, setLeft] = useState<TimeLeft | null>(null);

  useEffect(() => {
    if (!date) return;
    const target = new Date(date).getTime();
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) {
        setLeft({ d: "00", h: "00", m: "00", s: "00" });
        return;
      }
      const s = Math.floor(diff / 1000);
      setLeft({
        d: String(Math.floor(s / 86400)).padStart(2, "0"),
        h: String(Math.floor((s % 86400) / 3600)).padStart(2, "0"),
        m: String(Math.floor((s % 3600) / 60)).padStart(2, "0"),
        s: String(s % 60).padStart(2, "0"),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [date]);

  return left;
}

function EventRow({ event }: { event: EventItem }) {
  const [open, setOpen] = useState(false);
  const countdown = useCountdown(event.date);
  const completed = event.status === "completed";
  const passed = !completed && event.date && new Date(event.date).getTime() < Date.now();
  const displayStatus: "COMPLETED" | "UPCOMING" | "PASSED" = completed
    ? "COMPLETED"
    : passed
      ? "PASSED"
      : "UPCOMING";

  return (
    <motion.div
      className="group relative border-l border-white/10 pl-8 md:pl-12"
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* node */}
      <span
        className={`absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full ${
          completed ? "bg-build shadow-[0_0_10px_#3ddc84]" : passed ? "bg-zinc-600" : "border border-create bg-transparent"
        }`}
      />
      {/* date label */}
      <p className="font-display text-xs tracking-[0.4em] text-paper/50">
        {event.year}
        <span className="ml-3 text-paper/30">{completed ? "●" : "○"}</span>
      </p>

      <h3 className="mt-2 font-display text-2xl text-paper md:text-3xl">{event.name}</h3>
      <p className="mt-1 text-sm text-paper/60">{event.org}</p>

      {event.project && (
        <p className="mt-2 text-xs tracking-[0.2em] text-paper/40">
          PROJECT: {event.project}
        </p>
      )}

      <p
        className={`mt-2 inline-block text-[0.6rem] tracking-[0.35em] ${
          completed ? "text-build" : passed ? "text-paper/40" : "text-create"
        }`}
      >
        STATUS: {displayStatus}
      </p>

      {!passed && !completed && countdown && event.date && (
        <div className="mt-4 grid w-fit grid-cols-4 gap-2 text-center">
          {[
            ["DAYS", countdown.d],
            ["HRS", countdown.h],
            ["MIN", countdown.m],
            ["SEC", countdown.s],
          ].map(([label, val]) => (
            <div key={label} className="rounded-lg border border-white/10 px-3 py-2">
              <p className="font-display text-lg text-paper">{val}</p>
              <p className="text-[0.5rem] tracking-[0.25em] text-paper/40">{label}</p>
            </div>
          ))}
        </div>
      )}

      {completed && event.story && (
        <div className="mt-2">
          <button
            onClick={() => setOpen(!open)}
            data-cursor="view"
            className="text-[0.6rem] tracking-[0.3em] text-paper/50 underline-offset-4 hover:underline"
            aria-expanded={open}
          >
            {open ? "COLLAPSE STORY" : "READ STORY →"}
          </button>
          {open && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mt-3 max-w-xl text-sm text-paper/70"
            >
              {event.story}
            </motion.p>
          )}
        </div>
      )}
    </motion.div>
  );
}

/**
 * Mission log — a racing-calendar inspired timeline.
 */
export function EventTimeline() {
  const { events } = useCms();
  return (
    <section
      id="timeline"
      className="relative mx-auto w-full max-w-6xl px-6 py-24 md:px-10"
      aria-label="Timeline"
    >
      <TextReveal as="h2" className="mb-2 font-display text-xs tracking-[0.4em] text-paper/80">
        PATH / MISSION LOG
      </TextReveal>
      <TextReveal as="h3" delay={0.05} className="mb-14 font-display text-3xl tracking-[0.1em] md:text-5xl">
        THE ROAD SO FAR
      </TextReveal>

      <div className="flex flex-col gap-12">
        {events.map((e) => (
          <EventRow key={e.id} event={e} />
        ))}
      </div>
    </section>
  );
}