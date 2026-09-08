"use client";

import ExifReader from "exifreader";

export interface PhotoExif {
  camera?: string;
  lens?: string;
  aperture?: string;
  shutterSpeed?: string;
  iso?: string;
  date?: string;
}

/**
 * Reads EXIF metadata from an image via a fetch of the file URL.
 * Falls back gracefully to an empty object on any failure (missing file,
 * no metadata, or network error). Callers should merge EXIF over user-set
 * data so hand-filled fields survive.
 */
export async function readPhotoExif(url: string): Promise<PhotoExif> {
  if (!url) return {};
  try {
    const res = await fetch(url);
    if (!res.ok) return {};
    const buf = await res.arrayBuffer();
    const tags = ExifReader.load(buf);
    const make = tags["Make"]?.description;
    const model = tags["Model"]?.description;
    const lens = tags["LensModel"]?.description;
    const aperture = tags["FNumber"]?.description;
    const shutter = tags["ExposureTime"]?.description;
    const iso = tags["ISOSpeedRatings"]?.description ?? tags["ISO"]?.description;
    const date = tags["DateTimeOriginal"]?.description ?? tags["DateTime"]?.description;

    return {
      camera: make && model ? `${make} ${model}`.trim() : (model ?? undefined),
      lens: lens ?? undefined,
      aperture: aperture ? `f/${aperture}` : undefined,
      shutterSpeed: shutter ? `${shutter}s` : undefined,
      iso: iso ? `ISO ${iso}` : undefined,
      date: date ?? undefined,
    };
  } catch {
    return {};
  }
}
