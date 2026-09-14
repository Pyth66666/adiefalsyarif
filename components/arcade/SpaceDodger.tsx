"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AmbientSpace } from "@/components/experience/AmbientSpace";
import { ThemePicker } from "@/components/experience/ThemeProvider";
import { newGame, step, WIDTH, HEIGHT } from "./engine";

const mapping: Record<string,string> = { ArrowLeft: "left", a: "left", ArrowRight: "right", d: "right", ArrowUp: "up", w: "up", ArrowDown: "down", s: "down" };
export function SpaceDodger() {
  const canvas = useRef<HTMLCanvasElement>(null), consoleRef = useRef<HTMLDivElement>(null);
  const game = useRef(newGame()), keys = useRef(new Set<string>());
  const [hud, setHud] = useState({ status: "ready", score: 0, lives: 3 });
  const [best, setBest] = useState(0);
  const sync = useCallback(() => setHud({ status: game.current.status, score: game.current.score, lives: game.current.lives }), []);
  const start = () => { if (game.current.status === "ready" || game.current.status === "over") { game.current = newGame(); game.current.status = "playing"; keys.current.clear(); sync(); } consoleRef.current?.focus({ preventScroll: true }); };
  const pause = useCallback(() => { const g = game.current; if (g.status === "playing") g.status = "paused"; else if (g.status === "paused") g.status = "playing"; keys.current.clear(); sync(); }, [sync]);
  useEffect(() => {
    try { const value = Number(localStorage.getItem("adief-orbit-best")); if (Number.isFinite(value)) setBest(value); } catch {}
    const ctx = canvas.current?.getContext("2d"); if (!ctx) return;
    let frame = 0, previous = 0, lastHud = "", lastPaint = 0;
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      const current = game.current;
      if (current.status !== "playing" && lastHud === `${current.status}:${current.score}:${current.lives}`) { previous = now; return; }
      if (now - lastPaint < 1000 / 30) return;
      lastPaint = now;
      const g = game.current; step(g, previous ? (now - previous) / 1000 : 0, keys.current); previous = now;
      ctx.fillStyle = "#b9c79a"; ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = "#7b9164";
      for (let i = 0; i < 45; i++) ctx.fillRect((i * 73 + 19) % WIDTH, ((i * 47) + g.time * (i % 3 + 3)) % HEIGHT, 1, 1);
      ctx.strokeStyle = "#263c30"; ctx.lineWidth = 2;
      for (const o of g.objects) {
        ctx.beginPath();
        if (o.signal) { ctx.moveTo(o.x, o.y - 5); ctx.lineTo(o.x + 5, o.y); ctx.lineTo(o.x, o.y + 5); ctx.lineTo(o.x - 5, o.y); }
        else for (let i = 0; i < 8; i++) { const angle = i / 8 * Math.PI * 2, r = o.r * (i % 2 ? .78 : 1); const x = o.x + Math.cos(angle) * r, y = o.y + Math.sin(angle) * r; if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
        ctx.closePath(); ctx.stroke();
      }
      if (!g.immune || Math.floor(g.immune * 10) % 2 === 0) {
        ctx.fillStyle = "#263c30"; ctx.beginPath(); ctx.moveTo(g.x, g.y - 8); ctx.lineTo(g.x + 7, g.y + 7); ctx.lineTo(g.x, g.y + 3); ctx.lineTo(g.x - 7, g.y + 7); ctx.closePath(); ctx.fill();
        if (g.status === "playing") { ctx.fillStyle = "#657e52"; ctx.fillRect(g.x - 2, g.y + 8, 4, 3 + Math.floor(g.time * 10) % 4); }
      }
      const snapshot = `${g.status}:${g.score}:${g.lives}`;
      if (snapshot !== lastHud) { sync(); lastHud = snapshot; }
    };
    const suspend = () => { keys.current.clear(); if (game.current.status === "playing") { game.current.status = "paused"; sync(); } };
    const visibility = () => { if (document.hidden) { suspend(); cancelAnimationFrame(frame); } else { previous = 0; frame = requestAnimationFrame(draw); } };
    frame = requestAnimationFrame(draw);
    window.addEventListener("blur", suspend); document.addEventListener("visibilitychange", visibility);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("blur", suspend); document.removeEventListener("visibilitychange", visibility); };
  }, [sync]);
  useEffect(() => {
    if (hud.score > best) { setBest(hud.score); try { localStorage.setItem("adief-orbit-best", String(hud.score)); } catch {} }
  }, [hud.score, best]);
  return <main className="arcade-page"><AmbientSpace />
    <header className="arcade-header"><Link href="/?from=arcade#lab">← RETURN TO PORTFOLIO</Link><span>TRANSMISSION / 001</span></header>
    <div className="arcade-layout"><div className="arcade-copy"><p className="eyebrow">A SMALL DETOUR INTO SPACE</p><h1>Pocket<br/><em>Orbit.</em></h1><p>No downloads. No high stakes.<br/>Just you, a ship, and a few lost signals.</p><div className="arcade-instructions"><p>01 / STEER with arrows, WASD or the D-pad.</p><p>02 / COLLECT diamonds. Each signal is 100 points.</p><p>03 / DODGE rocks. You have three lives.</p><p>ENTER / start · SPACE or B / pause</p></div><ThemePicker compact /></div>
    <div ref={consoleRef} className="handheld" tabIndex={0} aria-label="Space Dodger console. Focus here to use keyboard controls."
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) { keys.current.clear(); if (game.current.status === "playing") { game.current.status = "paused"; sync(); } } }}
      onKeyDown={e => { if ((e.target as HTMLElement).tagName === "BUTTON") return; const key = mapping[e.key] || mapping[e.key.toLowerCase()]; if (key) { e.preventDefault(); keys.current.add(key); } else if (!e.repeat && e.key === "Enter") { e.preventDefault(); start(); } else if (!e.repeat && (e.key === " " || e.key.toLowerCase() === "b")) { e.preventDefault(); pause(); } }}
      onKeyUp={e => { const key = mapping[e.key] || mapping[e.key.toLowerCase()]; if (key) { e.preventDefault(); keys.current.delete(key); } }}>
      <div className="handheld-top"><span><i /> POWER</span><span>ADIEF SYSTEMS®</span></div>
      <div className="lcd-bezel"><div className="lcd-label">DOT MATRIX / ORBIT LINK</div><div className="lcd-screen">
        <canvas ref={canvas} width={WIDTH} height={HEIGHT} aria-label="Space Dodger playfield: collect diamond signals and avoid asteroids." />
        <div className="lcd-hud"><span>{String(hud.score).padStart(5,"0")}</span><span>HP {hud.lives}</span></div>
        {hud.status !== "playing" && <div className="lcd-overlay"><strong>{hud.status === "ready" ? "SPACE DODGER" : hud.status === "paused" ? "LINK PAUSED" : "SIGNAL LOST"}</strong><p>{hud.status === "over" ? `SCORE ${hud.score} / BEST ${best}` : hud.status === "paused" ? "Take your time, pilot." : "Collect signals. Stay in orbit."}</p><button onClick={hud.status === "paused" ? () => { pause(); consoleRef.current?.focus(); } : start}>{hud.status === "paused" ? "RESUME ▶" : hud.status === "over" ? "TRY AGAIN ↻" : "PRESS START ▶"}</button></div>}
      </div><div className="lcd-bottom"><span>MONOCHROME EXPLORER</span><span>BEST {best}</span></div></div>
      <div className="handheld-brand">pocket <em>orbit</em><span>01</span></div>
      <div className="handheld-controls"><div className="dpad" aria-label="Directional controls">{["up","left","right","down"].map(direction => <button key={direction} className={`dpad-${direction}`} aria-label={`Move ${direction}`}
        onPointerDown={e => { e.preventDefault(); consoleRef.current?.focus({ preventScroll:true }); e.currentTarget.setPointerCapture(e.pointerId); keys.current.add(direction); }}
        onPointerUp={() => keys.current.delete(direction)} onPointerCancel={() => keys.current.delete(direction)} onLostPointerCapture={() => keys.current.delete(direction)}
        onKeyDown={e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); keys.current.add(direction); } }} onKeyUp={() => keys.current.delete(direction)} onBlur={() => keys.current.delete(direction)}>{({up:"▲",left:"◀",right:"▶",down:"▼"})[direction]}</button>)}</div>
        <div className="action-buttons"><div><button aria-label="Pause or resume" onClick={() => { pause(); consoleRef.current?.focus(); }}>B</button><span>PAUSE</span></div><div><button aria-label="Start or restart after game over" onClick={start}>A</button><span>START</span></div></div>
      </div><div className="speaker" aria-hidden="true"><i/><i/><i/><i/><i/></div>
      <p className="sr-only" role="status" aria-live="polite">{hud.status}. Score {hud.score}. {hud.lives} lives remaining.</p>
    </div></div><footer className="arcade-footer">BUILT FOR A LITTLE WANDERING. / NO SOUND, JUST SPACE.</footer>
  </main>;
}
