"use client";

import { useCountUp } from "@/components/shared/useCountUp";
import { GlassPanel } from "@/components/shared/GlassPanel";
import { TextReveal } from "@/components/shared/TextReveal";
import { useCms } from "@/components/cms/CmsGate";
import type { Metric } from "@/data/telemetry";

function MetricRow({ m }: { m: Metric }) {
  const { ref, value } = useCountUp(m.value);
  return (
    <div className="flex items-baseline justify-between border-b border-white/5 py-4 last:border-0">
      <span className="text-[0.6rem] tracking-[0.3em] text-paper/50">{m.label}</span>
      <span className="font-display text-2xl text-paper md:text-3xl">
        {m.prefix ?? ""}
        <span ref={ref}>{value}</span>
        {m.suffix ?? ""}
      </span>
    </div>
  );
}

/**
 * "SYSTEM STATUS" telemetry — a racing-style stat panel.
 * Numbers animate on viewport entry via useCountUp.
 */
export function Telemetry() {
  const { statistics } = useCms();
  return (
    <section
      id="telemetry"
      className="relative mx-auto w-full max-w-6xl px-6 py-24 md:px-10"
      aria-label="Telemetry statistics"
    >
      <div className="mb-12 flex items-center gap-3">
        <span className="h-2 w-2 rounded-full bg-build shadow-[0_0_12px_#3ddc84]" />
        <TextReveal as="h2" className="font-display text-xs tracking-[0.4em] text-paper/80">
          SYSTEM STATUS
        </TextReveal>
      </div>

      <div className="flex flex-col gap-8 md:flex-row md:gap-12">
        <div className="flex-1">
          <TextReveal as="h3" className="mb-1 font-display text-2xl tracking-[0.2em] md:text-4xl">
            CURRENT SIGNAL
          </TextReveal>
          <TextReveal as="p" delay={0.1} className="text-sm text-paper/60">
            Live view of the signal I&apos;m operating on.
          </TextReveal>
        </div>
        <GlassPanel tone="build" className="flex-1 px-6 py-2">
          {statistics.map((m) => (
            <MetricRow key={m.id} m={m} />
          ))}
        </GlassPanel>
      </div>
    </section>
  );
}
