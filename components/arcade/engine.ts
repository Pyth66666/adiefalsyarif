export type Status = "ready" | "playing" | "paused" | "over";
export type Body = { x: number; y: number; r: number; speed: number; signal: boolean };
export type Game = { status: Status; x: number; y: number; score: number; lives: number; time: number; spawn: number; immune: number; objects: Body[] };
export const WIDTH = 320, HEIGHT = 240;
export function newGame(): Game { return { status: "ready", x: 160, y: 199, score: 0, lives: 3, time: 0, spawn: .4, immune: 0, objects: [] }; }
export function step(g: Game, elapsed: number, keys: Set<string>, random = Math.random) {
  if (g.status !== "playing") return;
  const dt = Math.min(elapsed, .05);
  g.time += dt; g.immune = Math.max(0, g.immune - dt);
  const dx = Number(keys.has("right")) - Number(keys.has("left"));
  const dy = Number(keys.has("down")) - Number(keys.has("up"));
  const scale = dx && dy ? Math.SQRT1_2 : 1;
  g.x = Math.max(9, Math.min(WIDTH - 9, g.x + dx * 125 * dt * scale));
  g.y = Math.max(28, Math.min(HEIGHT - 10, g.y + dy * 125 * dt * scale));
  g.spawn -= dt;
  if (g.spawn <= 0) {
    const signal = random() < .3;
    g.objects.push({ x: 14 + random() * (WIDTH - 28), y: -12, r: signal ? 5 : 7 + random() * 6, speed: 45 + Math.min(g.time * 1.5, 100) + random() * 25, signal });
    g.spawn = Math.max(.23, .7 - g.time * .007);
  }
  g.objects = g.objects.filter(o => {
    o.y += o.speed * dt;
    if (Math.hypot(o.x - g.x, o.y - g.y) < o.r + 6) {
      if (o.signal) { g.score += 100; return false; }
      if (!g.immune) { g.lives--; g.immune = 1.5; if (!g.lives) g.status = "over"; return false; }
    }
    return o.y < HEIGHT + 20;
  });
}
