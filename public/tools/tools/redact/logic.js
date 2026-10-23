export function clampRect(rect, width, height) {
  if (!(width > 0 && height > 0) || ![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) || !rect.width || !rect.height) return null;
  const x = Math.max(0, Math.floor(Math.min(rect.x, rect.x + rect.width)));
  const y = Math.max(0, Math.floor(Math.min(rect.y, rect.y + rect.height)));
  const right = Math.min(width, Math.ceil(Math.max(rect.x, rect.x + rect.width)));
  const bottom = Math.min(height, Math.ceil(Math.max(rect.y, rect.y + rect.height)));
  return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : null;
}

// Work on a copy: no encoded source bytes, metadata or PDF streams enter the output.
export function flattenPixels(rgba, width, height, rects, mode, blockSize = 12) {
  if (rgba.length !== width * height * 4) throw new RangeError('Invalid pixel dimensions.');
  if (mode !== 'black' && mode !== 'pixelate') throw new RangeError('Choose a redaction mode.');
  const output = new Uint8ClampedArray(rgba);
  for (const raw of rects) {
    const rect = clampRect(raw, width, height);
    if (!rect) continue;
    if (mode === 'black') {
      for (let y = rect.y; y < rect.y + rect.height; y++) for (let x = rect.x; x < rect.x + rect.width; x++) {
        const i = (y * width + x) * 4;
        output[i] = output[i + 1] = output[i + 2] = 0; output[i + 3] = 255;
      }
      continue;
    }
    const size = Math.max(2, Math.floor(blockSize));
    for (let top = rect.y; top < rect.y + rect.height; top += size) for (let left = rect.x; left < rect.x + rect.width; left += size) {
      const right = Math.min(left + size, rect.x + rect.width), bottom = Math.min(top + size, rect.y + rect.height);
      let r = 0, g = 0, b = 0, count = 0;
      for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
        const i = (y * width + x) * 4;
        // Composite transparent pixels over white before averaging or encoding.
        const alpha = rgba[i + 3] / 255;
        r += rgba[i] * alpha + 255 * (1 - alpha);
        g += rgba[i + 1] * alpha + 255 * (1 - alpha);
        b += rgba[i + 2] * alpha + 255 * (1 - alpha);
        count++;
      }
      for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
        const i = (y * width + x) * 4;
        output[i] = Math.round(r / count); output[i + 1] = Math.round(g / count);
        output[i + 2] = Math.round(b / count); output[i + 3] = 255;
      }
    }
  }
  return output;
}

// Always create a NEW document. Never load/copy the original document with pdf-lib.
export async function rebuildPdf(pages, lib) {
  if (!pages.length) throw new RangeError('No pages to export.');
  const doc = await lib.PDFDocument.create();
  for (const { png, width, height } of pages) {
    if (!(width > 0 && height > 0)) throw new RangeError('Invalid PDF page size.');
    const image = await doc.embedPng(png);
    doc.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height });
  }
  return doc.save();
}
