// PDF image compression without DOM dependencies. The browser supplies an encoder
// callback; the byte and PDF decisions can also be exercised in Node.

export function scaledDimensions(width, height, maxDimension) {
  if (!(width > 0 && height > 0)) throw new Error('Invalid image dimensions.');
  const scale = maxDimension > 0 ? Math.min(1, maxDimension / Math.max(width, height)) : 1;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function shouldReplaceImage(before, after) {
  return Number.isFinite(before) && Number.isFinite(after) && after > 0 && after < before;
}

export function sizeSavings(before, after) {
  const smaller = before > 0 && after < before;
  return { bytes: smaller ? before - after : 0, percent: smaller ? ((before - after) / before) * 100 : 0, smaller };
}

export function imageFilter(value) {
  const values = Array.isArray(value) ? value : value?.asArray?.() || [value];
  const names = values.map((v) => v?.toString?.().replace(/^\//, ''));
  if (names.includes('DCTDecode')) return 'DCTDecode';
  if (names.includes('FlateDecode')) return 'FlateDecode';
  return null;
}

export function rewriteImageStream(doc, ref, jpeg, width, height, lib) {
  const api = lib || globalThis.PDFLib;
  if (!api) throw new Error('PDF library is not loaded.');
  const { PDFName, PDFNumber, PDFRawStream } = api;
  const old = doc.context.lookup(ref, PDFRawStream);
  const dict = old.dict;
  const replacement = doc.context.obj({});
  for (const [key, value] of dict.entries()) replacement.set(key, value);
  replacement.set(PDFName.of('Type'), PDFName.of('XObject'));
  replacement.set(PDFName.of('Subtype'), PDFName.of('Image'));
  replacement.set(PDFName.of('Width'), PDFNumber.of(width));
  replacement.set(PDFName.of('Height'), PDFNumber.of(height));
  replacement.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
  replacement.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'));
  replacement.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8));
  replacement.set(PDFName.of('Length'), PDFNumber.of(jpeg.length));
  for (const key of ['DecodeParms', 'Decode', 'F', 'FFilter', 'FDecodeParms']) replacement.delete(PDFName.of(key));
  doc.context.assign(ref, PDFRawStream.of(replacement, jpeg));
}

function describeError(err) {
  const raw = String(err?.message || err || '');
  if (/encrypt|password/i.test(raw)) return new Error('This PDF is password-protected or encrypted and cannot be compressed.');
  return new Error('This file is not a valid PDF or is damaged.');
}

/**
 * The encode callback accepts { jpeg, pixels, width, height, target, quality }.
 * JPEG bytes are passed directly; decoded Flate RGB/gray pixels are RGBA.
 */
export async function compressPdf(bytes, { lib, quality = 60, maxDimension = null, encode, onProgress, cancelled = () => false } = {}) {
  if (!(bytes instanceof Uint8Array) || !lib || typeof encode !== 'function') throw new Error('PDF bytes, library and encoder are required.');
  let doc;
  try { doc = await lib.PDFDocument.load(bytes); }
  catch (err) { throw describeError(err); }
  const { PDFName, PDFRawStream } = lib;
  const name = (dict, key) => dict.get(PDFName.of(key))?.toString();
  const number = (dict, key) => dict.get(PDFName.of(key))?.asNumber?.();
  let recompressed = 0;
  let skipped = 0;
  const images = doc.context.enumerateIndirectObjects().filter(([, obj]) =>
    obj instanceof PDFRawStream && name(obj.dict, 'Subtype') === '/Image');
  for (const [ref, stream] of images) {
    if (cancelled()) return null;
    const dict = stream.dict;
    const width = number(dict, 'Width');
    const height = number(dict, 'Height');
    const filter = imageFilter(dict.get(PDFName.of('Filter')));
    const color = name(dict, 'ColorSpace');
    const bits = number(dict, 'BitsPerComponent');
    const parms = dict.get(PDFName.of('DecodeParms'));
    // Transparency, masks and nonstandard decode arrays require preserving the
    // original stream; otherwise JPEG's opaque RGB would change its appearance.
    const unsafe = ['SMask', 'Mask', 'ImageMask', 'Decode', 'F', 'FFilter', 'FDecodeParms', 'Alternates']
      .some((key) => dict.has(PDFName.of(key))) ||
      (filter === 'FlateDecode' && parms != null && parms.toString() !== 'null' &&
        !(parms.get && (!parms.get(PDFName.of('Predictor')) || parms.get(PDFName.of('Predictor')).asNumber?.() === 1)));
    if (unsafe || !filter || !Number.isInteger(width) || !Number.isInteger(height) ||
        width < 1 || height < 1 || width * height > 100000000 || bits !== 8 ||
        !['/DeviceRGB', '/DeviceGray'].includes(color)) {
      skipped++;
      onProgress?.(recompressed + skipped, images.length);
      continue;
    }
    try {
      let pixels;
      let jpeg;
      if (filter === 'DCTDecode' && name(dict, 'Filter') === '/DCTDecode') {
        jpeg = stream.contents;
      } else if (filter === 'FlateDecode' && name(dict, 'Filter') === '/FlateDecode') {
        const raw = lib.decodePDFRawStream(stream).decode();
        const components = color === '/DeviceRGB' ? 3 : 1;
        if (raw.length !== width * height * components) throw new Error('Unsupported pixel layout');
        pixels = new Uint8ClampedArray(width * height * 4);
        for (let i = 0; i < width * height; i++) {
          const p = i * 4;
          const s = i * components;
          pixels[p] = raw[s]; pixels[p + 1] = raw[s + (components === 3 ? 1 : 0)];
          pixels[p + 2] = raw[s + (components === 3 ? 2 : 0)]; pixels[p + 3] = 255;
        }
      } else throw new Error('Unsupported filter chain');
      const target = scaledDimensions(width, height, maxDimension);
      const result = await encode({ jpeg, pixels, width, height, target, quality });
      if (cancelled()) return null;
      if (result?.bytes instanceof Uint8Array && shouldReplaceImage(stream.contents.length, result.bytes.length)) {
        rewriteImageStream(doc, ref, result.bytes, target.width, target.height, lib);
        recompressed++;
      } else skipped++;
    } catch {
      skipped++;
    }
    onProgress?.(recompressed + skipped, images.length);
  }
  if (cancelled()) return null;
  const output = await doc.save({ useObjectStreams: true });
  return { bytes: output, recompressed, skipped, savings: sizeSavings(bytes.length, output.length) };
}
