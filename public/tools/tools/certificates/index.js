import { createDropzone, createDownloadButton, downloadBlob, formatBytes } from '../../assets/ui.js';
import { assetUrl } from '../../assets/assetUrl.js';
import { parseNames, generateCertificates } from './logic.js';
import { zipStore } from '../imgpdf/zip.js';
import { visibleBox, rotationOf, visualSize } from '../signpdf/logic.js';

const PDFLIB_URL = assetUrl('../../vendor/pdf-lib/pdf-lib.min.js', import.meta.url);
const PDFJS_URL = assetUrl('../../vendor/pdfjs/pdf.min.js', import.meta.url);
const WORKER_URL = assetUrl('../../vendor/pdfjs/pdf.worker.min.js', import.meta.url);
let libPromise, jsPromise;
function loadLib() {
  if (window.PDFLib) return Promise.resolve(window.PDFLib);
  if (!libPromise) libPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-pdflib]');
    const script = existing || document.createElement('script');
    script.src = PDFLIB_URL; script.dataset.pdflib = '1';
    script.addEventListener('load', () => window.PDFLib ? resolve(window.PDFLib) : reject(new Error('Bundled PDF library unavailable.')), { once: true });
    script.addEventListener('error', () => { libPromise = null; reject(new Error('Bundled PDF library unavailable.')); }, { once: true });
    if (!existing) document.head.append(script);
  });
  return libPromise;
}
function loadJs() {
  if (!jsPromise) jsPromise = import(/* @vite-ignore */ PDFJS_URL).then((js) => { js.GlobalWorkerOptions.workerSrc = WORKER_URL; return js; })
    .catch((error) => { jsPromise = null; throw error; });
  return jsPromise;
}
function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
}
function field(label, control) {
  const node = el('label', 'field'); node.append(el('span', 'field-label', label), control); return node;
}
function button(label, action) {
  const node = el('button', 'btn btn-secondary', label); node.type = 'button'; node.addEventListener('click', action); return node;
}
function number(value) {
  const node = el('input', 'field-input'); node.type = 'number'; node.step = 'any'; node.min = '0'; node.value = value; return node;
}

export function mount(root) {
  let template = null, proxy = null, renderTask = null, bitmap = null, destroyed = false, generation = 0, busy = false;
  let visual = null, output = null;
  const wrap = el('div', 'stack certificates-tool');
  const drop = createDropzone({ multiple: false, accept: 'application/pdf,image/png,image/jpeg,image/webp,.pdf,.png,.jpg,.jpeg,.webp',
    title: 'Drop a certificate template here', note: 'PDF first page, PNG, JPG or WebP · processed locally',
    ariaLabel: 'Choose a PDF or image certificate template', onFiles: (files) => openTemplate(files[0]) });
  const errors = el('div');
  const options = el('section', 'panel stack-sm'); options.hidden = true;
  options.append(el('h2', 'panel-title', 'Certificate options'));
  const csv = el('textarea', 'field-input'); csv.rows = 5; csv.placeholder = 'name\nAda Lovelace\nGrace Hopper';
  const csvFile = el('input', 'field-input'); csvFile.type = 'file'; csvFile.accept = '.csv,text/csv';
  const rowCount = el('p', 'field-hint', 'Paste names or choose a UTF-8 CSV. First column or a name header; up to 500 names.');
  const help = el('p', 'field-hint', 'Click the first-page preview to center a name, or enter X and Y in points from the visible top-left corner.');
  const frame = el('div', 'certificates-frame');
  const canvas = el('canvas', 'certificates-preview');
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'Template preview; click to center the name. Use X and Y fields for keyboard placement.');
  const marker = el('span', 'certificates-marker'); marker.setAttribute('aria-hidden', 'true');
  frame.append(canvas, marker);
  const coords = el('div', 'field-grid');
  const x = number('0'), y = number('0'), size = number('24'); size.min = '1'; size.max = '300';
  const color = el('input', 'field-input'); color.type = 'color'; color.value = '#1d1b17';
  const font = el('select', 'field-select');
  for (const [value, label] of [['Helvetica', 'Helvetica'], ['TimesRoman', 'Times Roman'], ['Courier', 'Courier']]) {
    const opt = el('option', '', label); opt.value = value; font.append(opt);
  }
  const format = el('select', 'field-select');
  for (const [value, label] of [['zip', 'Separate PDFs in a ZIP'], ['merged', 'One merged PDF']]) {
    const opt = el('option', '', label); opt.value = value; format.append(opt);
  }
  coords.append(field('X center (pt)', x), field('Y center (pt)', y), field('Font size (pt)', size), field('Text color', color), field('Font', font), field('Output', format));
  options.append(field('Names (CSV)', csv), field('Or choose a CSV file', csvFile), rowCount, help, frame, coords);
  const actions = el('div', 'status-row row');
  const primary = createDownloadButton({ label: 'Download certificates' });
  const clear = button('Clear', reset); clear.className = 'btn btn-text';
  const status = el('p', 'status', 'Add a PDF or image template to begin.'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  actions.append(primary.el, clear, status);
  wrap.append(drop.el, errors, options, actions); root.append(wrap);

  function setStatus(text, kind = '') { status.textContent = text; status.className = `status${kind ? ` is-${kind}` : ''}`; }
  function fail(text) {
    errors.replaceChildren(); const block = el('div', 'block block-error'); block.setAttribute('role', 'alert');
    block.append(el('span', 'block-lead', 'Could not generate certificates.'), el('span', 'block-detail', text)); errors.append(block);
    setStatus('Could not generate certificates.', 'bad');
  }
  function release() {
    renderTask?.cancel(); renderTask = null;
    proxy?.destroy(); proxy = null; bitmap?.close(); bitmap = null;
    canvas.width = canvas.height = 0; visual = null; template = null; output = null;
  }
  function reset() {
    generation++; release(); errors.replaceChildren(); options.hidden = true; drop.setCompact(false);
    csv.value = ''; csvFile.value = ''; primary.setEnabled(false); setStatus('Add a PDF or image template to begin.');
  }
  function syncMarker() {
    if (!visual) return;
    marker.style.left = `${Number(x.value) / visual.width * 100}%`;
    marker.style.top = `${Number(y.value) / visual.height * 100}%`;
  }
  canvas.addEventListener('click', (event) => {
    if (!visual || busy) return;
    const rect = canvas.getBoundingClientRect();
    x.value = String(Math.round(Math.max(0, Math.min(visual.width, (event.clientX - rect.left) / rect.width * visual.width)) * 10) / 10);
    y.value = String(Math.round(Math.max(0, Math.min(visual.height, (event.clientY - rect.top) / rect.height * visual.height)) * 10) / 10);
    syncMarker(); output = null;
  });
  for (const control of [x, y, csv, size, color, font, format]) control.addEventListener('input', () => { output = null; syncMarker(); updateNames(); });
  function updateNames() {
    try { rowCount.textContent = `${parseNames(csv.value).length} names ready (maximum 500).`; }
    catch { rowCount.textContent = 'Check CSV quoting before export.'; }
  }
  csvFile.addEventListener('change', async () => {
    const file = csvFile.files?.[0]; if (!file) return;
    const token = generation;
    try {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
      if (destroyed || token !== generation) return;
      csv.value = text; output = null; updateNames(); errors.replaceChildren();
    } catch { if (!destroyed && token === generation) fail('Choose a UTF-8 encoded CSV file.'); }
  });
  async function openTemplate(file) {
    if (!file || destroyed || busy) return;
    const token = ++generation;
    let nextProxy = null, nextBitmap = null, nextTask = null;
    errors.replaceChildren(); setStatus('Reading template...');
    try {
      const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      const isImage = /\.(png|jpe?g|webp)$/i.test(file.name) || ['image/png', 'image/jpeg', 'image/webp'].includes(file.type);
      if (!isPdf && !isImage) throw new Error('Choose a PDF, PNG, JPG or WebP template.');
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (destroyed || token !== generation) return;
      let nextTemplate, nextVisual;
      if (isPdf) {
        if (String.fromCharCode(...bytes.subarray(0, 5)) !== '%PDF-') throw new Error('This is not a valid PDF.');
        const lib = await loadLib();
        const source = await lib.PDFDocument.load(bytes);
        if (!source.getPageCount()) throw new Error('This PDF has no pages.');
        const page = source.getPage(0), box = visibleBox(page);
        nextVisual = visualSize(box, rotationOf(page));
        const js = await loadJs();
        nextProxy = await js.getDocument({ data: bytes.slice(), disableAutoFetch: true, disableStream: true, verbosity: 0 }).promise;
        nextTemplate = { pdf: bytes };
      } else {
        if (typeof window.createImageBitmap !== 'function') throw new Error('This browser cannot decode images.');
        nextBitmap = await window.createImageBitmap(file);
        if (!nextBitmap.width || !nextBitmap.height) throw new Error('Image has no pixels.');
        const scale = Math.min(1, 640 / nextBitmap.width);
        nextVisual = { width: nextBitmap.width, height: nextBitmap.height };
        // Encode decoded pixels once so orientation and preview agree for all image types.
        nextTemplate = { image: { type: 'image/png', bytes: null, width: nextBitmap.width, height: nextBitmap.height } };
        const full = document.createElement('canvas'); full.width = nextBitmap.width; full.height = nextBitmap.height;
        try {
          full.getContext('2d').drawImage(nextBitmap, 0, 0);
          const fullPng = await new Promise((resolve, reject) => full.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not convert image.')), 'image/png'));
          nextTemplate.image.bytes = new Uint8Array(await fullPng.arrayBuffer());
        } finally { full.width = full.height = 0; }
      }
      if (destroyed || token !== generation) return;
      if (isPdf) {
        const page = await nextProxy.getPage(1); const base = page.getViewport({ scale: 1 });
        const view = page.getViewport({ scale: Math.min(1, 640 / base.width) });
        canvas.width = Math.ceil(view.width); canvas.height = Math.ceil(view.height);
        nextTask = page.render({ canvasContext: canvas.getContext('2d'), viewport: view });
        await nextTask.promise; nextTask = null; page.cleanup();
      } else {
        const scale = Math.min(1, 640 / nextBitmap.width);
        canvas.width = Math.ceil(nextBitmap.width * scale); canvas.height = Math.ceil(nextBitmap.height * scale);
        canvas.getContext('2d').drawImage(nextBitmap, 0, 0, canvas.width, canvas.height);
      }
      if (destroyed || token !== generation) return;
      renderTask?.cancel(); proxy?.destroy(); bitmap?.close();
      proxy = nextProxy; nextProxy = null; bitmap = nextBitmap; nextBitmap = null;
      template = nextTemplate; visual = nextVisual; output = null;
      x.value = String(Math.round(visual.width / 2)); y.value = String(Math.round(visual.height / 2)); syncMarker();
      options.hidden = false; drop.setCompact(true, `1 file · ${formatBytes(file.size)}`);
      drop.setCompactActions([button('Replace', () => drop.open())]); primary.setEnabled(true);
      setStatus(`Template ready: ${file.name}. First page only.`);
    } catch (error) {
      if (!destroyed && token === generation) fail(/password|encrypt/i.test(String(error)) ? 'Password-protected PDFs are not supported.' : /Choose a|not a valid|no pages|no pixels|cannot decode/.test(error.message) ? error.message : 'Template is damaged or could not be decoded.');
    } finally { nextTask?.cancel(); nextProxy?.destroy(); nextBitmap?.close(); }
  }
  primary.el.addEventListener('click', async () => {
    if (!template || busy) return;
    const token = generation;
    errors.replaceChildren();
    try {
      const rows = parseNames(csv.value);
      if (!rows.length) throw new RangeError('Paste or import at least one name.');
      if (![x, y, size].every((input) => input.value.trim())) throw new RangeError('Enter X, Y and font size.');
      if (!Number.isFinite(Number(x.value)) || !Number.isFinite(Number(y.value))) throw new RangeError('Enter valid X and Y coordinates.');
      busy = true; primary.setEnabled(false); primary.setLabel('Working...'); setStatus(`Working... 0 of ${rows.length} names`);
      const lib = await loadLib();
      const result = await generateCertificates(template, rows, { x: x.value, y: y.value, size: size.value, color: color.value, font: font.value }, lib, format.value === 'merged',
        (done, total) => { if (!destroyed && token === generation) setStatus(`Working... ${done} of ${total} names`); });
      if (destroyed || token !== generation) return;
      if (result.errors.length) {
        const block = el('div', 'block block-error'); block.setAttribute('role', 'alert');
        block.append(el('span', 'block-lead', `${result.errors.length} names skipped.`));
        const list = el('ul');
        for (const { row, name, reason } of result.errors) list.append(el('li', '', `Row ${row}: ${name} - ${reason}`));
        block.append(list); errors.append(block);
      }
      const bytes = format.value === 'merged' ? result.merged : result.files.length ? zipStore(result.files) : null;
      if (!bytes) { if (!result.errors.length) fail('No certificates could be generated.'); return; }
      output = { bytes, name: format.value === 'merged' ? 'certificates.pdf' : 'certificates.zip', mime: format.value === 'merged' ? 'application/pdf' : 'application/zip' };
      downloadBlob(new Blob([bytes], { type: output.mime }), output.name);
      setStatus(`Done: ${format.value === 'merged' ? rows.length - result.errors.length : result.files.length} certificates, ${result.errors.length} skipped. ${formatBytes(bytes.length)}.`, result.errors.length ? 'bad' : 'ok');
      primary.el.focus();
    } catch (error) {
      if (!destroyed) fail(error instanceof RangeError ? error.message : 'Export failed. Check the template and try again.');
    } finally { busy = false; if (!destroyed) { primary.setLabel('Download certificates'); primary.setEnabled(Boolean(template)); } }
  });
  primary.setEnabled(false);
  return () => { destroyed = true; generation++; release(); };
}
