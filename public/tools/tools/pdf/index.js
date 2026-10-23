// PDF Merge / Split / Rotate — UI layer.
//
// Loaded lazily by the shell (see assets/tools.js -> load()). This module owns
// the DOM and the mode tabs only; the page grid, selection, rotation and
// reordering live in ./picker.js (pure logic in ./picker-state.js) and all PDF
// writing lives in ./pdf.js. pdf-lib is vendored at
// ../../vendor/pdf-lib/pdf-lib.min.js and injected as a plain <script> so it
// attaches window.PDFLib (no CDN, no bundler).
//
// Merge, Split and Rotate are three presets of the same picker grid: the text
// tabs stay, and the grid does the work. Split additionally offers "Split every
// N pages"; Rotate preselects every page.

import { createDropzone, createDownloadButton } from '../../assets/ui.js';
import { assetUrl } from '../../assets/assetUrl.js';
import { createPicker } from './picker.js';

// Resolve the vendored script against THIS module, not the document: a bare
// '../../vendor/...' handed to script.src would be resolved by the browser
// against the page, so the app broke when served from a sub-path (review F07).
const PDFLIB_URL = assetUrl('../../vendor/pdf-lib/pdf-lib.min.js', import.meta.url);
let libPromise = null;

/** Inject vendor/pdf-lib once, resolving with window.PDFLib. */
function loadPdfLib() {
  if (window.PDFLib) return Promise.resolve(window.PDFLib);
  if (libPromise) return libPromise;
  libPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-pdflib]`);
    const script = existing || document.createElement('script');
    script.src = PDFLIB_URL;
    script.async = true;
    script.dataset.pdflib = '1';
    script.addEventListener('load', () => {
      if (window.PDFLib) resolve(window.PDFLib);
      else reject(new Error('pdf-lib loaded but did not expose window.PDFLib'));
    });
    script.addEventListener('error', () => {
      libPromise = null;
      reject(new Error('Could not load the bundled pdf-lib library.'));
    });
    if (!existing) document.head.appendChild(script);
  });
  return libPromise;
}

const OPERATIONS = [
  { id: 'merge', label: 'Merge', help: 'Combine two or more PDFs, in the order you add them.' },
  { id: 'split', label: 'Split', help: 'Copy pages into separate PDFs — every N pages, or the selection.' },
  { id: 'rotate', label: 'Rotate', help: 'Rotate pages; every page starts selected.' },
];

export function mount(root) {
  const state = { op: 'merge', busy: false };

  /* ---- structure ---- */
  const wrap = el('div', 'stack pdf-tool');

  const opRow = el('div', 'tabs');
  opRow.setAttribute('role', 'tablist');
  opRow.setAttribute('aria-label', 'Operation');
  const opHelp = el('p', 'field-hint');
  const tabs = new Map();
  for (const op of OPERATIONS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tab';
    b.setAttribute('role', 'tab');
    b.dataset.op = op.id;
    b.textContent = op.label;
    b.addEventListener('click', () => setOp(op.id));
    tabs.set(op.id, b);
    opRow.append(b);
  }
  const tabHead = el('div', 'stack-sm');
  tabHead.append(opRow, opHelp);

  const dz = createDropzone({
    multiple: true,
    accept: 'application/pdf,.pdf',
    title: 'Drop a PDF here',
    note: 'PDF files \u00B7 up to 100 MB each',
    ariaLabel: 'Choose PDF files or drop them here',
    onFiles: (files) => picker.addFiles(files),
  });

  const pickerHost = el('div', 'picker-host');
  const primary = createDownloadButton({ label: 'Download PDF' });
  primary.el.disabled = true;
  primary.el.addEventListener('click', () => picker.downloadPrimary());

  const status = el('p', 'status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');

  const actions = el('div', 'status-row row');
  actions.append(primary.el, status);

  wrap.append(tabHead, dz.el, pickerHost, actions);
  root.append(wrap);

  const picker = createPicker(pickerHost, {
    loadPdfLib: async () => {
      await loadPdfLib();
      return window.PDFLib;
    },
  });

  /* ---- helpers ---- */
  function el(tag, cls) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }

  function setStatus(text, kind) {
    status.textContent = text || '';
    status.className = 'status' + (kind ? ` is-${kind}` : '');
  }

  function setOp(id) {
    if (state.busy || state.op === id) return;
    state.op = id;
    for (const [key, btn] of tabs) {
      const on = key === id;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    }
    const info = OPERATIONS.find((o) => o.id === id);
    opHelp.textContent = info ? info.help : '';
    picker.setMode(id);
    updatePrimary();
  }

  function updatePrimary() {
    const { total } = picker.counts();
    primary.setEnabled(total > 0);
    primary.setLabel('Download PDF');
  }

  // The picker can change the remaining page count after edits; poll the
  // primary button whenever the grid re-renders.
  const observer = new MutationObserver(() => updatePrimary());
  observer.observe(pickerHost, { childList: true, subtree: true });

  /* ---- init ---- */
  setOp('merge');
  setStatus('');
  updatePrimary();
  loadPdfLib().catch(() => setStatus('Couldn\u2019t load the bundled PDF library.', 'bad'));

  // Lifecycle (review F09): the shell calls this before clearing the mount and
  // whenever the tool is left. It releases everything the picker owns outside
  // the mount subtree: the floating bar on document.body, the Intersection
  // Observers, the pdf.js document proxies and any queued thumbnail work.
  return function unmount() {
    observer.disconnect();
    picker.destroy();
  };
}