// Shared UI building blocks used by every tool, so drag-and-drop,
// file picking and the Download button behave identically everywhere.
// Functional glyphs only (inline SVG, 1.5px stroke, currentColor).

/** SVG namespace for the few functional glyphs we draw. */
const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Build an inline functional glyph (upload arrow, check, close, trash, rotate,
 * drag handle). Stroke-only, currentColor, 1.5px.
 * @param {string} paths one or more <path> `d` strings
 * @returns {SVGElement}
 */
export function glyph(paths) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.5');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of paths) {
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('stroke-linejoin', 'round');
    svg.append(p);
  }
  return svg;
}

export const GLYPHS = {
  close: ['M6 6l12 12', 'M18 6L6 18'],
  check: ['M5 13l4 4L19 7'],
  trash: ['M4 7h16', 'M9 7V5h6v2', 'M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12'],
  rotateLeft: ['M9 5H5v4', 'M5 9a7 7 0 1 1-1 5'],
  rotateRight: ['M15 5h4v4', 'M19 9a7 7 0 1 0 1 5'],
  dragHandle: ['M9 6h.01', 'M15 6h.01', 'M9 12h.01', 'M15 12h.01', 'M9 18h.01', 'M15 18h.01'],
  arrowUp: ['M12 19V5', 'M6 11l6-6 6 6'],
  arrowDown: ['M12 5v14', 'M6 13l6 6 6-6'],
};

/**
 * Build a reusable drop / file-picker surface from the <template> in index.html.
 *
 * @param {object} opts
 * @param {boolean} [opts.multiple]   allow more than one file
 * @param {string}  [opts.accept]     input accept attribute, e.g. "application/pdf"
 * @param {string}  [opts.title]      big label text
 * @param {string}  [opts.hint]       small hint text (may include a browse button)
 * @param {string}  [opts.note]       caption line for accepted types / limits
 * @param {(files: File[]) => void} opts.onFiles  called with chosen files
 * @returns {{ el, setMeta, setCompact, setEmptyTitle, setHint, open, reset }}
 */
export function createDropzone(opts = {}) {
  const tpl = document.getElementById('dropzone-template');
  const el = tpl.content.firstElementChild.cloneNode(true);
  const input = el.querySelector('.dropzone-input');
  const titleEl = el.querySelector('.dropzone-title');
  const hintEl = el.querySelector('.dropzone-hint');
  const metaEl = el.querySelector('.dropzone-meta');
  // Container for the compact bar's Replace / Add more / Clear buttons.
  const compactActions = document.createElement('div');
  compactActions.className = 'compact-actions';
  el.append(compactActions);

  const emptyTitle = opts.title || 'Drop a file here';
  const emptyHint = opts.hint || 'or <span class="dropzone-browse">choose from your device</span>';

  input.multiple = Boolean(opts.multiple);
  if (opts.accept) input.accept = opts.accept;
  titleEl.textContent = emptyTitle;
  hintEl.innerHTML = emptyHint;
  if (opts.note) metaEl.textContent = opts.note;
  el.setAttribute('aria-label', opts.ariaLabel || emptyTitle);

  const emit = (list) => {
    const files = Array.from(list || []).filter(Boolean);
    if (files.length && typeof opts.onFiles === 'function') opts.onFiles(files);
  };

  const open = () => input.click();

  // Behaviour depends on state:
  //   empty -> the whole zone opens the picker (mouse or keyboard);
  //   compact -> the actions row is the only way in, so a click on the bar
  //              background does nothing (avoids nested-control surprises).
  el.addEventListener('click', (e) => {
    if (e.target === input) return;
    if (e.target.closest('button')) return;
    if (el.classList.contains('is-compact')) return;
    open();
  });
  el.addEventListener('keydown', (e) => {
    if (e.target !== el) return;
    if (el.classList.contains('is-compact')) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
  });

  input.addEventListener('change', () => {
    emit(input.files);
    input.value = '';
  });

  // Drag state: empty -> "Release to add" on drag-over (driven by the class).
  let depth = 0;
  el.addEventListener('dragenter', (e) => {
    e.preventDefault();
    depth += 1;
    el.classList.add('is-dragover');
    if (!el.classList.contains('is-compact')) titleEl.textContent = 'Release to add';
  });
  el.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  });
  el.addEventListener('dragleave', (e) => {
    e.preventDefault();
    depth = Math.max(0, depth - 1);
    if (depth === 0) endDrag();
  });
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    depth = 0;
    endDrag();
    emit(e.dataTransfer && e.dataTransfer.files);
  });

  function endDrag() {
    el.classList.remove('is-dragover');
    if (!el.classList.contains('is-compact')) titleEl.textContent = emptyTitle;
  }

  return {
    el,
    setMeta: (text) => { metaEl.textContent = text || ''; },
    /** Collapse to the compact bar and show Replace / Add more / Clear. */
    setCompact: (on, meta) => {
      el.classList.toggle('is-compact', Boolean(on));
      if (on) {
        el.setAttribute('tabindex', '-1');
        el.setAttribute('role', 'group');
        titleEl.textContent = 'Files added';
        if (meta != null) metaEl.textContent = meta;
      } else {
        el.setAttribute('tabindex', '0');
        el.setAttribute('role', 'button');
        titleEl.textContent = emptyTitle;
        compactActions.replaceChildren();
        metaEl.textContent = opts.note || '';
      }
    },
    setEmptyTitle: (text) => { if (!el.classList.contains('is-compact')) titleEl.textContent = text; },
    open,
    reset: () => { metaEl.textContent = opts.note || ''; },
    /** Replace the compact bar's actions with a fresh set of buttons. */
    setCompactActions: (buttons) => {
      compactActions.replaceChildren(...buttons);
    },
  };
}

/**
 * Build a small icon button with a functional glyph and an accessible label.
 * @param {keyof typeof GLYPHS} name
 * @param {string} label
 * @param {() => void} onClick
 */
export function iconButton(name, label, onClick) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn-icon';
  b.title = label;
  b.setAttribute('aria-label', label);
  b.append(glyph(GLYPHS[name] || GLYPHS.close));
  b.addEventListener('click', onClick);
  return b;
}

/**
 * Create the standard primary Download button for a tool.
 * Exactly one per view; always the only filled button.
 * @param {object} [opts]
 * @param {string} [opts.label]
 * @returns {{ el: HTMLButtonElement, setEnabled: (on: boolean) => void, setLabel: (t: string) => void }}
 */
export function createDownloadButton(opts = {}) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-primary';
  btn.disabled = true;
  const span = document.createElement('span');
  span.textContent = opts.label || 'Download';
  btn.append(span);
  return {
    el: btn,
    setEnabled: (on) => { btn.disabled = !on; },
    setLabel: (text) => { span.textContent = text; },
  };
}

/**
 * Trigger a browser download for a Blob or File without any server round-trip.
 * @param {Blob} blob
 * @param {string} filename
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'download';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** Human-readable byte size. */
export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) { value /= 1024; i += 1; }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[i]}`;
}