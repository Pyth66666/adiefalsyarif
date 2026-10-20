export interface CollectionBadge {
  id: string;
  title: string;
  event: string;
  year: string;
  frontImage: string;
  backImage?: string;
  story: string;
  whatHappened: string;
  whatIBuilt: string;
  peopleIMet: string;
  photos: string[];
  project?: string;
}

export const collection: CollectionBadge[] = [
  {
    "id": "myssp-2026",
    "title": "MYSSP’26",
    "event": "Selected member",
    "year": "2026",
    "frontImage": "",
    "backImage": "",
    "story": "Selected to join MYSSP’26 in September 2026.",
    "whatHappened": "I was selected as a member of MYSSP’26.",
    "whatIBuilt": "",
    "peopleIMet": "",
    "photos": [],
    "project": ""
  },
  {
    "id": "hydrospark-award",
    "title": "BEST TECHNICAL CONCEPT",
    "event": "UM–Cradle National Deep Tech Challenge",
    "year": "2026",
    "frontImage": "",
    "backImage": "",
    "story": "Our HYDROSPARK team received Best Technical Concept for a hydropower proof of concept.",
    "whatHappened": "We developed and pitched a simulated solution using large water pipes.",
    "whatIBuilt": "I contributed research, business planning and the pitch.",
    "peopleIMet": "",
    "photos": [],
    "project": "HYDROSPARK"
  },
  {
    "id": "putrahack-finalist",
    "title": "PUTRAHACK FINALIST",
    "event": "Universiti Putra Malaysia",
    "year": "2026",
    "frontImage": "",
    "backImage": "",
    "story": "Our team reached the PutraHack final with a farm-to-retail price-transparency concept.",
    "whatHappened": "We made a website/app prototype and pitched the idea.",
    "whatIBuilt": "I worked on research, the business model and pitching.",
    "peopleIMet": "",
    "photos": [],
    "project": "Farm-to-Retail Traceability"
  }
];
