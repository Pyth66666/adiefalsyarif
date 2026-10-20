/**
 * FIREWALL — packets travel along three lanes toward the server.
 * Move the gate between lanes: block malicious packets, let clean traffic through.
 */
export type Status = "ready" | "playing" | "paused" | "over";
export type Packet = { lane: number; x: number; speed: number; label: string; bad: boolean };
export type FirewallGame = {
  status: Status; lane: number; score: number; lives: number; time: number; spawn: number;
  packets: Packet[]; wave: number; banner: number; combo: number; flash: number; lastEvent: string;
};
export const WIDTH = 320, HEIGHT = 240, LANES = 3, GATE_X = 236, SERVER_X = 288, WAVE_SECONDS = 30;
export const laneY = (lane: number) => 70 + lane * 58;
export const CLEAN = ["GET /", "DNS", "HTTPS", "PING", "NTP", "SMTP", "IMAP", "POST /login"];
export const MALICIOUS = ["' OR 1=1", "<script>", "rm -rf /", "SYN FLOOD", "../../etc", "BRUTE SSH", "MALWARE.EXE", "${jndi:}"];

export function newFirewall(): FirewallGame {
  return { status: "ready", lane: 1, score: 0, lives: 3, time: 0, spawn: .6, packets: [], wave: 1, banner: 0, combo: 0, flash: 0, lastEvent: "" };
}

export function moveGate(g: FirewallGame, direction: -1 | 1) {
  if (g.status !== "playing") return;
  g.lane = Math.max(0, Math.min(LANES - 1, g.lane + direction));
}

export function stepFirewall(g: FirewallGame, elapsed: number, random = Math.random) {
  if (g.status !== "playing") return;
  const dt = Math.min(elapsed, .05);
  g.time += dt; g.banner = Math.max(0, g.banner - dt); g.flash = Math.max(0, g.flash - dt);
  const wave = 1 + Math.floor(g.time / WAVE_SECONDS);
  if (wave !== g.wave) { g.wave = wave; g.banner = 2; }
  g.spawn -= dt;
  if (g.spawn <= 0) {
    const bad = random() < Math.min(.65, .4 + g.wave * .05);
    const pool = bad ? MALICIOUS : CLEAN;
    g.packets.push({ lane: Math.floor(random() * LANES) % LANES, x: -40, speed: 42 + g.wave * 9 + random() * 18, label: pool[Math.floor(random() * pool.length) % pool.length], bad });
    g.spawn = Math.max(.45, 1.4 - g.wave * .12 - random() * .3);
  }
  g.packets = g.packets.filter(p => {
    const before = p.x; p.x += p.speed * dt;
    // The gate inspects a packet as it crosses the gate line in the gate's lane.
    if (p.lane === g.lane && before < GATE_X && p.x >= GATE_X) {
      if (p.bad) { g.combo++; g.score += 100 * Math.min(5, 1 + Math.floor(g.combo / 4)); g.lastEvent = `BLOCKED ${p.label}`; return false; }
      g.combo = 0; g.flash = .4; g.lastEvent = `FALSE POSITIVE ${p.label}`; damage(g); return false;
    }
    if (p.x >= SERVER_X) {
      if (p.bad) { g.combo = 0; g.flash = .4; g.lastEvent = `BREACH ${p.label}`; damage(g); }
      else { g.score += 10; }
      return false;
    }
    return true;
  });
}

function damage(g: FirewallGame) { g.lives--; if (g.lives <= 0) { g.lives = 0; g.status = "over"; } }
