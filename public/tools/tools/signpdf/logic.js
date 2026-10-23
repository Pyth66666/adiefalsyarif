// Geometry is expressed in the visible, clockwise-rotated page's top-left
// coordinate system. PDF drawing commands use the unrotated bottom-left system.
export function visibleBox(page) {
  const media = page.getMediaBox();
  const crop = page.getCropBox();
  const x = Math.max(media.x, crop.x);
  const y = Math.max(media.y, crop.y);
  const right = Math.min(media.x + media.width, crop.x + crop.width);
  const top = Math.min(media.y + media.height, crop.y + crop.height);
  return { x, y, width: right - x, height: top - y };
}

export function rotationOf(page) {
  return ((page.getRotation().angle % 360) + 360) % 360;
}

export function visualSize(box, rotation) {
  return rotation % 180 ? { width: box.height, height: box.width } : { width: box.width, height: box.height };
}

export function visualPoint(box, rotation, u, v) {
  switch (rotation) {
    case 0: return { x: box.x + u, y: box.y + box.height - v };
    case 90: return { x: box.x + v, y: box.y + u };
    case 180: return { x: box.x + box.width - u, y: box.y + v };
    case 270: return { x: box.x + box.width - v, y: box.y + box.height - u };
    default: throw new RangeError('Page rotation must be 0, 90, 180 or 270 degrees.');
  }
}

export function visualRect(box, rotation, rect) {
  const { x, y, width, height } = rect;
  const anchor = visualPoint(box, rotation, x, y + (rotation === 0 || rotation === 270 ? height : 0));
  return { ...anchor, width, height, rotate: rotation };
}

export function previewToPoints(rect, preview, visual) {
  if (!(preview.width > 0 && preview.height > 0)) throw new RangeError('Preview has no dimensions.');
  return {
    x: rect.x * visual.width / preview.width,
    y: rect.y * visual.height / preview.height,
    width: rect.width * visual.width / preview.width,
    height: rect.height * visual.height / preview.height,
  };
}

export function formatLabel(format, number, total) {
  if (format === 'page') return `Page ${number} of ${total}`;
  if (format === 'fraction') return `${number} / ${total}`;
  return String(number);
}

export function parseRange(spec, count) {
  if (!String(spec || '').trim()) return Array.from({ length: count }, (_, i) => i);
  const pages = new Set();
  for (const raw of spec.split(',')) {
    const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(raw.trim());
    if (!match) throw new RangeError('Use page numbers and ranges such as 1-3,5.');
    const start = Number(match[1]);
    const end = match[2] ? Number(match[2]) : start;
    if (start < 1 || end < start || end > count) throw new RangeError(`Choose pages between 1 and ${count}, in ascending ranges.`);
    for (let n = start; n <= end; n++) pages.add(n - 1);
  }
  return [...pages].sort((a, b) => a - b);
}

// Baseline is measured from the bottom margin; font height is reserved at top.
export function numberPlacement(box, rotation, position, margin, textWidth, fontSize) {
  const visual = visualSize(box, rotation);
  const [row, side] = position.split('-');
  const u = side === 'left' ? margin : side === 'right' ? visual.width - margin - textWidth : (visual.width - textWidth) / 2;
  const baseline = row === 'top' ? margin + fontSize : visual.height - margin;
  return { ...visualPoint(box, rotation, u, baseline), rotate: rotation };
}

export function inkBounds(rgba, width, height, padding = 2) {
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (rgba[(y * width + x) * 4 + 3] > 0) {
      left = Math.min(left, x); top = Math.min(top, y);
      right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
  }
  if (right < 0) return null;
  const x = Math.max(0, left - padding), y = Math.max(0, top - padding);
  return { x, y, width: Math.min(width, right + padding + 1) - x, height: Math.min(height, bottom + padding + 1) - y };
}

function validPdf(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 5 || String.fromCharCode(...bytes.subarray(0, 5)) !== '%PDF-') {
    throw new Error('This file is not a valid PDF or is damaged.');
  }
}

export async function addPageNumbers(bytes, options, lib) {
  validPdf(bytes);
  const doc = await lib.PDFDocument.load(bytes);
  const total = doc.getPageCount();
  const selected = parseRange(options.range, total);
  const font = await doc.embedFont(lib.StandardFonts.Helvetica);
  const size = Number(options.size), margin = Number(options.margin), start = Number(options.start);
  if (!(size > 0 && margin >= 0 && Number.isInteger(start))) throw new RangeError('Enter a valid font size, margin and starting number.');
  let numbered = 0;
  for (const index of selected) {
    if (options.skipFirst && index === 0) continue;
    const page = doc.getPage(index);
    const label = formatLabel(options.format, start + numbered++, total);
    const placement = numberPlacement(visibleBox(page), rotationOf(page), options.position, margin, font.widthOfTextAtSize(label, size), size);
    page.drawText(label, { x: placement.x, y: placement.y, size, font, rotate: lib.degrees(placement.rotate) });
  }
  return doc.save();
}

export async function addSignature(bytes, png, options, lib) {
  validPdf(bytes);
  const doc = await lib.PDFDocument.load(bytes);
  const pageNumber = Number(options.page);
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > doc.getPageCount()) throw new RangeError('Choose an existing page.');
  const page = doc.getPage(pageNumber - 1);
  const box = visibleBox(page), rotation = rotationOf(page), visual = visualSize(box, rotation);
  const rect = { x: Number(options.x), y: Number(options.y), width: Number(options.width), height: Number(options.height) };
  if (Object.values(rect).some((n) => !Number.isFinite(n)) || rect.x < 0 || rect.y < 0 || rect.width <= 0 || rect.height <= 0 || rect.x + rect.width > visual.width + 0.01 || rect.y + rect.height > visual.height + 0.01) {
    throw new RangeError('Keep the signature inside the page.');
  }
  const image = await doc.embedPng(png);
  const placement = visualRect(box, rotation, rect);
  page.drawImage(image, { ...placement, rotate: lib.degrees(rotation) });
  if (options.addDate) {
    const date = options.date || new Date().toISOString().slice(0, 10);
    const font = await doc.embedFont(lib.StandardFonts.Helvetica);
    const size = 10;
    const textWidth = font.widthOfTextAtSize(date, size);
    const x = rect.x + rect.width + 8 + textWidth <= visual.width ? rect.x + rect.width + 8 : Math.max(0, rect.x - textWidth - 8);
    const at = visualPoint(box, rotation, x, Math.min(visual.height, rect.y + rect.height));
    page.drawText(date, { ...at, size, font, rotate: lib.degrees(rotation) });
  }
  return doc.save();
}
