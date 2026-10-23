// Pure, DOM-free and canvas-free logic for the "Images -> PDF / PDF -> images"
// tool (tools/pdf category).
//
// This module holds the arithmetic and text rules that the UI leans on: page
// sizes and image fitting for the images-to-PDF pass, the page-range parser and
// the filename/collision rules for the PDF-to-images pass, a byte-level JPEG
// EXIF-orientation reader, and two small format sniffs. Nothing here touches the
// DOM, a canvas, pdf-lib or pdf.js, so it runs unchanged in the browser and in
// `node tests/imgpdf.test.mjs`.

/* ---------- errors ---------- */

export class ImgPdfError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ImgPdfError';
    this.code = code;
  }
}

/** Construct an ImgPdfError (thin helper so call sites read nicely). */
export function logicError(code, message) {
  return new ImgPdfError(code, message);
}

/* ---------- page sizes (PDF points; 1 pt = 1/72 inch) ---------- */

/** ISO A4 in portrait points. */
export const A4 = { width: 595.28, height: 841.89 };
/** US Letter in portrait points. */
export const LETTER = { width: 612, height: 792 };

/**
 * The width/height of a named page size in PDF points for the given
 * orientation. `portrait` is the named size as-is; `landscape` swaps the axes.
 * @param {'a4'|'letter'} id
 * @param {'portrait'|'landscape'} orientation
 * @returns {{ width: number, height: number }}
 */
export function pageSizeInPoints(id, orientation) {
  const base = id === 'a4' ? A4 : id === 'letter' ? LETTER : null;
  if (!base) throw new ImgPdfError('pageSize', `Unknown page size "${id}".`);
  return orientation === 'landscape'
    ? { width: base.height, height: base.width }
    : { width: base.width, height: base.height };
}

/**
 * Decide the page orientation for an image. `auto` follows the image's own
 * aspect ratio (wide -> landscape, tall/square -> portrait); an explicit
 * 'portrait'/'landscape' is honoured as requested.
 * @param {number} imgW
 * @param {number} imgH
 * @param {'auto'|'portrait'|'landscape'} [requested]
 * @returns {'portrait'|'landscape'}
 */
export function resolveOrientation(imgW, imgH, requested) {
  if (requested === 'portrait' || requested === 'landscape') return requested;
  return Number(imgW) > Number(imgH) ? 'landscape' : 'portrait';
}

/**
 * Fit a source rectangle (anything with a width/height) inside a box while
 * preserving its aspect ratio (CSS `object-fit: contain`). The result is never
 * larger than the box on either axis.
 * @returns {{ width: number, height: number }}
 */
export function fitRect(srcW, srcH, boxW, boxH) {
  const sw = Number(srcW) || 0;
  const sh = Number(srcH) || 0;
  const bw = Number(boxW) || 0;
  const bh = Number(boxH) || 0;
  if (!(sw > 0) || !(sh > 0) || !(bw > 0) || !(bh > 0)) {
    return { width: 0, height: 0 };
  }
  const scale = Math.min(bw / sw, bh / sh);
  return { width: sw * scale, height: sh * scale };
}

/**
 * Work out one PDF page for one image.
 *
 * Modes:
 *   - `pageSize: 'fit'` makes the page exactly the image size (at `dpi`, so a
 *     pixel maps to a sensible physical size) plus the margin on every side;
 *     the image keeps its full resolution.
 *   - `pageSize: 'a4' | 'letter'` picks a fixed page (orientation from the
 *     image unless forced) and contains the image inside it, centred, inset by
 *     the margin.
 *
 * `margin` is in PDF points. `dpi` only affects 'fit' mode (default 96, the
 * CSS pixel baseline, so an unscaled screenshot lands at a natural size).
 *
 * @returns {{ pageWidth, pageHeight, imageWidth, imageHeight, x, y }}
 */
export function computePageLayout(imgW, imgH, opts = {}) {
  const w = Number(imgW);
  const h = Number(imgH);
  if (!(w > 0) || !(h > 0)) {
    throw new ImgPdfError('size', 'Image dimensions must be positive numbers.');
  }
  const margin = Math.max(0, Number(opts.margin) || 0);
  const pageSize = opts.pageSize || 'fit';

  if (pageSize === 'fit') {
    const dpi = Number(opts.dpi) > 0 ? Number(opts.dpi) : 96;
    const scale = 72 / dpi; // pixels -> points at the given dpi
    const imageWidth = w * scale;
    const imageHeight = h * scale;
    return {
      pageWidth: imageWidth + margin * 2,
      pageHeight: imageHeight + margin * 2,
      imageWidth,
      imageHeight,
      x: margin,
      y: margin,
    };
  }

  if (pageSize !== 'a4' && pageSize !== 'letter') {
    throw new ImgPdfError('pageSize', `Unknown page size "${pageSize}".`);
  }
  const orientation = resolveOrientation(w, h, opts.orientation);
  const page = pageSizeInPoints(pageSize, orientation);
  const boxW = Math.max(0, page.width - margin * 2);
  const boxH = Math.max(0, page.height - margin * 2);
  const fitted = fitRect(w, h, boxW, boxH);
  return {
    pageWidth: page.width,
    pageHeight: page.height,
    imageWidth: fitted.width,
    imageHeight: fitted.height,
    x: (page.width - fitted.width) / 2,
    y: (page.height - fitted.height) / 2,
  };
}

/* ---------- page ranges (PDF -> images) ---------- */

/**
 * Parse a page-range spec into zero-based page indices.
 *
 * Accepts the same shapes the PDF picker does: "" or "all" (every page), a
 * comma-separated list of single pages and inclusive ranges (`"1-3,5"`), and an
 * open-ended range (`"7-"` = page 7 to the last page). Input is 1-based; output
 * is sorted, de-duplicated and zero-based. Throws ImgPdfError('range') for
 * page 0, non-numeric parts, backwards ranges, pages past the end, or a spec
 * that selects nothing.
 *
 * @param {string} spec
 * @param {number} pageCount
 * @returns {number[]}
 */
export function parsePageRange(spec, pageCount) {
  const total = Math.max(0, Math.floor(Number(pageCount) || 0));
  const text = String(spec == null ? '' : spec).trim();
  if (text === '' || /^all$/i.test(text)) {
    if (total === 0) throw new ImgPdfError('range', 'This PDF has no pages to export.');
    return Array.from({ length: total }, (_, i) => i);
  }
  const seen = new Set();
  for (const rawPart of text.split(',')) {
    const part = rawPart.trim();
    if (part === '') continue;
    const m = /^(\d+)(?:\s*-\s*(\d*))?$/.exec(part);
    if (!m) {
      throw new ImgPdfError('range', `"${part}" is not a valid page or range. Use forms like 1, 2-4.`);
    }
    const a = Number(m[1]);
    // "7-" has no upper bound; a missing/empty upper bound means "the last page".
    const upperRaw = m[2];
    const b = upperRaw === undefined ? a : (upperRaw === '' ? total : Number(upperRaw));
    if (a < 1 || b < 1) throw new ImgPdfError('range', 'Page numbers start at 1.');
    if (b < a) throw new ImgPdfError('range', `Range "${part}" runs backwards (${a}-${b}).`);
    if (b > total) throw new ImgPdfError('range', `Range "${part}" goes past the last page (${total}).`);
    for (let p = a; p <= b; p += 1) seen.add(p - 1);
  }
  if (seen.size === 0) throw new ImgPdfError('range', 'No pages were selected.');
  return [...seen].sort((x, y) => x - y);
}

/* ---------- filenames ---------- */

/** Strip a trailing extension and any path separators from a base name. */
function safeBase(name) {
  const stripped = String(name == null ? '' : name)
    .replace(/\.[^./\\]+$/, '')
    .replace(/[\\/]+/g, '-')
    .trim();
  return stripped || 'document';
}

/** Zero-pad `n` to the width of `total` (so page-2 sorts before page-10). */
function pad(n, total) {
  const width = String(Math.max(1, total)).length;
  return String(n).padStart(width, '0');
}

/**
 * The file name for one exported page image.
 *   single page -> "<base>.png" style base, numbered anyway for clarity
 *   several     -> "<base>-page-NN.<ext>" with zero-padded numbers
 *
 * The number used is the REAL page number (`pageNumber`, 1-based), not the
 * position within the export selection, so exporting "1,3" yields
 * "<base>-page-1.png" and "<base>-page-3.png" rather than ...-1/-2. The padded
 * width is still taken from `total` so names sort naturally across a batch.
 *
 * @param {string} base   the PDF's name (with or without extension)
 * @param {number} pageNumber 1-based page number in the source PDF
 * @param {number} total  number of pages being exported
 * @param {'png'|'jpeg'} format
 */
export function pageImageName(base, pageNumber, total, format) {
  const n = Math.max(1, Math.floor(Number(pageNumber) || 1));
  const ext = format === 'jpeg' ? 'jpg' : format === 'png' ? 'png' : String(format);
  return `${safeBase(base)}-page-${pad(n, total)}.${ext}`;
}

/**
 * Return `name`, or the first free "name-2", "name-3", … variant, and record the
 * result in `used` (a Set the caller keeps across a batch). Used to guarantee
 * unique entry names in the ZIP without ever dropping a page.
 * @param {string} name
 * @param {Set<string>} used
 * @returns {string}
 */
export function uniqueName(name, used) {
  const set = used instanceof Set ? used : new Set();
  const base = String(name == null ? '' : name) || 'file';
  if (!set.has(base)) { set.add(base); return base; }
  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : '';
  let n = 2;
  let candidate = `${stem}-${n}${ext}`;
  while (set.has(candidate)) { n += 1; candidate = `${stem}-${n}${ext}`; }
  set.add(candidate);
  return candidate;
}

/* ---------- format sniffing / output decisions ---------- */

/**
 * Sniff the image kind from leading bytes.
 * @param {Uint8Array} bytes
 * @returns {'jpeg'|'png'|'webp'|null}
 */
export function detectImageKind(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 4) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  if (bytes.length >= 12 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return 'webp';
  }
  return null;
}

/**
 * How a source image kind is added to the PDF:
 *   - JPEG and PNG embed their bytes directly (pdf-lib `embedJpg`/`embedPng`);
 *   - anything else (WebP, GIF, BMP, unknown) is decoded via the canvas and
 *     re-encoded as PNG by default (lossless; the UI may choose JPEG instead).
 * @param {'jpeg'|'png'|'webp'|null} kind
 * @param {'png'|'jpeg'} [reencodeAs]
 * @returns {{ embed: boolean, format: 'jpeg'|'png' }}
 */
export function imageOutputFor(kind, reencodeAs = 'png') {
  if (kind === 'jpeg') return { embed: true, format: 'jpeg' };
  if (kind === 'png') return { embed: true, format: 'png' };
  return { embed: false, format: reencodeAs === 'jpeg' ? 'jpeg' : 'png' };
}

/** Canonical MIME type for an image output format id. */
export function mimeForImageOutput(format) {
  switch (String(format).toLowerCase()) {
    case 'png': return 'image/png';
    case 'jpeg':
    case 'jpg': return 'image/jpeg';
    default: throw new ImgPdfError('format', `Unsupported image format "${format}".`);
  }
}

/* ---------- JPEG EXIF orientation (byte-level read) ---------- */

/**
 * Read the EXIF Orientation tag (0x0112) from a JPEG, if present.
 *
 * Walks the JPEG's APP1 "Exif" segment and inspects its TIFF block only: the
 * SOI and segment header, then IFD0's 12-byte entries, honouring the TIFF byte
 * order. Every offset is bounded by the APP1 segment end, so a malformed file
 * cannot make us read a neighbouring segment. Returns 1 (the EXIF default,
 * "top-left") when there is no EXIF, no orientation tag, or the tag is
 * unusable — never throws.
 *
 * @param {Uint8Array} bytes
 * @returns {number} 1..8
 */
export function exifOrientation(bytes) {
  const ORIENTATION = 0x0112;
  try {
    if (!(bytes instanceof Uint8Array) || bytes.length < 4) return 1;
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return 1;
    let i = 2;
    while (i + 4 <= bytes.length) {
      if (bytes[i] !== 0xff) { i += 1; continue; }
      // Collapse fill 0xFF bytes.
      while (i < bytes.length && bytes[i] === 0xff) i += 1;
      if (i >= bytes.length) break;
      const marker = bytes[i];
      i += 1;
      // SOS (0xDA) begins entropy data; no marker segments follow worth parsing.
      if (marker === 0xda || marker === 0xd9) break;
      // Markers without a length: TEM and RSTn.
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (i + 2 > bytes.length) break;
      const size = (bytes[i] << 8) | bytes[i + 1];
      if (size < 2 || i + size > bytes.length) break;
      const segStart = i - 2; // FF marker position
      const payloadStart = i + 2;
      const segEnd = segStart + 2 + size; // end of this segment
      if (marker === 0xe1 && payloadStart + 6 <= segEnd) {
        const id = String.fromCharCode(bytes[payloadStart], bytes[payloadStart + 1],
          bytes[payloadStart + 2], bytes[payloadStart + 3]);
        if (id === 'Exif') {
          const value = orientationInTiff(bytes, payloadStart + 6, segEnd, ORIENTATION);
          if (value != null) return value;
        }
      }
      i = segEnd;
    }
  } catch {
    // Never throw from a read helper.
  }
  return 1;
}

/**
 * Look for the Orientation tag in a TIFF block inside [tiffStart, tiffEnd).
 * Returns the value 1..8, or null when absent/unusable.
 */
function orientationInTiff(bytes, tiffStart, tiffEnd, tag) {
  if (tiffStart + 8 > tiffEnd) return null;
  const le = bytes[tiffStart] === 0x49 && bytes[tiffStart + 1] === 0x49;
  const be = bytes[tiffStart] === 0x4d && bytes[tiffStart + 1] === 0x4d;
  if (!le && !be) return null;
  const u16 = (o) => (le ? bytes[o] | (bytes[o + 1] << 8) : (bytes[o] << 8) | bytes[o + 1]);
  const u32 = (o) => (le
    ? (bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)) >>> 0
    : ((bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>> 0);

  if (u16(tiffStart + 2) !== 0x002a) return null;
  const ifd0 = tiffStart + u32(tiffStart + 4);
  if (ifd0 < tiffStart || ifd0 + 2 > tiffEnd) return null;
  const count = u16(ifd0);
  if (count > 4096) return null;
  if (ifd0 + 2 + count * 12 > tiffEnd) return null;
  for (let e = 0; e < count; e += 1) {
    const off = ifd0 + 2 + e * 12;
    if (u16(off) === tag) {
      // Orientation is SHORT (type 3) with count 1; its value fits the entry's
      // 4-byte value field, so read it in place without following any offset.
      const type = u16(off + 2);
      if (type !== 3) return null;
      const value = u16(off + 8);
      return value >= 1 && value <= 8 ? value : null;
    }
  }
  return null;
}

/**
 * Build a COPY of a JPEG's bytes with the EXIF Orientation tag (0x0112) in
 * APP1 "Exif" rewritten to 1 ("top-left"), leaving every other byte untouched.
 *
 * The real fix for bug B1: this Chrome IGNORES `imageOrientation: 'none'` for
 * JPEG EXIF and always stores the EXIF-transformed bitmap, so decoding our
 * original bytes would apply the orientation once and our own
 * `jpegOrientationTransform` would apply it a second time. Decoding a copy whose
 * tag reads 1 makes the browser yield the RAW stored pixels deterministically,
 * so our own transform (read from the ORIGINAL bytes) is applied exactly once.
 *
 * Only the two SHORT value bytes change, so the segment length is unchanged and
 * no offsets shift. The input bytes are never modified. Returns a no-op copy
 * (identical bytes) when there is no APP1 Exif segment, no TIFF header, no
 * Orientation entry, an unexpected value type, or truncated/invalid data.
 *
 * @param {Uint8Array} bytes
 * @returns {Uint8Array} a new Uint8Array; identical content when nothing to do
 */
export function withOrientationReset(bytes) {
  const ORIENTATION = 0x0112;
  if (!(bytes instanceof Uint8Array)) return bytes;
  const out = bytes.slice();
  try {
    if (out.length < 4) return out;
    if (out[0] !== 0xff || out[1] !== 0xd8) return out;
    let i = 2;
    while (i + 4 <= out.length) {
      if (out[i] !== 0xff) { i += 1; continue; }
      // Collapse fill 0xFF bytes.
      while (i < out.length && out[i] === 0xff) i += 1;
      if (i >= out.length) break;
      const marker = out[i];
      i += 1;
      // SOS (0xDA) begins entropy data; no marker segments follow worth parsing.
      if (marker === 0xda || marker === 0xd9) break;
      // Markers without a length: TEM and RSTn.
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (i + 2 > out.length) break;
      const size = (out[i] << 8) | out[i + 1];
      if (size < 2 || i + size > out.length) break;
      const segStart = i - 2; // FF marker position
      const payloadStart = i + 2;
      const segEnd = segStart + 2 + size; // end of this segment
      if (marker === 0xe1 && payloadStart + 6 <= segEnd) {
        const id = String.fromCharCode(out[payloadStart], out[payloadStart + 1],
          out[payloadStart + 2], out[payloadStart + 3]);
        if (id === 'Exif') {
          const valueOff = orientationEntryValueOffset(out, payloadStart + 6, segEnd, ORIENTATION);
          if (valueOff != null) {
            // The SHORT is stored little- or big-endian per the TIFF header; we
            // know the TIFF byte-order from the header just read.
            const le = out[payloadStart + 6] === 0x49 && out[payloadStart + 7] === 0x49;
            if (le) { out[valueOff] = 1; out[valueOff + 1] = 0; }
            else { out[valueOff] = 0; out[valueOff + 1] = 1; }
            return out;
          }
        }
      }
      i = segEnd;
    }
  } catch {
    // Never throw from a byte helper; return whatever we copied so far.
  }
  return out;
}

/**
 * Find the offset of the 4-byte value field of the Orientation entry inside a
 * TIFF block within [tiffStart, tiffEnd). Returns null when the tag is absent,
 * not a SHORT (type 3), or the block is malformed. The caller writes the new
 * SHORT into the returned offset respecting the TIFF byte order.
 */
function orientationEntryValueOffset(bytes, tiffStart, tiffEnd, tag) {
  if (tiffStart + 8 > tiffEnd) return null;
  const le = bytes[tiffStart] === 0x49 && bytes[tiffStart + 1] === 0x49;
  const be = bytes[tiffStart] === 0x4d && bytes[tiffStart + 1] === 0x4d;
  if (!le && !be) return null;
  const u16 = (o) => (le ? bytes[o] | (bytes[o + 1] << 8) : (bytes[o] << 8) | bytes[o + 1]);
  const u32 = (o) => (le
    ? (bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)) >>> 0
    : ((bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>> 0);

  if (u16(tiffStart + 2) !== 0x002a) return null;
  const ifd0 = tiffStart + u32(tiffStart + 4);
  if (ifd0 < tiffStart || ifd0 + 2 > tiffEnd) return null;
  const count = u16(ifd0);
  if (count > 4096) return null;
  if (ifd0 + 2 + count * 12 > tiffEnd) return null;
  for (let e = 0; e < count; e += 1) {
    const off = ifd0 + 2 + e * 12;
    if (u16(off) === tag) {
      // Orientation is SHORT (type 3); if another type is present, leave it be.
      if (u16(off + 2) !== 3) return null;
      if (off + 12 > tiffEnd) return null;
      return off + 8;
    }
  }
  return null;
}

/**
 * Describe how a canvas must be drawn so a JPEG with the given EXIF orientation
 * appears upright. `swap` means the output width/height are the source's
 * height/width; `rotate` is the clockwise canvas rotation in degrees; `flipX` /
 * `flipY` mirror before rotation.
 * @param {number} orientation 1..8
 * @returns {{ swap: boolean, rotate: 0|90|180|270, flipX: boolean, flipY: boolean }}
 */
export function jpegOrientationTransform(orientation) {
  const o = Number(orientation) || 1;
  switch (o) {
    case 2: return { swap: false, rotate: 0, flipX: true, flipY: false };
    case 3: return { swap: false, rotate: 180, flipX: false, flipY: false };
    case 4: return { swap: false, rotate: 180, flipX: true, flipY: false };
    case 5: return { swap: true, rotate: 270, flipX: true, flipY: false };
    case 6: return { swap: true, rotate: 90, flipX: false, flipY: false };
    case 7: return { swap: true, rotate: 90, flipX: true, flipY: false };
    case 8: return { swap: true, rotate: 270, flipX: false, flipY: false };
    default: return { swap: false, rotate: 0, flipX: false, flipY: false };
  }
}

/**
 * The upright output size for a stored WxH image at the given EXIF orientation.
 * Orientations 5-8 swap the axes; the rest keep them.
 * @param {number} width  stored pixel width
 * @param {number} height stored pixel height
 * @param {number} orientation 1..8
 * @returns {{ width: number, height: number }}
 */
export function orientedImageSize(width, height, orientation) {
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  const t = jpegOrientationTransform(orientation);
  return t.swap ? { width: h, height: w } : { width: w, height: h };
}

/**
 * Map a point in the STORED pixel space of a WxH image to the DISPLAYED
 * (upright) pixel space for the given EXIF orientation, applying exactly the
 * canvas operations `jpegOrientationTransform` describes: the canvas is sized
 * to the (possibly swapped) output, the drawing context is translated to its
 * centre, rotated (`rotate` degrees clockwise) and mirrored (`flipX`), and the
 * source is drawn centred at the origin.
 *
 * This is the pure-logic twin of the canvas math in tools/imgpdf/index.js, so a
 * node test can assert where each stored corner lands without a browser.
 *
 * @param {number} width  stored pixel width  (W)
 * @param {number} height stored pixel height (H)
 * @param {number} orientation 1..8
 * @param {number} x stored-space x (0..W)
 * @param {number} y stored-space y (0..H)
 * @returns {{ x: number, y: number }}
 */
export function mapStoredToDisplayed(width, height, orientation, x, y) {
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  const t = jpegOrientationTransform(orientation);
  const out = t.swap ? { width: h, height: w } : { width: w, height: h };
  let px = Number(x) - w / 2;
  let py = Number(y) - h / 2;
  if (t.flipX) px = -px;
  const rad = (t.rotate * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rx = px * cos - py * sin; // clockwise rotation on a y-down canvas
  const ry = px * sin + py * cos;
  return { x: rx + out.width / 2, y: ry + out.height / 2 };
}