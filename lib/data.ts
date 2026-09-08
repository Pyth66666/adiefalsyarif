import { getSupabasePublic } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { PublicContent, DbProject, DbEvent, DbPhoto, DbCollectionItem, DbHackdev, DbStatistic, DbSocialLink, DbSiteSettings, DbProfile } from "@/lib/types";
import type { Project } from "@/data/projects";
import type { Photo } from "@/data/photos";
import type { EventItem } from "@/data/events";
import type { CollectionBadge } from "@/data/collection";
import type { Metric } from "@/data/telemetry";
import type { SocialLink } from "@/data/socials";
import { projects as projectPlaceholders } from "@/data/projects";
import { photos as photoPlaceholders } from "@/data/photos";
import { events as eventPlaceholders } from "@/data/events";
import { collection as collectionPlaceholders } from "@/data/collection";
import { telemetry as telemetryPlaceholders, community as communityPlaceholders } from "@/data/telemetry";
import { socials as socialPlaceholders, email as placeholderEmail } from "@/data/socials";
import { site as sitePlaceholders } from "@/data/site";

const byOrder = <T extends { display_order: number; created_at: string }>(rows: T[]) =>
  [...rows].sort((a, b) => a.display_order - b.display_order || a.created_at.localeCompare(b.created_at));

function toProject(p: DbProject, index: number): Project {
  return {
    id: p.id,
    index: String(index + 1).padStart(2, "0"),
    title: p.title,
    tagline: p.tagline ?? "",
    category: p.category ?? "",
    year: p.year ?? "",
    description: p.description ?? "",
    problem: p.problem ?? "",
    solution: p.solution ?? "",
    technologies: p.technologies,
    image: p.hero_image ?? "",
    gallery: p.gallery,
    github: p.github ?? "",
    demo: p.demo ?? "",
    accent: (p.category ?? "").toLowerCase() === "create" ? "create" : "build",
  };
}

function toPhoto(p: DbPhoto): Photo {
  return {
    id: p.id,
    src: p.src,
    title: p.title ?? "",
    location: p.location ?? "",
    date: p.date ?? undefined,
    category: (["PEOPLE", "PLACES", "EVENTS", "STREET", "TRAVEL"] as const).includes(p.category as Photo["category"])
      ? (p.category as Photo["category"])
      : "STREET",
    camera: p.camera ?? undefined,
    lens: p.lens ?? undefined,
    aperture: p.aperture ?? undefined,
    shutterSpeed: p.shutter_speed ?? undefined,
    iso: p.iso ?? undefined,
    width: p.width ?? 1200,
    height: p.height ?? 800,
  };
}

function toEvent(e: DbEvent): EventItem {
  return {
    id: e.id,
    name: e.name,
    org: e.org ?? "",
    year: e.date ? new Date(e.date).getFullYear().toString() : "",
    status: e.status === "upcoming" || e.status === "ongoing" ? "upcoming" : "completed",
    project: e.project ?? undefined,
    story: e.description ?? undefined,
    date: e.date ?? undefined,
  };
}

function toCollection(c: DbCollectionItem): CollectionBadge {
  return {
    id: c.id,
    title: c.title,
    event: c.organization ?? c.event ?? "",
    year: c.year ?? "",
    frontImage: c.front_image ?? "",
    backImage: c.back_image ?? "",
    story: c.story ?? "",
    whatHappened: c.what_happened ?? "",
    whatIBuilt: c.what_i_built ?? "",
    peopleIMet: c.people_i_met ?? "",
    photos: c.photos,
    project: c.related_project ?? "",
  };
}

function toMetric(s: DbStatistic): Metric {
  return {
    id: s.id,
    label: s.label,
    value: Number(s.value),
    prefix: s.prefix ?? undefined,
    suffix: s.suffix ?? undefined,
  };
}

function toSocial(s: DbSocialLink): SocialLink {
  return {
    id: s.id,
    label: s.label ?? s.platform,
    url: s.url,
    group: s.group_name,
  };
}

export async function getPublicContent(): Promise<PublicContent> {
  if (!isSupabaseConfigured()) return placeholderContent();
  const sb = getSupabasePublic();
  if (!sb) return placeholderContent();

  const [projectsRes, photosRes, eventsRes, collectionRes, hackdevRes, statsRes, socialsRes, settingsRes, profilesRes] =
    await Promise.all([
      sb.from("projects").select("*").eq("published", true).order("display_order"),
      sb.from("photos").select("*").eq("published", true).order("display_order"),
      sb.from("events").select("*").eq("published", true).order("display_order"),
      sb.from("collection_items").select("*").eq("published", true).order("display_order"),
      sb.from("hackdev").select("*").limit(1),
      sb.from("statistics").select("*").eq("visible", true).order("display_order"),
      sb.from("social_links").select("*").eq("visible", true).order("display_order"),
      sb.from("site_settings").select("*").limit(1),
      sb.from("profiles").select("*").limit(1),
    ]);

  const projects = (projectsRes.data as DbProject[]) ?? [];
  const photos = (photosRes.data as DbPhoto[]) ?? [];
  const events = (eventsRes.data as DbEvent[]) ?? [];
  const collectionItems = (collectionRes.data as DbCollectionItem[]) ?? [];
  const hackdevRows = (hackdevRes.data as DbHackdev[]) ?? [];
  const stats = (statsRes.data as DbStatistic[]) ?? [];
  const socials = (socialsRes.data as DbSocialLink[]) ?? [];
  const settings = (settingsRes.data as DbSiteSettings[]) ?? [];
  const profiles = (profilesRes.data as DbProfile[]) ?? [];

  const setting = settings[0] ?? null;
  const hackdev = hackdevRows[0] ?? null;

  return {
    site: {
      name: setting?.name || sitePlaceholders.name,
      family: setting?.family || sitePlaceholders.family,
      fullName: `${setting?.name || sitePlaceholders.name} ${setting?.family || sitePlaceholders.family}`,
      domain: setting?.domain || sitePlaceholders.domain,
      descriptors: setting?.descriptors || sitePlaceholders.descriptors,
      intro: setting?.intro || sitePlaceholders.intro,
      about: setting?.about || sitePlaceholders.about,
      contactEmail: setting?.contact_email || profiles[0]?.email_public || "",
    },
    profile: profiles[0] ?? null,
    projects: projects.filter((p) => p.published).map(toProject),
    photos: photos.filter((p) => p.published).map(toPhoto),
    events: events.filter((e) => e.published).map(toEvent),
    collection: collectionItems.filter((c) => c.published).map(toCollection),
    hackdev: {
      name: hackdev?.name || "HACKDEV",
      description: hackdev?.description || "",
      members: hackdev?.members ?? 0,
      universities: hackdev?.universities ?? 0,
      events: hackdev?.events ?? 0,
      workshops: hackdev?.workshops ?? 0,
      discordUrl: hackdev?.discord_url ?? "",
      websiteUrl: hackdev?.website_url ?? "",
      image: hackdev?.image ?? "",
      story: hackdev?.story ?? "",
    },
    statistics: byOrder(stats).map(toMetric),
    community: [
      { id: "h-members", label: "MEMBERS", value: hackdev?.members ?? 1500, suffix: "+" },
      { id: "h-universities", label: "UNIVERSITIES", value: hackdev?.universities ?? 0 },
      { id: "h-events", label: "EVENTS", value: hackdev?.events ?? 0 },
      { id: "h-workshops", label: "WORKSHOPS", value: hackdev?.workshops ?? 0 },
    ],
    socials: socials.filter((s) => s.visible && s.url).map(toSocial),
  };
}

function placeholderContent(): PublicContent {
  return {
    site: { name: sitePlaceholders.name, family: sitePlaceholders.family, fullName: `${sitePlaceholders.name} ${sitePlaceholders.family}`, domain: sitePlaceholders.domain, descriptors: sitePlaceholders.descriptors, intro: sitePlaceholders.intro, about: sitePlaceholders.about, contactEmail: placeholderEmail },
    profile: null,
    projects: projectPlaceholders.map((p) => ({ ...p })),
    photos: photoPlaceholders.map((p) => ({ ...p })),
    events: eventPlaceholders.map((e) => ({ ...e })),
    collection: collectionPlaceholders.map((c) => ({ ...c })),
    hackdev: { name: "HACKDEV", description: "A community for people exploring technology and cybersecurity.", members: 1500, universities: 0, events: 0, workshops: 0, discordUrl: "", websiteUrl: "", image: "", story: "" },
    statistics: telemetryPlaceholders.map((m) => ({ ...m })),
    community: communityPlaceholders.map((m) => ({ ...m })),
    socials: socialPlaceholders.map((s) => ({ ...s })),
  };
}