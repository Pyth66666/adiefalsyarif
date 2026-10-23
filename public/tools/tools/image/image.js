// Pure image helpers — no DOM, no canvas, no network.
//
// Two families live here:
//
//   1. Byte-level, lossless metadata stripping for JPEG and PNG. These operate
//      directly on a Uint8Array and copy the payload through untouched, so the
//      compressed image data is bit-for-bit identical and only the metadata
//      (EXIF/GPS, XMP, IPTC, comment, PNG text/eXIf chunks) is dropped.
//   2. Small arithmetic/format helpers used by the UI: computeTargetSize,
//      mimeForFormat, humanBytes, detectImageType and readJpegExifSummary.
//
// Everything here runs unchanged in the browser and in `node tests/image.test.mjs`.

/* ---------- errors ---------- */

export class ImageError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ImageError';
    this.code = code;
  }
}

/* ---------- format detection ---------- */

/**
 * Sniff an image format from its leading bytes.
 * @param {Uint8Array} bytes
 * @returns {'jpeg'|'png'|'gif'|'webp'|'bmp'|null}
 */
export function detectImageType(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 4) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'gif';
  if (bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return 'webp';
  }
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return 'bmp';
  return null;
}

/* ---------- JPEG marker walking ---------- */

// JPEG structural markers that never carry segment payload we care about.
const JPEG_STANDALONE = new Set([0x01]); // TEM
// SOS (0xDA) starts the entropy-coded scan.
const SOS = 0xda;
const EOI = 0xd9;

/** The single friendly message for a structurally incomplete JPEG. */
const JPEG_TRUNCATED_MESSAGE = 'The JPEG is truncated or damaged; nothing was changed';

/** Throw the friendly ImageError used for every incomplete-JPEG case. */
function throwJpegTruncated() {
  throw new ImageError('jpeg', JPEG_TRUNCATED_MESSAGE);
}

/* ---------- JPEG metadata strip ---------- */

/**
 * Walk a JPEG's full marker structure, including any markers that appear
 * *between* entropy-coded scans of a progressive JPEG, and return the list of
 * segments up to EOI. Everything after EOI is ignored here.
 *
 * The entropy-coded data following each SOS is scanned correctly: 0xFF00 byte
 * stuffing and 0xFFD0..0xFFD7 restart markers are data, and the walk resumes at
 * the next real marker (which in a progressive JPEG may be DHT/DQT/SOS again).
 *
 * R2-03: an incomplete JPEG is REJECTED, never silently completed. The walk
 * throws the friendly ImageError when any segment length is < 2, a segment runs
 * past the end of the data, no SOS is found, the entropy-coded data ends
 * without an EOI, or no EOI is present at all. A fabricated EOI is never
 * returned, so a truncated or damaged file can never masquerade as "clean".
 *
 * @param {Uint8Array} bytes
 * @returns {{ segments: Array<{marker:number,start:number,length:number}>, sawEoi: boolean }}
 */
function walkJpegFull(bytes) {
  if (detectImageType(bytes) !== 'jpeg') {
    throw new ImageError('jpeg', 'Not a JPEG file.');
  }
  const segments = [];
  let i = 2; // skip SOI
  let sawEoi = false;
  let sawSos = false;

  while (i < bytes.length) {
    if (bytes[i] !== 0xff) {
      // A stray byte outside a scan: tolerate by skipping it, but only outside
      // entropy data (inside scans we are called from scanEntropy).
      i += 1;
      continue;
    }
    // Collapse any run of fill 0xFF bytes down to the marker byte.
    while (i < bytes.length && bytes[i] === 0xff) i += 1;
    // A run of fill bytes with no marker byte afterwards is a truncated tail.
    if (i >= bytes.length) throwJpegTruncated();
    const marker = bytes[i];
    i += 1;

    if (marker === EOI) { sawEoi = true; break; }
    if (marker === 0x00) continue; // stray stuffing outside a scan: ignore
    if (marker >= 0xd0 && marker <= 0xd7) continue; // stray RSTn: ignore

    if (marker === SOS) {
      if (i + 2 > bytes.length) throwJpegTruncated(); // truncated SOS header
      const size = (bytes[i] << 8) | bytes[i + 1];
      if (size < 2 || i + size > bytes.length) throwJpegTruncated();
      const start = i - 2;
      // Skip the SOS header, then walk the entropy-coded data. The scan is
      // recorded as part of the SOS segment so it is copied verbatim.
      i += size;
      const scanEnd = scanEntropy(bytes, i);
      segments.push({ marker, start, length: scanEnd - start });
      i = scanEnd;
      sawSos = true;
      continue;
    }

    if (JPEG_STANDALONE.has(marker)) {
      segments.push({ marker, start: i - 2, length: 2 });
      continue;
    }
    if (i + 2 > bytes.length) throwJpegTruncated(); // truncated segment header
    const size = (bytes[i] << 8) | bytes[i + 1];
    if (size < 2 || i + size > bytes.length) throwJpegTruncated(); // bad length
    segments.push({ marker, start: i - 2, length: size + 2 });
    i += size;
  }

  // The stream must actually reach an EOI, and must contain at least one scan.
  // Without both, the file is truncated or damaged and is rejected whole.
  if (!sawEoi) throwJpegTruncated();
  if (!sawSos) throwJpegTruncated();
  return { segments, sawEoi };
}

/**
 * Advance past entropy-coded scan data starting at `i`, returning the index of
 * the first byte that is the start of a real marker (0xFF followed by a byte
 * that is neither 0x00 stuffing nor 0xD0..0xD7 restart), or bytes.length.
 * @param {Uint8Array} bytes
 * @param {number} i
 */
function scanEntropy(bytes, i) {
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) { i += 1; continue; }
    // i+1 may run off the end (truncated tail): stop there.
    if (i + 1 >= bytes.length) return bytes.length;
    const n = bytes[i + 1];
    if (n === 0x00 || (n >= 0xd0 && n <= 0xd7)) { i += 2; continue; } // data
    if (n === 0xff) { i += 1; continue; } // fill run, re-check
    return i; // a real marker begins here
  }
  return bytes.length;
}

/** Payload of an APP2 segment that identifies an ICC profile ("ICC_PROFILE\0"). */
const ICC_SIG = [0x49, 0x43, 0x43, 0x5f, 0x50, 0x52, 0x4f, 0x46, 0x49, 0x4c, 0x45, 0x00];
/** Payload of an APP14 segment that identifies an Adobe colour transform. */
const ADOBE_SIG = [0x41, 0x64, 0x6f, 0x62, 0x65];

/** Does segment `seg` in `bytes` carry a payload starting with `sig`? */
function segmentHasSignature(bytes, seg, sig) {
  const payload = seg.start + 4; // FF marker LL LL
  if (payload + sig.length > seg.start + seg.length) return false;
  for (let k = 0; k < sig.length; k += 1) {
    if (bytes[payload + k] !== sig[k]) return false;
  }
  return true;
}

/**
 * Decide whether a non-scan marker segment should be kept by the metadata strip.
 *
 * Kept: every structural segment (DHT/DQT/SOF/DRI/DAC/SOS/etc), APP2 that is
 * an ICC colour profile, and APP14 "Adobe" (colour transform). Dropped: COM,
 * APP1 (EXIF/XMP), APP13 (IPTC/Photoshop) and every other APPn.
 */
function keepJpegSegment(bytes, seg) {
  const m = seg.marker;
  if (m === 0xe2) return segmentHasSignature(bytes, seg, ICC_SIG); // APP2 -> ICC only
  if (m === 0xee) return segmentHasSignature(bytes, seg, ADOBE_SIG); // APP14 Adobe only
  if (m === 0xfe) return false; // COM
  if (m >= 0xe0 && m <= 0xef) return false; // other APPn (APP1, APP13, ...)
  return true; // structural / table / scan markers
}

/**
 * Remove embedded metadata from a JPEG without re-encoding the image.
 *
 * Dropped: APP1 (EXIF and XMP), APP13 (IPTC / Photoshop), COM (comments) and
 * every APPn segment except APP2 (ICC colour profile) and APP14 "Adobe" (which
 * carries the colour transform). The walk covers the WHOLE marker stream,
 * including APPn/COM segments that a progressive JPEG places between scans, and
 * everything after EOI is discarded (appended thumbnails, motion-photo video,
 * hidden data), so a "clean" file really is clean. The entropy-coded image data
 * itself is copied verbatim, so pixels are unchanged.
 *
 * @param {Uint8Array} bytes
 * @returns {Uint8Array}
 */
export function stripJpegMetadata(bytes) {
  const { segments, sawEoi } = walkJpegFull(bytes);
  // walkJpegFull already throws for an incomplete JPEG; this is a defensive
  // guarantee that an EOI terminator is only ever written for a real one.
  if (!sawEoi) throwJpegTruncated();

  // Build a keep/drop decision for every segment in order, preserving SOS
  // segments (and the entropy data between them) exactly where they were.
  const parts = [];
  parts.push(bytes.subarray(0, 2)); // SOI
  for (const seg of segments) {
    if (keepJpegSegment(bytes, seg)) {
      parts.push(bytes.subarray(seg.start, seg.start + seg.length));
    }
  }
  // A single, clean EOI terminator; nothing after the original EOI survives.
  parts.push(new Uint8Array([0xff, 0xd9]));

  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/**
 * Summarise a JPEG's EXIF block: how many APP1/EXIF segments exist and whether
 * a GPS IFD pointer (tag 0x8825) is present. Purely a read; never mutates.
 * Returns null when there is no EXIF at all.
 * @param {Uint8Array} bytes
 * @returns {{ appSegments: number, hasExif: boolean, hasGps: boolean }|null}
 */
export function readJpegExifSummary(bytes) {
  let segments;
  try {
    ({ segments } = walkJpegFull(bytes));
  } catch {
    return null;
  }
  let appSegments = 0;
  let hasExif = false;
  let hasGps = false;
  for (const seg of segments) {
    if (seg.marker !== 0xe1) continue;
    appSegments += 1;
    // 6-byte payload header: "Exif\0\0", then TIFF data.
    const p = seg.start + 4; // skip FF E1 LL LL
    if (p + 6 > seg.start + seg.length) continue;
    const id = String.fromCharCode(bytes[p], bytes[p + 1], bytes[p + 2], bytes[p + 3]);
    if (id !== 'Exif') continue;
    hasExif = true;
    const app1End = seg.start + seg.length;
    if (hasTagInTiff(bytes, p + 6, app1End, 0x8825)) hasGps = true;
  }
  if (appSegments === 0) return null;
  return { appSegments, hasExif, hasGps };
}

/**
 * Look for a top-level TIFF tag inside an EXIF TIFF block. Enough to answer
 * "does this file contain GPS info" without a full EXIF parser.
 *
 * R2-06: every offset is bounded by `tiffEnd` (the end of the enclosing APP1
 * segment), never by the whole file. A TIFF header whose IFD pointer, entry
 * count or any 12-byte entry points past the segment is treated as unknown
 * (returns false) instead of following bytes that belong to later segments.
 *
 * @param {Uint8Array} bytes
 * @param {number} tiffStart absolute offset of the TIFF header
 * @param {number} tiffEnd   absolute offset just past the APP1 segment
 * @param {number} tag       tag id to look for, e.g. 0x8825 (GPS IFD pointer)
 */
function hasTagInTiff(bytes, tiffStart, tiffEnd, tag) {
  // The header (8 bytes), the IFD and every entry must lie inside the segment.
  if (!(tiffStart >= 0) || !(tiffEnd <= bytes.length) || tiffStart + 8 > tiffEnd) return false;
  const le = bytes[tiffStart] === 0x49 && bytes[tiffStart + 1] === 0x49;
  const be = bytes[tiffStart] === 0x4d && bytes[tiffStart + 1] === 0x4d;
  if (!le && !be) return false;
  const u16 = (o) => (le ? bytes[o] | (bytes[o + 1] << 8) : (bytes[o] << 8) | bytes[o + 1]);
  const u32 = (o) => (le
    ? (bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)) >>> 0
    : ((bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>> 0);

  if (u16(tiffStart + 2) !== 0x002a) return false;
  const ifd0 = tiffStart + u32(tiffStart + 4);
  // The IFD (and thus its entry count) must sit inside the segment.
  if (ifd0 < tiffStart || ifd0 + 2 > tiffEnd) return false;
  const count = u16(ifd0);
  // Guard against absurd counts.
  if (count > 4096) return false;
  // The whole entry table must fit: each entry needs its full 12 bytes inside.
  if (ifd0 + 2 + count * 12 > tiffEnd) return false;
  for (let e = 0; e < count; e += 1) {
    const off = ifd0 + 2 + e * 12;
    if (u16(off) === tag) return true;
  }
  return false;
}

/* ---------- PNG chunk walking ---------- */

// PNG signature: 137 P N G \r \n 26 \n
const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
// Ancillary chunks that carry (or describe) text / EXIF metadata.
const PNG_STRIP = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt']);

/**
 * Strip metadata chunks from a PNG losslessly.
 *
 * Drops eXIf, tEXt, zTXt and iTXt chunks. Each chunk is removed whole
 * (length + type + data + CRC), so every remaining chunk keeps its own valid
 * CRC and the IDAT image data is untouched.
 *
 * @param {Uint8Array} bytes
 * @returns {Uint8Array}
 */
export function stripPngMetadata(bytes) {
  if (detectImageType(bytes) !== 'png') {
    throw new ImageError('png', 'Not a PNG file.');
  }
  const keep = [bytes.subarray(0, 8)]; // signature
  let i = 8;
  let sawIend = false;

  while (i + 8 <= bytes.length) {
    const len = (bytes[i] << 24 | bytes[i + 1] << 16 | bytes[i + 2] << 8 | bytes[i + 3]) >>> 0;
    const type = String.fromCharCode(bytes[i + 4], bytes[i + 5], bytes[i + 6], bytes[i + 7]);
    const total = 12 + len; // len(4) + type(4) + data(len) + crc(4)
    if (i + total > bytes.length) {
      throw new ImageError('png', 'Malformed PNG: chunk extends past end of file.');
    }
    if (!PNG_STRIP.has(type)) {
      keep.push(bytes.subarray(i, i + total));
    }
    if (type === 'IEND') { sawIend = true; i += total; break; }
    i += total;
  }
  if (!sawIend) {
    throw new ImageError('png', 'Malformed PNG: missing IEND chunk.');
  }

  const outLen = keep.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(outLen);
  let o = 0;
  for (const c of keep) { out.set(c, o); o += c.length; }
  return out;
}

/* ---------- size math ---------- */

/**
 * Work out the pixel dimensions a resize should produce.
 *
 * Rules: a missing/0 target on either axis is derived from the other while
 * keeping the aspect ratio. When `keepAspect` is true, an explicit target on
 * one axis drives the other; if both are given the width wins. Without
 * `allowUpscale` the result is never larger than the source (the smaller of
 * the two deciding factors), so ticking "never upscale" honestly downsizes
 * only.
 *
 * @param {number} w        source width  (> 0)
 * @param {number} h        source height (> 0)
 * @param {object} opts
 * @param {number} [opts.width]        target width  (0/undefined = derive)
 * @param {number} [opts.height]       target height (0/undefined = derive)
 * @param {boolean} [opts.keepAspect]  default true
 * @param {boolean} [opts.allowUpscale] default false
 * @returns {{ width: number, height: number }}
 */
export function computeTargetSize(w, h, opts = {}) {
  const srcW = Math.round(Number(w));
  const srcH = Math.round(Number(h));
  if (!(srcW > 0) || !(srcH > 0)) {
    throw new ImageError('size', 'Source dimensions must be positive numbers.');
  }
  const keepAspect = opts.keepAspect !== false;
  const allowUpscale = opts.allowUpscale === true;
  const tw = Math.round(Number(opts.width) || 0);
  const th = Math.round(Number(opts.height) || 0);

  let outW = tw > 0 ? tw : 0;
  let outH = th > 0 ? th : 0;

  if (keepAspect) {
    if (outW > 0 && outH > 0) {
      // Width is authoritative; derive height from it.
      outH = Math.round((outW * srcH) / srcW);
    } else if (outW > 0) {
      outH = Math.round((outW * srcH) / srcW);
    } else if (outH > 0) {
      outW = Math.round((outH * srcW) / srcH);
    } else {
      outW = srcW;
      outH = srcH;
    }
  } else {
    if (outW <= 0) outW = srcW;
    if (outH <= 0) outH = srcH;
  }

  // Clamp to at least 1px.
  outW = Math.max(1, outW);
  outH = Math.max(1, outH);

  if (!allowUpscale) {
    if (outW > srcW || outH > srcH) {
      // Scale the pair down uniformly until neither axis exceeds the source.
      const scale = Math.min(srcW / outW, srcH / outH);
      outW = Math.max(1, Math.round(outW * scale));
      outH = Math.max(1, Math.round(outH * scale));
    }
  }
  return { width: outW, height: outH };
}

/* ---------- format helpers ---------- */

/**
 * Canonical MIME type for a short OUTPUT format id (JPEG/PNG/WebP only).
 * Used for canvas.toBlob, where only the encodable formats are valid.
 * @param {'png'|'jpeg'|'jpg'|'webp'} format
 */
export function mimeForFormat(format) {
  switch (String(format).toLowerCase()) {
    case 'png': return 'image/png';
    case 'jpeg':
    case 'jpg': return 'image/jpeg';
    case 'webp': return 'image/webp';
    default: throw new ImageError('format', `Unsupported output format "${format}".`);
  }
}

/**
 * MIME type for a detected SOURCE format id, including the input-only formats
 * the tool advertises (GIF, BMP) that it cannot encode. Used to build the
 * preview Blob and hand bytes to createImageBitmap. Unknown types return null
 * so the caller can show its friendly error rather than throwing here.
 * @param {'jpeg'|'jpg'|'png'|'webp'|'gif'|'bmp'} type
 * @returns {string|null}
 */
export function sourceMimeForType(type) {
  switch (String(type).toLowerCase()) {
    case 'jpeg':
    case 'jpg': return 'image/jpeg';
    case 'png': return 'image/png';
    case 'webp': return 'image/webp';
    case 'gif': return 'image/gif';
    case 'bmp': return 'image/bmp';
    default: return null;
  }
}

/**
 * Human-readable byte size, matching the shell's formatBytes so the Image tool
 * and the rest of the hub report sizes identically.
 * @param {number} bytes
 */
export function humanBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i += 1; }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[i]}`;
}

/* ---------- input generation (staleness guard) ---------- */

/**
 * A tiny monotonic generation counter used to discard async work whose input
 * has since changed. The UI bumps `next()` whenever it invalidates a pending
 * result (file add/replace/clear, option change); an async task captures the
 * token at start and checks `isCurrent(token)` before publishing, so a result
 * that finishes late can never overwrite a newer state.
 *
 * Pure and DOM-free, so the invariant is unit-testable in node.
 *
 * @returns {{ next: () => number, current: () => number, isCurrent: (token: number) => boolean }}
 */
export function createGeneration() {
  let gen = 0;
  return {
    next() { gen += 1; return gen; },
    current() { return gen; },
    isCurrent(token) { return token === gen; },
  };
}