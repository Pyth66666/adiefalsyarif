// Bounded EXIF/TIFF reader and metadata-free canvas export. No network or dependencies.
const malformed = () => new Error('Malformed or truncated EXIF metadata. Try another image.');
const text = (bytes, start, length) => {
  let value = '';
  for (let i = start; i < start + length; i++) value += String.fromCharCode(bytes[i]);
  return value;
};

function tiffMetadata(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const size = bytes.length;
  function check(at, length) {
    if (!Number.isSafeInteger(at) || at < 0 || length < 0 || at + length > size) throw malformed();
  }
  check(0, 8);
  const order = text(bytes, 0, 2);
  if (order !== 'II' && order !== 'MM') throw malformed();
  const le = order === 'II';
  const u16 = (at) => { check(at, 2); return view.getUint16(at, le); };
  const u32 = (at) => { check(at, 4); return view.getUint32(at, le); };
  if (u16(2) !== 42) throw malformed();
  const widths = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
  function ifd(offset) {
    check(offset, 2);
    const count = u16(offset);
    check(offset + 2, count * 12 + 4);
    const entries = new Map();
    for (let n = 0; n < count; n++) {
      const pos = offset + 2 + n * 12;
      const tag = u16(pos), type = u16(pos + 2), number = u32(pos + 4);
      if (!widths[type]) continue;
      const length = widths[type] * number;
      if (!length || length > size) throw malformed();
      const data = length <= 4 ? pos + 8 : u32(pos + 8);
      check(data, length);
      const values = [];
      if (type === 2) {
        values.push(text(bytes, data, length).replace(/\0.*$/s, '').trim());
      } else if (type === 3 || type === 4 || type === 5 || type === 9 || type === 10) {
        // Only fields we display require scalar or three-element rational values.
        if (number > 16) continue;
        for (let i = 0; i < number; i++) {
          const p = data + i * widths[type];
          if (type === 5 || type === 10) {
            const numerator = type === 5 ? u32(p) : view.getInt32(p, le);
            const denominator = type === 5 ? u32(p + 4) : view.getInt32(p + 4, le);
            if (!denominator) throw malformed();
            values.push(numerator / denominator);
          } else values.push(type === 3 ? u16(p) : type === 4 ? u32(p) : view.getInt32(p, le));
        }
      }
      entries.set(tag, values.length === 1 ? values[0] : values);
    }
    return entries;
  }
  const main = ifd(u32(4));
  const extra = main.has(0x8769) ? ifd(main.get(0x8769)) : new Map();
  const gpsIfd = main.has(0x8825) ? ifd(main.get(0x8825)) : null;
  const coordinate = (value, ref, positive, negative, max) => {
    if (!Array.isArray(value) || value.length !== 3 || ![positive, negative].includes(ref) ||
      value.some((part) => !Number.isFinite(part) || part < 0)) return null;
    const decimal = value[0] + value[1] / 60 + value[2] / 3600;
    return decimal <= max ? decimal * (ref === negative ? -1 : 1) : null;
  };
  const latitude = gpsIfd && coordinate(gpsIfd.get(2), gpsIfd.get(1), 'N', 'S', 90);
  const longitude = gpsIfd && coordinate(gpsIfd.get(4), gpsIfd.get(3), 'E', 'W', 180);
  return {
    hasExif: true,
    make: main.get(0x010f), model: main.get(0x0110), software: main.get(0x0131),
    datetime: extra.get(0x9003) || main.get(0x0132),
    exposure: extra.get(0x829a), iso: extra.get(0x8827), focalLength: extra.get(0x920a),
    orientation: main.get(0x0112), width: extra.get(0xa002) || main.get(0x0100),
    height: extra.get(0xa003) || main.get(0x0101),
    gps: latitude !== null && longitude !== null ? { latitude, longitude } : null,
    hasGps: Boolean(gpsIfd),
  };
}

export function parseImageMetadata(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new Error('Unsupported image format.');
  let tiff = null;
  const tag = (at, label) => text(bytes, at, label.length) === label;
  if (tag(0, 'II') || tag(0, 'MM')) tiff = bytes;
  else if (bytes[0] === 255 && bytes[1] === 216) {
    let i = 2;
    while (i < bytes.length) {
      if (bytes[i] !== 255 || i + 2 > bytes.length) throw malformed();
      const marker = bytes[i + 1];
      if (marker === 0xda || marker === 0xd9) break;
      if (i + 4 > bytes.length) throw malformed();
      const length = bytes[i + 2] * 256 + bytes[i + 3];
      if (length < 2 || i + 2 + length > bytes.length) throw malformed();
      if (marker === 0xe1 && tag(i + 4, 'Exif\0\0')) {
        tiff = bytes.subarray(i + 10, i + 2 + length); break;
      }
      i += 2 + length;
    }
  } else if (tag(0, '\x89PNG\r\n\x1a\n')) {
    let i = 8;
    while (i + 12 <= bytes.length) {
      const len = new DataView(bytes.buffer, bytes.byteOffset + i, 4).getUint32(0);
      if (i + 12 + len > bytes.length) throw malformed();
      const type = text(bytes, i + 4, 4);
      if (type === 'eXIf') { tiff = bytes.subarray(i + 8, i + 8 + len); break; }
      if (type === 'IEND') break;
      i += 12 + len;
    }
  } else if (tag(0, 'RIFF') && tag(8, 'WEBP')) {
    let i = 12;
    while (i + 8 <= bytes.length) {
      const len = new DataView(bytes.buffer, bytes.byteOffset + i + 4, 4).getUint32(0, true);
      if (i + 8 + len > bytes.length) throw malformed();
      if (tag(i, 'EXIF')) {
        tiff = bytes.subarray(i + 8, i + 8 + len);
        if (tag(i + 8, 'Exif\0\0')) tiff = tiff.subarray(6);
        break;
      }
      i += 8 + len + (len & 1);
    }
  } else throw new Error('Unsupported image format. Choose JPEG, PNG, WebP or TIFF.');
  return tiff ? tiffMetadata(tiff) : { hasExif: false, gps: null, hasGps: false };
}

// Browsers may auto-orient JPEGs even when asked for raw pixels. Reset the
// orientation in a copy before decoding, then apply the original exactly once.
function resetJpegOrientation(bytes) {
  const out = bytes.slice();
  let i = 2;
  while (i + 4 <= out.length && out[i] === 255) {
    const marker = out[i + 1];
    if (marker === 0xda || marker === 0xd9) break;
    const length = out[i + 2] * 256 + out[i + 3];
    if (length < 2 || i + 2 + length > out.length) break;
    if (marker === 0xe1 && text(out, i + 4, 6) === 'Exif\0\0') {
      const start = i + 10, end = i + 2 + length;
      const le = text(out, start, 2) === 'II';
      if (!le && text(out, start, 2) !== 'MM') break;
      const v = new DataView(out.buffer);
      if (start + 8 > end) break;
      const base = start + v.getUint32(start + 4, le);
      if (base + 2 > end) break;
      const count = v.getUint16(base, le);
      if (base + 2 + count * 12 > end) break;
      for (let n = 0; n < count; n++) {
        const p = base + 2 + n * 12;
        if (v.getUint16(p, le) === 0x0112 && v.getUint16(p + 2, le) === 3 && v.getUint32(p + 4, le) === 1) {
          v.setUint16(p + 8, 1, le); return out;
        }
      }
      break;
    }
    i += 2 + length;
  }
  return out;
}

export async function reencodeWithoutMetadata(bytes, type, orientation = 1, adapters = {}) {
  const mime = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', tiff: 'image/tiff' }[type];
  if (!mime) throw new Error('Unsupported image format.');
  const createBitmap = adapters.createImageBitmap || globalThis.createImageBitmap;
  const createCanvas = adapters.createCanvas || (() => document.createElement('canvas'));
  if (typeof createBitmap !== 'function') throw new Error('This browser cannot decode this image.');
  const bitmap = await createBitmap(new Blob([type === 'jpeg' ? resetJpegOrientation(bytes) : bytes], { type: mime }), { imageOrientation: 'none' });
  try {
    const o = Number(orientation) || 1;
    const swap = o >= 5 && o <= 8;
    const canvas = createCanvas();
    canvas.width = swap ? bitmap.height : bitmap.width;
    canvas.height = swap ? bitmap.width : bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is unavailable.');
    ctx.translate(canvas.width / 2, canvas.height / 2);
    const rotations = { 3: 180, 4: 180, 5: 270, 6: 90, 7: 90, 8: 270 };
    ctx.rotate((rotations[o] || 0) * Math.PI / 180);
    if ([2, 4, 5, 7].includes(o)) ctx.scale(-1, 1);
    ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
    // Always output PNG, including for WebP/JPEG, to avoid unsupported encoder fallbacks.
    return await new Promise((resolve, reject) => canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Could not encode this image.')), 'image/png'));
  } finally { bitmap.close?.(); }
}
