// CMS / database row shapes (snake_case, matching supabase/schema.sql)

export interface DbProject {
  id: string;
  title: string;
  tagline: string | null;
  description: string | null;
  problem: string | null;
  solution: string | null;
  year: string | null;
  category: string | null;
  status: "completed" | "ongoing" | "archived";
  technologies: string[];
  role: string | null;
  hero_image: string | null;
  gallery: string[];
  github: string | null;
  demo: string | null;
  featured: boolean;
  published: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface DbEvent {
  id: string;
  name: string;
  org: string | null;
  location: string | null;
  date: string | null;
  status: "upcoming" | "ongoing" | "completed";
  result: string | null;
  description: string | null;
  project: string | null;
  images: string[];
  external_link: string | null;
  featured: boolean;
  published: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface DbPhoto {
  id: string;
  src: string;
  title: string | null;
  description: string | null;
  location: string | null;
  date: string | null;
  category: string;
  camera: string | null;
  lens: string | null;
  aperture: string | null;
  shutter_speed: string | null;
  iso: string | null;
  featured: boolean;
  published: boolean;
  show_location: boolean;
  width: number | null;
  height: number | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface DbCollectionItem {
  id: string;
  title: string;
  event: string | null;
  organization: string | null;
  year: string | null;
  front_image: string | null;
  back_image: string | null;
  story: string | null;
  what_happened: string | null;
  what_i_built: string | null;
  people_i_met: string | null;
  photos: string[];
  related_project: string | null;
  external_link: string | null;
  featured: boolean;
  published: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface DbHackdev {
  id: string;
  name: string;
  description: string | null;
  members: number;
  universities: number;
  events: number;
  workshops: number;
  discord_url: string | null;
  website_url: string | null;
  image: string | null;
  story: string | null;
}

export interface DbStatistic {
  id: string;
  label: string;
  value: number;
  prefix: string | null;
  suffix: string | null;
  description: string | null;
  visual_type: string;
  display_order: number;
  visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbSocialLink {
  id: string;
  platform: string;
  label: string | null;
  url: string;
  icon: string | null;
  group_name: "tech" | "creative";
  visible: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface DbMediaItem {
  id: string;
  path: string;
  url: string | null;
  filename: string | null;
  mime: string | null;
  size: number | null;
  bucket: string;
  uploaded_by: string | null;
  created_at: string;
}

export interface DbProfile {
  id: string;
  email: string | null;
  name: string | null;
  title: string | null;
  short_bio: string | null;
  long_bio: string | null;
  location: string | null;
  email_public: string | null;
  profile_image: string | null;
  resume_url: string | null;
}

export interface DbSiteSettings {
  id: string;
  name: string;
  family: string;
  domain: string;
  descriptors: string;
  intro: string | null;
  about: string | null;
  contact_email: string | null;
}

// ── Public shapes consumed by the website ──────────────────

export interface PublicUser {
  id: string;
  email: string | null;
  name: string | null;
  role: "admin" | "member";
}

export interface PublicContent {
  site: {
    name: string;
    family: string;
    fullName: string;
    domain: string;
    descriptors: string;
    intro: string;
    about: string;
    contactEmail: string;
  };
  projects: import("@/data/projects").Project[];
  photos: import("@/data/photos").Photo[];
  events: import("@/data/events").EventItem[];
  collection: import("@/data/collection").CollectionBadge[];
  hackdev: {
    name: string;
    description: string;
    members: number;
    universities: number;
    events: number;
    workshops: number;
    discordUrl: string;
    websiteUrl: string;
    image: string;
    story: string;
  };
  statistics: import("@/data/telemetry").Metric[];
  community: import("@/data/telemetry").Metric[];
  socials: import("@/data/socials").SocialLink[];
  profile: DbProfile | null;
}

export const PHOTO_CATEGORIES = ["PEOPLE", "PLACES", "EVENTS", "STREET", "TRAVEL"] as const;
export const PROJECT_STATUSES = ["completed", "ongoing", "archived"] as const;
export const EVENT_STATUSES = ["upcoming", "ongoing", "completed"] as const;