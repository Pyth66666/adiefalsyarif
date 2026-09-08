export interface EventItem {
  id: string;
  name: string;
  org: string;
  year: string;
  status: "completed" | "upcoming";
  project?: string;
  story?: string;
  date?: string; // ISO date for countdown — leave undefined if not configured
}

export const events: EventItem[] = [
  {
    id: "imaginehack-2026",
    name: "IMAGINEHACK",
    org: "Taylor's University",
    year: "2026",
    status: "completed",
    project: "[PROJECT NAME]",
    story: "[STORY OF THE EVENT — what happened, what I built, who I met.]",
    date: "2026-03-01",
  },
  {
    id: "national-cyber-summit",
    name: "NATIONAL CYBERSECURITY SUMMIT",
    org: "[ORGANIZER]",
    year: "[YEAR]",
    status: "completed",
    story: "[STORY]",
  },
  {
    id: "next-event",
    name: "NEXT EVENT",
    org: "[ORGANIZER]",
    year: "[YEAR]",
    status: "upcoming",
    // Add `date: "2026-06-01"` when a real date is known to enable the countdown.
    date: undefined,
  },
];
