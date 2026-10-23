// Images -> PDF / PDF -> images — UI layer.
//
// Loaded lazily by the shell (see assets/tools.js -> load()). This module owns
// the DOM only; the page fitting, range parsing, filename and EXIF-orientation
// rules live in the pure ./logic.js and the store-only ZIP writer in ./zip.js.
//
// Two directions, one tool:
//
//   * "Images to PDF" adds JPG/PNG/WebP files (drop or pick), lets them be
//     reordered (drag or keyboard) and removed, and writes ONE PDF with pdf-lib
//     (vendored under ../../vendor/pdf-lib/). JPEG and PNG embed their bytes
//     directly; WebP and anything else are decoded through a canvas and
//     re-encoded as PNG. JPEG EXIF orientation is honoured (the pixel data is
//     redrawn upright before embedding). Non-images and undecodable files are
//     rejected with a named reason while the rest still load.
//
//   * "PDF to images" loads a PDF with pdf.js (vendored under
//     ../../vendor/pdfjs/), renders each chosen page to a canvas at 1x/2x/3x and
//     exports PNG or JPEG (with a quality slider). Pages can be downloaded one
//     by one or all together as a ZIP built by ./zip.js. Encrypted or corrupt
//     PDFs raise a clear error and never crash.
//
// No CDN, no network, no AI — only browser built-ins plus the vendored libraries.

import { createDropzone, createDownloadButton, downloadBlob, formatBytes, iconButton, glyph, GLYPHS } from '../../assets/ui.js';
import { assetUrl } from '../../assets/assetUrl.js';
import {
  computePageLayout,
  parsePageRange,
  pageImageName,
  uniqueName,
  detectImageKind,
  mimeForImageOutput,
  exifOrientation,
  withOrientationReset,
  jpegOrientationTransform,
  ImgPdfError,
} from './logic.js';
import { zipStore } from './zip.js';

// Resolve vendored scripts against THIS module, not the document (review F07).
const PDFLIB_URL = assetUrl('../../vendor/pdf-lib/pdf-lib.min.js', import.meta.url);
const PDFJS_URL = assetUrl('../../vendor/pdfjs/pdf.min.js', import.meta.url);
const PDFJS_WORKER_URL = assetUrl('../../vendor/pdfjs/pdf.worker.min.js', import.meta.url);

let libPromise = null;
/** Inject vendor/pdf-lib once, resolving with window.PDFLib. */
function loadPdfLib() {
  if (window.PDFLib) return Promise.resolve(window.PDFLib);
  if (libPromise) return libPromise;
  libPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-pdflib]');
    const script = existing || document.createElement('script');
    script.src = PDFLIB_URL;
    script.async = true;
    script.dataset.pdflib = '1';
    script.addEventListener('load', () => {
      if (window.PDFLib) resolve(window.PDFLib);
      else { libPromise = null; reject(new Error('pdf-lib loaded but did not expose window.PDFLib')); }
    });
    script.addEventListener('error', () => {
      libPromise = null;
      reject(new Error('Could not load the bundled pdf-lib library.'));
    });
    if (!existing) document.head.appendChild(script);
  });
  return libPromise;
}

let pdfjsPromise = null;
/** Load the vendored pdf.js ES module once (worker is same-origin). */
function loadPdfjs() {
  if (pdfjsPromise) return pdfjsPromise;
  pdfjsPromise = import(/* @vite-ignore */ PDFJS_URL).then((mod) => {
    const GlobalWorkerOptions = mod.GlobalWorkerOptions || (mod.default && mod.default.GlobalWorkerOptions);
    if (GlobalWorkerOptions) GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
    return mod;
  }).catch((err) => { pdfjsPromise = null; throw err; });
  return pdfjsPromise;
}

const MODES = [
  { id: 'toPdf', label: 'Images to PDF', help: 'Add JPG, PNG or WebP images, reorder them, and build one PDF.' },
  { id: 'toImages', label: 'PDF to images', help: 'Render the pages of a PDF as PNG or JPEG; download one by one or all as a ZIP.' },
];

const PAGE_SIZE_OPTIONS = [
  { id: 'fit', label: 'Fit to image' },
  { id: 'a4', label: 'A4' },
  { id: 'letter', label: 'Letter' },
];

const ORIENTATION_OPTIONS = [
  { id: 'auto', label: 'Auto' },
  { id: 'portrait', label: 'Portrait' },
  { id: 'landscape', label: 'Landscape' },
];

const MARGIN_OPTIONS = [
  { id: '0', label: 'None' },
  { id: '18', label: 'Small (18 pt)' },
  { id: '36', label: 'Medium (36 pt)' },
  { id: '72', label: 'Large (72 pt)' },
];

const SCALE_OPTIONS = [
  { id: '1', label: '1x' },
  { id: '2', label: '2x' },
  { id: '3', label: '3x' },
];

/** Human byte size, matching the shell's formatBytes. */
function humanBytes(n) { return formatBytes(n); }

export function mount(root) {
  const state = {
    mode: 'toPdf',
    busy: false,
    // Images -> PDF
    images: [],       // { id, name, bytes, kind, width, height, encoded: {bytes,format}, url }
    // PDF -> images
    pdf: null,        // { name, bytes, doc, pageCount }
    outputs: [],      // { name, bytes, url }
    outputZip: null,  // { name, bytes }
  };

  let imageSeq = 0;
  let destroyed = false;
  // Object URLs backing the <img> thumbnails, revoked when the list re-renders
  // or the tool unmounts so nothing is orphaned on navigation (review F09).
  const thumbUrls = new Set();

  /* ---- structure ---- */
  const wrap = el('div', 'stack imgpdf-tool');

  const modeRow = el('div', 'tabs');
  modeRow.setAttribute('role', 'tablist');
  modeRow.setAttribute('aria-label', 'Direction');
  const modeHelp = el('p', 'field-hint');
  const modeTabs = new Map();
  for (const m of MODES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tab';
    b.setAttribute('role', 'tab');
    b.dataset.mode = m.id;
    b.textContent = m.label;
    b.addEventListener('click', () => setMode(m.id));
    modeTabs.set(m.id, b);
    modeRow.append(b);
  }
  const tabHead = el('div', 'stack-sm');
  tabHead.append(modeRow, modeHelp);

  const dz = createDropzone({
    multiple: true,
    accept: 'image/png,image/jpeg,image/webp,image/gif,image/bmp,.png,.jpg,.jpeg,.webp,.gif,.bmp',
    title: 'Drop images here',
    note: 'JPG, PNG, WebP, GIF or BMP \u00B7 up to 100 MB each',
    ariaLabel: 'Choose image files or drop them here',
    onFiles: (files) => handleDrop(files),
  });

  const options = el('div', 'panel');
  const optionsTitle = el('h2', 'panel-title');
  optionsTitle.textContent = 'Options';
  const optionsBody = el('div', 'field-grid');

  // Images list (reorderable).
  const imageList = el('ul', 'imgpdf-list');
  imageList.setAttribute('aria-label', 'Added images, in page order');

  // PDF preview/grid host.
  const pageGrid = el('div', 'imgpdf-grid');
  pageGrid.setAttribute('role', 'list');
  pageGrid.setAttribute('aria-label', 'Pages to export');
  const pageInfo = el('p', 'field-hint');

  const actions = el('div', 'status-row row');
  const primary = createDownloadButton({ label: 'Download PDF' });
  primary.el.addEventListener('click', onPrimary);
  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'btn btn-text';
  clearBtn.textContent = 'Clear';
  clearBtn.addEventListener('click', clearAll);
  actions.append(primary.el, clearBtn);

  const status = el('p', 'status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  actions.append(status);

  const errors = el('div', 'imgpdf-errors');
  errors.hidden = true;

  const results = el('div', 'results');
  results.setAttribute('aria-live', 'polite');

  const progress = el('div', 'imgpdf-progress');
  progress.hidden = true;
  const progressBar = el('div', 'imgpdf-progress-bar');
  progress.append(progressBar);

  options.append(optionsTitle, optionsBody);
  wrap.append(tabHead, dz.el, errors, imageList, pageGrid, pageInfo, options, progress, actions, results);
  root.append(wrap);

  /* ---- option controls (created once, re-parented per mode) ---- */
  const pageSizeSel = select('imgpdf-page-size', PAGE_SIZE_OPTIONS);
  const orientationSel = select('imgpdf-orientation', ORIENTATION_OPTIONS);
  const marginSel = select('imgpdf-margin', MARGIN_OPTIONS);
  const jpegQualityWrap = rangeField('imgpdf-jpg-quality', 0, 100, 90);

  const outFormatSel = select('imgpdf-out-format', [
    { id: 'png', label: 'PNG' },
    { id: 'jpeg', label: 'JPEG' },
  ]);
  const scaleSel = select('imgpdf-scale', SCALE_OPTIONS);
  const rangeInput = document.createElement('input');
  rangeInput.type = 'text';
  rangeInput.id = 'imgpdf-range';
  rangeInput.className = 'field-input';
  rangeInput.placeholder = 'All pages, or e.g. 1-3,5';
  rangeInput.autocomplete = 'off';
  const zipCheck = checkbox('imgpdf-zip', 'Also build a ZIP of all pages', true);

  for (const control of [pageSizeSel, orientationSel, marginSel, outFormatSel, scaleSel, rangeInput]) {
    control.addEventListener('change', () => invalidateOutputs());
    control.addEventListener('input', () => invalidateOutputs());
  }
  jpegQualityWrap.input.addEventListener('input', () => invalidateOutputs());
  zipCheck.input.addEventListener('change', () => { invalidateOutputs(); renderOptions(); });

  for (const btn of modeTabs.values()) {
    btn.addEventListener('keydown', (e) => onTabKey(e, btn));
  }

  /* ---- helpers ---- */
  function el(tag, cls) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }

  function select(id, opts) {
    const s = document.createElement('select');
    s.id = id;
    s.className = 'field-select';
    for (const o of opts) {
      const opt = document.createElement('option');
      opt.value = o.id;
      opt.textContent = o.label;
      s.append(opt);
    }
    return s;
  }

  function rangeField(id, min, max, value) {
    const input = document.createElement('input');
    input.type = 'range';
    input.id = id;
    input.min = String(min);
    input.max = String(max);
    input.value = String(value);
    const out = el('span', 'field-hint');
    const sync = () => { out.textContent = `${input.value}%`; };
    input.addEventListener('input', sync);
    sync();
    return { input, out };
  }

  function checkbox(id, labelText, checked) {
    const lab = el('label', 'check-row');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = id;
    input.checked = Boolean(checked);
    const span = document.createElement('span');
    span.textContent = labelText;
    lab.append(input, span);
    return { el: lab, input };
  }

  function field(labelText, control, extra) {
    const label = el('label', 'field');
    const span = el('span', 'field-label');
    span.textContent = labelText;
    label.append(span, control);
    if (extra) label.append(extra);
    return label;
  }

  function setStatus(text, kind) {
    status.textContent = text || '';
    status.className = 'status' + (kind ? ` is-${kind}` : '');
  }

  function setProgress(fraction) {
    if (fraction == null) { progress.hidden = true; progressBar.style.width = '0%'; return; }
    progress.hidden = false;
    progressBar.style.width = `${Math.max(0, Math.min(1, fraction)) * 100}%`;
    progress.setAttribute('aria-hidden', 'true');
  }

  function showError(title, detail) {
    errors.hidden = false;
    const block = el('div', 'block block-error');
    block.setAttribute('role', 'alert');
    const lead = el('span', 'block-lead');
    lead.textContent = title;
    const text = el('span', 'block-detail');
    text.textContent = detail ? ` ${detail}` : '';
    block.append(lead, text);
    errors.append(block);
  }

  function clearErrors() { errors.replaceChildren(); errors.hidden = true; }

  /* ---- modes ---- */
  function setMode(id) {
    if (state.busy || state.mode === id) return;
    state.mode = id;
    invalidateOutputs();
    clearErrors();
    for (const [key, btn] of modeTabs) {
      const on = key === id;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
      btn.tabIndex = on ? 0 : -1;
    }
    const info = MODES.find((m) => m.id === id);
    modeHelp.textContent = info ? info.help : '';
    // Re-point the dropzone at the right input type.
    dz.setMeta(id === 'toPdf' ? 'JPG, PNG, WebP, GIF or BMP \u00B7 up to 100 MB each' : 'PDF files \u00B7 up to 100 MB each');
    dz.setEmptyTitle(id === 'toPdf' ? 'Drop images here' : 'Drop a PDF here');
    renderAll();
  }

  function onTabKey(e, btn) {
    const ids = MODES.map((m) => m.id);
    const i = ids.indexOf(btn.dataset.mode);
    let next = null;
    if (e.key === 'ArrowRight') next = ids[(i + 1) % ids.length];
    else if (e.key === 'ArrowLeft') next = ids[(i - 1 + ids.length) % ids.length];
    if (!next) return;
    e.preventDefault();
    setMode(next);
    const target = modeTabs.get(next);
    if (target) target.focus();
  }

  /* ---- image ingestion (Images -> PDF) ---- */
  async function handleDrop(files) {
    if (state.mode === 'toImages') { await addPdf(files); return; }
    await addImages(files);
  }

  async function addImages(files) {
    const list = Array.from(files || []);
    if (!list.length) return;
    clearErrors();
    dz.setEmptyTitle('Drop images here');
    for (const file of list) {
      if (destroyed) return;
      const name = file.name || 'image';
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (destroyed) return;
        const kind = detectImageKind(bytes);
        if (!kind) {
          showError('Couldn\u2019t read this file.', `${name} is not a JPEG, PNG or WebP image.`);
          continue;
        }
        // Decode to learn the pixel size (and to re-encode non-embed formats or
        // to redraw a JPEG that carries a non-default EXIF orientation).
        const decoded = await decodeImage(bytes, kind, name);
        if (destroyed) return;
        imageSeq += 1;
        state.images.push({
          id: `img${imageSeq}`,
          name,
          bytes,
          kind,
          embeddedFormat: decoded.format, // 'jpeg' | 'png' — what img.blob actually is
          width: decoded.width,
          height: decoded.height,
          blob: decoded.blob, // a Blob ready for pdf-lib's embedJpg/embedPng
          orient: kind === 'jpeg' ? exifOrientation(bytes) : 1,
        });
      } catch (err) {
        if (destroyed) return;
        showError('Couldn\u2019t read this image.', `${name}: ${friendly(err)}`);
      }
    }
    if (destroyed) return;
    invalidateOutputs();
    renderAll();
  }

  /**
   * Decode an image to learn its pixel size. JPEG/PNG are decoded as-is (their
   * bytes embed directly, but we still need the dimensions); WebP/other decode
   * through the canvas. A JPEG with a non-default EXIF orientation is redrawn
   * upright on a canvas so the embedded pixels are correct.
   *
   * B1 fix: this Chrome ignores `imageOrientation: 'none'` for JPEG EXIF and
   * always returns the EXIF-transformed bitmap, so decoding the original bytes
   * made the browser apply the orientation once and our own
   * `jpegOrientationTransform` apply it again (an orientation-6 JPEG came out
   * 400x200 instead of 200x400). We therefore decode a COPY whose EXIF
   * Orientation tag has been rewritten to 1 (`withOrientationReset`), which
   * makes the browser yield the RAW stored pixels deterministically; our own
   * transform, read from the ORIGINAL bytes, is then applied exactly once.
   */
  async function decodeImage(bytes, kind, name) {
    const makeBitmap = window.createImageBitmap;
    if (typeof makeBitmap !== 'function') {
      throw new ImgPdfError('decode', 'this browser cannot decode images (no createImageBitmap).');
    }
    const mime = kind === 'jpeg' ? 'image/jpeg' : kind === 'png' ? 'image/png' : 'image/webp';
    const orientation = kind === 'jpeg' ? exifOrientation(bytes) : 1;
    // Decode a copy with the EXIF orientation neutralised so the browser yields
    // the raw stored pixels regardless of how it treats 'none'.
    const decodeBytes = kind === 'jpeg' ? withOrientationReset(bytes) : bytes;
    const bitmap = await makeBitmap(new Blob([decodeBytes], { type: mime }), { imageOrientation: 'none' });
    const srcW = bitmap.width;
    const srcH = bitmap.height;
    const transform = jpegOrientationTransform(orientation);
    const needsRedraw = kind !== 'jpeg' || transform.swap || transform.rotate !== 0 || transform.flipX || transform.flipY;

    if (kind === 'jpeg' && !needsRedraw) {
      bitmap.close && bitmap.close();
      return { width: srcW, height: srcH, format: 'jpeg', blob: new Blob([bytes], { type: 'image/jpeg' }) };
    }
    if (kind === 'png') {
      bitmap.close && bitmap.close();
      return { width: srcW, height: srcH, format: 'png', blob: new Blob([bytes], { type: 'image/png' }) };
    }

    // Draw upright: swap axes for orientations 5-8, rotate, then mirror.
    const outW = transform.swap ? srcH : srcW;
    const outH = transform.swap ? srcW : srcH;
    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) { bitmap.close && bitmap.close(); throw new ImgPdfError('canvas', 'could not get a 2D canvas context.'); }
    ctx.save();
    ctx.translate(outW / 2, outH / 2);
    if (transform.rotate) ctx.rotate((transform.rotate * Math.PI) / 180);
    if (transform.flipX) ctx.scale(-1, 1);
    if (transform.flipY) ctx.scale(1, -1);
    ctx.drawImage(bitmap, -srcW / 2, -srcH / 2, srcW, srcH);
    ctx.restore();
    bitmap.close && bitmap.close();

    const blob = await canvasToBlob(canvas, 'image/png');
    return { width: outW, height: outH, format: 'png', blob };
  }

  function canvasToBlob(canvas, mime, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new ImgPdfError('encode', `could not encode to ${mime}.`))),
        mime,
        quality,
      );
    });
  }

  /* ---- PDF ingestion (PDF -> images) ---- */
  async function addPdf(files) {
    const file = Array.from(files || []).find(Boolean);
    if (!file) return;
    if (destroyed) return;
    clearErrors();
    dz.setEmptyTitle('Drop a PDF here');
    const isPdf = /\.pdf$/i.test(file.name || '') || file.type === 'application/pdf';
    if (!isPdf) { showError('Couldn\u2019t read this file.', `${file.name} is not a PDF file. Add a file ending in .pdf.`); return; }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (destroyed) return;
      await loadPdfjs();
      if (destroyed) return;
      const doc = await pdfjsGetDocument(bytes);
      if (destroyed) { doc.destroy && doc.destroy(); return; }
      destroyPdfDoc();
      state.pdf = { name: file.name, bytes, doc, pageCount: doc.numPages };
    } catch (err) {
      if (destroyed) return;
      showError('Couldn\u2019t read this PDF.', pdfReason(err, file.name));
      return;
    }
    if (destroyed) return;
    invalidateOutputs();
    renderAll();
  }

  /** Give pdf.js its own copy: it TRANSFERS (detaches) the buffer it is given. */
  function pdfjsGetDocument(bytes) {
    const owned = bytes.slice();
    return loadPdfjs().then((pdfjs) => pdfjs.getDocument({
      data: owned,
      disableAutoFetch: true,
      disableStream: true,
      verbosity: 0,
    }).promise);
  }

  function destroyPdfDoc() {
    const doc = state.pdf && state.pdf.doc;
    state.pdf = null;
    if (doc && typeof doc.destroy === 'function') { try { doc.destroy(); } catch { /* ignore */ } }
  }

  function pdfReason(err, filename) {
    const who = filename ? `"${filename}"` : 'that file';
    const raw = String((err && err.message) || err || '');
    if (/password|encrypt/i.test(raw)) return `${who} is password-protected or encrypted and cannot be read.`;
    if (/invalid pdf|no pdf header|failed to parse|(trailer|startxref|xref)|format/i.test(raw)) {
      return `${who} is not a valid or is a damaged PDF.`;
    }
    return `${who} could not be read${raw ? `: ${raw}` : '.'}`;
  }

  /* ---- rendering ---- */
  function renderAll() {
    renderTabs();
    renderOptions();
    renderImages();
    renderPages();
    renderActions();
  }

  function renderTabs() {
    for (const [key, btn] of modeTabs) {
      const on = key === state.mode;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
      btn.tabIndex = on ? 0 : -1;
    }
    const info = MODES.find((m) => m.id === state.mode);
    modeHelp.textContent = info ? info.help : '';
  }

  function renderOptions() {
    optionsBody.replaceChildren();
    if (state.mode === 'toPdf') {
      if (state.images.length === 0) { options.hidden = true; return; }
      optionsBody.append(
        field('Page size', pageSizeSel),
        field('Orientation', orientationSel),
        field('Margin', marginSel),
      );
      options.hidden = false;
      return;
    }
    if (!state.pdf) { options.hidden = true; return; }
    optionsBody.append(
      field('Format', outFormatSel),
      field('Scale', scaleSel),
      field('Pages', rangeInput),
    );
    if (outFormatSel.value === 'jpeg') {
      optionsBody.append(field('JPEG quality', jpegQualityWrap.input, jpegQualityWrap.out));
    }
    optionsBody.append(zipCheck.el);
    options.hidden = false;
  }

  function renderImages() {
    revokeThumbUrls();
    imageList.replaceChildren();
    if (state.mode !== 'toPdf' || state.images.length === 0) { imageList.hidden = true; return; }
    imageList.hidden = false;
    state.images.forEach((img, i) => {
      const li = el('li', 'imgpdf-item');
      li.dataset.id = img.id;
      li.draggable = true;
      li.tabIndex = 0;
      li.setAttribute('role', 'listitem');
      li.setAttribute('aria-label', `Page ${i + 1}: ${img.name}, ${img.width}\u00D7${img.height}`);

      const handle = el('span', 'imgpdf-handle');
      handle.append(glyph(GLYPHS.dragHandle));
      handle.setAttribute('aria-hidden', 'true');

      const thumb = el('img', 'imgpdf-thumb');
      thumb.alt = '';
      thumb.loading = 'lazy';
      const url = URL.createObjectURL(img.blob);
      thumbUrls.add(url);
      thumb.src = url;
      thumb.addEventListener('load', () => releaseThumbUrl(url), { once: true });
      thumb.addEventListener('error', () => releaseThumbUrl(url), { once: true });

      const name = el('span', 'imgpdf-name');
      name.textContent = img.name;
      const meta = el('span', 'field-hint');
      meta.textContent = `${img.width}\u00D7${img.height} \u00B7 ${humanBytes(img.bytes.length)}${img.orient !== 1 ? ` \u00B7 EXIF ${img.orient}` : ''}`;

      const text = el('span', 'imgpdf-item-text');
      text.append(name, meta);

      const up = iconButton('arrowUp', `Move ${img.name} earlier`, () => moveImage(img.id, -1));
      const down = iconButton('arrowDown', `Move ${img.name} later`, () => moveImage(img.id, 1));
      const rm = iconButton('trash', `Remove ${img.name}`, () => removeImage(img.id));
      up.disabled = i === 0;
      down.disabled = i === state.images.length - 1;

      li.append(handle, thumb, text, up, down, rm);
      wireImageItem(li, img);
      imageList.append(li);
    });
  }

  function releaseThumbUrl(url) {
    if (thumbUrls.has(url)) { URL.revokeObjectURL(url); thumbUrls.delete(url); }
  }

  function revokeThumbUrls() {
    for (const url of thumbUrls) URL.revokeObjectURL(url);
    thumbUrls.clear();
  }

  function wireImageItem(li, img) {
    li.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp' && (e.altKey || e.ctrlKey || e.metaKey)) { e.preventDefault(); moveImage(img.id, -1); }
      else if (e.key === 'ArrowDown' && (e.altKey || e.ctrlKey || e.metaKey)) { e.preventDefault(); moveImage(img.id, 1); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeImage(img.id); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); moveImage(img.id, -1); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); moveImage(img.id, 1); }
    });
    li.addEventListener('dragstart', (e) => {
      li.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', img.id); } catch { /* ignore */ }
    });
    li.addEventListener('dragend', () => { li.classList.remove('is-dragging'); clearDropMarks(); });
    li.addEventListener('dragover', (e) => {
      if (!imageList.querySelector('.is-dragging')) return;
      e.preventDefault();
      const rect = li.getBoundingClientRect();
      const after = e.clientY - rect.top > rect.height / 2;
      clearDropMarks();
      li.classList.add(after ? 'drop-after' : 'drop-before');
    });
    li.addEventListener('drop', (e) => {
      e.preventDefault();
      const dragging = imageList.querySelector('.is-dragging');
      clearDropMarks();
      if (!dragging) return;
      const fromId = dragging.dataset.id;
      const rect = li.getBoundingClientRect();
      const after = e.clientY - rect.top > rect.height / 2;
      moveImageTo(fromId, img.id, after);
    });
  }

  function clearDropMarks() {
    for (const n of imageList.querySelectorAll('.drop-before, .drop-after')) {
      n.classList.remove('drop-before', 'drop-after');
    }
  }

  function moveImage(id, dir) {
    const i = state.images.findIndex((x) => x.id === id);
    if (i === -1) return;
    const j = i + dir;
    if (j < 0 || j >= state.images.length) return;
    const [item] = state.images.splice(i, 1);
    state.images.splice(j, 0, item);
    invalidateOutputs();
    renderAll();
    focusImage(id);
  }

  function moveImageTo(fromId, toId, after) {
    if (fromId === toId) return;
    const i = state.images.findIndex((x) => x.id === fromId);
    if (i === -1) return;
    const [item] = state.images.splice(i, 1);
    let j = state.images.findIndex((x) => x.id === toId);
    if (j === -1) j = state.images.length - 1;
    state.images.splice(after ? j + 1 : j, 0, item);
    invalidateOutputs();
    renderAll();
    focusImage(fromId);
  }

  function focusImage(id) {
    const node = imageList.querySelector(`.imgpdf-item[data-id="${cssEscape(id)}"]`);
    if (node) node.focus();
  }

  function removeImage(id) {
    const i = state.images.findIndex((x) => x.id === id);
    if (i === -1) return;
    state.images.splice(i, 1);
    invalidateOutputs();
    renderAll();
  }

  function renderPages() {
    pageGrid.replaceChildren();
    if (state.mode !== 'toImages' || !state.pdf) { pageGrid.hidden = true; pageInfo.hidden = true; return; }
    pageGrid.hidden = false;
    pageInfo.hidden = false;
    const total = state.pdf.pageCount;
    pageInfo.textContent = `${total} page${total === 1 ? '' : 's'} in ${state.pdf.name}.`;
    // Lightweight page chips (number only); the real rendering happens on demand.
    for (let p = 0; p < total; p += 1) {
      const chip = el('span', 'imgpdf-chip');
      chip.textContent = String(p + 1);
      pageGrid.append(chip);
    }
  }

  function renderActions() {
    const hasWork = state.mode === 'toPdf' ? state.images.length > 0 : Boolean(state.pdf);
    primary.setEnabled(!state.busy && hasWork);
    let label;
    if (state.busy) label = 'Working\u2026';
    else if (state.mode === 'toPdf') label = 'Download PDF';
    else label = state.outputs.length > 0 ? 'Download images' : 'Export images';
    primary.setLabel(label);
    clearBtn.disabled = state.busy;
  }

  function invalidateOutputs() {
    for (const out of state.outputs) if (out.url) URL.revokeObjectURL(out.url);
    state.outputs = [];
    state.outputZip = null;
    renderResults();
    renderActions();
  }

  function clearAll() {
    if (state.busy) return;
    state.images = [];
    destroyPdfDoc();
    invalidateOutputs();
    clearErrors();
    setStatus('');
    setProgress(null);
    renderAll();
  }

  /* ---- primary action ---- */
  async function onPrimary() {
    if (state.busy) return;
    if (state.mode === 'toPdf') { await buildPdf(); return; }
    // PDF -> images: the first press renders the pages and lists the downloads;
    // once results exist the primary offers the whole set as one archive/ZIP.
    if (state.outputs.length === 0) { await exportImages(); return; }
    downloadAllOutputs();
  }

  /** Download every rendered page, then the ZIP when one was built. */
  function downloadAllOutputs() {
    for (const out of state.outputs) {
      downloadBlob(new Blob([out.bytes], { type: out.name.endsWith('.png') ? 'image/png' : 'image/jpeg' }), out.name);
    }
    if (state.outputZip) {
      downloadBlob(new Blob([state.outputZip.bytes], { type: 'application/zip' }), state.outputZip.name);
    }
  }

  /* ---- Images -> PDF ---- */
  async function buildPdf() {
    if (state.images.length === 0) return;
    state.busy = true;
    renderActions();
    renderResults();
    setProgress(0);
    setStatus('Working\u2026');
    clearErrors();
    try {
      const lib = await loadPdfLib();
      if (destroyed) return;
      const { PDFDocument } = lib;
      const doc = await PDFDocument.create();
      const pageSize = pageSizeSel.value;
      const orientation = orientationSel.value;
      const margin = Number(marginSel.value) || 0;

      for (let i = 0; i < state.images.length; i += 1) {
        if (destroyed) return;
        const img = state.images[i];
        // img.blob is already the right bytes to embed: the original JPEG/PNG
        // file, or a fresh PNG for WebP and for EXIF-oriented JPEGs.
        const bytes = new Uint8Array(await img.blob.arrayBuffer());
        if (destroyed) return;
        const embedded = img.embeddedFormat === 'jpeg'
          ? await doc.embedJpg(bytes)
          : await doc.embedPng(bytes);
        const layout = computePageLayout(embedded.width, embedded.height, { pageSize, margin, orientation });
        const page = doc.addPage([layout.pageWidth, layout.pageHeight]);
        page.drawImage(embedded, {
          x: layout.x,
          y: layout.y,
          width: layout.imageWidth,
          height: layout.imageHeight,
        });
        setProgress((i + 1) / state.images.length);
        setStatus(`Working\u2026 ${i + 1} of ${state.images.length} images`);
      }

      const out = await doc.save();
      if (destroyed) return;
      const name = pdfName(state.images[0].name, state.images.length);
      const blob = new Blob([out], { type: 'application/pdf' });
      downloadBlob(blob, name);
      setStatus(`Done \u2014 ${state.images.length} page${state.images.length === 1 ? '' : 's'} \u00B7 ${humanBytes(out.length)}.`, 'ok');
    } catch (err) {
      if (destroyed) return;
      showError('Couldn\u2019t build the PDF.', friendly(err));
      setStatus('Couldn\u2019t build the PDF.', 'bad');
    } finally {
      state.busy = false;
      setProgress(null);
      renderActions();
    }
  }

  function pdfName(firstName, count) {
    const base = String(firstName || 'images').replace(/\.[^.]+$/, '') || 'images';
    return count === 1 ? `${base}.pdf` : 'images.pdf';
  }

  /* ---- PDF -> images ---- */
  async function exportImages() {
    if (!state.pdf) return;
    state.busy = true;
    renderActions();
    renderResults();
    setProgress(0);
    clearErrors();
    let indices;
    try {
      indices = parsePageRange(rangeInput.value, state.pdf.pageCount);
    } catch (err) {
      state.busy = false;
      renderActions();
      showError('Couldn\u2019t export these pages.', friendly(err));
      setStatus('Check the page range.', 'bad');
      return;
    }

    const format = outFormatSel.value === 'jpeg' ? 'jpeg' : 'png';
    const scale = Number(scaleSel.value) || 1;
    const quality = Number(jpegQualityWrap.input.value) / 100;
    try {
      if (!state.pdf || !state.pdf.doc) throw new ImgPdfError('pdf', 'no PDF is loaded.');
      setStatus(`Working\u2026 0 of ${indices.length} pages`);
      const outputs = [];
      const used = new Set();
      for (let k = 0; k < indices.length; k += 1) {
        if (destroyed) return;
        const page = await state.pdf.doc.getPage(indices[k] + 1);
        if (destroyed) return;
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(viewport.width));
        canvas.height = Math.max(1, Math.round(viewport.height));
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new ImgPdfError('canvas', 'could not get a 2D canvas context.');
        await page.render({ canvasContext: ctx, viewport }).promise;
        if (destroyed) return;
        const mime = mimeForImageOutput(format);
        const blob = await canvasToBlob(canvas, mime, format === 'jpeg' ? quality : undefined);
        // Free the canvas backing store as soon as the bytes exist.
        canvas.width = 0; canvas.height = 0;
        if (destroyed) return;
        const bytes = new Uint8Array(await blob.arrayBuffer());
        if (destroyed) return;
        const rawName = pageImageName(state.pdf.name, indices[k] + 1, indices.length, format);
        const name = uniqueName(rawName, used);
        const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
        outputs.push({ name, bytes, url });
        setProgress((k + 1) / indices.length);
        setStatus(`Working\u2026 ${k + 1} of ${indices.length} pages`);
      }
      if (destroyed) { for (const o of outputs) URL.revokeObjectURL(o.url); return; }
      for (const o of state.outputs) if (o.url) URL.revokeObjectURL(o.url);
      state.outputs = outputs;
      if (zipCheck.input.checked) {
        const zipEntries = outputs.map((o) => ({ name: o.name, bytes: o.bytes }));
        const zipBytes = zipStore(zipEntries);
        state.outputZip = { name: `${safeBaseName(state.pdf.name)}-images.zip`, bytes: zipBytes };
      } else {
        state.outputZip = null;
      }
      renderResults();
      const totalBytes = outputs.reduce((n, o) => n + o.bytes.length, 0);
      setStatus(`Done \u2014 ${outputs.length} page${outputs.length === 1 ? '' : 's'} \u00B7 ${humanBytes(totalBytes)}${
        state.outputZip ? ` \u00B7 ZIP ${humanBytes(state.outputZip.bytes.length)}` : ''}.`, 'ok');
    } catch (err) {
      if (destroyed) return;
      showError('Couldn\u2019t render this PDF.', friendly(err));
      setStatus('Couldn\u2019t render this PDF.', 'bad');
    } finally {
      state.busy = false;
      setProgress(null);
      renderActions();
    }
  }

  function safeBaseName(name) {
    return String(name || 'document').replace(/\.[^.]+$/, '').replace(/[\\/]+/g, '-') || 'document';
  }

  /* ---- results ---- */
  function renderResults() {
    results.replaceChildren();
    if (state.mode !== 'toImages' || !state.outputs.length) return;

    if (state.outputZip) {
      const zipRow = el('div', 'result');
      const label = el('span', 'result-name');
      label.textContent = `${state.outputZip.name} \u00B7 ${humanBytes(state.outputZip.bytes.length)}`;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-secondary';
      btn.textContent = 'Download ZIP';
      btn.addEventListener('click', () => downloadBlob(
        new Blob([state.outputZip.bytes], { type: 'application/zip' }), state.outputZip.name));
      zipRow.append(label, btn);
      results.append(zipRow);
    }

    for (const out of state.outputs) {
      const row = el('div', 'result');
      const label = el('span', 'result-name');
      label.textContent = `${out.name} \u00B7 ${humanBytes(out.bytes.length)}`;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-secondary';
      btn.textContent = 'Download';
      btn.addEventListener('click', () => downloadBlob(
        new Blob([out.bytes], { type: out.name.endsWith('.png') ? 'image/png' : 'image/jpeg' }), out.name));
      row.append(label, btn);
      results.append(row);
    }
  }

  /* ---- misc ---- */
  function friendly(err) {
    if (err instanceof ImgPdfError) return err.message;
    return String((err && err.message) || err || 'unknown error');
  }

  function cssEscape(s) {
    return String(s).replace(/["\\]/g, '\\$&');
  }

  /* ---- init ---- */
  setMode('toPdf');
  renderAll();
  loadPdfLib().catch(() => { /* pdf-lib is only needed once an image is added */ });

  // Lifecycle (review F09): release everything this tool owns outside the mount
  // subtree — the pdf.js document proxy, rendered-page object URLs and any
  // queued work — when the shell leaves the tool.
  return function unmount() {
    destroyed = true;
    destroyPdfDoc();
    for (const out of state.outputs) if (out.url) URL.revokeObjectURL(out.url);
    state.outputs = [];
    state.outputZip = null;
    state.images = [];
    revokeThumbUrls();
  };
}