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
    id: "imaginehack-badge",
    title: "IMAGINEHACK 2026",
    event: "Taylor's University",
    year: "2026",
    frontImage: "",
    backImage: "",
    story: "[STORY OF THE BADGE]",
    whatHappened: "[WHAT HAPPENED AT THE EVENT]",
    whatIBuilt: "[WHAT I BUILT]",
    peopleIMet: "[PEOPLE I MET]",
    photos: [],
    project: "",
  },
  {
    id: "badge-02",
    title: "[BADGE TITLE]",
    event: "[EVENT NAME]",
    year: "[YEAR]",
    frontImage: "",
    backImage: "",
    story: "[STORY]",
    whatHappened: "[WHAT HAPPENED]",
    whatIBuilt: "[WHAT I BUILT]",
    peopleIMet: "[PEOPLE I MET]",
    photos: [],
    project: "",
  },
];
