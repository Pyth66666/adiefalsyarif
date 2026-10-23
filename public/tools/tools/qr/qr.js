// Pure QR code helpers — no DOM, no network, no browser-only API at module
// load. Runs unchanged in the browser and in `node tests/qr.test.mjs`.
//
// The heavy lifting (Reed-Solomon coding, masking, version selection) is done
// by the vendored MIT library `qrcode-generator` (qrcode.js), which defines a
// browser global `qrcode` and also exports through CommonJS. This module never
// touches the network and never logs the payload; it only turns text into a
// boolean module matrix and the matrix into an SVG string.
//
// Exports:
//   * escapeWifi(value)                — escape the reserved Wi-Fi payload chars
//   * buildWifiPayload({ ssid, password, encryption, hidden })
//   * matrixFromText(text, ecLevel)    — array of boolean rows (true = dark)
//   * matrixToSvg(matrix, options)     — self-contained SVG string
//   * contrastRatio(hexA, hexB)        — WCAG contrast ratio (1..21)
//
// qrcode-generator itself is loaded once, lazily, through loadEncoder().

import { assetUrl } from '../../assets/assetUrl.js';

export class QrError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'QrError';
    this.code = code;
  }
}

const EC_LEVELS = ['L', 'M', 'Q', 'H'];

/* ===================================================================== */
/* Vendored encoder                                                      */
/* ===================================================================== */

let encoderPromise = null;

/**
 * Resolve the qrcode-generator factory. In the browser the vendored build is
 * injected as a plain <script> (so it attaches the `qrcode` global); in Node
 * the same file is imported as a CommonJS module. Either way the library is
 * never fetched over the network.
 *
 * The single-file build defaults to a lossy latin1 `stringToBytes`; we switch
 * it to the UTF-8 converter the library also ships so any Unicode payload
 * round-trips exactly.
 *
 * @returns {Promise<Function>} the `qrcode(typeNumber, ecLevel)` factory
 */
export function loadEncoder() {
  if (globalThis.qrcode && globalThis.qrcode.__utf8Configured) return Promise.resolve(globalThis.qrcode);
  if (globalThis.qrcode) { configureEncoder(globalThis.qrcode); return Promise.resolve(globalThis.qrcode); }
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    if (encoderPromise) return encoderPromise;
    encoderPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-qrcode-gen]');
      const script = existing || document.createElement('script');
      // Resolved against this module, not the document: a bare '../../vendor/...'
      // on script.src is resolved by the browser against the page, which broke
      // when the app was served from a sub-path (review F07).
      script.src = assetUrl('../../vendor/qrcode-generator/qrcode.js', import.meta.url);
      script.async = true;
      script.dataset.qrcodeGen = '1';
      script.addEventListener('load', () => {
        if (globalThis.qrcode) { configureEncoder(globalThis.qrcode); resolve(globalThis.qrcode); }
        else reject(new QrError('encoder', 'qrcode.js loaded but did not expose the qrcode global.'));
      });
      script.addEventListener('error', () => {
        encoderPromise = null;
        reject(new QrError('encoder', 'Could not load the bundled qrcode-generator library.'));
      });
      if (!existing) document.head.appendChild(script);
    });
    return encoderPromise;
  }
  // Node (or any CommonJS host): import the vendored file directly.
  encoderPromise = import('../../vendor/qrcode-generator/qrcode.js')
    .then((mod) => {
      const qrcode = mod.default || mod;
      configureEncoder(qrcode);
      return qrcode;
    })
    .catch((err) => {
      encoderPromise = null;
      throw new QrError('encoder', `Could not import the bundled qrcode-generator library: ${(err && err.message) || err}`);
    });
  return encoderPromise;
}

/** Point the encoder's byte conversion at its own UTF-8 implementation. */
function configureEncoder(qrcode) {
  if (qrcode && qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs['UTF-8']) {
    qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
  }
  if (qrcode) {
    try { qrcode.__utf8Configured = true; } catch { /* frozen object: harmless */ }
  }
}

/* ===================================================================== */
/* Matrix building                                                       */
/* ===================================================================== */

function normalizeEcLevel(ecLevel) {
  const up = String(ecLevel == null ? '' : ecLevel).trim().toUpperCase();
  return EC_LEVELS.includes(up) ? up : null;
}

function dataUrlLength(text) {
  // qrcode-generator measures payload length in UTF-8 bytes; mirror that here
  // so the empty/oversize checks match what the encoder will attempt.
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length;
  return encodeUtf8Fallback(text).length;
}

function encodeUtf8Fallback(str) {
  const out = [];
  for (let i = 0; i < str.length; i += 1) {
    let c = str.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
      const next = str.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        c = 0x10000 + (((c & 0x3ff) << 10) | (next & 0x3ff));
        i += 1;
      }
    }
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
  }
  return out;
}

/**
 * Encode text as a QR module matrix.
 *
 * Returns an array of rows; each row is an array of booleans where `true`
 * means a dark module. The matrix is square with `17 + 4 * version` modules
 * per side (version 1..40). When `typeNumber` is 0 (the default) the encoder
 * picks the smallest version that fits.
 *
 * @param {string} text
 * @param {string} [ecLevel]  one of 'L' | 'M' | 'Q' | 'H' (default 'M')
 * @param {{ typeNumber?: number }} [opts]
 * @returns {Promise<boolean[][]>}
 */
export async function matrixFromText(text, ecLevel = 'M', opts = {}) {
  const value = text == null ? '' : String(text);
  const level = normalizeEcLevel(ecLevel);
  if (!level) throw new QrError('ec', `Unknown error correction level "${ecLevel}" — use L, M, Q or H.`);

  const dataLen = dataUrlLength(value);
  // qrcode-generator throws a bare "code length overflow" for oversized input.
  // Cap at roughly what version 40-L can hold (2953 bytes) so the error text we
  // surface is always friendly; the encoder still enforces the exact limit.
  if (dataLen > 2953) {
    throw new QrError('overflow', `The content is too long for a QR code (${dataLen} bytes; the largest code holds 2953).`);
  }

  const qrcode = await loadEncoder();
  if (typeof qrcode !== 'function') {
    throw new QrError('encoder', 'The bundled qrcode-generator did not provide a factory function.');
  }

  const typeNumber = Number.isInteger(opts.typeNumber) && opts.typeNumber >= 0 && opts.typeNumber <= 40
    ? opts.typeNumber
    : 0;

  let qr;
  try {
    qr = qrcode(typeNumber, level);
    qr.addData(value);
    qr.make();
  } catch (err) {
    const msg = String((err && err.message) || err);
    if (/overflow/i.test(msg)) {
      throw new QrError('overflow', `The content is too long for a QR code at error correction level ${level} (${dataLen} bytes).`);
    }
    throw new QrError('encode', msg);
  }

  const count = qr.getModuleCount();
  // Every valid side length is 21, 25, ... 177 (17 + 4*version for version 1..40).
  if (!(count % 4 === 1 && count >= 21 && count <= 177)) {
    throw new QrError('matrix', `Unexpected module count ${count}.`);
  }

  const matrix = new Array(count);
  for (let r = 0; r < count; r += 1) {
    const row = new Array(count);
    for (let c = 0; c < count; c += 1) row[c] = qr.isDark(r, c) === true;
    matrix[r] = row;
  }
  return matrix;
}

/** Matrix side length for a QR version number. */
export function versionToSize(version) {
  return 17 + 4 * version;
}

/* ===================================================================== */
/* Wi-Fi payloads                                                        */
/* ===================================================================== */

/**
 * Escape one field of a Wi-Fi (WIFI:) payload. The MECARD-style grammar uses
 * `\`, `;`, `,`, `:` and `"` as metacharacters, so each is backslash-escaped.
 * The backslash itself must be escaped first.
 *
 * @param {string} value
 * @returns {string}
 */
export function escapeWifi(value) {
  return String(value == null ? '' : value)
    .replace(/\\/g, '\\\\')
    .replace(/([;,:"])/g, '\\$1');
}

/**
 * Build a Wi-Fi join payload.
 *
 * Format: `WIFI:T:<WPA|WEP|nopass>;S:<ssid>;P:<password>;H:<true|false>;;`
 * The trailing `;;` terminates the record. Empty optional fields are omitted;
 * `H:true` is only emitted for a hidden network.
 *
 * @param {object} o
 * @param {string} o.ssid
 * @param {string} [o.password]
 * @param {string} [o.encryption]  'WPA' | 'WEP' | 'nopass' (default 'WPA')
 * @param {boolean} [o.hidden]
 * @returns {string}
 */
export function buildWifiPayload(o = {}) {
  const ssid = escapeWifi(o.ssid);
  const enc = String(o.encryption == null ? 'WPA' : o.encryption).trim();
  const type = enc === 'nopass' ? 'nopass' : (enc === 'WEP' ? 'WEP' : 'WPA');

  let out = `WIFI:T:${type};S:${ssid};`;
  if (type !== 'nopass' && o.password != null && o.password !== '') {
    out += `P:${escapeWifi(o.password)};`;
  }
  if (o.hidden) out += 'H:true;';
  out += ';';
  return out;
}

/** vCard 3.0 TEXT values escape backslash before delimiters and line breaks. */
export function escapeVcard(value) {
  return String(value == null ? '' : value)
    .replace(/\\/g, '\\\\')
    .replace(/\r\n|\r|\n/g, '\\n')
    .replace(/([;,])/g, '\\$1');
}

export function buildVcardPayload(v = {}) {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0'];
  const name = String(v.name || '').trim();
  if (name) {
    lines.push(`FN:${escapeVcard(name)}`);
    const parts = name.split(/\s+/);
    const last = parts.length > 1 ? parts.pop() : '';
    lines.push(`N:${escapeVcard(last)};${escapeVcard(parts.join(' '))};;;`);
  }
  for (const [key, value] of [['ORG', v.org], ['TEL;TYPE=CELL', v.tel], ['EMAIL', v.email], ['URL', v.url]]) {
    if (String(value || '').trim()) lines.push(`${key}:${escapeVcard(String(value).trim())}`);
  }
  return [...lines, 'END:VCARD'].join('\r\n') + '\r\n';
}

/** Parse RFC-style CSV records, taking the first column as the QR payload. */
export function parseQrCsv(csv) {
  const text = String(csv || '').replace(/^\ufeff/, '');
  const rows = [];
  let field = '', columns = [], quoted = false, closed = false;
  function finish() {
    columns.push(field);
    if (columns[0].trim()) {
      if (rows.length === 200) throw new QrError('csv', 'CSV supports at most 200 non-empty rows.');
      rows.push(columns[0]);
    }
    field = ''; columns = []; closed = false;
  }
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') { quoted = false; closed = true; }
      else if (ch === '\r' && text[i + 1] === '\n') { field += '\n'; i += 1; }
      else field += ch;
    } else if (ch === '"' && !field && !closed) {
      quoted = true;
    } else if (ch === ',' || ch === '\n' || ch === '\r') {
      if (ch === ',') { columns.push(field); field = ''; closed = false; }
      else { finish(); if (ch === '\r' && text[i + 1] === '\n') i += 1; }
    } else {
      if (closed || ch === '"') throw new QrError('csv', 'Invalid CSV quoting.');
      field += ch;
    }
  }
  if (quoted) throw new QrError('csv', 'Unclosed CSV quoted field.');
  if (field || columns.length || closed) finish();
  return rows;
}

/** Produce flat, deterministic, unique names without using untrusted path segments. */
export function qrFilenames(payloads) {
  const used = new Set();
  return payloads.map((payload) => {
    const base = String(payload).normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64).replace(/-+$/g, '') || 'qr-code';
    let name = `${base}.png`, number = 2;
    while (used.has(name.toLowerCase())) name = `${base}-${number++}.png`;
    used.add(name.toLowerCase());
    return name;
  });
}

/* ===================================================================== */
/* SVG rendering                                                         */
/* ===================================================================== */

function normalizeHex(value, fallback) {
  const s = String(value == null ? '' : value).trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s)) {
    return s.length === 4
      ? `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`.toLowerCase()
      : s.toLowerCase();
  }
  return fallback;
}

/**
 * Render a module matrix as a self-contained SVG string.
 *
 * The SVG references nothing external (no images, no fonts, no network) and
 * uses `shape-rendering="crispEdges"` so modules stay sharp at any size. Each
 * dark module becomes one unit square inside a single light-filled background
 * rectangle, with a quiet zone of `margin` modules on every side.
 *
 * @param {boolean[][]} matrix
 * @param {{ scale?: number, margin?: number, dark?: string, light?: string }} [options]
 * @returns {string}
 */
export function matrixToSvg(matrix, options = {}) {
  if (!Array.isArray(matrix) || matrix.length === 0 || !Array.isArray(matrix[0])) {
    throw new QrError('matrix', 'matrixToSvg expects a non-empty matrix of rows.');
  }
  const n = matrix.length;
  for (let r = 0; r < n; r += 1) {
    if (!Array.isArray(matrix[r]) || matrix[r].length !== n) {
      throw new QrError('matrix', `matrixToSvg expects a square matrix; row ${r} has ${matrix[r] && matrix[r].length} entries.`);
    }
  }

  const scale = Math.max(1, Math.floor(Number(options.scale) || 8));
  const margin = Math.max(0, Math.floor(Number(options.margin) || 0));
  const dark = normalizeHex(options.dark, '#000000');
  const light = normalizeHex(options.light, '#ffffff');

  const dim = (n + margin * 2) * scale;
  const parts = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${dim}" height="${dim}" ` +
    `viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges" role="img" ` +
    `aria-label="QR code">`,
  );
  parts.push(`<rect width="${dim}" height="${dim}" fill="${light}"/>`);

  // One <path> for every dark module keeps the SVG small and single-purpose.
  let d = '';
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      if (matrix[r][c]) {
        const x = (c + margin) * scale;
        const y = (r + margin) * scale;
        d += `M${x} ${y}h${scale}v${scale}h-${scale}z`;
      }
    }
  }
  if (d) parts.push(`<path fill="${dark}" d="${d}"/>`);
  parts.push('</svg>');
  return parts.join('');
}

/* ===================================================================== */
/* Contrast                                                              */
/* ===================================================================== */

function hexToRgb(hex) {
  const s = String(hex == null ? '' : hex).trim();
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(s);
  if (!m) throw new QrError('colour', `Not a hex colour: "${hex}".`);
  let body = m[1];
  if (body.length === 3) body = body[0] + body[0] + body[1] + body[1] + body[2] + body[2];
  return [
    parseInt(body.slice(0, 2), 16),
    parseInt(body.slice(2, 4), 16),
    parseInt(body.slice(4, 6), 16),
  ];
}

function relativeLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * WCAG contrast ratio between two hex colours, in the range 1..21.
 * Black on white is exactly 21; two identical colours are exactly 1.
 *
 * @param {string} hexA
 * @param {string} hexB
 * @returns {number}
 */
export function contrastRatio(hexA, hexB) {
  const la = relativeLuminance(hexA);
  const lb = relativeLuminance(hexB);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Inverted polarity makes scanning unreliable even with a high ratio. */
export function isInvertedContrast(foreground, background) {
  return relativeLuminance(foreground) > relativeLuminance(background);
}

/** Conservative scan heuristic retained for callers using the legacy 4.5 threshold. */
export function isScannableContrast(dark, light, min = 4.5) {
  try {
    return contrastRatio(dark, light) >= min && relativeLuminance(dark) < relativeLuminance(light);
  } catch {
    return false;
  }
}

/* ===================================================================== */
/* PNG pixels (used by the UI canvas and by the node tests)              */
/* ===================================================================== */

/**
 * Expand a module matrix into a packed RGBA pixel buffer, one array element
 * per channel (r,g,b,a) so it is trivial to feed either an ImageData or a PNG
 * encoder. `scale` is the pixel size of one module; `margin` adds a quiet zone
 * in modules. Returns `{ width, height, data }`.
 *
 * @param {boolean[][]} matrix
 * @param {{ scale?: number, margin?: number, dark?: string, light?: string }} [options]
 * @returns {{ width: number, height: number, data: Uint8ClampedArray }}
 */
export function matrixToRgba(matrix, options = {}) {
  const n = matrix.length;
  const scale = Math.max(1, Math.floor(Number(options.scale) || 8));
  const margin = Math.max(0, Math.floor(Number(options.margin) || 0));
  const dark = hexToRgb(normalizeHex(options.dark, '#000000'));
  const light = hexToRgb(normalizeHex(options.light, '#ffffff'));
  const size = (n + margin * 2) * scale;

  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    const mr = Math.floor(y / scale) - margin;
    for (let x = 0; x < size; x += 1) {
      const mc = Math.floor(x / scale) - margin;
      const isDark = mr >= 0 && mr < n && mc >= 0 && mc < n && matrix[mr][mc];
      const [r, g, b] = isDark ? dark : light;
      const i = (y * size + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return { width: size, height: size, data };
}
