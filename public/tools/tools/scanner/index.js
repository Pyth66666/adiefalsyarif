// Scanner — UI layer.
//
// Loaded lazily by the shell (see assets/tools.js -> load()). This module owns
// the DOM, the camera and the canvas only; the corner ordering, the projective
// flattening math, the filters and the PDF assembly live in the pure
// ./logic.js and are exercised by `node tests/scanner.test.mjs`.
//
// Flow, entirely in the browser — nothing is uploaded, ever:
//
//   1. Capture  — take a photo with the phone camera (getUserMedia, rear camera
//                 preferred) or, when no camera is available, choose an image
//                 file. Several photos can be captured in a row.
//   2. Adjust   — drag four corner points onto the page's corners; the quad is
//                 flattened to an upright rectangle and one of colour, grayscale
//                 or black-and-white is applied.
//   3. Review   — thumbnails of the scanned pages, reorder and delete.
//   4. Export   — write ONE PDF with the vendored pdf-lib and download it.
//
// No CDN, no network, no AI — only browser built-ins plus the vendored library.

import { createDropzone, createDownloadButton, downloadBlob, formatBytes, iconButton } from '../../assets/ui.js';
import { assetUrl } from '../../assets/assetUrl.js';
import {
  orderCorners,
  flattenQuad,
  applyFilter,
  buildScannedPdf,
  ScannerError,
} from './logic.js';

// Resolve the vendored script against THIS module, not the document.
const PDFLIB_URL = assetUrl('../../vendor/pdf-lib/pdf-lib.min.js', import.meta.url);

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

const FILTER_OPTIONS = [
  { id: 'colour', label: 'Colour' },
  { id: 'grayscale', label: 'Grayscale' },
  { id: 'bw', label: 'Black & white' },
];

/** Thumbnail edge (px) drawn for the review list and preview. */
const THUMB_EDGE = 320;
/** Long-edge cap (px) for a flattened page. */
const SCAN_MAX_EDGE = 2000;

export function mount(root) {
  const state = {
    busy: false,
    // The photo currently being adjusted: { data, width, height, corners[4], filter }
    editing: null,
    // Scanned pages, in order: { png, width, height, url, filter }
    pages: [],
    stream: null,
  };

  let pageSeq = 0;
  let destroyed = false;
  const objectUrls = new Set();

  /* ---- structure ---- */
  const wrap = el('div', 'stack scanner-tool');

  // Capture panel.
  const capturePanel = el('section', 'panel scanner-capture');
  const captureTitle = el('h2', 'panel-title');
  captureTitle.textContent = 'Capture a page';
  const captureHelp = el('p', 'field-hint');
  captureHelp.textContent = 'Take a photo of a page with the camera, or choose a photo from your device. Nothing leaves this device.';
  const video = document.createElement('video');
  video.className = 'scanner-video';
  video.setAttribute('playsinline', '');
  video.muted = true;
  video.hidden = true;
  const captureActions = el('div', 'status-row row');
  const cameraBtn = button('Start camera', 'btn btn-primary', onStartCamera);
  const shootBtn = button('Capture page', 'btn btn-secondary', onCapture);
  shootBtn.disabled = true;
  const stopBtn = button('Stop camera', 'btn btn-text', onStopCamera);
  stopBtn.hidden = true;
  captureActions.append(cameraBtn, shootBtn, stopBtn);

  const dz = createDropzone({
    multiple: false,
    accept: 'image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp',
    title: 'Drop a photo of a page here',
    note: 'Or use the camera above \u00B7 JPG, PNG or WebP',
    ariaLabel: 'Choose a photo of a page or drop one here',
    onFiles: (files) => onChoosePhoto(files),
  });

  capturePanel.append(captureTitle, captureHelp, video, captureActions, dz.el);

  // Edit panel (corners + filter).
  const editPanel = el('section', 'panel scanner-edit');
  const editTitle = el('h2', 'panel-title');
  editTitle.textContent = 'Adjust the page corners';
  const editHelp = el('p', 'field-hint');
  editHelp.textContent = 'Drag each corner point onto a corner of the page, then choose a filter and add the page.';
  // The corner stage shows the ORIGINAL photo with the draggable handles on
  // top, so a handle always sits where the user points; the flattened, filtered
  // result is previewed beside it.
  const editStage = el('div', 'scanner-stage');
  const frame = el('div', 'scanner-frame');
  const editCanvas = document.createElement('canvas');
  editCanvas.className = 'scanner-preview';
  const overlay = el('div', 'scanner-overlay');
  const overlaySvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  overlaySvg.setAttribute('class', 'scanner-quad');
  const quadPath = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  overlaySvg.append(quadPath);
  frame.append(editCanvas, overlay, overlaySvg);
  const handles = [];
  for (let i = 0; i < 4; i += 1) {
    const h = el('button', 'scanner-handle');
    h.type = 'button';
    h.dataset.index = String(i);
    h.setAttribute('aria-label', `Corner ${i + 1}`);
    handles.push(h);
    overlay.append(h);
  }
  // Flattened result preview (updates as the corners or filter change).
  const resultWrap = el('div', 'scanner-result');
  const resultLabel = el('span', 'field-label');
  resultLabel.textContent = 'Result';
  const resultCanvas = document.createElement('canvas');
  resultCanvas.className = 'scanner-result-canvas';
  resultWrap.append(resultLabel, resultCanvas);
  editStage.append(frame, resultWrap);

  const filterSel = select('scanner-filter', FILTER_OPTIONS);
  filterSel.id = 'scanner-filter';
  const editActions = el('div', 'status-row row');
  const addBtn = button('Add this page', 'btn btn-primary', onAddPage);
  const discardBtn = button('Discard photo', 'btn btn-text', onDiscardEdit);
  editActions.append(addBtn, discardBtn);
  const editOptions = el('div', 'row');
  const filterField = el('label', 'field');
  const filterLabel = el('span', 'field-label');
  filterLabel.textContent = 'Filter';
  filterField.append(filterLabel, filterSel);
  editOptions.append(filterField);
  editPanel.append(editTitle, editHelp, editStage, editOptions, editActions);
  editPanel.hidden = true;

  // Review panel.
  const reviewPanel = el('section', 'panel scanner-review');
  const reviewTitle = el('h2', 'panel-title');
  reviewTitle.textContent = 'Review';
  const reviewHelp = el('p', 'field-hint');
  reviewHelp.textContent = 'Reorder or delete pages before exporting.';
  const pageList = el('ul', 'scanner-list');
  pageList.setAttribute('aria-label', 'Scanned pages, in export order');
  reviewPanel.append(reviewTitle, reviewHelp, pageList);
  reviewPanel.hidden = true;

  // Actions bar.
  const actions = el('div', 'status-row row');
  const primary = createDownloadButton({ label: 'Download PDF' });
  primary.el.addEventListener('click', onExport);
  const clearBtn = button('Clear all', 'btn btn-text', clearAll);
  actions.append(primary.el, clearBtn);
  const status = el('p', 'status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  actions.append(status);

  const errors = el('div', 'scanner-errors');
  errors.hidden = true;

  wrap.append(capturePanel, errors, editPanel, reviewPanel, actions);
  root.append(wrap);

  for (const h of handles) h.addEventListener('pointerdown', (e) => onHandleDown(e, h));
  filterSel.addEventListener('change', () => {
    if (state.editing) { state.editing.filter = filterSel.value; renderEditCanvas(); }
  });

  /* ---- helpers ---- */
  function el(tag, cls) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }

  function button(text, cls, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.textContent = text;
    b.addEventListener('click', onClick);
    return b;
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

  function setStatus(text, kind) {
    status.textContent = text || '';
    status.className = 'status' + (kind ? ` is-${kind}` : '');
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

  function friendly(err) {
    if (err instanceof ScannerError) return err.message;
    return String((err && err.message) || err || 'unknown error');
  }

  function trackUrl(url) { objectUrls.add(url); return url; }

  /* ---- camera ---- */
  async function onStartCamera() {
    clearErrors();
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      showError('No camera available.', 'This browser cannot open a camera. Choose a photo instead.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      if (destroyed) { stopStream(stream); return; }
      state.stream = stream;
      video.srcObject = stream;
      video.hidden = false;
      await video.play().catch(() => {});
      cameraBtn.hidden = true;
      stopBtn.hidden = false;
      shootBtn.disabled = false;
      setStatus('Camera on. Line up the page and press Capture page.', 'ok');
    } catch (err) {
      const denied = err && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
      showError('Couldn\u2019t start the camera.',
        denied ? 'Camera access was blocked. Allow it in the browser, or choose a photo instead.'
          : friendly(err));
    }
  }

  function onStopCamera() {
    stopCamera();
    setStatus('Camera off.');
  }

  function stopStream(stream) {
    if (!stream) return;
    for (const track of stream.getTracks()) { try { track.stop(); } catch { /* ignore */ } }
  }

  function stopCamera() {
    stopStream(state.stream);
    state.stream = null;
    video.srcObject = null;
    video.hidden = true;
    cameraBtn.hidden = false;
    stopBtn.hidden = true;
    shootBtn.disabled = true;
  }

  function onCapture() {
    if (!state.stream || !video.videoWidth) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) { showError('Couldn\u2019t capture.', 'No 2D canvas context is available.'); return; }
    ctx.drawImage(video, 0, 0, w, h);
    const image = ctx.getImageData(0, 0, w, h);
    beginEdit({ data: image.data, width: w, height: h });
    setStatus('Photo captured. Adjust the corners.');
  }

  /* ---- photo from file ---- */
  async function onChoosePhoto(files) {
    const file = Array.from(files || []).find(Boolean);
    if (!file) return;
    clearErrors();
    if (!/^image\//.test(file.type || '') && !/\.(png|jpe?g|webp)$/i.test(file.name || '')) {
      showError('Couldn\u2019t read this file.', `${file.name || 'That file'} is not an image.`);
      return;
    }
    if (typeof window.createImageBitmap !== 'function') {
      showError('Couldn\u2019t read this image.', 'This browser cannot decode images.');
      return;
    }
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (destroyed) return;
      const bitmap = await window.createImageBitmap(new Blob([bytes], { type: file.type || 'image/jpeg' }));
      if (destroyed) { bitmap.close && bitmap.close(); return; }
      const w = bitmap.width;
      const h = bitmap.height;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { bitmap.close && bitmap.close(); showError('Couldn\u2019t read this image.', 'No 2D canvas context.'); return; }
      ctx.drawImage(bitmap, 0, 0, w, h);
      bitmap.close && bitmap.close();
      const image = ctx.getImageData(0, 0, w, h);
      beginEdit({ data: image.data, width: w, height: h });
      setStatus('Photo ready. Adjust the corners.');
    } catch (err) {
      if (destroyed) return;
      showError('Couldn\u2019t read this image.', friendly(err));
    }
  }

  /* ---- edit (corners + filter) ---- */
  function beginEdit(image) {
    // Default corners: a small inset so the handles are grabbable on all sides.
    const insetX = image.width * 0.08;
    const insetY = image.height * 0.08;
    const corners = [
      { x: insetX, y: insetY },
      { x: image.width - insetX, y: insetY },
      { x: image.width - insetX, y: image.height - insetY },
      { x: insetX, y: image.height - insetY },
    ];
    state.editing = { ...image, corners, filter: filterSel.value };
    editPanel.hidden = false;
    renderEditCanvas();
    capturePanel.scrollIntoView({ block: 'nearest' });
  }

  function renderEditCanvas() {
    const ed = state.editing;
    if (!ed) return;

    // The corner stage shows the ORIGINAL photo, so a handle sits where the user
    // points. The canvas is drawn at the photo's native size and scaled down by
    // CSS; the overlay tracks it exactly (inset: 0 of the frame).
    editCanvas.width = ed.width;
    editCanvas.height = ed.height;
    const ctx = editCanvas.getContext('2d');
    if (ctx) {
      const img = ctx.createImageData(ed.width, ed.height);
      img.data.set(ed.data);
      ctx.putImageData(img, 0, 0);
    }

    // The flattened, filtered result is previewed beside the stage.
    const ordered = orderCorners(ed.corners);
    let preview;
    try {
      preview = flattenQuad({ data: ed.data, width: ed.width, height: ed.height }, ordered, { maxEdge: 480 });
      preview = applyFilter(preview, ed.filter);
    } catch {
      preview = { data: ed.data, width: ed.width, height: ed.height };
    }
    resultCanvas.width = preview.width;
    resultCanvas.height = preview.height;
    const rctx = resultCanvas.getContext('2d');
    if (rctx) {
      const img = rctx.createImageData(preview.width, preview.height);
      img.data.set(preview.data);
      rctx.putImageData(img, 0, 0);
    }
    renderHandles();
  }

  /** Position the four handles and the quad path in the overlay's pixel space. */
  function renderHandles() {
    const ed = state.editing;
    if (!ed) return;
    const rect = overlay.getBoundingClientRect();
    const w = rect.width || ed.width;
    const h = rect.height || ed.height;
    const toX = (cx) => (cx / ed.width) * w;
    const toY = (cy) => (cy / ed.height) * h;
    const ordered = orderCorners(ed.corners);
    for (let i = 0; i < 4; i += 1) {
      handles[i].style.left = `${toX(ordered[i].x)}px`;
      handles[i].style.top = `${toY(ordered[i].y)}px`;
    }
    overlaySvg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    quadPath.setAttribute('points', ordered.map((p) => `${toX(p.x)},${toY(p.y)}`).join(' '));
  }

  function onHandleDown(e, handle) {
    if (!state.editing) return;
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    const index = Number(handle.dataset.index);
    const move = (ev) => {
      const rect = overlay.getBoundingClientRect();
      const x = ((ev.clientX - rect.left) / rect.width) * state.editing.width;
      const y = ((ev.clientY - rect.top) / rect.height) * state.editing.height;
      state.editing.corners[index] = clampPoint(x, y, state.editing.width, state.editing.height);
      renderEditCanvas();
    };
    const end = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  }

  function clampPoint(x, y, w, h) {
    return {
      x: Math.max(0, Math.min(w, x)),
      y: Math.max(0, Math.min(h, y)),
    };
  }

  async function onAddPage() {
    const ed = state.editing;
    if (!ed) return;
    clearErrors();
    try {
      const ordered = orderCorners(ed.corners);
      const flat = flattenQuad({ data: ed.data, width: ed.width, height: ed.height }, ordered, { maxEdge: SCAN_MAX_EDGE });
      const filtered = applyFilter(flat, ed.filter);
      const png = await encodePng(filtered);
      if (destroyed) return;
      pageSeq += 1;
      const url = trackUrl(URL.createObjectURL(new Blob([png], { type: 'image/png' })));
      state.pages.push({ id: `scan${pageSeq}`, png, width: filtered.width, height: filtered.height, url, filter: ed.filter });
      state.editing = null;
      editPanel.hidden = true;
      renderReview();
      setStatus(`Added page ${state.pages.length}. Capture another or download the PDF.`, 'ok');
    } catch (err) {
      if (destroyed) return;
      showError('Couldn\u2019t add this page.', friendly(err));
    }
  }

  function onDiscardEdit() {
    state.editing = null;
    editPanel.hidden = true;
    setStatus('Photo discarded.');
  }

  /** Encode an RGBA image as PNG bytes via a canvas. */
  function encodePng(image) {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return Promise.reject(new ScannerError('canvas', 'No 2D canvas context is available.'));
    const img = ctx.createImageData(image.width, image.height);
    img.data.set(image.data);
    ctx.putImageData(img, 0, 0);
    return new Promise((resolve, reject) => {
      canvas.toBlob(async (blob) => {
        if (!blob) { reject(new ScannerError('encode', 'Could not encode the page as PNG.')); return; }
        try { resolve(new Uint8Array(await blob.arrayBuffer())); } catch (err) { reject(err); }
      }, 'image/png');
    });
  }

  /* ---- review ---- */
  function renderReview() {
    pageList.replaceChildren();
    reviewPanel.hidden = state.pages.length === 0;
    state.pages.forEach((page, i) => {
      const li = el('li', 'scanner-item');
      li.dataset.id = page.id;
      li.draggable = true;

      const thumb = el('img', 'scanner-thumb');
      thumb.alt = '';
      thumb.loading = 'lazy';
      thumb.src = page.url;

      const text = el('span', 'scanner-item-text');
      const name = el('span', 'scanner-name');
      name.textContent = `Page ${i + 1}`;
      const meta = el('span', 'field-hint');
      meta.textContent = `${page.width}\u00D7${page.height} \u00B7 ${filterLabelFor(page.filter)} \u00B7 ${formatBytes(page.png.length)}`;
      text.append(name, meta);

      const up = iconButton('arrowUp', `Move page ${i + 1} earlier`, () => movePage(page.id, -1));
      const down = iconButton('arrowDown', `Move page ${i + 1} later`, () => movePage(page.id, 1));
      const rm = iconButton('trash', `Delete page ${i + 1}`, () => removePage(page.id));
      up.disabled = i === 0;
      down.disabled = i === state.pages.length - 1;

      li.append(thumb, text, up, down, rm);
      wireItemDrag(li, page);
      pageList.append(li);
    });
    renderActions();
  }

  function filterLabelFor(id) {
    const f = FILTER_OPTIONS.find((o) => o.id === id);
    return f ? f.label : id;
  }

  function wireItemDrag(li, page) {
    li.addEventListener('dragstart', (e) => {
      li.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', page.id); } catch { /* ignore */ }
    });
    li.addEventListener('dragend', () => { li.classList.remove('is-dragging'); clearDropMarks(); });
    li.addEventListener('dragover', (e) => {
      if (!pageList.querySelector('.is-dragging')) return;
      e.preventDefault();
      const rect = li.getBoundingClientRect();
      const after = e.clientY - rect.top > rect.height / 2;
      clearDropMarks();
      li.classList.add(after ? 'drop-after' : 'drop-before');
    });
    li.addEventListener('drop', (e) => {
      e.preventDefault();
      const dragging = pageList.querySelector('.is-dragging');
      clearDropMarks();
      if (!dragging) return;
      const fromId = dragging.dataset.id;
      const rect = li.getBoundingClientRect();
      const after = e.clientY - rect.top > rect.height / 2;
      movePageTo(fromId, page.id, after);
    });
    li.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removePage(page.id); }
    });
  }

  function clearDropMarks() {
    for (const n of pageList.querySelectorAll('.drop-before, .drop-after')) {
      n.classList.remove('drop-before', 'drop-after');
    }
  }

  function movePage(id, dir) {
    const i = state.pages.findIndex((p) => p.id === id);
    if (i === -1) return;
    const j = i + dir;
    if (j < 0 || j >= state.pages.length) return;
    const [item] = state.pages.splice(i, 1);
    state.pages.splice(j, 0, item);
    renderReview();
  }

  function movePageTo(fromId, toId, after) {
    if (fromId === toId) return;
    const i = state.pages.findIndex((p) => p.id === fromId);
    if (i === -1) return;
    const [item] = state.pages.splice(i, 1);
    let j = state.pages.findIndex((p) => p.id === toId);
    if (j === -1) j = state.pages.length - 1;
    state.pages.splice(after ? j + 1 : j, 0, item);
    renderReview();
  }

  function removePage(id) {
    const i = state.pages.findIndex((p) => p.id === id);
    if (i === -1) return;
    const [page] = state.pages.splice(i, 1);
    if (page.url && objectUrls.has(page.url)) { URL.revokeObjectURL(page.url); objectUrls.delete(page.url); }
    renderReview();
  }

  /* ---- export ---- */
  function renderActions() {
    primary.setEnabled(!state.busy && state.pages.length > 0);
    primary.setLabel(state.busy ? 'Working\u2026' : 'Download PDF');
    clearBtn.disabled = state.busy;
  }

  async function onExport() {
    if (state.busy || state.pages.length === 0) return;
    state.busy = true;
    renderActions();
    clearErrors();
    setStatus('Working\u2026');
    try {
      const lib = await loadPdfLib();
      if (destroyed) return;
      const bytes = await buildScannedPdf(state.pages.map((p) => ({ png: p.png, width: p.width, height: p.height })), lib);
      if (destroyed) return;
      const name = `scan-${state.pages.length}-page${state.pages.length === 1 ? '' : 's'}.pdf`;
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), name);
      setStatus(`Done \u2014 ${state.pages.length} page${state.pages.length === 1 ? '' : 's'} \u00B7 ${formatBytes(bytes.length)}.`, 'ok');
    } catch (err) {
      if (destroyed) return;
      showError('Couldn\u2019t build the PDF.', friendly(err));
      setStatus('Couldn\u2019t build the PDF.', 'bad');
    } finally {
      state.busy = false;
      renderActions();
    }
  }

  function clearAll() {
    if (state.busy) return;
    for (const page of state.pages) {
      if (page.url && objectUrls.has(page.url)) { URL.revokeObjectURL(page.url); objectUrls.delete(page.url); }
    }
    state.pages = [];
    state.editing = null;
    editPanel.hidden = true;
    clearErrors();
    setStatus('');
    renderReview();
  }

  function onResize() {
    if (state.editing) renderEditCanvas();
  }
  window.addEventListener('resize', onResize);

  /* ---- init ---- */
  renderActions();
  loadPdfLib().catch(() => { /* pdf-lib is only needed on export */ });

  // Lifecycle: release the camera, object URLs and the resize listener when the
  // shell leaves the tool.
  return function unmount() {
    destroyed = true;
    window.removeEventListener('resize', onResize);
    stopCamera();
    for (const url of objectUrls) URL.revokeObjectURL(url);
    objectUrls.clear();
    state.pages = [];
    state.editing = null;
  };
}