// Image Resize / Convert / Compress / Strip metadata — UI layer.
//
// Loaded lazily by the shell (see assets/tools.js -> load()). This module owns
// the DOM only; the pure byte-level and arithmetic helpers live in ./image.js.
//
// Two operating modes, mirroring the task design:
//   * "Edit" (resize / convert / compress) decodes with createImageBitmap,
//     draws to a canvas at the computed target size and re-encodes with
//     canvas.toBlob(). Re-encoding through a canvas inherently drops all
//     metadata (EXIF/GPS/ICC), which the UI calls out.
//   * "Strip metadata" is lossless and never touches the canvas: it runs the
//     pure stripJpegMetadata / stripPngMetadata helpers on the raw bytes, so
//     the compressed image data — and therefore every pixel — is preserved
//     while EXIF/GPS/IPTC/text chunks are removed.
//
// No network, no libraries, no CDN — only browser built-ins.

import { createDropzone, createDownloadButton, downloadBlob, formatBytes, iconButton } from '../../assets/ui.js';
import {
  detectImageType,
  stripJpegMetadata,
  stripPngMetadata,
  computeTargetSize,
  mimeForFormat,
  sourceMimeForType,
  readJpegExifSummary,
  createGeneration,
  ImageError,
} from './image.js';

const MODES = [
  { id: 'edit', label: 'Resize / Convert', help: 'Resize, change format and compress. Re-encoding through a canvas removes all metadata.' },
  { id: 'strip', label: 'Strip metadata', help: 'Losslessly remove EXIF/GPS/IPTC and text chunks. Pixels and image data are kept exactly.' },
];

const FORMATS = [
  { id: 'jpeg', label: 'JPEG' },
  { id: 'png', label: 'PNG' },
  { id: 'webp', label: 'WebP' },
];

export function mount(root) {
  const state = {
    mode: 'edit',
    files: [],
    results: [],
    busy: false,
  };

  // Monotonic input generation (F13). Bumped whenever the chosen file or the
  // options change, which invalidates any prepared result and any async work
  // still in flight. Async tasks capture the token at start and discard their
  // output when it is no longer current, so stale output is never republished.
  const gen = createGeneration();

  /* ---- structure ---- */
  const wrap = el('div', 'stack image-tool');

  const modeRow = el('div', 'tabs');
  modeRow.setAttribute('role', 'tablist');
  modeRow.setAttribute('aria-label', 'Mode');
  const modeHelp = el('p', 'field-hint');
  const tabs = new Map();
  for (const mode of MODES) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tab';
    b.setAttribute('role', 'tab');
    b.dataset.mode = mode.id;
    b.textContent = mode.label;
    b.addEventListener('click', () => setMode(mode.id));
    tabs.set(mode.id, b);
    modeRow.append(b);
  }
  const tabHead = el('div', 'stack-sm');
  tabHead.append(modeRow, modeHelp);

  const dz = createDropzone({
    multiple: false,
    accept: 'image/png,image/jpeg,image/webp,image/gif,image/bmp',
    title: 'Drop an image here',
    note: 'PNG, JPEG, WebP, GIF or BMP',
    ariaLabel: 'Choose an image file or drop it here',
    onFiles: (files) => addFiles(files),
  });

  const options = el('div', 'panel');
  const optionsTitle = el('h2', 'panel-title');
  optionsTitle.textContent = 'Options';
  const optionsBody = el('div', 'field-grid');

  const fileList = el('ul', 'file-list');
  fileList.setAttribute('aria-label', 'Selected file');

  const actions = el('div', 'status-row row');
  const runBtn = document.createElement('button');
  runBtn.type = 'button';
  runBtn.className = 'btn btn-secondary';
  runBtn.textContent = 'Prepare';
  runBtn.addEventListener('click', run);
  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'btn btn-text';
  clearBtn.textContent = 'Clear';
  clearBtn.addEventListener('click', clearAll);
  const dl = createDownloadButton({ label: 'Download' });
  dl.el.addEventListener('click', downloadFirst);
  actions.append(dl.el, runBtn, clearBtn);

  const status = el('p', 'status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  actions.append(status);

  const preview = el('div', 'image-preview');
  const previewMeta = el('p', 'image-preview-meta field-hint');
  const previewGroup = el('div', 'stack-sm');
  previewGroup.hidden = true;
  previewGroup.append(preview, previewMeta);
  const results = el('div', 'results');
  results.setAttribute('aria-live', 'polite');

  // Editable option inputs, created once and re-parented per mode.
  const widthInput = numberInput('image-width', 'e.g. 1920', 'Target width in pixels');
  const heightInput = numberInput('image-height', 'auto', 'Target height in pixels (blank = keep aspect ratio)');
  const keepAspect = checkbox('image-keep-aspect', 'Keep aspect ratio', true);
  const allowUpscale = checkbox('image-allow-upscale', 'Allow upscaling', false);
  const formatSel = document.createElement('select');
  formatSel.id = 'image-format';
  formatSel.className = 'field-select';
  for (const f of FORMATS) {
    const o = document.createElement('option');
    o.value = f.id; o.textContent = f.label;
    formatSel.append(o);
  }
  const quality = rangeInput('image-quality', 0, 100, 82);

  // F13: changing any encoding option invalidates a prepared result — a stale
  // download must not survive an option change that makes it wrong.
  for (const control of [widthInput, heightInput, formatSel, quality]) {
    control.addEventListener('input', () => invalidateResult());
    control.addEventListener('change', () => invalidateResult());
  }
  for (const cb of [keepAspect, allowUpscale]) {
    cb.input.addEventListener('change', () => invalidateResult());
  }

  options.append(optionsTitle, optionsBody);
  wrap.append(tabHead, dz.el, fileList, options, actions, previewGroup, results);
  root.append(wrap);

  // Dimensions of the loaded source image, captured when the preview decodes.
  let sourceDims = null;

  // Object URL currently backing the preview <img>, if any, so it can be
  // revoked when the input is replaced/cleared (F13: no leaked stale URLs).
  let previewUrl = null;

  /* ---- helpers ---- */
  function el(tag, cls) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }

  function numberInput(id, placeholder, title) {
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'field-input';
    input.id = id;
    input.min = '1';
    input.placeholder = placeholder || '';
    input.autocomplete = 'off';
    input.title = title || '';
    return input;
  }

  function rangeInput(id, min, max, value) {
    const input = document.createElement('input');
    input.type = 'range';
    input.id = id;
    input.min = String(min);
    input.max = String(max);
    input.value = String(value);
    return input;
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

  function setStatus(text, kind) {
    status.textContent = text || '';
    status.className = 'status' + (kind ? ` is-${kind}` : '');
  }

  // F13/R2-04: called on every file add/replace/clear and every option change.
  // Bumps the generation (so in-flight async work is discarded), drops the
  // prepared result, revokes the preview URL, disables Download and clears the
  // summary.
  function invalidateResult() {
    gen.next();
    return dropPreparedResult();
  }

  // The non-generating half of invalidateResult: drops the prepared output,
  // revokes the preview URL and clears the summary. Used directly by the
  // ingestion path, which bumps the generation itself (see addFiles).
  function dropPreparedResult() {
    const stale = state.results;
    state.results = [];
    revokePreviewUrl();
    renderResults([]);
    setStatus('');
    return stale;
  }

  function revokePreviewUrl() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = null;
    }
  }

  function field(labelText, control) {
    const label = el('label', 'field');
    const span = el('span', 'field-label');
    span.textContent = labelText;
    label.append(span, control);
    return label;
  }

  function setMode(id) {
    if (state.busy || state.mode === id) return;
    state.mode = id;
    // A mode switch changes what a prepared result would be: invalidate it.
    invalidateResult();
    for (const [key, btn] of tabs) {
      const on = key === id;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    }
    const info = MODES.find((m) => m.id === id);
    modeHelp.textContent = info ? info.help : '';
    renderOptions();
    renderResults([]);
    setStatus('');
    updateRun();
  }

  function renderOptions() {
    optionsBody.replaceChildren();
    // The Options panel only appears once a file has been added.
    if (state.files.length === 0) {
      options.hidden = true;
      return;
    }
    if (state.mode === 'strip') {
      // Lossless byte mode has no encoding options; explain briefly.
      const note = el('p', 'field-hint field-span');
      note.textContent = 'Lossless: the compressed image data is copied unchanged; only metadata is dropped.';
      optionsBody.append(note);
      options.hidden = false;
      return;
    }
    optionsBody.append(
      field('Width (px)', widthInput),
      field('Height (px)', heightInput),
      keepAspect.el,
      allowUpscale.el,
      field('Format', formatSel),
      field('Quality', quality),
    );
    options.hidden = false;
  }

  /* ---- file handling ---- */
  async function addFiles(files) {
    const f = files[0];
    if (!f) return;
    // R2-04: capture the ingestion generation BEFORE the first await. Adding or
    // replacing the file invalidates any prepared result and any earlier
    // in-flight read; the token is re-checked after EVERY await so a late read
    // can never repopulate a cleared/replaced/unmounted tool.
    const token = gen.next();
    dropPreparedResult();
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      if (!gen.isCurrent(token)) return; // superseded by Clear/replace/unmount
      const type = detectImageType(bytes);
      if (!type) {
        if (gen.isCurrent(token)) setStatus('Couldn\u2019t read this image. Try a PNG or JPEG instead.', 'bad');
        return;
      }
      state.files = [{ name: f.name, size: f.size, bytes, type }];
      if (!gen.isCurrent(token)) return; // discarded before publishing
      setStatus('');
      renderPreview(bytes, type, token);
      if (!gen.isCurrent(token)) return; // preview creation raced an invalidation
    } catch {
      if (gen.isCurrent(token)) setStatus('Couldn\u2019t read this file.', 'bad');
      return;
    }
    renderFiles();
    renderOptions();
    updateRun();
  }

  function renderPreview(bytes, type, token) {
    // Refuse to touch the DOM or create an object URL if this ingestion is no
    // longer current (cleared, replaced or unmounted meanwhile).
    if (token != null && !gen.isCurrent(token)) return;
    preview.replaceChildren();
    revokePreviewUrl();
    previewGroup.hidden = false;
    // Build the preview Blob from the SOURCE mime (GIF/BMP included); fall back
    // to octet-stream when a type slips through, so the img simply fails and is
    // reported rather than throwing and leaving controls inconsistent.
    const blob = new Blob([bytes], { type: sourceMimeForType(type) || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    previewUrl = url;
    const img = document.createElement('img');
    img.className = 'image-thumb';
    img.alt = 'Preview of the selected image';
    img.src = url;
    img.addEventListener('load', () => {
      sourceDims = { w: img.naturalWidth, h: img.naturalHeight };
      if (previewUrl === url) { URL.revokeObjectURL(url); previewUrl = null; }
      updatePreviewMeta();
    }, { once: true });
    img.addEventListener('error', () => {
      if (previewUrl === url) { URL.revokeObjectURL(url); previewUrl = null; }
    }, { once: true });
    preview.append(img);
  }

  /** One line under the preview: original size, then result size + delta. */
  function updatePreviewMeta() {
    const file = state.files[0];
    if (!file) { previewMeta.textContent = ''; return; }
    const parts = [];
    if (sourceDims) {
      parts.push(`Original ${sourceDims.w}\u00D7${sourceDims.h} \u00B7 ${formatBytes(file.size)}`);
    } else {
      parts.push(`Original \u00B7 ${formatBytes(file.size)}`);
    }
    const out = state.results[0];
    if (out && out.after) {
      const pct = out.before && out.before.size
        ? Math.round((1 - out.after.size / out.before.size) * 100)
        : 0;
      const sign = pct > 0 ? `-${pct}%` : (pct < 0 ? `+${Math.abs(pct)}%` : '0%');
      parts.push(`Result ${out.after.w}\u00D7${out.after.h} \u00B7 ${formatBytes(out.after.size)} (${sign})`);
    } else if (out && out.bytes) {
      parts.push(`Result \u00B7 ${formatBytes(out.bytes.length)}`);
    }
    previewMeta.textContent = parts.join('  \u00B7  ');
  }

  function clearAll() {
    invalidateResult();
    state.files = [];
    sourceDims = null;
    renderFiles();
    renderOptions();
    renderResults([]);
    preview.replaceChildren();
    revokePreviewUrl();
    previewMeta.textContent = '';
    previewGroup.hidden = true;
    setStatus('');
    updateRun();
  }

  function renderFiles() {
    fileList.replaceChildren();
    for (const f of state.files) {
      const li = el('li', 'file-row');
      const name = el('span', 'file-name');
      name.textContent = f.name;
      const meta = el('span', 'file-meta');
      meta.textContent = `${formatBytes(f.size)} \u00B7 ${f.type.toUpperCase()}`;
      const rm = iconButton('trash', `Remove ${f.name}`, clearAll);
      li.append(name, meta, rm);
      fileList.append(li);
    }
  }

  /* ---- run ---- */
  function updateRun() {
    runBtn.disabled = state.busy || state.files.length === 0;
    runBtn.textContent = state.busy ? 'Working\u2026' : 'Prepare';
  }

  function ensureSupportedForStrip(file) {
    if (file.type === 'jpeg' || file.type === 'png') return;
    throw new ImageError('unsupported', 'Strip metadata works on JPEG and PNG only. Use Resize / Convert to change formats.');
  }

  async function run() {
    if (state.busy || state.files.length === 0) return;
    // Capture the input generation before any await; if the file or options
    // change while we work, the token goes stale and the result is dropped.
    const token = gen.current();
    state.busy = true;
    updateRun();
    renderResults([]);
    setStatus(state.mode === 'strip' ? 'Stripping metadata\u2026' : 'Working\u2026');

    try {
      const file = state.files[0];
      if (state.mode === 'strip') {
        await runStrip(file, token);
      } else {
        await runEdit(file, token);
      }
    } catch (err) {
      // A superseded run must not clobber the newer status either.
      if (gen.isCurrent(token)) {
        const msg = err instanceof ImageError ? err.message : String((err && err.message) || err);
        setStatus(`Couldn\u2019t process this image. ${msg}`, 'bad');
      }
    } finally {
      state.busy = false;
      updateRun();
    }
  }

  async function runStrip(file, token) {
    ensureSupportedForStrip(file);
    const before = file.bytes.length;
    const gpsBefore = file.type === 'jpeg' ? hasGps(file.bytes) : false;
    const out = file.type === 'jpeg'
      ? stripJpegMetadata(file.bytes)
      : stripPngMetadata(file.bytes);
    const after = out.length;
    const removed = before - after;
    const gpsAfter = file.type === 'jpeg' ? hasGps(out) : false;
    if (!gen.isCurrent(token)) return; // input changed mid-run: discard

    const name = `${stripExt(file.name)}-clean.${file.type === 'jpeg' ? 'jpg' : 'png'}`;
    showResults([{ name, bytes: out, mime: file.type === 'jpeg' ? 'image/jpeg' : 'image/png' }]);

    let msg = removed > 0
      ? `Removed ${formatBytes(removed)} of metadata (lossless). Pixels unchanged.`
      : 'No removable metadata found \u2014 file is already clean.';
    if (gpsBefore && !gpsAfter) msg = `GPS/EXIF metadata was found and removed. ${msg}`;
    setStatus(msg, 'ok');
  }

  function hasGps(bytes) {
    const summary = readJpegExifSummary(bytes);
    return Boolean(summary && summary.hasGps);
  }

  async function runEdit(file, token) {
    if (typeof createImageBitmap !== 'function') {
      throw new ImageError('canvas', 'This browser has no createImageBitmap(); cannot resize or convert.');
    }
    const bitmap = await createImageBitmap(new Blob([file.bytes]));
    // Input/options changed while decoding: discard and release the bitmap.
    if (!gen.isCurrent(token)) { bitmap.close && bitmap.close(); return; }
    const srcW = bitmap.width;
    const srcH = bitmap.height;

    const format = formatSel.value;
    const q = Number(quality.value) / 100;
    let size;
    try {
      size = computeTargetSize(srcW, srcH, {
        width: Number(widthInput.value) || 0,
        height: Number(heightInput.value) || 0,
        keepAspect: keepAspect.input.checked,
        allowUpscale: allowUpscale.input.checked,
      });
    } catch (err) {
      bitmap.close && bitmap.close();
      throw err;
    }

    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) { bitmap.close && bitmap.close(); throw new ImageError('canvas', 'Could not get a 2D canvas context.'); }
    ctx.drawImage(bitmap, 0, 0, size.width, size.height);
    bitmap.close && bitmap.close();

    const mime = mimeForFormat(format);
    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new ImageError('encode', `Could not encode to ${format.toUpperCase()}.`))),
        mime,
        format === 'png' ? undefined : q,
      );
    });

    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (!gen.isCurrent(token)) return; // input changed while encoding: discard
    const ext = format === 'jpeg' ? 'jpg' : format;
    const name = `${stripExt(file.name)}-${size.width}x${size.height}.${ext}`;
    showResults([{
      name,
      bytes,
      mime,
      before: { w: srcW, h: srcH, size: file.bytes.length },
      after: { w: size.width, h: size.height, size: bytes.length },
    }]);

    const dir = file.bytes.length === bytes.length ? 'same size'
      : bytes.length < file.bytes.length ? `${formatBytes(file.bytes.length - bytes.length)} smaller` : 'larger';
    setStatus(`${srcW}\u00D7${srcH} \u2192 ${size.width}\u00D7${size.height} \u00B7 ${dir}.`, 'ok');
  }

  function stripExt(name) {
    return String(name).replace(/\.[^.]+$/, '') || 'image';
  }

  /* ---- results ---- */
  function showResults(outputs) {
    state.results = outputs;
    renderResults(outputs);
  }

  function downloadFirst() {
    const out = state.results[0];
    if (!out) return;
    downloadBlob(new Blob([out.bytes], { type: out.mime }), out.name);
  }

  function renderResults(outputs) {
    results.replaceChildren();
    state.results = outputs;
    const hasResult = outputs.length > 0;
    // Before a result exists the primary shape stays visible but disabled;
    // the only enabled action is the secondary "Prepare".
    dl.setEnabled(hasResult);
    updatePreviewMeta();
    if (!outputs.length) return;

    for (const out of outputs) {
      const row = el('div', 'result');
      const label = el('span', 'result-name');
      const dims = out.after ? ` \u00B7 ${out.after.w}\u00D7${out.after.h}` : '';
      const delta = out.before && out.after
        ? ` (was ${formatBytes(out.before.size)})`
        : '';
      label.textContent = `${out.name} \u00B7 ${formatBytes(out.bytes.length)}${dims}${delta}`;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-secondary';
      btn.textContent = 'Download';
      const blob = new Blob([out.bytes], { type: out.mime });
      btn.addEventListener('click', () => downloadBlob(blob, out.name));
      row.append(label, btn);
      results.append(row);
    }
  }

  /* ---- init ---- */
  setMode('edit');
  // setMode early-returns for the already-current mode, so sync the panel:
  // with no file yet the Options panel must start hidden (no heading over
  // blank space).
  renderOptions();
  renderResults([]);
  updateRun();

  // Lifecycle (review F09): release the preview object URL (and any pending
  // result blobs) when the shell leaves the tool, so nothing is orphaned when
  // the mount subtree is cleared.
  return function unmount() {
    // Bump the generation so any in-flight decode/encode is discarded.
    gen.next();
    revokePreviewUrl();
    state.results = [];
    state.files = [];
  };
}