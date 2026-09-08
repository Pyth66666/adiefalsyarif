"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useCountUp } from "@/components/shared/useCountUp";
import { TextReveal } from "@/components/shared/TextReveal";
import { useCms } from "@/components/cms/CmsGate";
import type { Metric } from "@/data/telemetry";

/**
 * Cursor-reactive particle network on canvas — HackDev's members as a
 * living graph. Nodes drift and link lines form; the cursor attracts them.
 */
function NodeNetwork() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let w = (canvas.width = canvas.offsetWidth);
    let h = (canvas.height = canvas.offsetHeight);
    const count = 90;
    const nodes = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
    }));
    const mouse = { x: -9999, y: -9999 };
    let raf = 0;

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    };
    const onLeave = () => {
      mouse.x = mouse.y = -9999;
    };

    const draw = () => {
      // Link lines between close nodes
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1;
      for (let i = 0; i < count; i++) {
        const a = nodes[i];
        // drift
        a.x += a.vx;
        a.y += a.vy;
        if (a.x < 0 || a.x > w) a.vx *= -1;
        if (a.y < 0 || a.y > h) a.vy *= -1;
        // mouse attraction
        a.x += (mouse.x - a.x) * 0.004;
        a.y += (mouse.y - a.y) * 0.004;
        for (let j = i + 1; j < count; j++) {
          const b = nodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 120 * 120) {
            const alpha = 0.25 * (1 - Math.sqrt(d2) / 120);
            const nearMouse = d2 < 20000;
            ctx.strokeStyle = nearMouse
              ? `rgba(61,220,132,${alpha + 0.3})`
              : `rgba(154,160,171,${alpha})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
        ctx.fillStyle = "rgba(61,220,132,0.5)";
        ctx.beginPath();
        ctx.arc(a.x, a.y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };

    if (!reduced) {
      raf = requestAnimationFrame(draw);
      window.addEventListener("pointermove", onMove, { passive: true });
      canvas.addEventListener("pointerleave", onLeave);
    } else {
      // static draw once
      for (let i = 0; i < count; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < count; j++) {
          const b = nodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 120 * 120) {
            ctx.strokeStyle = `rgba(154,160,171,${0.2 * (1 - Math.sqrt(d2) / 120)})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
        ctx.fillStyle = "rgba(61,220,132,0.5)";
        ctx.beginPath();
        ctx.arc(a.x, a.y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    const onResize = () => {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="h-full min-h-[320px] w-full" />;
}

function CommunityMetric({ m }: { m: Metric }) {
  const { ref, value } = useCountUp(m.value);
  return (
    <div className="text-center">
      <p className="font-display text-3xl text-paper">
        <span ref={ref}>{value}</span>
        {m.suffix ?? ""}
      </p>
      <p className="mt-1 text-[0.6rem] tracking-[0.3em] text-paper/50">{m.label}</p>
    </div>
  );
}

/**
 * HackDev community: a living network + stats + CTA.
 */
export function HackDev() {
  const { community, hackdev } = useCms();
  const hackdevUrl = hackdev.websiteUrl || hackdev.discordUrl;
  return (
    <section
      id="hackdev"
      className="relative mx-auto w-full max-w-6xl px-6 py-24 md:px-10"
      aria-label="HackDev community"
    >
      <div className="overflow-hidden rounded-2xl border border-white/8 bg-graphite/30">
        <div className="p-8 md:p-12">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <TextReveal as="h2" className="font-display text-4xl tracking-[0.15em] text-build md:text-6xl">
                {hackdev.name}
              </TextReveal>
              <TextReveal as="p" delay={0.1} className="mt-3 max-w-md text-sm text-paper/60">
                {hackdev.description}
              </TextReveal>
            </div>
            <div className="flex gap-8">
              {community.map((m) => (
                <CommunityMetric key={m.id} m={m} />
              ))}
            </div>
          </div>
        </div>
        <NodeNetwork />
        <div className="flex justify-center py-10">
          <motion.a
            href={hackdevUrl || "#hackdev"}
            onClick={(e) => {
              if (!hackdevUrl) e.preventDefault();
            }}
            target={hackdevUrl ? "_blank" : undefined}
            rel="noreferrer"
            data-cursor="enter"
            className="rounded-full border border-build/40 px-8 py-3 font-display text-xs tracking-[0.3em] text-paper transition-colors hover:bg-build/10 hover:border-build"
          >
            ENTER HACKDEV
          </motion.a>
        </div>
        {!hackdevUrl && (
          <p className="-mt-6 pb-8 text-center text-[0.6rem] tracking-[0.2em] text-paper/40">
            [SET DISCORD / WEBSITE URL IN ADMIN → HACKDEV]
          </p>
        )}
      </div>
    </section>
  );
}