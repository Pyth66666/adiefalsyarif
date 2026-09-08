export interface Project {
  id: string;
  index: string;
  title: string;
  tagline: string;
  category: string; // e.g. "AI / WEB / PRODUCT"
  year: string;
  description: string;
  problem: string;
  solution: string;
  technologies: string[];
  image: string;
  gallery: string[];
  github: string;
  demo: string;
  accent: "build" | "create";
}

export const projects: Project[] = [
  {
    id: "rooted",
    index: "01",
    title: "[PROJECT NAME]",
    tagline: "Rooted — AI-powered shampoo ingredient analysis.",
    category: "AI / WEB / PRODUCT",
    year: "2026",
    description: "AI-powered shampoo ingredient analysis. Replace with real project description.",
    problem: "[PROBLEM — what issue does this project solve?]",
    solution: "[SOLUTION — how is it solved?]",
    technologies: ["AI", "Web", "Product"],
    image: "",
    gallery: [],
    github: "",
    demo: "",
    accent: "build",
  },
  {
    id: "project-02",
    index: "02",
    title: "[PROJECT NAME]",
    tagline: "[SHORT DESCRIPTION OF THE PROJECT]",
    category: "[CATEGORY]",
    year: "[YEAR]",
    description: "[DESCRIPTION]",
    problem: "[PROBLEM]",
    solution: "[SOLUTION]",
    technologies: ["[TECH]"],
    image: "",
    gallery: [],
    github: "",
    demo: "",
    accent: "build",
  },
  {
    id: "project-03",
    index: "03",
    title: "[PROJECT NAME]",
    tagline: "[SHORT DESCRIPTION OF THE PROJECT]",
    category: "[CATEGORY]",
    year: "[YEAR]",
    description: "[DESCRIPTION]",
    problem: "[PROBLEM]",
    solution: "[SOLUTION]",
    technologies: ["[TECH]"],
    image: "",
    gallery: [],
    github: "",
    demo: "",
    accent: "create",
  },
];
