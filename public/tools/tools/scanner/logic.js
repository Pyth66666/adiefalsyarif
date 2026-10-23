// Pure, DOM-free and canvas-free logic for the Scanner tool (tools/scanner).
//
// The scanner lets the user photograph a page with the phone camera, drag four
// corner points onto the page's corners, and flatten that quad to a rectangle.
// This module owns all of the arithmetic and every pixel operation the UI leans
// on, so it runs unchanged in the browser and in `node tests/scanner.test.mjs`:
//
//   * corner ordering (a shuffled quad -> TL, TR, BR, BL),
//   * the quad's edge lengths and the output rectangle size,
//   * the projective transform (homography) from the quad to a rectangle and its
//     inverse, used to resample the source into an axis-aligned result,
//   * `flattenQuad`, the bilinear warp that turns an RGBA buffer + quad into a
//     flat RGBA rectangle,
//   * the colour / grayscale / black-and-white pixel filters,
//   * `buildScannedPdf`, which assembles one page per scanned image with the
//     vendored pdf-lib (passed in, never imported here — no DOM, no library
//     globals, so the same code path is unit-tested).
//
// Nothing here touches the DOM, a canvas, getUserMedia or pdf-lib directly.

/* ---------- errors ---------- */

export class ScannerError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ScannerError';
    this.code = code;
  }
}

/** Construct a ScannerError (thin helper so call sites read nicely). */
export function scannerError(code, message) {
  return new ScannerError(code, message);
}

/* ---------- corners ---------- */

/**
 * Order four points as TL, TR, BR, BL.
 *
 * The sort is geometric, not input-order dependent: the point with the smallest
 * x+y is the top-left; the largest x+y is the bottom-right; of the remaining two,
 * the smaller y-x is the top-right and the larger y-x is the bottom-left. This
 * holds for a convex quad seen at any rotation up to 90 degrees, which is what a
 * phone-held page produces. A quadrilateral that is not convex in this sense is
 * still ordered deterministically — the UI clamps the points to the frame.
 *
 * @param {{x:number,y:number}[]} points
 * @returns {{x:number,y:number}[]} four points, TL, TR, BR, BL
 */
export function orderCorners(points) {
  if (!Array.isArray(points) || points.length !== 4
      || !points.every((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y))) {
    throw new ScannerError('corners', 'A scan needs exactly four corner points.');
  }
  const tl = points.reduce((a, b) => (b.x + b.y < a.x + a.y ? b : a));
  const br = points.reduce((a, b) => (b.x + b.y > a.x + a.y ? b : a));
  const rest = points.filter((p) => p !== tl && p !== br);
  // Of the two middle points, the one nearer the top (smaller y - x) is TR.
  const [tr, bl] = rest[0].y - rest[0].x < rest[1].y - rest[1].x
    ? [rest[0], rest[1]]
    : [rest[1], rest[0]];
  return [tl, tr, br, bl];
}

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * The width and height of a quad, as the average of its two opposite edges. For
 * the perspective page quad the top and bottom (and left and right) edges differ
 * slightly; the average keeps the output rectangle upright and undistorted on
 * average. Points are ordered TL, TR, BR, BL (use `orderCorners` first).
 * @param {{x:number,y:number}[]} quad
 * @returns {{width:number, height:number}}
 */
export function quadSize(quad) {
  const [tl, tr, br, bl] = quad;
  const width = (distance(tl, tr) + distance(bl, br)) / 2;
  const height = (distance(tl, bl) + distance(tr, br)) / 2;
  return { width, height };
}

/**
 * The pixel size of the flattened rectangle for a quad. The long edge is capped
 * at `maxEdge` (default 2000, a sane cap for a phone photo) and the short edge
 * follows the quad's aspect ratio; both are at least 1 px.
 * @param {{x:number,y:number}[]} quad ordered TL, TR, BR, BL
 * @param {{maxEdge?:number}} [opts]
 * @returns {{width:number, height:number}}
 */
export function targetSize(quad, opts = {}) {
  const { width, height } = quadSize(quad);
  const maxEdge = Number(opts.maxEdge) > 0 ? Number(opts.maxEdge) : 2000;
  if (!(width > 0) || !(height > 0)) {
    throw new ScannerError('quad', 'The four corners do not enclose any area.');
  }
  const longest = Math.max(width, height);
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/* ---------- homography (projective transform) ---------- */

/**
 * The 3x3 projective matrix mapping the four `src` points onto the four `dst`
 * points (in order). Returns the matrix as a flat length-9 array in row-major
 * order with h[8] normalised to 1. Throws ScannerError('quad') when the points
 * are degenerate (any three collinear), because no invertible map exists.
 *
 * The system is the standard 8x8 linear solve for a homography.
 * @param {{x:number,y:number}[]} src four points
 * @param {{x:number,y:number}[]} dst four points
 * @returns {number[]} h[0..8]
 */
export function computeHomography(src, dst) {
  if (!Array.isArray(src) || !Array.isArray(dst) || src.length !== 4 || dst.length !== 4) {
    throw new ScannerError('quad', 'A homography needs four source and four destination points.');
  }
  // Build A h = b for the eight unknowns h0..h7 (h8 = 1).
  const A = [];
  const b = [];
  for (let i = 0; i < 4; i += 1) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const h = solve8(A, b);
  if (!h) throw new ScannerError('quad', 'The four corners are degenerate and cannot be flattened.');
  return [...h, 1];
}

/**
 * Solve an 8x8 linear system by Gaussian elimination with partial pivoting.
 * Returns the solution array, or null when the matrix is singular.
 */
function solve8(A, b) {
  const n = 8;
  const m = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col += 1) {
    // Partial pivot.
    let pivot = col;
    for (let r = col + 1; r < n; r += 1) {
      if (Math.abs(m[r][col]) > Math.abs(m[pivot][col])) pivot = r;
    }
    if (Math.abs(m[pivot][col]) < 1e-12) return null;
    if (pivot !== col) { const t = m[pivot]; m[pivot] = m[col]; m[col] = t; }
    const pv = m[col][col];
    for (let r = 0; r < n; r += 1) {
      if (r === col) continue;
      const factor = m[r][col] / pv;
      if (factor === 0) continue;
      for (let c = col; c <= n; c += 1) m[r][c] -= factor * m[col][c];
    }
  }
  return m.map((row, i) => row[n] / m[i][i]);
}

/**
 * Apply a homography to a point: (x', y') = H (x, y, 1) / w.
 * @param {number[]} h length-9 row-major matrix
 * @param {number} x
 * @param {number} y
 * @returns {{x:number, y:number}}
 */
export function applyHomography(h, x, y) {
  const w = h[6] * x + h[7] * y + h[8];
  return {
    x: (h[0] * x + h[1] * y + h[2]) / w,
    y: (h[3] * x + h[4] * y + h[5]) / w,
  };
}

/* ---------- flattening ---------- */

/** Bilinear sample of an RGBA image at fractional (x, y), returning [r,g,b,a]. */
function sampleBilinear(image, x, y) {
  const { data, width, height } = image;
  const cx = Math.min(Math.max(x, 0), width - 1);
  const cy = Math.min(Math.max(y, 0), height - 1);
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const x1 = Math.min(x0 + 1, width - 1);
  const y1 = Math.min(y0 + 1, height - 1);
  const fx = cx - x0;
  const fy = cy - y0;
  const out = [0, 0, 0, 0];
  for (let c = 0; c < 4; c += 1) {
    const p00 = data[(y0 * width + x0) * 4 + c];
    const p10 = data[(y0 * width + x1) * 4 + c];
    const p01 = data[(y1 * width + x0) * 4 + c];
    const p11 = data[(y1 * width + x1) * 4 + c];
    const top = p00 + (p10 - p00) * fx;
    const bottom = p01 + (p11 - p01) * fx;
    out[c] = top + (bottom - top) * fy;
  }
  return out;
}

/**
 * Flatten the quad of `image` (an RGBA buffer with width/height) onto an
 * axis-aligned rectangle. For each destination pixel the INVERSE homography maps
 * it back into the source, and the source is sampled bilinearly, so the result
 * is the page seen face-on. Returns a new { data, width, height } with the same
 * 4-channel RGBA layout and fully opaque pixels.
 *
 * @param {{data:Uint8ClampedArray|Uint8Array, width:number, height:number}} image
 * @param {{x:number,y:number}[]} quad ordered TL, TR, BR, BL in image pixels
 * @param {{maxEdge?:number, target?:{width:number,height:number}}} [opts]
 * @returns {{data:Uint8ClampedArray, width:number, height:number}}
 */
export function flattenQuad(image, quad, opts = {}) {
  if (!image || !(image.width > 0) || !(image.height > 0)
      || !image.data || image.data.length !== image.width * image.height * 4) {
    throw new ScannerError('image', 'The source image is missing or malformed.');
  }
  const ordered = orderCorners(quad);
  const size = opts.target && opts.target.width > 0 && opts.target.height > 0
    ? { width: Math.round(opts.target.width), height: Math.round(opts.target.height) }
    : targetSize(ordered, opts);
  const W = size.width;
  const H = size.height;

  // Destination rectangle corners (in pixel-centre space, so a 1:1 full-frame
  // quad reproduces the source exactly).
  const dst = [
    { x: 0, y: 0 },
    { x: W, y: 0 },
    { x: W, y: H },
    { x: 0, y: H },
  ];
  // Inverse map: rectangle -> source quad.
  const inv = computeHomography(dst, ordered);

  const data = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const p = applyHomography(inv, x, y);
      const [r, g, b] = sampleBilinear(image, p.x, p.y);
      const i = (y * W + x) * 4;
      data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255;
    }
  }
  return { data, width: W, height: H };
}

/* ---------- filters ---------- */

/** Clamp a channel to a byte. */
const byte = (v) => Math.max(0, Math.min(255, Math.round(v)));

/**
 * Colour mode: a copy of the image, unchanged.
 * @returns {{data:Uint8ClampedArray, width:number, height:number}}
 */
function asColour(image) {
  return { data: new Uint8ClampedArray(image.data), width: image.width, height: image.height };
}

/**
 * Grayscale (Rec. 601 luma), leaving the alpha channel untouched. Returns a new
 * buffer; the input is not modified.
 */
export function toGrayscale(image) {
  if (!image || !image.data || image.data.length !== image.width * image.height * 4) {
    throw new ScannerError('image', 'The source image is missing or malformed.');
  }
  const data = new Uint8ClampedArray(image.data.length);
  for (let i = 0; i < image.data.length; i += 4) {
    const y = 0.299 * image.data[i] + 0.587 * image.data[i + 1] + 0.114 * image.data[i + 2];
    const g = byte(y);
    data[i] = g; data[i + 1] = g; data[i + 2] = g; data[i + 3] = image.data[i + 3];
  }
  return { data, width: image.width, height: image.height };
}

/**
 * Black-and-white (1-bit look) via a luma threshold. Every output pixel is
 * PURE black (0,0,0) or PURE white (255,255,255) — no grey — which is what the
 * "black-and-white" filter promises. The alpha channel is forced opaque.
 * @param {object} image
 * @param {number} [threshold] 0..255, default 128
 */
export function toBlackAndWhite(image, threshold = 128) {
  if (!image || !image.data || image.data.length !== image.width * image.height * 4) {
    throw new ScannerError('image', 'The source image is missing or malformed.');
  }
  const cut = Number.isFinite(threshold) ? threshold : 128;
  const data = new Uint8ClampedArray(image.data.length);
  for (let i = 0; i < image.data.length; i += 4) {
    const y = 0.299 * image.data[i] + 0.587 * image.data[i + 1] + 0.114 * image.data[i + 2];
    const v = y >= cut ? 255 : 0;
    data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255;
  }
  return { data, width: image.width, height: image.height };
}

/**
 * Apply one of the three filters to an RGBA image.
 * @param {object} image
 * @param {'colour'|'grayscale'|'bw'} mode
 * @returns {{data:Uint8ClampedArray, width:number, height:number}}
 */
export function applyFilter(image, mode) {
  switch (mode) {
    case 'colour': return asColour(image);
    case 'grayscale': return toGrayscale(image);
    case 'bw': return toBlackAndWhite(image);
    default: throw new ScannerError('filter', `Unknown filter "${mode}".`);
  }
}

/* ---------- PDF assembly ---------- */

/**
 * Assemble one PDF page per scanned image and return its bytes.
 *
 * Each `page` is `{ png, width?, height? }` where `png` is the flattened PNG
 * bytes and the optional width/height are the pixel size (when omitted the page
 * is sized A4 portrait, a sane default for a scanned document). pdf-lib is
 * supplied as `lib` (the vendored window.PDFLib / required module) so this stays
 * free of any library global and is unit-tested with the real build.
 *
 * A page that is wider than it is tall is placed on a landscape page; otherwise
 * portrait. With no explicit width/height the image is fitted into A4 with a
 * small margin.
 *
 * @param {{png:Uint8Array|ArrayBuffer, width?:number, height?:number}[]} pages
 * @param {{PDFDocument:any}} lib
 * @returns {Promise<Uint8Array>}
 */
export async function buildScannedPdf(pages, lib) {
  if (!Array.isArray(pages) || pages.length === 0) {
    throw new ScannerError('empty', 'Add at least one scanned page before exporting.');
  }
  if (!lib || typeof lib.PDFDocument?.create !== 'function') {
    throw new ScannerError('lib', 'The PDF library is unavailable.');
  }
  const A4 = { width: 595.28, height: 841.89 };
  const MARGIN = 18;
  const doc = await lib.PDFDocument.create();
  for (const page of pages) {
    if (!page || !page.png) throw new ScannerError('page', 'A scanned page has no image data.');
    const image = await doc.embedPng(page.png);
    const iw = Number(page.width) > 0 ? Number(page.width) : image.width;
    const ih = Number(page.height) > 0 ? Number(page.height) : image.height;
    const landscape = iw > ih;
    // The page keeps the image's aspect ratio, sized so the image fills it with
    // a small margin, scaled into A4 bounds at 72 dpi-equivalent points.
    const boxW = (landscape ? A4.height : A4.width) - MARGIN * 2;
    const boxH = (landscape ? A4.width : A4.height) - MARGIN * 2;
    const scale = Math.min(boxW / iw, boxH / ih);
    const drawW = iw * scale;
    const drawH = ih * scale;
    const pageW = landscape ? A4.height : A4.width;
    const pageH = landscape ? A4.width : A4.height;
    const p = doc.addPage([pageW, pageH]);
    p.drawImage(image, {
      x: (pageW - drawW) / 2,
      y: (pageH - drawH) / 2,
      width: drawW,
      height: drawH,
    });
  }
  return doc.save();
}