"use client";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { LiquidMetal } from "@paper-design/shaders-react";
import { isWebGLSupported } from "@/lib/webgl";

/**
 * Splash-only liquid-metal wordmark (Paper Shaders, the engine behind paper-design/liquid-logo).
 * The word is drawn in the site's display font onto a canvas, and that mask feeds the shader,
 * so the metal follows the real typography instead of a separate logo file.
 */
class Boundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** Draws each line centred, in the site's display font, onto one transparent mask. */
function drawMask(lines: string[], fontFamily: string): string {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const fontSize = 300, lineHeight = fontSize * 1.08, tracking = fontSize * 0.16, pad = 50;
  const font = `700 ${fontSize}px ${fontFamily}`;
  ctx.font = font;
  const measured = lines.map(line => {
    const widths = [...line].map(ch => ctx.measureText(ch).width);
    return { line, widths, width: widths.reduce((a, b) => a + b, 0) + tracking * (line.length - 1) };
  });
  const width = Math.ceil(Math.max(...measured.map(m => m.width)) + pad * 2);
  const height = Math.ceil(lineHeight * lines.length + pad);
  canvas.width = width; canvas.height = height;
  ctx.font = font; ctx.textBaseline = "middle"; ctx.fillStyle = "#000";
  measured.forEach((m, row) => {
    let x = (width - m.width) / 2;
    const y = pad / 2 + lineHeight * (row + 0.5) + 6;
    [...m.line].forEach((ch, i) => { ctx.fillText(ch, x, y); x += m.widths[i] + tracking; });
  });
  return canvas.toDataURL("image/png");
}

export function LiquidWordmark({ lines, className = "" }: { lines: string[]; className?: string }) {
  const label = lines.join(" ");
  const probe = useRef<HTMLSpanElement>(null);
  const [mask, setMask] = useState("");
  const [ratio, setRatio] = useState(4);
  const [still, setStill] = useState(false);
  useEffect(() => {
    if (!isWebGLSupported()) return;
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    setStill(query.matches);
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (cancelled || !probe.current) return;
      // A solid sans gives the metal enough surface; the serif headline face is too thin for it.
      const sans = getComputedStyle(document.documentElement).getPropertyValue("--font-sans").trim() || "sans-serif";
      const url = drawMask(lines, sans);
      if (!url) return;
      const image = new Image();
      image.onload = () => { if (!cancelled) { setRatio(image.width / image.height); setMask(url); } };
      image.src = url;
    });
    return () => { cancelled = true; };
  }, [label]); // eslint-disable-line react-hooks/exhaustive-deps
  const text = <span ref={probe} className={className}>{lines.map((line, i) => <span key={line} className={`block${i ? " opacity-70" : ""}`}>{line}</span>)}</span>;
  if (!mask) return text;
  return <Boundary fallback={text}>
    <span className="liquid-wordmark" style={{ aspectRatio: String(ratio) }} aria-hidden="true">
      <LiquidMetal image={mask} colorBack="#00000000" colorTint="#ffffff" shape="none" fit="contain" scale={1}
        repetition={1.6} softness={0.28} shiftRed={0.07} shiftBlue={0.07} distortion={0.04} contour={0.25} angle={70}
        speed={still ? 0 : 0.6} style={{ width: "100%", height: "100%" }} />
    </span>
    <span className="sr-only">{label}</span>
  </Boundary>;
}
