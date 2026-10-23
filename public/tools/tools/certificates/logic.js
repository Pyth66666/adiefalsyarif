import { visibleBox, rotationOf, visualSize, visualPoint } from '../signpdf/logic.js';

export function parseNames(text) {
  const input = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let cells = [], cell = '', quoted = false, closed = false, row = 1, start = 1;
  const finish = () => { cells.push(cell); rows.push({ cells, row: start }); cells = []; cell = ''; closed = false; };
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"' && input[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else if (c === '\r' && input[i + 1] === '\n') { cell += '\n'; i++; row++; }
      else { cell += c; if (c === '\n' || c === '\r') row++; }
      continue;
    }
    if (c === '"' && !cell && !closed) { quoted = true; continue; }
    if (c === ',' || c === '\n' || c === '\r') {
      if (c === ',') { cells.push(cell); cell = ''; closed = false; }
      else { finish(); if (c === '\r' && input[i + 1] === '\n') i++; row++; start = row; }
      continue;
    }
    if (closed && !/\s/.test(c)) throw new RangeError(`Invalid CSV quote on row ${start}.`);
    if (c === '"') throw new RangeError(`Invalid CSV quote on row ${start}.`);
    cell += c;
  }
  if (quoted) throw new RangeError(`Unclosed CSV quote on row ${start}.`);
  if (cell || cells.length) finish();
  const header = rows[0]?.cells.findIndex((value) => value.trim().toLowerCase() === 'name') ?? -1;
  const column = header < 0 ? 0 : header;
  return rows.slice(header < 0 ? 0 : 1).map(({ cells: values, row: line }) => ({ name: (values[column] || '').trim(), row: line }))
    .filter(({ name }) => name).slice(0, 500);
}

export function certificateNames(names) {
  const used = new Set();
  return names.map((name) => {
    let base = String(name).replace(/[\x00-\x1f\x7f<>:"/\\|?*]/g, '').trim().replace(/[. ]+$/g, '').slice(0, 100);
    if (!base || /^\.+$/.test(base)) base = 'certificate';
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(base)) base += '_';
    let candidate = base, suffix = 2;
    while (used.has(`${candidate}.pdf`.toLowerCase())) candidate = `${base}-${suffix++}`;
    used.add(`${candidate}.pdf`.toLowerCase());
    return `${candidate}.pdf`;
  });
}

// X/Y identify the visual text center, measured from the visible page's top-left.
export function namePlacement(box, rotation, x, y, width, size) {
  const visual = visualSize(box, rotation);
  if (![x, y, width, size].every(Number.isFinite) || size <= 0 || width < 0 || x < 0 || y < 0 || x > visual.width || y > visual.height) {
    throw new RangeError('Place the name center inside the visible page.');
  }
  const point = visualPoint(box, rotation, x - width / 2, y + size / 2);
  return { ...point, rotate: rotation };
}

export async function generateCertificates(template, rows, options, lib, merged = false, onProgress = () => {}) {
  if (!rows.length) throw new RangeError('Add at least one name.');
  if (rows.length > 500) throw new RangeError('Use at most 500 names.');
  const size = Number(options.size), x = Number(options.x), y = Number(options.y);
  if (!Number.isFinite(size) || size <= 0 || !/^#[0-9a-f]{6}$/i.test(options.color)) throw new RangeError('Choose a valid font size and color.');
  if (!['Helvetica', 'TimesRoman', 'Courier'].includes(options.font)) throw new RangeError('Choose a standard font.');
  const source = template.pdf ? await lib.PDFDocument.load(template.pdf) : null;
  if (source && !source.getPageCount()) throw new RangeError('Template PDF has no pages.');
  if (!source && !template.image) throw new RangeError('Add a template.');
  if (!source && !(template.image.width > 0 && template.image.height > 0)) throw new RangeError('Template image has no dimensions.');
  const output = merged ? await lib.PDFDocument.create() : null;
  const files = [], errors = [], names = certificateNames(rows.map(({ name }) => name));
  const color = lib.rgb(...[1, 3, 5].map((i) => parseInt(options.color.slice(i, i + 2), 16) / 255));
  const sourcePage = source?.getPage(0);
  const box = sourcePage ? visibleBox(sourcePage) : { x: 0, y: 0, width: template.image.width, height: template.image.height };
  const rotation = sourcePage ? rotationOf(sourcePage) : 0;
  namePlacement(box, rotation, x, y, 0, size);
  for (let i = 0; i < rows.length; i++) {
    const { name, row } = rows[i];
    try {
      const doc = output || await lib.PDFDocument.create();
      const font = await doc.embedFont(lib.StandardFonts[options.font]);
      try { font.encodeText(name); }
      catch { errors.push({ row, name, reason: 'The selected standard font cannot encode this name.' }); continue; }
      const placement = namePlacement(box, rotation, x, y, font.widthOfTextAtSize(name, size), size);
      let page;
      if (source) [page] = await doc.copyPages(source, [0]);
      else {
        const image = template.image.type === 'image/jpeg' ? await doc.embedJpg(template.image.bytes) : await doc.embedPng(template.image.bytes);
        page = doc.addPage([image.width, image.height]);
        page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
      }
      if (source) doc.addPage(page);
      page.drawText(name, { ...placement, size, font, color, rotate: lib.degrees(placement.rotate) });
      if (!merged) files.push({ name: names[i], bytes: await doc.save() });
    } catch (error) {
      if (error instanceof RangeError) throw error;
      errors.push({ row, name, reason: 'Could not generate a certificate for this name.' });
    }
    onProgress(i + 1, rows.length);
  }
  return { files, errors, merged: output && output.getPageCount() ? await output.save() : null };
}
