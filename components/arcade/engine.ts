export type Status = "ready" | "playing" | "paused" | "over";
export type Kind = "rock" | "signal" | "comet" | "splitter" | "drone" | "shield" | "magnet" | "slow";
export type Body = {
  x: number; y: number; r: number; speed: number; signal: boolean;
  kind?: Kind; baseX?: number; phase?: number; vx?: number; split?: boolean;
};
export type Game = {
  status: Status; x: number; y: number; score: number; lives: number; time: number; spawn: number; immune: number; objects: Body[];
  wave: number; banner: number; combo: number; comboTimer: number; bestCombo: number;
  shield: number; magnet: number; slow: number;
};
export const WIDTH = 320, HEIGHT = 240;
export const WAVE_SECONDS = 30;
export const POWER_SECONDS = { shield: 6, magnet: 7, slow: 5 } as const;

export function newGame(): Game {
  return { status: "ready", x: 160, y: 199, score: 0, lives: 3, time: 0, spawn: .4, immune: 0, objects: [],
    wave: 1, banner: 0, combo: 0, comboTimer: 0, bestCombo: 0, shield: 0, magnet: 0, slow: 0 };
}

export const kindOf = (o: Body): Kind => o.kind ?? (o.signal ? "signal" : "rock");
const isPower = (k: Kind) => k === "shield" || k === "magnet" || k === "slow";
const isHazard = (k: Kind) => k === "rock" || k === "comet" || k === "splitter" || k === "drone";
/** Signal multiplier: x1, then +1 for every three signals collected in a row (max x5). */
export const multiplier = (combo: number) => Math.min(5, 1 + Math.floor(combo / 3));

function spawnBody(g: Game, random: () => number): Body {
  const base = 45 + Math.min(g.time * 1.5, 100) + random() * 25;
  const x = 14 + random() * (WIDTH - 28);
  const roll = random();
  if (roll < .3) return { x, y: -12, r: 5, speed: base, signal: true, kind: "signal" };
  if (g.wave >= 2 && roll > .955) {
    const kinds = ["shield", "magnet", "slow"] as const;
    return { x, y: -12, r: 6, speed: 55, signal: false, kind: kinds[Math.floor(random() * 3) % 3] };
  }
  const hazardRoll = random();
  if (g.wave >= 4 && hazardRoll < .18) return { x, y: -12, r: 7, speed: base * .55, signal: false, kind: "drone", vx: 0 };
  if (g.wave >= 3 && hazardRoll < .36) return { x, y: -12, r: 11, speed: base * .8, signal: false, kind: "splitter" };
  if (g.wave >= 2 && hazardRoll < .56) return { x, y: -12, r: 6, speed: base * 1.25, signal: false, kind: "comet", baseX: x, phase: random() * Math.PI * 2 };
  return { x, y: -12, r: 7 + random() * 6, speed: base, signal: false, kind: "rock" };
}

export function step(g: Game, elapsed: number, keys: Set<string>, random = Math.random) {
  if (g.status !== "playing") return;
  const dt = Math.min(elapsed, .05);
  g.time += dt; g.immune = Math.max(0, g.immune - dt);
  g.banner = Math.max(0, (g.banner ?? 0) - dt);
  g.shield = Math.max(0, (g.shield ?? 0) - dt); g.magnet = Math.max(0, (g.magnet ?? 0) - dt); g.slow = Math.max(0, (g.slow ?? 0) - dt);
  g.comboTimer = Math.max(0, (g.comboTimer ?? 0) - dt); if (!g.comboTimer) g.combo = 0;
  const wave = 1 + Math.floor(g.time / WAVE_SECONDS);
  if (wave !== (g.wave ?? 1)) { g.wave = wave; g.banner = 2; }

  const dx = Number(keys.has("right")) - Number(keys.has("left"));
  const dy = Number(keys.has("down")) - Number(keys.has("up"));
  const scale = dx && dy ? Math.SQRT1_2 : 1;
  g.x = Math.max(9, Math.min(WIDTH - 9, g.x + dx * 125 * dt * scale));
  g.y = Math.max(28, Math.min(HEIGHT - 10, g.y + dy * 125 * dt * scale));

  g.spawn -= dt;
  if (g.spawn <= 0) {
    g.objects.push(spawnBody(g, random));
    g.spawn = Math.max(.2, .7 - g.time * .007);
  }
  const worldDt = g.slow > 0 ? dt * .45 : dt;
  const born: Body[] = [];
  g.objects = g.objects.filter(o => {
    const kind = kindOf(o);
    o.y += o.speed * worldDt;
    if (kind === "comet") { o.phase = (o.phase ?? 0) + worldDt * 5; o.x = Math.max(8, Math.min(WIDTH - 8, (o.baseX ?? o.x) + Math.sin(o.phase) * 38)); }
    if (kind === "drone") { o.vx = (o.vx ?? 0) + Math.sign(g.x - o.x) * 140 * worldDt; o.vx = Math.max(-60, Math.min(60, o.vx)); o.x += o.vx * worldDt; }
    if (kind === "splitter" && !o.split && o.y > HEIGHT * .38) {
      // Breaks into two smaller rocks that fly apart.
      born.push({ x: o.x, y: o.y, r: 6, speed: o.speed, signal: false, kind: "comet", baseX: o.x - 22, phase: Math.PI / 2 },
        { x: o.x, y: o.y, r: 6, speed: o.speed, signal: false, kind: "comet", baseX: o.x + 22, phase: -Math.PI / 2 });
      return false;
    }
    if (kind === "signal" && g.magnet > 0) {
      const d = Math.hypot(g.x - o.x, g.y - o.y);
      if (d < 90 && d > 0) { o.x += (g.x - o.x) / d * 120 * dt; o.y += (g.y - o.y) / d * 60 * dt; }
    }
    if (Math.hypot(o.x - g.x, o.y - g.y) < o.r + 6) {
      if (kind === "signal") {
        g.score += 100 * multiplier(g.combo ?? 0);
        g.combo = (g.combo ?? 0) + 1; g.comboTimer = 3; g.bestCombo = Math.max(g.bestCombo ?? 0, g.combo);
        return false;
      }
      if (isPower(kind)) { g[kind as "shield" | "magnet" | "slow"] = POWER_SECONDS[kind as keyof typeof POWER_SECONDS]; g.score += 50; return false; }
      if (isHazard(kind)) {
        if (g.shield > 0) { g.score += 25; return false; }
        if (!g.immune) { g.lives--; g.immune = 1.5; g.combo = 0; g.comboTimer = 0; if (!g.lives) g.status = "over"; return false; }
      }
    }
    return o.y < HEIGHT + 20;
  });
  if (born.length) g.objects.push(...born);
}
