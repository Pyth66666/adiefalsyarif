"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AmbientSpace } from "@/components/experience/AmbientSpace";
import { ThemePicker } from "@/components/experience/ThemeProvider";
import { newGame, step, kindOf, multiplier, WIDTH, HEIGHT, type Game } from "./engine";
import { newFirewall, stepFirewall, moveGate, laneY, LANES, GATE_X, SERVER_X, type FirewallGame } from "./firewall";

type Cart = "orbit" | "firewall";
type Status = "ready" | "playing" | "paused" | "over";
const DARK = "#263c30", MID = "#657e52", LIGHT = "#b9c79a", DOTS = "#7b9164";
const BEST_KEY: Record<Cart, string> = { orbit: "adief-orbit-best", firewall: "adief-firewall-best" };
const CARTS: Record<Cart, { title: string; tagline: string; over: string; steps: string[] }> = {
  orbit: {
    title: "SPACE DODGER", tagline: "Collect signals. Stay in orbit.", over: "SIGNAL LOST",
    steps: ["01 / STEER with arrows, WASD or the D-pad.", "02 / COLLECT diamonds. Chain them for up to x5.", "03 / DODGE rocks, zig-zag comets, splitters and drones.", "04 / GRAB S shield · M magnet · T slow-time."],
  },
  firewall: {
    title: "FIREWALL", tagline: "Block attacks. Let clean traffic through.", over: "SERVER BREACHED",
    steps: ["01 / MOVE the gate between lanes with ▲ ▼.", "02 / BLOCK malicious packets like <script> or ' OR 1=1.", "03 / LET clean traffic like DNS or GET / reach the server.", "04 / A blocked clean packet is a false positive."],
  },
};
const mapping: Record<string, string> = { ArrowLeft: "left", a: "left", ArrowRight: "right", d: "right", ArrowUp: "up", w: "up", ArrowDown: "down", s: "down" };

function drawOrbit(ctx: CanvasRenderingContext2D, g: Game) {
  ctx.fillStyle = LIGHT; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = DOTS;
  for (let i = 0; i < 45; i++) ctx.fillRect((i * 73 + 19) % WIDTH, ((i * 47) + g.time * (i % 3 + 3) * (g.slow > 0 ? .45 : 1)) % HEIGHT, 1, 1);
  ctx.strokeStyle = DARK; ctx.fillStyle = DARK; ctx.lineWidth = 2;
  const rock = (x: number, y: number, r: number) => { ctx.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, rr = r * (i % 2 ? .78 : 1); const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; if (!i) ctx.moveTo(px, py); else ctx.lineTo(px, py); } ctx.closePath(); ctx.stroke(); };
  for (const o of g.objects) {
    const kind = kindOf(o);
    if (kind === "signal") { ctx.beginPath(); ctx.moveTo(o.x, o.y - 5); ctx.lineTo(o.x + 5, o.y); ctx.lineTo(o.x, o.y + 5); ctx.lineTo(o.x - 5, o.y); ctx.closePath(); ctx.stroke(); }
    else if (kind === "rock") rock(o.x, o.y, o.r);
    else if (kind === "splitter") { rock(o.x, o.y, o.r); ctx.beginPath(); ctx.moveTo(o.x - 3, o.y - o.r * .7); ctx.lineTo(o.x + 2, o.y); ctx.lineTo(o.x - 2, o.y + o.r * .7); ctx.stroke(); }
    else if (kind === "comet") { ctx.beginPath(); ctx.arc(o.x, o.y, o.r * .8, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = MID; ctx.beginPath(); ctx.moveTo(o.x, o.y - o.r); ctx.lineTo(o.x, o.y - o.r - 12); ctx.stroke(); ctx.strokeStyle = DARK; }
    else if (kind === "drone") { ctx.strokeRect(o.x - 6, o.y - 5, 12, 10); ctx.fillRect(o.x - 2, o.y - 1, 4, 3); ctx.beginPath(); ctx.moveTo(o.x - 9, o.y - 7); ctx.lineTo(o.x - 6, o.y - 5); ctx.moveTo(o.x + 9, o.y - 7); ctx.lineTo(o.x + 6, o.y - 5); ctx.stroke(); }
    else { ctx.lineWidth = 1.5; ctx.strokeRect(o.x - 7, o.y - 7, 14, 14); ctx.lineWidth = 2; ctx.font = "bold 10px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(kind === "shield" ? "S" : kind === "magnet" ? "M" : "T", o.x, o.y + 1); }
  }
  if (!g.immune || Math.floor(g.immune * 10) % 2 === 0) {
    ctx.fillStyle = DARK; ctx.beginPath(); ctx.moveTo(g.x, g.y - 8); ctx.lineTo(g.x + 7, g.y + 7); ctx.lineTo(g.x, g.y + 3); ctx.lineTo(g.x - 7, g.y + 7); ctx.closePath(); ctx.fill();
    if (g.status === "playing") { ctx.fillStyle = MID; ctx.fillRect(g.x - 2, g.y + 8, 4, 3 + Math.floor(g.time * 10) % 4); }
  }
  if (g.shield > 0 && (g.shield > 1.5 || Math.floor(g.shield * 8) % 2 === 0)) { ctx.setLineDash([3, 3]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(g.x, g.y, 13, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 2; }
  if (g.magnet > 0) { ctx.strokeStyle = MID; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(g.x, g.y, 22 + (g.time * 30) % 14, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 2; ctx.strokeStyle = DARK; }
  const powers = [g.shield > 0 && `S${Math.ceil(g.shield)}`, g.magnet > 0 && `M${Math.ceil(g.magnet)}`, g.slow > 0 && `T${Math.ceil(g.slow)}`].filter(Boolean).join(" ");
  ctx.fillStyle = DARK; ctx.font = "bold 9px monospace"; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
  if (powers) ctx.fillText(powers, 8, HEIGHT - 6);
  if (g.banner > 0) banner(ctx, `WAVE ${g.wave}`, g.wave === 2 ? "COMETS INBOUND" : g.wave === 3 ? "SPLITTERS INBOUND" : g.wave === 4 ? "DRONES INBOUND" : "FASTER");
}

function drawFirewall(ctx: CanvasRenderingContext2D, g: FirewallGame) {
  const invert = g.flash > 0 && Math.floor(g.flash * 20) % 2 === 0;
  const bg = invert ? DARK : LIGHT, fg = invert ? LIGHT : DARK;
  ctx.fillStyle = bg; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.strokeStyle = invert ? LIGHT : DOTS; ctx.lineWidth = 1; ctx.setLineDash([2, 4]);
  for (let lane = 0; lane < LANES; lane++) { ctx.beginPath(); ctx.moveTo(0, laneY(lane)); ctx.lineTo(SERVER_X, laneY(lane)); ctx.stroke(); }
  ctx.setLineDash([]);
  // Server rack.
  ctx.strokeStyle = fg; ctx.fillStyle = fg; ctx.lineWidth = 2; ctx.strokeRect(SERVER_X + 4, 46, 24, 150);
  for (let i = 0; i < 6; i++) ctx.fillRect(SERVER_X + 8, 54 + i * 23, 16, 3);
  ctx.font = "bold 8px monospace"; ctx.textAlign = "center"; ctx.fillText("SRV", SERVER_X + 16, 210);
  // Gate: solid in the active lane, faint marks elsewhere.
  for (let lane = 0; lane < LANES; lane++) {
    if (lane === g.lane) { ctx.fillRect(GATE_X - 3, laneY(lane) - 20, 6, 40); ctx.fillRect(GATE_X - 7, laneY(lane) - 22, 14, 3); ctx.fillRect(GATE_X - 7, laneY(lane) + 19, 14, 3); }
    else { ctx.globalAlpha = .3; ctx.fillRect(GATE_X - 1, laneY(lane) - 14, 2, 28); ctx.globalAlpha = 1; }
  }
  ctx.font = "bold 9px monospace"; ctx.textBaseline = "middle";
  for (const p of g.packets) {
    const w = Math.max(30, ctx.measureText(p.label).width + 10), y = laneY(p.lane);
    ctx.fillStyle = bg; ctx.fillRect(p.x - w, y - 8, w, 16); ctx.strokeStyle = fg; ctx.lineWidth = 1.5; ctx.strokeRect(p.x - w, y - 8, w, 16);
    ctx.fillStyle = fg; ctx.textAlign = "center"; ctx.fillText(p.label, p.x - w / 2, y + 1);
  }
  ctx.textBaseline = "alphabetic"; ctx.textAlign = "left"; ctx.font = "bold 8px monospace"; ctx.fillStyle = fg;
  if (g.lastEvent) ctx.fillText(g.lastEvent.slice(0, 34), 8, HEIGHT - 6);
  if (g.combo >= 4) { ctx.textAlign = "right"; ctx.fillText(`CHAIN x${Math.min(5, 1 + Math.floor(g.combo / 4))}`, GATE_X - 12, HEIGHT - 6); }
  if (g.banner > 0) banner(ctx, `WAVE ${g.wave}`, "TRAFFIC SPIKE");
}

function banner(ctx: CanvasRenderingContext2D, title: string, sub: string) {
  // Sits under the HUD and above the first Firewall lane, so it never hides the action.
  ctx.fillStyle = LIGHT; ctx.fillRect(70, 22, 180, 38); ctx.strokeStyle = DARK; ctx.lineWidth = 2; ctx.strokeRect(70, 22, 180, 38);
  ctx.fillStyle = DARK; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "bold 15px monospace"; ctx.fillText(title, 160, 36);
  ctx.font = "bold 7px monospace"; ctx.fillText(sub, 160, 51); ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
}

export function SpaceDodger() {
  const canvas = useRef<HTMLCanvasElement>(null), consoleRef = useRef<HTMLDivElement>(null);
  const [cart, setCart] = useState<Cart>("orbit");
  const cartRef = useRef<Cart>("orbit");
  const orbit = useRef(newGame()), wall = useRef(newFirewall()), keys = useRef(new Set<string>());
  const [hud, setHud] = useState({ status: "ready" as Status, score: 0, lives: 3, wave: 1, mult: 1 });
  const [best, setBest] = useState(0);
  const current = () => (cartRef.current === "orbit" ? orbit.current : wall.current);
  const sync = useCallback(() => {
    const g = cartRef.current === "orbit" ? orbit.current : wall.current;
    const mult = cartRef.current === "orbit" ? multiplier(orbit.current.combo) : Math.min(5, 1 + Math.floor(wall.current.combo / 4));
    setHud({ status: g.status, score: g.score, lives: g.lives, wave: g.wave, mult });
  }, []);
  const loadBest = (which: Cart) => { try { const value = Number(localStorage.getItem(BEST_KEY[which])); setBest(Number.isFinite(value) ? value : 0); } catch { setBest(0); } };
  const switchCart = (next: Cart) => {
    if (next === cartRef.current) return;
    cartRef.current = next; setCart(next); orbit.current = newGame(); wall.current = newFirewall(); keys.current.clear(); loadBest(next); sync();
    try { window.history.replaceState(null, "", next === "firewall" ? "/play?cart=firewall" : "/play"); } catch {}
  };
  const start = () => {
    const g = current();
    if (g.status === "ready" || g.status === "over") {
      if (cartRef.current === "orbit") { orbit.current = newGame(); orbit.current.status = "playing"; } else { wall.current = newFirewall(); wall.current.status = "playing"; }
      keys.current.clear(); sync();
    }
    consoleRef.current?.focus({ preventScroll: true });
  };
  const pause = useCallback(() => { const g = cartRef.current === "orbit" ? orbit.current : wall.current; if (g.status === "playing") g.status = "paused"; else if (g.status === "paused") g.status = "playing"; keys.current.clear(); sync(); }, [sync]);
  const press = (direction: string) => {
    if (cartRef.current === "firewall") { if (direction === "up") moveGate(wall.current, -1); if (direction === "down") moveGate(wall.current, 1); return; }
    keys.current.add(direction);
  };
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("cart") === "firewall" ? "firewall" : "orbit";
    cartRef.current = requested; setCart(requested); loadBest(requested); sync();
  }, [sync]);
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d"); if (!ctx) return;
    let frame = 0, previous = 0, lastHud = "", lastPaint = 0;
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      const which = cartRef.current, g = which === "orbit" ? orbit.current : wall.current;
      const snapshotKey = `${which}:${g.status}:${g.score}:${g.lives}:${g.wave}`;
      if (g.status !== "playing" && lastHud === snapshotKey) { previous = now; return; }
      if (now - lastPaint < 1000 / 30) return;
      lastPaint = now;
      const elapsed = previous ? (now - previous) / 1000 : 0; previous = now;
      if (which === "orbit") { step(orbit.current, elapsed, keys.current); drawOrbit(ctx, orbit.current); }
      else { stepFirewall(wall.current, elapsed); drawFirewall(ctx, wall.current); }
      const after = `${which}:${g.status}:${g.score}:${g.lives}:${g.wave}`;
      if (after !== lastHud) { sync(); lastHud = after; }
    };
    const suspend = () => { keys.current.clear(); const g = cartRef.current === "orbit" ? orbit.current : wall.current; if (g.status === "playing") { g.status = "paused"; sync(); } };
    const visibility = () => { if (document.hidden) { suspend(); cancelAnimationFrame(frame); } else { previous = 0; frame = requestAnimationFrame(draw); } };
    frame = requestAnimationFrame(draw);
    window.addEventListener("blur", suspend); document.addEventListener("visibilitychange", visibility);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("blur", suspend); document.removeEventListener("visibilitychange", visibility); };
  }, [sync]);
  useEffect(() => {
    if (hud.score > best) { setBest(hud.score); try { localStorage.setItem(BEST_KEY[cart], String(hud.score)); } catch {} }
  }, [hud.score, best, cart]);
  const info = CARTS[cart];
  return <main className="arcade-page"><AmbientSpace />
    <header className="arcade-header"><Link href="/?from=arcade#lab">← RETURN TO PORTFOLIO</Link><span>TRANSMISSION / 001</span></header>
    <div className="arcade-layout"><div className="arcade-copy"><p className="eyebrow">A SMALL DETOUR INTO SPACE</p><h1>Pocket<br/><em>Orbit.</em></h1><p>No downloads. No high stakes.<br/>Two cartridges: a ship in an asteroid field, and a firewall under attack.</p>
      <div className="cart-switch" role="group" aria-label="Choose a game cartridge">
        {(["orbit", "firewall"] as const).map(id => <button key={id} aria-pressed={cart === id} onClick={() => switchCart(id)}>{id === "orbit" ? "SPACE DODGER" : "FIREWALL"}</button>)}
      </div>
      <div className="arcade-instructions">{info.steps.map(line => <p key={line}>{line}</p>)}<p>ENTER / start · SPACE or B / pause · new wave every 30s</p></div><ThemePicker compact /></div>
    <div ref={consoleRef} className="handheld" tabIndex={0} aria-label={`${info.title} console. Focus here to use keyboard controls.`}
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) { keys.current.clear(); const g = current(); if (g.status === "playing") { g.status = "paused"; sync(); } } }}
      onKeyDown={e => { if ((e.target as HTMLElement).tagName === "BUTTON") return; const key = mapping[e.key] || mapping[e.key.toLowerCase()]; if (key) { e.preventDefault(); if (!(cartRef.current === "firewall" && e.repeat)) press(key); } else if (!e.repeat && e.key === "Enter") { e.preventDefault(); start(); } else if (!e.repeat && (e.key === " " || e.key.toLowerCase() === "b")) { e.preventDefault(); pause(); } }}
      onKeyUp={e => { const key = mapping[e.key] || mapping[e.key.toLowerCase()]; if (key) { e.preventDefault(); keys.current.delete(key); } }}>
      <div className="handheld-top"><span><i /> POWER</span><span>ADIEF SYSTEMS®</span></div>
      <div className="lcd-bezel"><div className="lcd-label">DOT MATRIX / {cart === "orbit" ? "ORBIT LINK" : "PACKET INSPECTOR"}</div><div className="lcd-screen">
        <canvas ref={canvas} width={WIDTH} height={HEIGHT} aria-label={cart === "orbit" ? "Space Dodger playfield: collect diamond signals and avoid hazards." : "Firewall playfield: block malicious packets and let clean traffic through."} />
        <div className="lcd-hud"><span>{String(hud.score).padStart(5, "0")}</span><span>W{hud.wave}{hud.mult > 1 ? ` · x${hud.mult}` : ""}</span><span>HP {hud.lives}</span></div>
        {hud.status !== "playing" && <div className="lcd-overlay"><strong>{hud.status === "ready" ? info.title : hud.status === "paused" ? "LINK PAUSED" : info.over}</strong><p>{hud.status === "over" ? `SCORE ${hud.score} / BEST ${best}` : hud.status === "paused" ? "Take your time." : info.tagline}</p><button onClick={hud.status === "paused" ? () => { pause(); consoleRef.current?.focus(); } : start}>{hud.status === "paused" ? "RESUME ▶" : hud.status === "over" ? "TRY AGAIN ↻" : "PRESS START ▶"}</button></div>}
      </div><div className="lcd-bottom"><span>{cart === "orbit" ? "MONOCHROME EXPLORER" : "PACKET INSPECTOR"}</span><span>BEST {best}</span></div></div>
      <div className="handheld-brand">pocket <em>orbit</em><span>{cart === "orbit" ? "01" : "02"}</span></div>
      <div className="handheld-controls"><div className="dpad" aria-label="Directional controls">{["up", "left", "right", "down"].map(direction => <button key={direction} className={`dpad-${direction}`} aria-label={`Move ${direction}`}
        onPointerDown={e => { e.preventDefault(); consoleRef.current?.focus({ preventScroll: true }); e.currentTarget.setPointerCapture(e.pointerId); press(direction); }}
        onPointerUp={() => keys.current.delete(direction)} onPointerCancel={() => keys.current.delete(direction)} onLostPointerCapture={() => keys.current.delete(direction)}
        onKeyDown={e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); press(direction); } }} onKeyUp={() => keys.current.delete(direction)} onBlur={() => keys.current.delete(direction)}>{({ up: "▲", left: "◀", right: "▶", down: "▼" })[direction]}</button>)}</div>
        <div className="action-buttons"><div><button aria-label="Pause or resume" onClick={() => { pause(); consoleRef.current?.focus(); }}>B</button><span>PAUSE</span></div><div><button aria-label="Start or restart after game over" onClick={start}>A</button><span>START</span></div></div>
      </div><div className="speaker" aria-hidden="true"><i/><i/><i/><i/><i/></div>
      <p className="sr-only" role="status" aria-live="polite">{info.title}. {hud.status}. Score {hud.score}. Wave {hud.wave}. {hud.lives} lives remaining.</p>
    </div></div><footer className="arcade-footer">BUILT FOR A LITTLE WANDERING. / NO SOUND, JUST SPACE.</footer>
  </main>;
}
