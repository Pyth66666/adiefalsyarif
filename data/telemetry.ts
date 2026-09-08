// Editable statistics.
// Replace placeholder values with real, verified numbers.
// Do NOT invent data that has not been verified by the owner.

export interface Metric {
  id: string;
  label: string;
  value: number;
  suffix?: string;
  prefix?: string;
}

export const telemetry: Metric[] = [
  { id: "ctf-rank", label: "CTF RANK", value: 0, prefix: "#", suffix: "—" },
  { id: "hackathons", label: "HACKATHONS", value: 0, suffix: "" },
  { id: "projects", label: "PROJECTS", value: 0, suffix: "" },
  { id: "events", label: "EVENTS", value: 0, suffix: "" },
  { id: "workshops", label: "WORKSHOPS", value: 0, suffix: "" },
];

export const community: Metric[] = [
  { id: "members", label: "MEMBERS", value: 1500, suffix: "+" },
  { id: "events", label: "EVENTS", value: 0, suffix: "" },
  { id: "universities", label: "UNIVERSITIES", value: 0, suffix: "" },
  { id: "workshops", label: "WORKSHOPS", value: 0, suffix: "" },
];
