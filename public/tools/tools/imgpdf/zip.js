// A tiny store-only ZIP writer — pure, DOM-free, no libraries.
//
// The PDF-to-images pass can offer "download all pages as a ZIP" without pulling
// in a compression library: every page image (PNG/JPEG) is already compressed,
// so the archives use the ZIP "store" method (0) and only need correct framing
// plus a CRC-32 per entry. This module is small enough to audit and is verified
// in `node tests/zip.test.mjs` against Python's stdlib `zipfile` as an
// independent reader.

/**
 * CRC-32 (the IEEE 802.3 / ZIP polynomial 0xEDB88320), as an unsigned 32-bit
 * number. Accepts any Uint8Array, including a subarray view.
 * @param {Uint8Array} bytes
 * @returns {number}
 */
export function crc32(bytes) {
  const table = CRC_TABLE;
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    c = table[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;
const VERSION = 20; // 2.0 — plain stored entries need nothing newer.
const UTF8_FLAG = 0x0800; // general-purpose bit 11: names are UTF-8.

/** Little-endian writers into a growing byte list. */
function le16(arr, v) { arr.push(v & 0xff, (v >>> 8) & 0xff); }
function le32(arr, v) { arr.push(v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff); }

/**
 * Build a ZIP archive (store method only) from `[{ name, bytes }]` entries.
 *
 * The output is a spec-valid .zip: a local file header + stored data per entry,
 * a central directory record per entry, and an End Of Central Directory record.
 * Times are fixed to a constant (1980-01-01) so the same inputs always produce
 * byte-identical output. No encryption, no data descriptors, no compression.
 *
 * @param {{ name: string, bytes: Uint8Array }[]} entries
 * @returns {Uint8Array}
 */
export function zipStore(entries) {
  const list = Array.isArray(entries) ? entries : [];
  const encoder = new TextEncoder();

  const out = [];
  const central = [];
  let offset = 0;

  for (const entry of list) {
    const name = String(entry && entry.name != null ? entry.name : '');
    if (!name) throw new Error('Every ZIP entry needs a non-empty name.');
    const bytes = entry.bytes instanceof Uint8Array
      ? entry.bytes
      : new Uint8Array(entry.bytes || []);
    const nameBytes = encoder.encode(name);
    const crc = crc32(bytes);
    const size = bytes.length;

    // ---- local file header (30 bytes) + name + data ----
    const local = [];
    le32(local, LOCAL_SIG);
    le16(local, VERSION);       // version needed to extract
    le16(local, UTF8_FLAG);     // general purpose bit flag
    le16(local, 0);             // compression method: store
    le16(local, 0);             // last mod time (fixed)
    le16(local, 0x0021);        // last mod date (fixed: 1980-01-01)
    le32(local, crc);
    le32(local, size);          // compressed size
    le32(local, size);          // uncompressed size
    le16(local, nameBytes.length);
    le16(local, 0);             // extra field length

    for (const b of local) out.push(b);
    for (const b of nameBytes) out.push(b);
    for (let i = 0; i < size; i += 1) out.push(bytes[i]);

    // ---- central directory record (46 bytes) + name ----
    const rec = [];
    le32(rec, CENTRAL_SIG);
    le16(rec, VERSION);         // version made by
    le16(rec, VERSION);         // version needed
    le16(rec, UTF8_FLAG);
    le16(rec, 0);               // method: store
    le16(rec, 0);               // time
    le16(rec, 0x0021);          // date
    le32(rec, crc);
    le32(rec, size);
    le32(rec, size);
    le16(rec, nameBytes.length);
    le16(rec, 0);               // extra length
    le16(rec, 0);               // comment length
    le16(rec, 0);               // disk number start
    le16(rec, 0);               // internal attributes
    le32(rec, 0);               // external attributes
    le32(rec, offset);          // relative offset of the local header
    for (const b of rec) central.push(b);
    for (const b of nameBytes) central.push(b);

    offset += 30 + nameBytes.length + size;
  }

  const centralStart = offset;
  for (const b of central) out.push(b);
  const centralSize = central.length;

  // ---- End Of Central Directory (22 bytes) ----
  const eocd = [];
  le32(eocd, EOCD_SIG);
  le16(eocd, 0);              // number of this disk
  le16(eocd, 0);              // disk with the central directory
  le16(eocd, list.length);    // entries on this disk
  le16(eocd, list.length);    // total entries
  le32(eocd, centralSize);
  le32(eocd, centralStart);
  le16(eocd, 0);              // comment length
  for (const b of eocd) out.push(b);

  return new Uint8Array(out);
}