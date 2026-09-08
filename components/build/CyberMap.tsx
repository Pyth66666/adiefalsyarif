"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { TextReveal } from "@/components/shared/TextReveal";

interface CyberNode {
  id: string;
  label: string;
  type: "ctf" | "security" | "research" | "tool";
  detail: string;
  x: number;
  y: number;
}

// Placeholder nodes — replace content in data/ as needed.
const seedNodes: Omit<CyberNode, "x" | "y">[] = [
  { id: "n1", label: "CTF", type: "ctf", detail: "[CTF related work / competitions]" },
  { id: "n2", label: "SECURITY", type: "security", detail: "[Security projects & findings]" },
  { id: "n3", label: "RESEARCH", type: "research", detail: "[Research notes & writeups]" },
  { id: "n4", label: "TOOLS", type: "tool", detail: "[Tools I build & maintain]" },
  { id: "n5", label: "NETWORKS", type: "research", detail: "[Network analysis & recon]" },
  { id: "n6", label: "CRYPTO", type: "ctf", detail: "[Crypto challenges & notes]" },
  { id: "n7", label: "WEB", type: "tool", detail: "[Web security tooling]" },
];

const typeColor: Record<CyberNode["type"], string> = {
  ctf: "#3ddc84",
  security: "#5aa9e6",
  research: "#9aa0ab",
  tool: "#b8c04a",
};

function layout(nodes: Omit<CyberNode, "x" | "y">[], w = 560, h = 420) {
  const base = 2 * Math.PI / nodes.length;
  return nodes.map((n, i) => {
    const angle = base * i - Math.PI / 2;
    const radius = Math.min(w, h) * 0.34;
    const jitter = (Math.sin(i * 7.13) * 0.5 + 0.5) * 0.35 + 0.65;
    return {
      ...n,
      x: w / 2 + Math.cos(angle) * radius * jitter,
      y: h / 2 + Math.sin(angle) * radius * jitter,
    };
  });
}

/**
 * Cybersecurity experience as an explorable digital map of connected nodes.
 */
export function CyberMap() {
  const nodes = useMemo(() => layout(seedNodes), []);
  const [active, setActive] = useState<string | null>(null);
  const activeNode = nodes.find((n) => n.id === active);

  return (
    <section
      id="cybermap"
      className="relative mx-auto w-full max-w-6xl px-6 py-24 md:px-10"
      aria-label="Cybersecurity map"
    >
      <TextReveal as="h2" className="mb-2 font-display text-xs tracking-[0.4em] text-paper/80">
        CYBERSECURITY EXPERIENCE
      </TextReveal>
      <TextReveal as="h3" delay={0.05} className="mb-8 font-display text-3xl tracking-[0.1em] md:text-5xl">
        EXPLORE THE MAP
      </TextReveal>

      <div className="relative mx-auto max-w-3xl">
        <svg viewBox="0 0 560 420" className="w-full" role="img" aria-label="Node network of cybersecurity areas">
          {nodes.map((n) =>
            nodes
              .filter((m) => m.id !== n.id)
              .map((m) => {
                const isLit = active === null || active === n.id || active === m.id;
                return (
                  <line
                    key={`${n.id}-${m.id}`}
                    x1={n.x}
                    y1={n.y}
                    x2={m.x}
                    y2={m.y}
                    stroke={typeColor[n.type]}
                    strokeOpacity={isLit ? 0.12 : 0.04}
                    strokeWidth={1}
                  />
                );
              })
          )}
          {nodes.map((n) => {
            const isActive = active === n.id;
            return (
              <g
                key={n.id}
                onMouseEnter={() => setActive(n.id)}
                onMouseLeave={() => setActive(null)}
                onClick={() => setActive(isActive ? null : n.id)}
                className="cursor-pointer"
                style={{ cursor: "pointer" }}
              >
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={isActive ? 22 : 18}
                  fill={typeColor[n.type]}
                  fillOpacity={isActive ? 0.25 : 0.12}
                  stroke={typeColor[n.type]}
                  strokeWidth={isActive ? 2 : 1}
                >
                  <animate attributeName="r" values={isActive ? "18;22;18" : "18"} dur="2s" repeatCount="indefinite" />
                </circle>
                <text
                  x={n.x}
                  y={n.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-paper"
                  style={{ fontSize: 9, letterSpacing: "0.15em", fontWeight: 600, textTransform: "uppercase" }}
                >
                  {n.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Detail panel */}
        {activeNode && (
          <motion.div
            key={activeNode.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="pointer-events-none absolute bottom-2 left-1/2 w-64 -translate-x-1/2 rounded-xl border border-white/10 bg-ink/80 p-4 text-center backdrop-blur-md"
          >
            <p className="font-display text-xs tracking-[0.3em]" style={{ color: typeColor[activeNode.type] }}>
              {activeNode.label}
            </p>
            <p className="mt-2 text-xs text-paper/60">{activeNode.detail}</p>
          </motion.div>
        )}
      </div>
    </section>
  );
}