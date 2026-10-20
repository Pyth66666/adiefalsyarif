export interface Project {
  id: string; index: string; title: string; tagline: string; category: string; year: string;
  description: string; problem: string; solution: string; technologies: string[];
  image: string; gallery: string[]; github: string; demo: string; accent: "build" | "create";
}

// Public summaries based on Adief's October 2026 profile context, October 2026 master CV,
// and local project repositories. Concepts and prototypes are labelled as such.
// Published CMS projects take precedence over these local entries.
export const projects: Project[] = [
  {
    "id": "oralviu",
    "index": "01",
    "title": "OralViu",
    "tagline": "A remote dental-monitoring concept with a working app demo.",
    "category": "HEALTH TECH / DORMATHON",
    "year": "2026",
    "description": "At Dormathon in October 2026, our team presented an app demo for remote dental monitoring. I worked on research, UI/UX, pitching and team coordination. The proposed image-capture hardware was not integrated into the demo.",
    "problem": "Explore how patients could share dental images for remote review.",
    "solution": "Design and demonstrate the app flow while keeping the hardware concept separate.",
    "technologies": [
      "UI/UX",
      "App prototype"
    ],
    "image": "",
    "gallery": [],
    "github": "",
    "demo": "",
    "accent": "build"
  },
  {
    "id": "lumio",
    "index": "02",
    "title": "LUMIO — Your Electricity Checker",
    "tagline": "An ImagineHack demo for analysing building electricity bills.",
    "category": "ENERGY / IMAGINEHACK",
    "year": "2026",
    "description": "At ImagineHack at Taylor’s University in June 2026, I worked on the frontend demo and research for LUMIO. The tool analysed electricity-bill CSVs and suggested ways large buildings could reduce costs. The demo used sample data.",
    "problem": "Large buildings need clearer ways to read energy costs and spot opportunities to save.",
    "solution": "Build a frontend demo around bill analysis and practical recommendations.",
    "technologies": [
      "Frontend",
      "CSV analysis"
    ],
    "image": "",
    "gallery": [],
    "github": "",
    "demo": "",
    "accent": "build"
  },
  {
    "id": "ai-cv-analysis",
    "index": "03",
    "title": "AI CV Analysis Prototype",
    "tagline": "A team-built recruitment research and CV-analysis demo.",
    "category": "AI / ALIBABA HACKATHON",
    "year": "2026",
    "description": "At the Alibaba Hackathon in July 2026, I helped research recruitment problems and shape a team prototype that uploads and analyses CVs with AI.",
    "problem": "Explore how recruiters could review CV information more efficiently.",
    "solution": "Help shape the problem and prototype flow with the team.",
    "technologies": [
      "AI",
      "Prototype"
    ],
    "image": "",
    "gallery": [],
    "github": "",
    "demo": "",
    "accent": "build"
  },
  {
    "id": "hydrospark",
    "index": "04",
    "title": "HYDROSPARK",
    "tagline": "Best Technical Concept at the UM–Cradle National Deep Tech Challenge.",
    "category": "DEEP TECH / HACKATHON",
    "year": "2026",
    "description": "HYDROSPARK proposed a hydropower solution using large water pipes. At the May 2026 National Deep Tech Challenge, I contributed research, business planning and the pitch. The team received Best Technical Concept. It was a simulation and proof of concept, not a deployed generator.",
    "problem": "Explore energy generation from existing large water-pipe infrastructure.",
    "solution": "Develop and pitch a simulated hydropower concept using university IP.",
    "technologies": [],
    "image": "",
    "gallery": [],
    "github": "",
    "demo": "",
    "accent": "build"
  },
  {
    "id": "putrahack",
    "index": "05",
    "title": "Farm-to-Retail Traceability",
    "tagline": "A PutraHack finalist concept for transparent agricultural pricing.",
    "category": "BLOCKCHAIN / HACKATHON",
    "year": "2026",
    "description": "Our team reached the PutraHack final at UPM in March 2026 with a blockchain-based farm-to-retail tracking concept. We produced a web/app prototype focused on price transparency. I worked on research, the business model and pitching.",
    "problem": "Make the path and price of agricultural products easier to trace from farm to retail.",
    "solution": "Prototype a transparent tracking experience and pitch its business value.",
    "technologies": [
      "Blockchain",
      "Prototype"
    ],
    "image": "",
    "gallery": [],
    "github": "",
    "demo": "",
    "accent": "build"
  },
  {
    "id": "cyclist-wardrobe",
    "index": "06",
    "title": "Cyclist Wardrobe",
    "tagline": "An independent frontend redesign prototype for a specialist cycling retailer.",
    "category": "REACT / FRONTEND PROTOTYPE",
    "year": "2026",
    "description": "A frontend-only exploration of a cycling shop experience, with product discovery, comparison, cart, and checkout screens. The catalogue uses real product names and imagery; stock, prices, accounts, and payments are mock data. The prototype is intended for design review.",
    "problem": "Explore clearer browsing and product detail flows for specialist cycling gear.",
    "solution": "Create an interactive React prototype that can be reviewed before any real commerce integration.",
    "technologies": [
      "React",
      "TypeScript",
      "Tailwind CSS"
    ],
    "image": "",
    "gallery": [],
    "github": "",
    "demo": "",
    "accent": "build"
  },
  {
    "id": "sepang-radar",
    "index": "07",
    "title": "F1 Sepang Radar",
    "tagline": "A motorsport community interface for tracking sightings, drivers, events, and discussion.",
    "category": "WEB / MAPS / COMMUNITY",
    "year": "2026",
    "description": "A web app prototype with a tracker map, driver pages, activity feed, event pages, chat, and sighting reports. The project is still under development.",
    "problem": "Bring scattered motorsport community updates into one place.",
    "solution": "Explore map-based tracking and community features in a React application.",
    "technologies": [
      "React",
      "TypeScript",
      "MapLibre"
    ],
    "image": "",
    "gallery": [],
    "github": "",
    "demo": "",
    "accent": "build"
  },
  {
    "id": "knowledge-capture",
    "index": "08",
    "title": "Knowledge Capture",
    "tagline": "A local-first system for saving and finding useful written knowledge.",
    "category": "PYTHON / LOCAL TOOLS",
    "year": "2026",
    "description": "A personal project for capturing links and files, extracting written content, organising it, detecting duplicates and searching it later. The local workflow is still in development.",
    "problem": "Useful sources are easy to lose across tabs, files, and notes.",
    "solution": "Build a searchable local archive that keeps source references and detailed summaries.",
    "technologies": [
      "Python",
      "SQLite",
      "FastAPI"
    ],
    "image": "",
    "gallery": [],
    "github": "",
    "demo": "",
    "accent": "build"
  },
  {
    "id": "rooted",
    "index": "09",
    "title": "ROOTED.MY Exploration",
    "tagline": "Exploring AI-assisted analysis of shampoo ingredients.",
    "category": "AI / PRODUCT CONCEPT",
    "year": "2026",
    "description": "An early product exploration around making shampoo ingredient information easier to understand through AI-assisted analysis.",
    "problem": "Ingredient labels can be hard to interpret.",
    "solution": "Explore a clearer way to analyse and explain ingredients.",
    "technologies": [],
    "image": "",
    "gallery": [],
    "github": "",
    "demo": "",
    "accent": "build"
  },
  {
    "id": "pocket-orbit",
    "index": "10",
    "title": "Pocket Orbit",
    "tagline": "A playable little browser game inside this portfolio.",
    "category": "WEB / INTERACTIVE",
    "year": "2026",
    "description": "A side project in the portfolio: pilot a ship through an asteroid field, collect signals, and try to stay in orbit. It supports keyboard and touch controls.",
    "problem": "Make the portfolio a place to play with an interaction, not just read about one.",
    "solution": "Build a compact browser arcade with a direct play loop.",
    "technologies": [
      "React",
      "TypeScript",
      "Canvas"
    ],
    "image": "",
    "gallery": [],
    "github": "",
    "demo": "/play",
    "accent": "build"
  },
  {
    "id": "netbeans-bridge",
    "index": "11",
    "title": "NetBeans Bridge",
    "tagline": "A private bridge for working with local Java coursework.",
    "category": "JAVA / DEVELOPER TOOLS",
    "year": "2026",
    "description": "A local tool project connecting an assistant to approved NetBeans coursework folders. Its scope includes reading and editing source, building and running projects, and inspecting compiler output. I use it as a private workflow tool.",
    "problem": "Moving code and build errors between an IDE and an assistant interrupts the learning workflow.",
    "solution": "Expose a small set of scoped local project tools.",
    "technologies": [
      "Java",
      "NetBeans",
      "MCP"
    ],
    "image": "",
    "gallery": [],
    "github": "",
    "demo": "",
    "accent": "build"
  }
];
