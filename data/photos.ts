export interface Photo {
  id: string;
  src: string;
  title: string;
  location: string;
  date?: string;
  category: "PEOPLE" | "PLACES" | "EVENTS" | "STREET" | "TRAVEL";
  camera?: string;
  lens?: string;
  aperture?: string;
  shutterSpeed?: string;
  iso?: string;
  width: number;
  height: number;
}

export const photoCategories = ["ALL", "PEOPLE", "PLACES", "EVENTS", "STREET", "TRAVEL"] as const;

export const photos: Photo[] = [
  {
    id: "photo-01",
    src: "",
    title: "[PHOTO TITLE]",
    location: "KUALA LUMPUR",
    date: "24.08.2026",
    category: "PLACES",
    camera: "SONY α7R IV",
    lens: "50mm",
    aperture: "f/1.8",
    iso: "100",
    width: 1200,
    height: 800,
  },
  {
    id: "photo-02",
    src: "",
    title: "[PHOTO TITLE]",
    location: "[LOCATION]",
    date: "[DATE]",
    category: "PEOPLE",
    camera: "[CAMERA]",
    lens: "[LENS]",
    aperture: "[APERTURE]",
    iso: "[ISO]",
    width: 900,
    height: 1200,
  },
  {
    id: "photo-03",
    src: "",
    title: "[PHOTO TITLE]",
    location: "[LOCATION]",
    date: "[DATE]",
    category: "STREET",
    camera: "[CAMERA]",
    lens: "[LENS]",
    aperture: "[APERTURE]",
    iso: "[ISO]",
    width: 1400,
    height: 900,
  },
  {
    id: "photo-04",
    src: "",
    title: "[PHOTO TITLE]",
    location: "[LOCATION]",
    date: "[DATE]",
    category: "EVENTS",
    width: 1000,
    height: 1000,
  },
  {
    id: "photo-05",
    src: "",
    title: "[PHOTO TITLE]",
    location: "[LOCATION]",
    date: "[DATE]",
    category: "TRAVEL",
    width: 1100,
    height: 1300,
  },
  {
    id: "photo-06",
    src: "",
    title: "[PHOTO TITLE]",
    location: "[LOCATION]",
    date: "[DATE]",
    category: "PLACES",
    width: 1300,
    height: 850,
  },
];
