export interface Metric { id: string; label: string; value: number; suffix?: string; prefix?: string; }

// Counts describe reported results, not invented rankings or completed products.
export const telemetry: Metric[] = [
  { id: "projects", label: "PROJECTS & PROTOTYPES", value: 11 },
  { id: "awards", label: "HACKATHON RECOGNITIONS", value: 2 },
  { id: "speaking", label: "SPEAKING SESSIONS", value: 3 },
  { id: "ctf", label: "BEST CTF RESULT", value: 3, prefix: "TOP " },
  { id: "members", label: "HACKDEV MEMBERS", value: 2000, suffix: "+" },
];

export const community: Metric[] = [
  { id: "members", label: "MEMBERS", value: 2000, suffix: "+" },
  { id: "events", label: "COMMUNITY EVENTS", value: 5 },
];
