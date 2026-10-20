export interface EventItem {
  id: string; name: string; org: string; year: string; status: "completed" | "upcoming";
  project?: string; story?: string; date?: string;
}

// Only reported roles, results and events with source support. Exact dates are
// intentionally omitted where the résumé/profile does not give them.
export const events: EventItem[] = [
  {
    "id": "claude-impact-lab-2026",
    "name": "CLAUDE IMPACT LAB",
    "org": "First event in preparation · hosting planned",
    "year": "November 2026",
    "status": "upcoming",
    "story": "Preparing to host the first Claude Impact Lab in November."
  },
  {
    "id": "myssp-2026",
    "name": "SELECTED FOR MYSSP’26",
    "org": "Selected member",
    "year": "September 2026",
    "status": "completed",
    "story": "Selected to join MYSSP’26."
  },
  {
    "id": "oralviu-2026",
    "name": "DORMATHON — ORALVIU",
    "org": "Remote dental monitoring app demo",
    "year": "October 2026",
    "status": "completed",
    "story": "I worked on research, UI/UX, pitching and team coordination. Our team showed a working app demo; the proposed image-capture hardware was not integrated."
  },
  {
    "id": "krackeddevs-2026",
    "name": "FIVE UNIVERSITY AMBASSADORS ONBOARDED",
    "org": "National KD University Hubs Lead",
    "year": "September 2026",
    "status": "completed",
    "story": "Recruited and onboarded five university ambassadors and coordinate campus relationships, resources and plans for workshops and hackathons."
  },
  {
    "id": "aws-community-day-2026",
    "name": "AWS COMMUNITY DAY",
    "org": "HackDev booth representative",
    "year": "September 2026",
    "status": "completed",
    "story": "Represented HackDev MY at the community booth."
  },
  {
    "id": "hackdev-pitching-2026",
    "name": "HACKATHONS & EFFECTIVE PITCHING",
    "org": "HackDev × AIESEC Heriot-Watt · Speaker",
    "year": "July 2026",
    "status": "completed",
    "story": "I gave a session on hackathons and pitching for a student audience."
  },
  {
    "id": "cradle-bootcamp-2026",
    "name": "CRADLE STARTUP BOOTCAMP",
    "org": "Penang",
    "year": "July 2026",
    "status": "completed",
    "story": "Joined sessions on startup validation, business modelling, market research and pitching."
  },
  {
    "id": "imaginehack-2026",
    "name": "IMAGINEHACK — LUMIO",
    "org": "Taylor’s University",
    "year": "June 2026",
    "status": "completed",
    "project": "LUMIO",
    "story": "I worked on research and a frontend demo that analysed sample electricity-bill CSVs for large buildings."
  },
  {
    "id": "um-deep-tech-2026",
    "name": "UM / CRADLE DEEP TECH CHALLENGE",
    "org": "Best Technical Concept · HYDROSPARK",
    "year": "May 2026",
    "status": "completed",
    "story": "HYDROSPARK proposed a simulated hydropower concept using large water pipes. Our team received Best Technical Concept; I contributed research, business planning and the pitch."
  },
  {
    "id": "putrahack-2026",
    "name": "PUTRAHACK FINALIST",
    "org": "Universiti Putra Malaysia",
    "year": "March 2026",
    "status": "completed",
    "project": "Blockchain price traceability",
    "story": "Our team reached the final with a farm-to-retail transparency concept and a website/app prototype. I worked on research, the business model and pitching."
  },
  {
    "id": "hackdev-cybersecurity-2026",
    "name": "INTRODUCTION TO CYBERSECURITY",
    "org": "HackDev MY · Speaker",
    "year": "February 2026",
    "status": "completed",
    "story": "I spoke about cyber threats, ethical hacking fundamentals and security awareness, with demonstrations and a Q&A."
  },
  {
    "id": "fotokreatif-2026",
    "name": "MOBILEGRAPHY & THE ART OF SEEING",
    "org": "KOQ Fotokreatif, UTM · Speaker",
    "year": "February 2026",
    "status": "completed",
    "story": "I taught mobile photography and visual storytelling to pupils at SK Sultan Hishamuddin Alam Shah."
  },
  {
    "id": "qiub-2025",
    "name": "STARTUP MENTORSHIP",
    "org": "QIUB Startup · Media and events",
    "year": "2025",
    "status": "completed",
    "story": "During my February–June 2025 placement, I produced around four marketing videos per month, helped organise a networking event and joined interviews with eight Malaysian STEM startup founders."
  },
  {
    "id": "jpmpp-2025",
    "name": "JPMPP UTMKL EVENTS",
    "org": "Public Relations Secretariat · Emcee",
    "year": "2025",
    "status": "completed",
    "story": "I helped with communications and coordination and served as emcee at two official JPMPP events."
  },
  {
    "id": "ctf-2024-2025",
    "name": "CYBERSECURITY & CTF COMPETITIONS",
    "org": "National and IoT CTFs",
    "year": "2024–2025",
    "status": "completed",
    "story": "My results include a top-three national CTF placement among 230+ participants, a top-ten IoT CTF ranking, top ten with team r00tk1t in 3108 CTF: Bayang Satria, and top seven in the Yayasan Digital Malaysia Hardware Hacking Examination."
  },
  {
    "id": "tabung-haji-2024",
    "name": "YOUNG LEADERSHIP AMBASSADOR",
    "org": "Tabung Haji · Kuala Langat",
    "year": "2024",
    "status": "completed",
    "story": "I represented Kuala Langat at the Tabung Haji Leadership Bootcamp, interviewed the CEO of Tabung Haji and the chairman of Axiata, and joined youth leadership discussions."
  },
  {
    "id": "head-prefect-2024",
    "name": "HEAD PREFECT / TOKOH SAHSIAH",
    "org": "SMK Banting",
    "year": "2024",
    "status": "completed",
    "story": "I led a team of 101 prefects, coordinated school programmes and received Tokoh Sahsiah recognition. I also received Anugerah Duta Sahsiah Pengawas recognition at state and national level."
  },
  {
    "id": "tokoh-kokurikulum-2022",
    "name": "TOKOH KOKURIKULUM",
    "org": "SMK Telok Datok",
    "year": "2022",
    "status": "completed",
    "story": "I received Tokoh Kokurikulum recognition while studying at SMK Telok Datok."
  }
] as EventItem[];
