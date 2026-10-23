// Pure text / encoding operations — no DOM, no network, no browser-only API
// at module load.
//
// Four families live here:
//
//   1. JSON  — format (pretty-print), minify and validate with line/column.
//   2. Base64 — encode/decode bytes and text (UTF-8, URL-safe, tolerant).
//   3. UUID  — RFC 4122 version 4 generation via crypto.
//   4. SHA-256 — hex digest via crypto.subtle, with a pure-JS fallback for
//      insecure contexts (plain http on a non-localhost host has no subtle).
//
// Everything here runs unchanged in the browser and in `node tests/text.test.mjs`.

/* ---------- environment-independent crypto/compat shims ---------- */

// Prefer the global Web Crypto (browsers, Workers, Node >= 19). Older Node
// exposes it on globalThis.crypto as well; there is no require() of node
// built-ins here so the module stays browser-pure.
const webcrypto = (typeof globalThis !== 'undefined' && globalThis.crypto) || null;

const hasSubtle = Boolean(webcrypto && webcrypto.subtle && typeof webcrypto.subtle.digest === 'function');
const hasRandomUUID =
  Boolean(webcrypto && typeof webcrypto.randomUUID === 'function');
const hasGetRandomValues =
  Boolean(webcrypto && typeof webcrypto.getRandomValues === 'function');

// TextEncoder/TextDecoder are globals in browsers and Node, but be defensive.
const TextEnc = typeof TextEncoder !== 'undefined' ? TextEncoder : null;
const TextDec = typeof TextDecoder !== 'undefined' ? TextDecoder : null;

/* ---------- errors ---------- */

export class TextToolError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'TextToolError';
    this.code = code;
  }
}

/* ===================================================================== */
/* JSON                                                                  */
/* ===================================================================== */

/**
 * Parse JSON and translate engine output into a friendly, position-aware error.
 * Never throws for malformed input — always returns a `{ message, line, column }`.
 *
 * @param {string} text
 * @param {number|null} pos  0-based character offset from error.position when known
 * @returns {{ message: string, line: number|null, column: number|null }}
 */
function describeJsonError(text, err, pos) {
  const src = String(text);
  let index = Number.isInteger(pos) && pos >= 0 && pos <= src.length ? pos : null;

  if (index === null) {
    // Best effort: the classic three major engines all mention the offset.
    const m = /position\s+(\d+)/i.exec(String((err && err.message) || ''));
    if (m) index = Number(m[1]);
  }

  const base = String((err && err.message) || err || 'Invalid JSON');
  let line = null;
  let column = null;
  if (index !== null) {
    const upto = src.slice(0, index);
    const lastNl = upto.lastIndexOf('\n');
    line = (upto.match(/\n/g) || []).length + 1;
    column = index - lastNl; // 1-based; after a newline lastNl=-1 -> index+1
  }

  return { message: base, line, column };
}

/**
 * Validate a JSON document.
 * @param {string} text
 * @returns {{ ok: true } | { ok: false, error: { message: string, line: number|null, column: number|null } }}
 */
export function validateJson(text) {
  const src = String(text == null ? '' : text);
  try {
    JSON.parse(src);
    return { ok: true };
  } catch (err) {
    const pos = Number.isInteger(err && err.position) ? err.position : null;
    return { ok: false, error: describeJsonError(src, err, pos) };
  }
}

function parseOrThrow(text, code) {
  const src = String(text == null ? '' : text);
  if (src.trim() === '') {
    throw new TextToolError(code, 'There is nothing to process — the input is empty.');
  }
  try {
    return JSON.parse(src);
  } catch (err) {
    const pos = Number.isInteger(err && err.position) ? err.position : null;
    const info = describeJsonError(src, err, pos);
    const where = info.line != null
      ? ` (line ${info.line}, column ${info.column})`
      : '';
    throw new TextToolError('json', `Invalid JSON${where}: ${info.message}`);
  }
}

/**
 * Pretty-print JSON.
 * @param {string} text
 * @param {number|string} [indent]  spaces (or any JSON.stringify space value), default 2
 * @returns {string}
 */
export function formatJson(text, indent = 2) {
  const value = parseOrThrow(text, 'json');
  return JSON.stringify(value, null, indent);
}

/**
 * Strip all insignificant whitespace from JSON.
 * @param {string} text
 * @returns {string}
 */
export function minifyJson(text) {
  const value = parseOrThrow(text, 'json');
  return JSON.stringify(value);
}

/* ===================================================================== */
/* Base64                                                                */
/* ===================================================================== */

const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_URL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

// Accept standard and URL-safe alphabets, ignore whitespace, optional padding.
const B64_RE = /^[A-Za-z0-9+/]*={0,2}$/;

/**
 * Encode raw bytes to Base64.
 * @param {Uint8Array} bytes
 * @param {{ urlSafe?: boolean }} [opts]
 * @returns {string}
 */
export function base64EncodeBytes(bytes, opts = {}) {
  if (!(bytes instanceof Uint8Array)) {
    throw new TextToolError('input', 'base64EncodeBytes expects a Uint8Array.');
  }
  const alphabet = opts.urlSafe ? B64_URL_ALPHABET : B64_ALPHABET;
  let out = '';
  let i = 0;
  for (; i + 3 <= bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += alphabet[(n >> 18) & 63] + alphabet[(n >> 12) & 63] +
           alphabet[(n >> 6) & 63] + alphabet[n & 63];
  }
  const rem = bytes.length - i;
  if (rem === 1) {
    const n = bytes[i] << 16;
    out += alphabet[(n >> 18) & 63] + alphabet[(n >> 12) & 63];
    if (opts.pad !== false) out += '==';
  } else if (rem === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += alphabet[(n >> 18) & 63] + alphabet[(n >> 12) & 63] + alphabet[(n >> 6) & 63];
    if (opts.pad !== false) out += '=';
  }
  return out;
}

/**
 * Decode Base64 to bytes. Tolerates whitespace, missing padding and the
 * URL-safe alphabet. Throws TextToolError on genuinely invalid input.
 * @param {string} text
 * @returns {Uint8Array}
 */
export function base64DecodeToBytes(text) {
  if (typeof text !== 'string') {
    throw new TextToolError('input', 'Base64 input must be a string.');
  }
  const normalized = text
    .replace(/\s+/g, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  if (normalized.length === 0) return new Uint8Array(0);

  const noPad = normalized.replace(/=+$/g, '');
  // `=` may only appear as trailing padding; the regex above would hide an
  // internal `=`, so reject anything that still contains one.
  if (noPad.includes('=') || !B64_RE.test(normalized)) {
    throw new TextToolError('base64', 'Invalid Base64: it contains characters outside the Base64 alphabet.');
  }
  if (noPad.length % 4 === 1) {
    throw new TextToolError('base64', 'Invalid Base64: the length is not valid for Base64 data.');
  }

  const padded = noPad + '='.repeat((4 - (noPad.length % 4)) % 4);

  // Decode via an explicit 6-bit lookup so we do not depend on atob quirks.
  const lookup = new Int16Array(256).fill(-1);
  for (let i = 0; i < B64_ALPHABET.length; i += 1) lookup[B64_ALPHABET.charCodeAt(i)] = i;

  const outLen = (padded.length / 4) * 3
    - (padded.endsWith('==') ? 2 : padded.endsWith('=') ? 1 : 0);
  const out = new Uint8Array(outLen);
  let o = 0;
  for (let i = 0; i < padded.length; i += 4) {
    const c0 = lookup[padded.charCodeAt(i)];
    const c1 = lookup[padded.charCodeAt(i + 1)];
    const c2 = padded[i + 2] === '=' ? 0 : lookup[padded.charCodeAt(i + 2)];
    const c3 = padded[i + 3] === '=' ? 0 : lookup[padded.charCodeAt(i + 3)];
    const n = (c0 << 18) | (c1 << 12) | (c2 << 6) | c3;
    if (o < outLen) out[o++] = (n >> 16) & 0xff;
    if (o < outLen) out[o++] = (n >> 8) & 0xff;
    if (o < outLen) out[o++] = n & 0xff;
  }
  return out;
}

/**
 * Encode a JavaScript string as Base64 of its UTF-8 bytes.
 * @param {string} text
 * @param {{ urlSafe?: boolean }} [opts]
 * @returns {string}
 */
export function base64EncodeText(text, opts = {}) {
  if (typeof text !== 'string') {
    throw new TextToolError('input', 'base64EncodeText expects a string.');
  }
  if (!TextEnc) throw new TextToolError('env', 'TextEncoder is not available in this environment.');
  return base64EncodeBytes(new TextEnc().encode(text), opts);
}

/**
 * Decode Base64 back to a string, interpreting the bytes as UTF-8.
 * @param {string} text
 * @returns {string}
 */
export function base64DecodeToText(text) {
  const bytes = base64DecodeToBytes(text);
  if (!TextDec) throw new TextToolError('env', 'TextDecoder is not available in this environment.');
  try {
    return new TextDec('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new TextToolError('utf8', 'The decoded bytes are not valid UTF-8 text.');
  }
}

/**
 * Pure mode-dispatch for the Base64 tab (F14). Resolves the effective input
 * (a dropped file always wins over typed text), runs the right operation and
 * reports which source was actually used so the UI can be honest about it.
 *
 *   encode + fileBytes -> Base64 of the file's raw bytes (URL-safe optional)
 *   encode + text      -> Base64 of the typed text's UTF-8 bytes
 *   decode + fileBytes -> decode the (text) file's bytes as UTF-8, then
 *                         Base64-decode that text; the file wins
 *   decode + text      -> Base64-decode the typed text
 *
 * @param {object} input
 * @param {'encode'|'decode'} input.mode
 * @param {string} [input.text]        typed text (used only when no file)
 * @param {Uint8Array|null} [input.fileBytes]  dropped file bytes, or null
 * @param {boolean} [input.urlSafe]    URL-safe alphabet (encode only)
 * @returns {{ output: string, source: 'file'|'text', bytes: Uint8Array }}
 */
export function runBase64(input = {}) {
  const mode = input.mode === 'decode' ? 'decode' : 'encode';
  const text = input.text == null ? '' : String(input.text);
  const fileBytes = input.fileBytes instanceof Uint8Array ? input.fileBytes : null;

  if (mode === 'decode') {
    // For a dropped file, decode its text content first, then Base64-decode it.
    if (fileBytes) {
      const content = decodeUtf8(fileBytes);
      const output = base64DecodeToText(content);
      return { output, source: 'file', bytes: utf8Bytes(output) };
    }
    const output = base64DecodeToText(text);
    return { output, source: 'text', bytes: utf8Bytes(output) };
  }

  // Encode: the file's raw bytes win over typed text.
  if (fileBytes) {
    const output = base64EncodeBytes(fileBytes, { urlSafe: Boolean(input.urlSafe) });
    return { output, source: 'file', bytes: utf8Bytes(output) };
  }
  const output = base64EncodeText(text, { urlSafe: Boolean(input.urlSafe) });
  return { output, source: 'text', bytes: utf8Bytes(output) };
}

/** UTF-8 bytes of a string, or an empty array when no encoder is available. */
function utf8Bytes(str) {
  return TextEnc ? new TextEnc().encode(str) : new Uint8Array(0);
}

/** Decode bytes as strict UTF-8 text, with a friendly error. */
function decodeUtf8(bytes) {
  if (!TextDec) throw new TextToolError('env', 'TextDecoder is not available in this environment.');
  try {
    return new TextDec('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new TextToolError('utf8', 'The dropped file is not valid UTF-8 text.');
  }
}

/* ===================================================================== */
/* Base64 compatibility helpers (btoa/atob with UTF-8 handling)          */
/* ===================================================================== */

/**
 * UTF-8 safe `btoa`: encode a string's UTF-8 bytes as Base64.
 * Uses the shared encoder above; named to mirror the task's btoa/atob note.
 * @param {string} text
 * @param {{ urlSafe?: boolean }} [opts]
 * @returns {string}
 */
export function btoaUtf8(text, opts = {}) {
  return base64EncodeText(text, opts);
}

/**
 * UTF-8 safe `atob`: decode Base64 to a UTF-8 string.
 * @param {string} text
 * @returns {string}
 */
export function atobUtf8(text) {
  return base64DecodeToText(text);
}

/* ===================================================================== */
/* UUID v4                                                               */
/* ===================================================================== */

function randomBytes(n) {
  const out = new Uint8Array(n);
  if (hasGetRandomValues) {
    webcrypto.getRandomValues(out);
    return out;
  }
  // Last-resort: Math.random. Never used in a browser with Web Crypto.
  for (let i = 0; i < n; i += 1) out[i] = Math.floor(Math.random() * 256);
  return out;
}

const HEX = '0123456789abcdef';

/**
 * Generate an RFC 4122 version 4 UUID. Uses crypto.randomUUID when present,
 * otherwise builds one from crypto.getRandomValues (version nibble 4 and
 * variant bits 10xx are set explicitly).
 * @returns {string}
 */
export function uuidV4() {
  if (hasRandomUUID) return webcrypto.randomUUID();

  const b = randomBytes(16);
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant 10xx
  let s = '';
  for (let i = 0; i < 16; i += 1) {
    s += HEX[b[i] >> 4] + HEX[b[i] & 0x0f];
    if (i === 3 || i === 5 || i === 7 || i === 9) s += '-';
  }
  return s;
}

/**
 * Generate `n` version 4 UUIDs (n is clamped to 1..1000).
 * @param {number} n
 * @returns {string[]}
 */
export function uuidMany(n) {
  const count = Math.max(1, Math.min(1000, Math.floor(Number(n) || 1)));
  const out = new Array(count);
  for (let i = 0; i < count; i += 1) out[i] = uuidV4();
  return out;
}

/* ===================================================================== */
/* SHA-256                                                               */
/* ===================================================================== */

/* ---- pure-JS fallback (used only when crypto.subtle is unavailable) ---- */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(x, n) {
  return ((x >>> n) | (x << (32 - n))) >>> 0;
}

/**
 * A small, dependency-free SHA-256 over a Uint8Array. Returns lowercase hex.
 * Used as the fallback when crypto.subtle is not available (e.g. plain http on
 * a non-localhost origin). Tested against the standard known-answer vectors.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
export function sha256HexFallback(bytes) {
  if (!(bytes instanceof Uint8Array)) {
    throw new TextToolError('input', 'sha256HexFallback expects a Uint8Array.');
  }
  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const W = new Uint32Array(64);

  const ml = bytes.length;
  const bitLen = ml * 8;
  const withOne = ml + 1;
  const paddedLen = withOne + ((56 - (withOne % 64)) + 64) % 64 + 8;
  const msg = new Uint8Array(paddedLen);
  msg.set(bytes);
  msg[ml] = 0x80;
  // 64-bit big-endian length; split across two 32-bit words.
  const hi = Math.floor(bitLen / 0x100000000);
  const lo = bitLen >>> 0;
  const tail = paddedLen - 8;
  msg[tail] = (hi >>> 24) & 0xff;
  msg[tail + 1] = (hi >>> 16) & 0xff;
  msg[tail + 2] = (hi >>> 8) & 0xff;
  msg[tail + 3] = hi & 0xff;
  msg[tail + 4] = (lo >>> 24) & 0xff;
  msg[tail + 5] = (lo >>> 16) & 0xff;
  msg[tail + 6] = (lo >>> 8) & 0xff;
  msg[tail + 7] = lo & 0xff;

  for (let off = 0; off < paddedLen; off += 64) {
    for (let t = 0; t < 16; t += 1) {
      const j = off + t * 4;
      W[t] = (msg[j] << 24) | (msg[j + 1] << 16) | (msg[j + 2] << 8) | msg[j + 3];
    }
    for (let t = 16; t < 64; t += 1) {
      const x = W[t - 15];
      const y = W[t - 2];
      const s0 = (rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3)) >>> 0;
      const s1 = (rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10)) >>> 0;
      W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0;
    }

    let a = H[0], b = H[1], c = H[2], d = H[3];
    let e = H[4], f = H[5], g = H[6], h = H[7];

    for (let t = 0; t < 64; t += 1) {
      const S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 = (h + S1 + ch + K[t] + W[t]) >>> 0;
      const S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e;
      e = (d + temp1) >>> 0;
      d = c; c = b; b = a;
      a = (temp1 + temp2) >>> 0;
    }

    H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0;
    H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
    H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0;
    H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
  }

  let hex = '';
  for (let i = 0; i < 8; i += 1) {
    const v = H[i];
    hex += HEX[(v >>> 28) & 0xf] + HEX[(v >>> 24) & 0xf] +
           HEX[(v >>> 20) & 0xf] + HEX[(v >>> 16) & 0xf] +
           HEX[(v >>> 12) & 0xf] + HEX[(v >>> 8) & 0xf] +
           HEX[(v >>> 4) & 0xf] + HEX[v & 0xf];
  }
  return hex;
}

/** Whether crypto.subtle.digest is available in this environment. */
export function sha256HasSubtle() {
  return hasSubtle;
}

/**
 * SHA-256 of a byte array, returned as lowercase hex.
 * Uses crypto.subtle.digest when available, otherwise the pure-JS fallback so
 * hashing keeps working in insecure contexts.
 * @param {Uint8Array} bytes
 * @returns {Promise<string>}
 */
export async function sha256Hex(bytes) {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  if (hasSubtle) {
    const buf = await webcrypto.subtle.digest('SHA-256', input);
    const view = new Uint8Array(buf);
    let hex = '';
    for (let i = 0; i < view.length; i += 1) {
      hex += HEX[view[i] >> 4] + HEX[view[i] & 0x0f];
    }
    return hex;
  }
  return sha256HexFallback(input);
}