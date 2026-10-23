// Pure PDF operations — no DOM, no network, no pdf-lib import at module load.
//
// pdf-lib is vendored in vendor/pdf-lib/ and loaded separately (a <script> in
// the browser, an import in Node tests). The loaded namespace is injected once
// with setPdfLib(); every function below then works on plain Uint8Array bytes
// and returns plain Uint8Array bytes, so the same code runs in the browser and
// in `node tests/pdf.test.mjs`.

let PDFLib = null;

/** Inject the pdf-lib namespace (window.PDFLib in the browser). */
export function setPdfLib(lib) {
  if (!lib || typeof lib.PDFDocument === 'undefined') {
    throw new Error('pdf-lib namespace is missing PDFDocument');
  }
  PDFLib = lib;
}

function lib() {
  if (!PDFLib) {
    throw new Error('pdf-lib is not loaded yet — call setPdfLib() first');
  }
  return PDFLib;
}

/* ---------- errors ---------- */

export class PdfError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PdfError';
    this.code = code;
  }
}

/**
 * Translate a pdf-lib load failure into a friendly, user-facing message.
 * Encrypted PDFs throw a specific error mentioning "encrypted"; damaged files
 * fail either the header check or the parser.
 */
export function describeLoadError(err, filename) {
  const who = filename ? `"${filename}"` : 'that file';
  const raw = String((err && err.message) || err || '');
  if (/encrypt/i.test(raw)) {
    return new PdfError('encrypted', `${who} is password-protected or encrypted and cannot be read.`);
  }
  if (/no pdf header|header|not a pdf|invalid pdf|failed to parse|(trailer|startxref|xref)/i.test(raw)) {
    return new PdfError('corrupt', `${who} is not a valid or is a damaged PDF.`);
  }
  return new PdfError('load', `Could not read ${who}: ${raw || 'unknown error'}.`);
}

async function loadDoc(bytes, filename) {
  if (!(bytes instanceof Uint8Array)) {
    throw new PdfError('input', 'Expected PDF bytes as a Uint8Array.');
  }
  try {
    // ignoreEncryption:false so encrypted files surface a real error we can map.
    return await lib().PDFDocument.load(bytes);
  } catch (err) {
    throw describeLoadError(err, filename);
  }
}

/* ---------- page-range parsing ---------- */

/**
 * Parse a human range string like "1-3,5, 7-" into zero-based ranges.
 * Returns [{ start, end }] inclusive, zero-based, sorted and de-duplicated.
 * Throws PdfError for malformed input or pages beyond pageCount.
 * @param {string} spec
 * @param {number} pageCount
 */
export function parseRanges(spec, pageCount) {
  if (typeof spec !== 'string' || spec.trim() === '') {
    throw new PdfError('range', 'Enter at least one page or range, e.g. 1-3,5.');
  }
  const out = [];
  const seen = new Set();
  for (const rawPart of spec.split(',')) {
    const part = rawPart.trim();
    if (part === '') continue;
    const m = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(part);
    if (!m) {
      throw new PdfError('range', `"${part}" is not a valid page or range. Use forms like 1, 2-4.`);
    }
    const a = Number(m[1]);
    const b = m[2] === undefined ? a : Number(m[2]);
    if (a < 1 || b < 1) {
      throw new PdfError('range', 'Page numbers start at 1.');
    }
    if (b < a) {
      throw new PdfError('range', `Range "${part}" runs backwards (${a}-${b}).`);
    }
    if (b > pageCount) {
      throw new PdfError('range', `Range "${part}" goes past the last page (${pageCount}).`);
    }
    for (let p = a; p <= b; p += 1) {
      if (!seen.has(p)) { seen.add(p); out.push(p - 1); }
    }
  }
  if (out.length === 0) {
    throw new PdfError('range', 'No pages were selected.');
  }
  return out;
}

/* ---------- merge ---------- */

/**
 * Merge PDFs in order into a single PDF.
 * @param {Uint8Array[]} arrayOfUint8Array
 * @param {string[]} [names]      optional names for friendlier errors
 * @returns {Promise<Uint8Array>}
 */
export async function mergePdfs(arrayOfUint8Array, names = []) {
  if (!Array.isArray(arrayOfUint8Array) || arrayOfUint8Array.length === 0) {
    throw new PdfError('input', 'Add at least one PDF to merge.');
  }
  const { PDFDocument } = lib();
  const merged = await PDFDocument.create();
  for (let i = 0; i < arrayOfUint8Array.length; i += 1) {
    const src = await loadDoc(arrayOfUint8Array[i], names[i]);
    const pages = await merged.copyPages(src, src.getPageIndices());
    for (const page of pages) merged.addPage(page);
  }
  return merged.save();
}

/* ---------- split ---------- */

/**
 * Split a PDF into one output PDF per requested range group.
 * Each comma-separated group in `ranges` becomes its own output PDF, so
 * "1-3,5" yields two PDFs: pages 1-3 and page 5.
 * @param {Uint8Array} bytes
 * @param {string} ranges     e.g. "1-3,5"
 * @param {string} [name]     source filename for friendlier errors
 * @returns {Promise<{ name: string, bytes: Uint8Array }[]>}
 */
export async function splitPdf(bytes, ranges, name) {
  const src = await loadDoc(bytes, name);
  const pageCount = src.getPageCount();
  const groups = splitIntoGroups(ranges, pageCount);
  const { PDFDocument } = lib();
  const base = stripExt(name || 'document');

  const outputs = [];
  for (let g = 0; g < groups.length; g += 1) {
    const pages = groups[g];
    const out = await PDFDocument.create();
    const copied = await out.copyPages(src, pages);
    for (const page of copied) out.addPage(page);
    const label = groups.length === 1 ? 'pages' : `part${g + 1}`;
    outputs.push({ name: `${base}-${label}.pdf`, bytes: await out.save() });
  }
  return outputs;
}

/** Split a range spec into groups (one per comma-separated chunk), zero-based. */
export function splitIntoGroups(spec, pageCount) {
  if (typeof spec !== 'string' || spec.trim() === '') {
    throw new PdfError('range', 'Enter at least one page or range, e.g. 1-3,5.');
  }
  const groups = [];
  for (const rawPart of spec.split(',')) {
    const part = rawPart.trim();
    if (part === '') continue;
    groups.push(parseRanges(part, pageCount));
  }
  if (groups.length === 0) {
    throw new PdfError('range', 'No pages were selected.');
  }
  return groups;
}

/* ---------- rotate ---------- */

/**
 * Rotate pages by 90/180/270 degrees.
 * @param {Uint8Array} bytes
 * @param {number} degrees            90 | 180 | 270
 * @param {string|null} pageSelection e.g. "1,3-5"; null/"all" = every page
 * @param {string} [name]
 * @returns {Promise<Uint8Array>}
 */
export async function rotatePdf(bytes, degrees, pageSelection, name) {
  const deg = Number(degrees);
  if (![90, 180, 270].includes(deg)) {
    throw new PdfError('degrees', 'Rotation must be 90, 180 or 270 degrees.');
  }
  const doc = await loadDoc(bytes, name);
  const pageCount = doc.getPageCount();

  const all = pageSelection == null ||
    (typeof pageSelection === 'string' && /^\s*(all|)\s*$/i.test(pageSelection));
  const indices = all
    ? doc.getPageIndices()
    : parseRanges(pageSelection, pageCount);

  const { degrees: toDegrees } = lib();
  for (const i of indices) {
    const page = doc.getPage(i);
    const current = page.getRotation().angle || 0;
    page.setRotation(toDegrees(toPdfAngle(current + deg)));
  }
  return doc.save();
}

/** Normalise any angle into pdf-lib's [0,360) rotation. */
export function toPdfAngle(angle) {
  const a = ((Math.round(angle) % 360) + 360) % 360;
  return a;
}

/* ---------- helpers ---------- */

function stripExt(name) {
  return String(name).replace(/\.pdf$/i, '') || 'document';
}

/* ---------- applyPlan (page picker) ---------- */

/**
 * Build one PDF from a picker plan.
 *
 * @param {Map<string, Uint8Array>|object} sources  fileId -> PDF bytes
 * @param {{ fileId: string, pageIndex: number, rotation: number }[]} plan
 *        pages to keep, in output order; `rotation` is the extra rotation to
 *        ADD to each page's existing rotation (mod 360).
 * @param {Map<string, string>|object} [names]  fileId -> friendly file name
 * @returns {Promise<Uint8Array>}
 */
export async function applyPlan(sources, plan, names = {}) {
  const get = (bag, key) =>
    bag && typeof bag.get === 'function' ? bag.get(key) : (bag ? bag[key] : undefined);

  if (!sources) {
    throw new PdfError('input', 'No source files were provided.');
  }
  if (!Array.isArray(plan) || plan.length === 0) {
    throw new PdfError('empty', 'No pages remain — keep at least one page.');
  }

  // Load every distinct source once, mapping load failures to friendly errors.
  const docByFile = new Map();
  for (const item of plan) {
    const fileId = item && item.fileId;
    if (fileId == null) {
      throw new PdfError('plan', 'A page in the plan has no source file.');
    }
    if (docByFile.has(fileId)) continue;
    const bytes = get(sources, fileId);
    if (!(bytes instanceof Uint8Array)) {
      throw new PdfError('input', `Missing bytes for source "${fileId}".`);
    }
    docByFile.set(fileId, await loadDoc(bytes, get(names, fileId)));
  }

  const { PDFDocument, degrees: toDegrees } = lib();
  const out = await PDFDocument.create();
  // copyPages resolves the whole selection up-front...
  const copiedByFile = new Map();
  for (const [fileId, src] of docByFile) {
    const indices = [];
    for (const item of plan) {
      if (item.fileId === fileId) indices.push(item.pageIndex);
    }
    const pages = indices.length ? await out.copyPages(src, indices) : [];
    copiedByFile.set(fileId, pages);
  }
  // ...then we consume them in plan order, adding the extra rotation.
  const cursor = new Map();
  for (const item of plan) {
    const fileId = item.fileId;
    const list = copiedByFile.get(fileId);
    const k = cursor.get(fileId) || 0;
    cursor.set(fileId, k + 1);
    const page = list[k];
    if (!page) {
      throw new PdfError('plan', `Page ${item.pageIndex + 1} is missing from its source file.`);
    }
    const extra = Number(item.rotation) || 0;
    if (extra % 360 !== 0) {
      const current = page.getRotation().angle || 0;
      page.setRotation(toDegrees(toPdfAngle(current + extra)));
    }
    out.addPage(page);
  }
  return out.save();
}