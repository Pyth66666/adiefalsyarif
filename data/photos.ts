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

export const photos: Photo[] = [];
