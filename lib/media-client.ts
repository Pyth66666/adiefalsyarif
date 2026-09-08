"use client";

import { getSupabaseBrowser } from "@/lib/supabase/client";
import { supabaseEnv } from "@/lib/supabase/env";
import { validateUpload } from "@/lib/actions/validate";
import { recordMediaUpload } from "@/lib/media";
import ExifReader from "exifreader";

export interface UploadedImage {
  path: string;
  url: string;
}

export async function uploadImage(file: File): Promise<UploadedImage> {
  const sb = getSupabaseBrowser();
  if (!sb) throw new Error("Supabase not configured");
  const check = validateUpload(file);
  if (check) throw new Error(check);
  const bucket = supabaseEnv().bucket;
  const slug = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const path = `media/${slug}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
  const { error } = await sb.storage.from(bucket).upload(path, file, { cacheControl: "3600", upsert: false });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  const { data } = sb.storage.from(bucket).getPublicUrl(path);
  await recordMediaUpload({ path, filename: file.name, mime: file.type, size: file.size });
  return { path, url: data.publicUrl };
}

export interface DetectedExif {
  camera?: string;
  lens?: string;
  aperture?: string;
  shutterSpeed?: string;
  iso?: string;
  date?: string;
  orientation?: number | null;
}

export async function extractExifFromFile(file: File): Promise<DetectedExif> {
  try {
    const tags = ExifReader.load(await file.arrayBuffer());
    const make = tags["Make"]?.description;
    const model = tags["Model"]?.description;
    const lens = tags["LensModel"]?.description;
    const aperture = tags["FNumber"]?.description;
    const shutter = tags["ExposureTime"]?.description;
    const iso = tags["ISOSpeedRatings"]?.description ?? tags["ISO"]?.description;
    const date = tags["DateTimeOriginal"]?.description ?? tags["DateTime"]?.description;
    const orientation = tags["Orientation"]?.value ?? null;
    return {
      camera: make && model ? `${make} ${model}`.trim() : (model ?? undefined),
      lens: lens ?? undefined,
      aperture: aperture ? `f/${aperture}` : undefined,
      shutterSpeed: shutter ? `${shutter}s` : undefined,
      iso: iso ? `ISO ${iso}` : undefined,
      date: date ?? undefined,
      orientation: typeof orientation === "number" ? orientation : null,
    };
  } catch {
    return {};
  }
}

export async function hasGpsExif(file: File): Promise<boolean> {
  return file.arrayBuffer().then((buf) => {
    const tags = ExifReader.load(buf, { includeUnknown: true });
    return ["GPSLatitude", "GPSLongitude", "GPSAltitude"].some((k) => Boolean(tags[k]));
  }).catch(() => false);
}