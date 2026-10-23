// PDF page picker — the shared grid UI for Merge / Split / Rotate.
//
// Visual only: every selection / rotation / reorder edit and its undo live in
// the pure ./picker-state.js module (unit-tested in tests/picker.test.mjs); the
// final PDF is written by pdf.applyPlan(). This file owns the DOM, the
// thumbnails (lazily rendered with pdf.js, vendored under ../../vendor/pdfjs/),
// the keyboard / pointer interaction and the toolbar. No network, no CDN.

import {
  downloadBlob,
  formatBytes,
  glyph,
  GLYPHS,
} from '../../assets/ui.js';
import { assetUrl } from '../../assets/assetUrl.js';
import * as pickerState from './picker-state.js';
import { createDocumentCache } from './thumbs.js';

// Both resolved against this module (not the page), so the pdf.js script and
// its worker stay correct whatever route the tool is opened on (review F07).
const PDFJS_URL = assetUrl('../../vendor/pdfjs/pdf.min.js', import.meta.url);
const PDFJS_WORKER_URL = assetUrl('../../vendor/pdfjs/pdf.worker.min.js', import.meta.url);
const THUMB_MAX_WIDTH = 264; // 2x DPR cap; the box is 3:4 and 132px wide.
const RENDER_CONCURRENCY = 3;
const THUMB_MAX_ATTEMPTS = 3;   // 1 initial + up to 2 automatic retries
const THUMB_RETRY_DELAY_MS = 400;

let pdfjsPromise = null;

/** Load the vendored pdf.js ES module once. Worker is same-origin; no ranges. */
function loadPdfjs() {
  if (pdfjsPromise) return pdfjsPromise;
  pdfjsPromise = import(/* @vite-ignore */ PDFJS_URL).then((mod) => {
    const GlobalWorkerOptions = mod.GlobalWorkerOptions || (mod.default && mod.default.GlobalWorkerOptions);
    if (GlobalWorkerOptions) {
      GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
    }
    return mod;
  });
  return pdfjsPromise;
}

/**
 * Mount the picker into `root`.
 *
 * @param {HTMLElement} root
 * @param {object} opts
 * @param {(bytes: Uint8Array) => Promise<{ pageCount: number }>} opts.loadPdfLib
 *        resolves the injected pdf-lib namespace for applyPlan; called lazily.
 * @returns {object} controller with { setMode, addFiles, destroy }
 */
export function createPicker(root, opts = {}) {
  const ensurePdfLib = opts.loadPdfLib || (async () => {});

  const state = pickerState.createPickerState();
  const fileMeta = new Map(); // fileId -> { name, bytes, pageCount, size }
  const sources = new Map();  // fileId -> Uint8Array (for applyPlan)
  const nameById = new Map(); // fileId -> friendly name
  const thumbs = new Map();   // thumbIndex -> { canvas, status, attempts, box }
  // pdf.js transfers (detaches) the buffer it is given, so it must never see the
  // arrays we keep for pdf-lib. The cache hands pdf.js its own copy and
  // memoizes the loading promise per fileId.
  const docCache = createDocumentCache(() => ensurePdfjs());
  const renderQueue = [];
  let rendersInFlight = 0;
  let mode = 'merge';
  let dragId = null;
  let dragOverIndex = null;
  let newFileSeq = 0;
  let thumbSeq = 0;
  let destroyed = false;

  /* ---- structure ---- */

  const wrap = el('div', 'stack pdf-picker');

  // Host-level shortcuts: Ctrl/Cmd+Z (undo) and Ctrl/Cmd+A (select all) work
  // whenever focus is anywhere inside the picker host (grid OR toolbar), but
  // never while the user is typing in a field (input/textarea/select) or a
  // contenteditable element. Attached to `wrap` so it also catches keys while
  // focus sits on a toolbar button rather than a tile.
  wrap.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (isTextField(e.target)) return;
    if (e.key === 'z' || e.key === 'Z') {
      e.preventDefault();
      performUndo();
    } else if (e.key === 'a' || e.key === 'A') {
      e.preventDefault();
      pickerState.selectAll(state);
      render();
    }
  });

  const grid = document.createElement('div');
  grid.className = 'pdf-grid';
  grid.setAttribute('role', 'listbox');
  grid.setAttribute('aria-multiselectable', 'true');
  grid.setAttribute('aria-label', 'PDF pages');
  // Focusable so keyboard focus can fall back to the grid container itself
  // after an edit removes the focused tile (roving tabindex lives on tiles).
  grid.tabIndex = -1;
  grid.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && e.target === grid) {
      pickerState.clearSelection(state);
      render();
    }
  });

  const toolbar = el('div', 'pdf-toolbar');
  const toolbarTop = el('div', 'pdf-toolbar-row');
  const toolbarActions = el('div', 'pdf-toolbar-actions');
  const summaryEl = el('span', 'pdf-summary');
  summaryEl.setAttribute('role', 'status');
  summaryEl.setAttribute('aria-live', 'polite');

  const selectAllBtn = textBtn('Select all', () => { pickerState.selectAll(state); render(); });
  const clearSelBtn = textBtn('Clear', () => { pickerState.clearSelection(state); render(); });
  const undoToolbarBtn = textBtn('Undo', () => performUndo());
  undoToolbarBtn.disabled = true;
  undoToolbarBtn.title = 'Undo';

  const rotateLeftBtn = actionBtn('Rotate left', () => { edit('rotate', -90); });
  const rotateRightBtn = actionBtn('Rotate right', () => { edit('rotate', 90); });
  const deleteBtn = actionBtn('Delete', () => edit('delete'));
  const extractBtn = actionBtn('Extract selected\u2026', () => extractSelected());
  // Stable hooks so focus can be restored to the equivalent button after a
  // re-render (toolbar buttons are never destroyed/recreated, but this also
  // lets us find a clone in the floating bar if needed).
  selectAllBtn.dataset.action = 'select-all';
  clearSelBtn.dataset.action = 'clear';
  undoToolbarBtn.dataset.action = 'undo';
  rotateLeftBtn.dataset.action = 'rotate-left';
  rotateRightBtn.dataset.action = 'rotate-right';
  deleteBtn.dataset.action = 'delete';
  extractBtn.dataset.action = 'extract';
  const rotateGroup = el('span', 'pdf-rotate-group');
  rotateGroup.append(rotateLeftBtn, rotateRightBtn);
  toolbarActions.append(selectAllBtn, clearSelBtn, undoToolbarBtn, rotateGroup, deleteBtn, extractBtn);

  toolbarTop.append(summaryEl, toolbarActions);

  // Split-mode control (only shown in split mode).
  const splitRow = el('div', 'pdf-split-row row');
  const splitN = document.createElement('input');
  splitN.type = 'number';
  splitN.className = 'field-input';
  splitN.min = '1';
  splitN.value = '1';
  splitN.id = 'pdf-split-n';
  splitN.setAttribute('aria-label', 'Pages per part');
  const splitEveryBtn = document.createElement('button');
  splitEveryBtn.type = 'button';
  splitEveryBtn.className = 'btn btn-secondary';
  splitEveryBtn.textContent = 'Split every N pages';
  splitEveryBtn.addEventListener('click', () => splitEvery());
  const splitLabel = el('label', 'field-label');
  splitLabel.setAttribute('for', 'pdf-split-n');
  splitLabel.textContent = 'Pages per part';
  splitRow.append(splitLabel, splitN, splitEveryBtn);
  splitRow.hidden = true;

  toolbar.append(toolbarTop, splitRow);

  // Status + undo line + errors.
  const statusLine = el('p', 'status');
  statusLine.setAttribute('role', 'status');
  statusLine.setAttribute('aria-live', 'polite');

  const errors = el('div', 'picker-errors');
  errors.hidden = true;

  // Watermark: the sticky toolbar's placeholder anchor.
  const gridWrap = el('div', 'pdf-grid-wrap');
  gridWrap.append(grid);

  wrap.append(toolbar, gridWrap, statusLine, errors);
  root.append(wrap);

  // Floating bar (mirrors the toolbar actions when the toolbar scrolls away).
  const floating = el('div', 'pdf-floating');
  floating.hidden = true;
  const floatingSummary = el('span', 'pdf-summary');
  const floatingActions = el('div', 'pdf-toolbar-actions');
  floatingActions.append(
    cloneAction(rotateLeftBtn), cloneAction(rotateRightBtn),
    cloneAction(deleteBtn), cloneAction(extractBtn),
  );
  floating.append(floatingSummary, floatingActions);
  document.body.append(floating);

  /* ---- helpers ---- */

  function el(tag, cls) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }

  /** True for editable targets where host shortcuts must not fire. */
  function isTextField(target) {
    if (!target || !target.tagName) return false;
    const tag = target.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    return target.isContentEditable === true;
  }

  function textBtn(text, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-text';
    b.textContent = text;
    b.addEventListener('click', onClick);
    return b;
  }

  function actionBtn(text, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-secondary';
    b.textContent = text;
    b.addEventListener('click', onClick);
    return b;
  }

  function cloneAction(src) {
    const props = ['Rotate left', 'Rotate right', 'Delete', 'Extract selected\u2026'];
    const b = actionBtn(src.textContent, () => src.click());
    b.disabled = src.disabled;
    b.dataset.cloneOf = props.includes(src.textContent) ? src.textContent : '';
    return b;
  }

  function edit(kind, arg) {
    if (kind === 'rotate') pickerState.rotate(state, pickerState.selectedIds(state), arg);
    else if (kind === 'delete') pickerState.deleteSelected(state);
    render();
  }

  /** Undo the last edit and re-render (shared by Ctrl/Cmd+Z and the button). */
  function performUndo() {
    pickerState.undo(state);
    render();
  }

  /* ---- files ---- */

  async function addFiles(files) {
    let cleared = false;
    for (const file of files) {
      // R2-05: the picker may have been destroyed before/during this loop.
      if (destroyed) return;
      const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
      if (!isPdf) { showError(file.name, 'is not a PDF file. Add a file ending in .pdf.'); continue; }
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        // Discard the whole continuation if the picker was torn down while the
        // bytes were being read: never repopulate the cleared maps.
        if (destroyed) return;
        const size = bytes.byteLength;
        const { pageCount } = await inspect(bytes, file.name);
        if (destroyed) return;
        const fileId = `f${newFileSeq++}`;
        fileMeta.set(fileId, { name: file.name, bytes, pageCount, size });
        sources.set(fileId, bytes);
        nameById.set(fileId, file.name);
        cleared = appendEntries(fileId, file.name, pageCount) || cleared;
      } catch (err) {
        if (destroyed) return;
        showError(file.name, err && err.message ? err.message : 'could not be read.');
      }
    }
    if (destroyed) return;
    historyClearedNotice = cleared;
    afterFilesChanged();
  }

  /** pdf-lib is the identity source; it also gives friendlier errors. */
  async function inspect(bytes, name) {
    const lib = await ensurePdfLib();
    const pdf = await import('./pdf.js');
    if (destroyed) return { pageCount: 0 };
    if (lib) pdf.setPdfLib(lib);
    try {
      const doc = await lib.PDFDocument.load(bytes);
      if (destroyed) return { pageCount: 0 };
      return { pageCount: doc.getPageCount() };
    } catch (err) {
      throw pdf.describeLoadError(err, name);
    }
  }

  function appendEntries(fileId, fileName, pageCount) {
    // Extend the grid state with this file's pages, keeping the current edits.
    // Adding files CLEARS the undo history (review F11): a snapshot taken before
    // this file existed must never be restorable, or a later undo would drop the
    // new file's pages from the plan.
    const clearedHistory = pickerState.appendFilePages(state, {
      id: fileId,
      name: fileName,
      pageCount,
      startThumbIndex: thumbSeq,
    });
    thumbSeq += pageCount;
    // Rotate mode preselects every page, including the new ones.
    if (mode === 'rotate') pickerState.selectAll(state);
    return clearedHistory;
  }

  /** Set once any file was ingested, so the next render can say history cleared. */
  let historyClearedNotice = false;

  function afterFilesChanged() {
    if (destroyed) return;
    if (mode === 'rotate') pickerState.selectAll(state);
    render();
    ensurePdfjs().then(() => scheduleRenders()).catch(() => {});
    if (historyClearedNotice) {
      historyClearedNotice = false;
      const base = statusLine.textContent;
      statusLine.textContent = `${base}${base ? ' ' : ''}Undo history cleared.`;
      statusLine.classList.add('has-undo');
    }
  }

  /* ---- rendering ---- */

  const showFileName = () => fileMeta.size > 1;

  function render() {
    // R2-05: once destroyed, no render may rebuild the grid or re-observers.
    if (destroyed) return;
    // Capture where focus was BEFORE the grid is rebuilt, but only when focus
    // was actually inside the picker. If the user was on a toolbar button (or
    // anywhere outside), we must not steal focus back into the grid.
    const active = document.activeElement;
    const focusWasInPicker = !!(active && wrap.contains(active));

    const focusTileId = state.focusedId;
    const entriesBefore = state.entries.map((e) => e.id);
    // Identify a focused toolbar button by its stable data-action hook.
    const actionEl = focusWasInPicker && active && active.closest
      ? active.closest('button[data-action]')
      : null;
    const focusedAction = actionEl ? actionEl.dataset.action : null;
    const isGridFocus = focusWasInPicker && !!active.closest('.pdf-grid');

    renderGrid();
    renderToolbar();
    renderStatus();
    scheduleRenders();

    if (!focusWasInPicker) return;

    if (isGridFocus) {
      // Restore into the grid: same tile, else same index, else previous,
      // else the grid container itself (tabindex=-1).
      const entriesAfter = state.entries.map((e) => e.id);
      const targetId = pickerState.nextFocusId(entriesBefore, entriesAfter, focusTileId);
      state.focusedId = targetId;
      syncTabindex();
      const tile = targetId
        ? grid.querySelector(`[data-id="${cssEscape(targetId)}"]`)
        : null;
      if (tile) tile.focus();
      else grid.focus();
    } else if (focusedAction) {
      // Keep focus on the equivalent toolbar button the user just activated.
      // A disabled button cannot hold focus, so fall back to the grid
      // container in that case (it has tabindex=-1).
      const btn = wrap.querySelector(`button[data-action="${focusedAction}"]`);
      if (btn && !btn.disabled) btn.focus();
      else grid.focus();
    } else {
      // Focus was on some other element inside the picker (grid container,
      // status area…): leave it, but ensure the roving tabindex is coherent.
      syncTabindex();
    }
  }

  function renderGrid() {
    const prevFocus = state.focusedId;
    // Unobserve the tiles about to be discarded so the IntersectionObserver does
    // not keep observing detached nodes (review F09).
    if (observer) {
      for (const stale of grid.children) observer.unobserve(stale);
    }
    grid.replaceChildren();
    const byThumb = new Map();
    state.entries.forEach((entry, i) => {
      const tile = buildTile(entry, i);
      grid.append(tile);
      byThumb.set(entry.thumbIndex, tile);
    });
    // Reattach existing canvases to surviving thumb indices, and re-apply the
    // "Preview unavailable" note for tiles whose thumbnail failed: a rebuilt
    // tile starts blank, so the persisted status must be restored each time.
    for (const [thumbIndex, data] of thumbs) {
      const tile = byThumb.get(thumbIndex);
      if (!tile) continue;
      if (data.status === 'done') {
        const box = tile.querySelector('.tile-canvas');
        if (box && data.canvas && !box.contains(data.canvas)) box.append(data.canvas);
        if (tile && data.canvas) applyRotation(tile, data.canvas, tile.__entry.rotation);
      } else if (data.status === 'failed') {
        applyUnavailableNote(tile);
      }
    }
    // Roving tabindex: keep the focused tile tabbable, else the first tile.
    const focusTarget = grid.querySelector(`[data-id="${cssEscape(prevFocus || '')}"]`);
    if (focusTarget) focusTarget.tabIndex = 0;
    else {
      const first = grid.querySelector('.tile');
      if (first) { first.tabIndex = 0; state.focusedId = first.dataset.id; }
    }
  }

  function buildTile(entry, i) {
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.setAttribute('role', 'option');
    tile.dataset.id = entry.id;
    tile.tabIndex = entry.id === state.focusedId ? 0 : -1;
    tile.draggable = true;
    tile.__entry = entry;

    const box = el('div', 'tile-canvas');
    const num = el('span', 'tile-num');
    num.textContent = String(entry.pageIndex + 1);
    const nameEl = el('span', 'tile-name');
    if (showFileName()) {
      nameEl.textContent = entry.fileName;
      nameEl.title = entry.fileName;
    }
    tile.append(box, num);
    if (showFileName()) tile.append(nameEl);

    const selected = state.selected.has(entry.id);
    tile.setAttribute('aria-selected', selected ? 'true' : 'false');
    if (selected) {
      tile.classList.add('is-selected');
      const badge = el('span', 'tile-check');
      badge.append(glyph(GLYPHS.check));
      tile.append(badge);
    }
    tile.setAttribute('aria-label', ariaLabel(entry, selected, i));

    wireTile(tile, entry, box);
    return tile;
  }

  function ariaLabel(entry, selected, i) {
    const parts = [`Page ${entry.pageIndex + 1}`];
    if (showFileName()) parts.push(entry.fileName);
    if (entry.rotation) parts.push(`rotated ${entry.rotation}\u00B0`);
    parts.push(selected ? 'selected' : 'not selected');
    return parts.join(', ');
  }

  function applyRotation(tile, canvas, rotation) {
    // Rotating 90/270 swaps visual dimensions; scale so the rotated image
    // still fits the fixed 3:4 box.
    canvas.style.transform = `rotate(${rotation || 0}deg)`;
    if (rotation === 90 || rotation === 270) canvas.dataset.rotated = '1';
    else delete canvas.dataset.rotated;
  }

  function renderToolbar() {
    const n = pickerState.selectedCount(state);
    const total = pickerState.count(state);
    summaryEl.textContent = pickerState.summary(state);
    floatingSummary.textContent = summaryEl.textContent;
    const has = n > 0;
    for (const b of [rotateLeftBtn, rotateRightBtn, deleteBtn, extractBtn]) b.disabled = !has;
    for (const b of floatingActions.querySelectorAll('button')) b.disabled = !has;
    clearSelBtn.disabled = !has;
    selectAllBtn.disabled = total === 0 || n === total;
    renderUndoButton();
    splitRow.hidden = mode !== 'split' || total === 0;
    updateFloating();
  }

  /** Enable/disable the toolbar Undo and name the edit it will reverse. */
  function renderUndoButton() {
    const kind = pickerState.describeLastEdit(state);
    const can = pickerState.canUndo(state);
    undoToolbarBtn.disabled = !can;
    undoToolbarBtn.title = can && kind ? `Undo ${kind}` : 'Nothing to undo';
    undoToolbarBtn.setAttribute('aria-label', undoToolbarBtn.title);
  }

  function renderStatus() {
    const n = state.entries.length;
    if (n === 0) { statusLine.textContent = ''; statusLine.className = 'status'; return; }
    const sizes = state.entries.reduce((sum, e) => sum + (fileMeta.get(e.fileId)?.size || 0), 0);
    statusLine.textContent = `${n} page${n === 1 ? '' : 's'} \u00B7 ${formatBytes(sizes)}`;
    statusLine.className = 'status';
  }

  /* ---- thumbnails ---- */

  async function ensurePdfjs() {
    return loadPdfjs();
  }

  function scheduleRenders() {
    if (destroyed) return;
    // Queue visible-but-unrendered tiles; the IntersectionObserver decides
    // which are "near". This is called after each render; observers drive it.
    scheduleAll();
  }

  function scheduleAll() {
    for (const tile of grid.querySelectorAll('.tile')) {
      observeTile(tile);
    }
  }

  const observer = typeof IntersectionObserver !== 'undefined'
    ? new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) enqueueRender(entry.target);
      }
    }, { rootMargin: '800px' })
    : null;

  function observeTile(tile) {
    if (!observer) { enqueueRender(tile); return; }
    observer.observe(tile);
  }

  function enqueueRender(tile) {
    if (destroyed) return;
    const entry = tile.__entry;
    const key = entry.thumbIndex;
    if (thumbs.has(key)) return;
    thumbs.set(key, { status: 'queued', canvas: null, attempts: 0, box: tile.querySelector('.tile-canvas') });
    renderQueue.push({ tile, entry, key });
    pump();
  }

  function pump() {
    if (destroyed) return;
    while (rendersInFlight < RENDER_CONCURRENCY && renderQueue.length) {
      const job = renderQueue.shift();
      rendersInFlight += 1;
      renderThumb(job).catch(() => {
        retryOrFail(job);
      }).finally(() => {
        rendersInFlight -= 1;
        pump();
      });
    }
  }

  /**
   * A failed thumbnail is retried automatically (up to THUMB_MAX_ATTEMPTS total)
   * after a short delay, so a transient worker hiccup heals itself. Only once
   * the attempts are exhausted does the tile show "Preview unavailable".
   */
  function retryOrFail(job) {
    const data = thumbs.get(job.key);
    if (!data) return;
    data.attempts = (data.attempts || 0) + 1;
    if (data.attempts < THUMB_MAX_ATTEMPTS) {
      data.status = 'queued';
      setTimeout(() => {
        if (destroyed || !thumbs.has(job.key)) return;
        renderQueue.push(job);
        pump();
      }, THUMB_RETRY_DELAY_MS);
      return;
    }
    data.status = 'failed';
    const tile = grid.querySelector(`[data-id="${cssEscape(job.entry.id)}"]`);
    if (tile) applyUnavailableNote(tile);
  }

  /** Re-queue a single failed thumbnail (click-to-retry): exactly one more try. */
  function retryThumb(key) {
    const data = thumbs.get(key);
    if (!data || data.status !== 'failed') return;
    const entry = state.entries.find((e) => e.thumbIndex === key);
    if (!entry) return;
    const tile = grid.querySelector(`[data-id="${cssEscape(entry.id)}"]`);
    if (!tile) return;
    data.status = 'queued';
    // One attempt only: a failure after this shows the note again.
    data.attempts = THUMB_MAX_ATTEMPTS - 1;
    const box = tile.querySelector('.tile-canvas');
    if (box) box.replaceChildren();
    renderQueue.push({ tile, entry, key });
    pump();
  }

  async function renderThumb({ tile, entry, key }) {
    // The cache copies the bytes and memoizes the load, so concurrent jobs for
    // one file await the same document and the arrays we keep stay intact.
    const bytes = fileMeta.get(entry.fileId).bytes;
    const doc = await docCache.getDocument(entry.fileId, bytes);
    // The picker may have been destroyed while the document was loading.
    if (destroyed) return;
    const page = await doc.getPage(entry.pageIndex + 1);
    if (destroyed) return;
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(1, THUMB_MAX_WIDTH / base.width);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.className = 'tile-thumb';
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(viewport.width * ratio);
    canvas.height = Math.round(viewport.height * ratio);
    canvas.style.width = `${Math.round(viewport.width)}px`;
    canvas.style.height = `${Math.round(viewport.height)}px`;
    const ctx = canvas.getContext('2d');
    ctx.scale(ratio, ratio);
    await page.render({ canvasContext: ctx, viewport }).promise;
    if (destroyed) return;

    // Current box may have been rebuilt by a later render(); reattach.
    const data = thumbs.get(key);
    if (!data) return;
    data.status = 'done';
    data.canvas = canvas;
    applyRotation(tile, canvas, entry.rotation);
    const live = grid.querySelector(`[data-id="${cssEscape(entry.id)}"] .tile-canvas`);
    if (live) { live.replaceChildren(canvas); data.box = live; }
  }

  function applyUnavailableNote(tile) {
    const box = tile.querySelector('.tile-canvas');
    if (!box) return;
    box.replaceChildren();
    const note = el('span', 'tile-unavailable');
    note.textContent = 'Preview unavailable';
    note.title = 'Click to retry';
    note.addEventListener('click', (e) => {
      e.stopPropagation();
      const entry = tile.__entry;
      if (entry) retryThumb(entry.thumbIndex);
    });
    box.append(note);
  }

  /* ---- tile interaction ---- */

  function wireTile(tile, entry) {
    tile.addEventListener('click', (e) => onTileClick(e, entry));
    tile.addEventListener('keydown', (e) => onTileKey(e, tile, entry));
    tile.addEventListener('focus', () => { state.focusedId = entry.id; syncTabindex(); });

    // Drag to reorder.
    tile.addEventListener('dragstart', (e) => {
      dragId = entry.id;
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', entry.id); } catch { /* ignore */ }
      tile.classList.add('is-dragging');
    });
    tile.addEventListener('dragend', () => {
      dragId = null; dragOverIndex = null;
      tile.classList.remove('is-dragging');
      clearInsertionBars();
    });
    tile.addEventListener('dragover', (e) => {
      if (dragId == null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = tile.getBoundingClientRect();
      const after = e.clientX - rect.left > rect.width / 2;
      dragOverIndex = indexOfId(entry.id) + (after ? 1 : 0);
      showInsertionBar(tile, after);
    });
    tile.addEventListener('drop', (e) => {
      e.preventDefault();
      if (dragId == null) return;
      const ids = state.selected.has(dragId) && pickerState.selectedCount(state) > 1
        ? pickerState.selectedIds(state)
        : [dragId];
      pickerState.movePages(state, ids, dragOverIndex);
      dragId = null; dragOverIndex = null;
      clearInsertionBars();
      render();
    });

    // Touch: long-press then drag is emulated by leaving HTML5 drag to pointer
    // capable devices; we still support keyboard reordering everywhere.
  }

  function onTileClick(e, entry) {
    const shift = e.shiftKey;
    const meta = e.ctrlKey || e.metaKey;
    const prevAnchor = state.anchorId;
    if (shift) pickerState.selectRange(state, state.anchorId, entry.id);
    else pickerState.toggle(state, entry.id);
    state.focusedId = entry.id;
    // Ctrl/Cmd+click toggles without moving the range anchor.
    if (meta) state.anchorId = prevAnchor;
    render();
  }

  function onTileKey(e, tile, entry) {
    const idx = indexOfId(entry.id);
    // Alt+Arrow moves the page(s); plain arrows move focus.
    if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      const ids = pickerState.selectedCount(state) ? pickerState.selectedIds(state) : [entry.id];
      pickerState.moveByKeyboard(state, ids, e.key === 'ArrowLeft' ? -1 : 1);
      render();
      focusId(entry.id);
      return;
    }
    switch (e.key) {
      case ' ':
        e.preventDefault();
        if (e.shiftKey) pickerState.selectRange(state, state.anchorId, entry.id);
        else pickerState.toggle(state, entry.id);
        render();
        focusId(entry.id);
        break;
      case 'Escape':
        e.preventDefault(); pickerState.clearSelection(state); render();
        break;
      case 'Delete':
      case 'Backspace': {
        e.preventDefault();
        const ids = pickerState.selectedCount(state) ? pickerState.selectedIds(state) : [entry.id];
        const removed = ids.length;
        pickerState.deleteIds(state, ids);
        render();
        announceDeleted(removed);
        break;
      }
      case 'ArrowLeft': moveFocus(e, idx, -1); break;
      case 'ArrowRight': moveFocus(e, idx, 1); break;
      case 'ArrowUp': moveFocus(e, idx, -columns()); break;
      case 'ArrowDown': moveFocus(e, idx, columns()); break;
      case 'Home': e.preventDefault(); focusIndex(0); break;
      case 'End': e.preventDefault(); focusIndex(state.entries.length - 1); break;
      default: break;
    }
  }

  function moveFocus(e, idx, delta) {
    e.preventDefault();
    focusIndex(idx + delta);
  }

  function focusIndex(i) {
    const clamped = Math.max(0, Math.min(state.entries.length - 1, i));
    const entry = state.entries[clamped];
    if (entry) focusId(entry.id);
  }

  function focusId(id) {
    state.focusedId = id;
    syncTabindex();
    const tile = grid.querySelector(`[data-id="${cssEscape(id)}"]`);
    if (tile) tile.focus();
  }

  function syncTabindex() {
    for (const t of grid.querySelectorAll('.tile')) {
      t.tabIndex = t.dataset.id === state.focusedId ? 0 : -1;
    }
  }

  function columns() {
    if (!grid.firstElementChild) return 1;
    const top = grid.firstElementChild.offsetTop;
    let n = 0;
    for (const t of grid.children) {
      if (t.offsetTop === top) n += 1;
      else break;
    }
    return Math.max(1, n);
  }

  function indexOfId(id) {
    return state.entries.findIndex((e) => e.id === id);
  }

  function showInsertionBar(tile, after) {
    clearInsertionBars();
    tile.classList.add(after ? 'drop-after' : 'drop-before');
  }

  function clearInsertionBars() {
    for (const t of grid.querySelectorAll('.drop-after, .drop-before')) {
      t.classList.remove('drop-after', 'drop-before');
    }
  }

  function announceDeleted(n) {
    if (n <= 0) return;
    // The sentence ends at the period; the inline "Undo" button supplies the
    // single visible "Undo" (previously this read "Deleted 1 page. Undo Undo").
    statusLine.textContent = `Deleted ${n} page${n === 1 ? '' : 's'}.`;
    statusLine.classList.add('has-undo');
    const undoBtn = textBtn('Undo', () => performUndo());
    undoBtn.title = 'Undo delete';
    undoBtn.setAttribute('aria-label', 'Undo delete');
    statusLine.append(' ');
    statusLine.append(undoBtn);
  }

  /* ---- floating bar ---- */

  let io = null;
  function updateFloating() {
    // R2-05: teardown sets io = null; without this guard a late render could
    // recreate an IntersectionObserver that nothing ever disconnects.
    if (destroyed) return;
    if (!('IntersectionObserver' in window)) return;
    if (!io) {
      io = new IntersectionObserver(() => updateFloating(), { threshold: 0 });
      io.observe(toolbar);
    }
    const visible = toolbar.getBoundingClientRect().top >= 0;
    const has = pickerState.selectedCount(state) > 0;
    floating.hidden = visible || !has;
  }

  /* ---- modes, split, extract, download ---- */

  function setMode(nextMode) {
    mode = nextMode;
    if (mode === 'rotate') pickerState.selectAll(state);
    render();
  }

  async function splitEvery() {
    const n = Math.max(1, Number(splitN.value) || 1);
    const total = state.entries.length;
    if (!total) return;
    const groups = [];
    for (let i = 0; i < total; i += n) groups.push(state.entries.slice(i, i + n));
    await downloadGroups(groups, 'part');
  }

  async function extractSelected() {
    const plan = pickerState.extractPlan(state);
    if (!plan.length) return;
    await downloadPlan(plan, 'extracted.pdf');
  }

  async function downloadPlan(plan, name) {
    if (!plan.length) { setStatus('No pages remain \u2014 keep at least one page.', 'bad'); return; }
    setStatus('Working\u2026');
    try {
      const lib = await ensurePdfLib();
      const pdf = await import('./pdf.js');
      if (lib) pdf.setPdfLib(lib);
      const bytes = await pdf.applyPlan(sources, plan, nameById);
      downloadBlob(new Blob([bytes], { type: 'application/pdf' }), name);
      setStatus(`Done \u2014 ${plan.length} page${plan.length === 1 ? '' : 's'} \u00B7 ${formatBytes(bytes.length)}.`, 'ok');
    } catch (err) {
      setStatus(`Couldn\u2019t build the PDF. ${err && err.message ? err.message : ''}`, 'bad');
    }
  }

  async function downloadGroups(groups, prefix) {
    setStatus('Working\u2026');
    try {
      const lib = await ensurePdfLib();
      const pdf = await import('./pdf.js');
      if (lib) pdf.setPdfLib(lib);
      const results = el('div', 'results');
      for (let g = 0; g < groups.length; g += 1) {
        const plan = groups[g].map((e) => ({ fileId: e.fileId, pageIndex: e.pageIndex, rotation: e.rotation }));
        const bytes = await pdf.applyPlan(sources, plan, nameById);
        const name = `${prefix}${g + 1}.pdf`;
        results.append(resultRow(name, bytes));
      }
      const existing = wrap.querySelector('.split-results');
      if (existing) existing.remove();
      results.classList.add('split-results');
      wrap.append(results);
      setStatus(`Done \u2014 ${groups.length} PDFs.`, 'ok');
    } catch (err) {
      setStatus(`Couldn\u2019t split. ${err && err.message ? err.message : ''}`, 'bad');
    }
  }

  function resultRow(name, bytes) {
    const row = el('div', 'result');
    const label = el('span', 'result-name');
    label.textContent = `${name} \u00B7 ${formatBytes(bytes.length)}`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-secondary';
    btn.textContent = 'Download';
    btn.addEventListener('click', () => downloadBlob(new Blob([bytes], { type: 'application/pdf' }), name));
    row.append(label, btn);
    return row;
  }

  function setStatus(text, kind) {
    statusLine.textContent = text || '';
    statusLine.className = 'status' + (kind ? ` is-${kind}` : '');
  }

  /* ---- primary action ---- */

  async function downloadPrimary() {
    const plan = pickerState.toPlan(state);
    if (!plan.length) return;
    const name = fileMeta.size > 1 ? 'merged.pdf' : editedName(firstFileName());
    await downloadPlan(plan, name);
  }

  function firstFileName() {
    const first = state.entries[0];
    return first ? first.fileName : 'document.pdf';
  }

  function editedName(name) {
    return `${String(name).replace(/\.pdf$/i, '')}-edited.pdf`;
  }

  /* ---- errors ---- */

  function showError(fileName, reason) {
    errors.hidden = false;
    const block = el('div', 'block block-error');
    block.setAttribute('role', 'alert');
    const lead = el('span', 'block-lead');
    lead.textContent = 'Couldn\u2019t read this file.';
    const detail = el('span', 'block-detail');
    detail.textContent = ` ${fileName} ${reason}`;
    block.append(lead, detail);
    errors.append(block);
  }

  function clearErrors() { errors.replaceChildren(); errors.hidden = true; }

  function cssEscape(s) {
    return String(s).replace(/["\\]/g, '\\$&');
  }

  /* ---- public ---- */

  const api = {
    el: wrap,
    setMode,
    addFiles,
    downloadPrimary,
    clearErrors,
    get state() { return state; },
    /**
     * Total selected / remaining page counts, for the shell's primary button.
     */
    counts: () => ({ total: state.entries.length, selected: pickerState.selectedCount(state) }),
    destroy() {
      destroyed = true;
      if (io) { io.disconnect(); io = null; }
      if (observer) {
        observer.disconnect();
        for (const tile of grid.children) observer.unobserve(tile);
      }
      // Drop queued work so no thumbnail render starts after teardown.
      renderQueue.length = 0;
      // Release the pdf.js document proxies for every file.
      for (const fileId of fileMeta.keys()) docCache.release(fileId);
      fileMeta.clear();
      sources.clear();
      nameById.clear();
      thumbs.clear();
      // The floating bar lives on document.body, outside the tool mount, so it
      // must be removed explicitly or it survives navigation.
      floating.remove();
    },
  };

  // Boot.
  render();

  return api;
}