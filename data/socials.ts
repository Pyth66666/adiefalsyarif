export interface SocialLink {
  id: string;
  label: string;
  url: string;
  group: "tech" | "creative";
}

export function configuredLinks(links: SocialLink[]): SocialLink[] {
  return links.filter((l) => l.url.length > 0);
}

export const socials: SocialLink[] = [
  // Tech links — only filled URLs are rendered.
  { id: "github", label: "GitHub", url: "", group: "tech" },
  { id: "linkedin", label: "LinkedIn", url: "", group: "tech" },
  { id: "ctftime", label: "CTFtime", url: "", group: "tech" },
  // Creative links
  { id: "instagram", label: "Instagram", url: "", group: "creative" },
  { id: "photography", label: "Photography", url: "", group: "creative" },
  { id: "printstore", label: "Print Store", url: "", group: "creative" },
];

export const email = ""; // e.g. "hi@adiefalsyarif.com"
export const hackdevUrl = ""; // set the HackDev community destination here
