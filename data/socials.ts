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
  { id: "github", label: "GitHub", url: "https://github.com/Pyth66666", group: "tech" },
  { id: "linkedin", label: "LinkedIn", url: "https://www.linkedin.com/in/adief-al-syarif-9315aa277", group: "tech" },
  { id: "ctftime", label: "CTFtime", url: "", group: "tech" },
  // Creative links
  { id: "instagram", label: "Instagram", url: "", group: "creative" },
  { id: "photography", label: "Photography", url: "", group: "creative" },
  { id: "printstore", label: "Print Store", url: "", group: "creative" },
];

export const email = "muhdadief07@gmail.com"; // Public address supplied by Adief.
export const hackdevUrl = ""; // set the HackDev community destination here
