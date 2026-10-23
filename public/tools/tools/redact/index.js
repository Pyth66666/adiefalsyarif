import { createDropzone, createDownloadButton, downloadBlob, formatBytes } from '../../assets/ui.js';
import { assetUrl } from '../../assets/assetUrl.js';
import { clampRect, flattenPixels, rebuildPdf } from './logic.js';

const PDFJS_URL = assetUrl('../../vendor/pdfjs/pdf.min.js', import.meta.url);
const WORKER_URL = assetUrl('../../vendor/pdfjs/pdf.worker.min.js', import.meta.url);
const PDFLIB_URL = assetUrl('../../vendor/pdf-lib/pdf-lib.min.js', import.meta.url);
let jsPromise, libPromise;
function loadPdfjs() {
  if (!jsPromise) jsPromise = import(/* @vite-ignore */ PDFJS_URL).then((js) => {
    js.GlobalWorkerOptions.workerSrc = WORKER_URL;
    return js;
  }).catch((error) => { jsPromise = null; throw error; });
  return jsPromise;
}
function loadPdfLib() {
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
function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
}
function button(label, action) {
  const node = el('button', 'btn btn-secondary', label);
  node.type = 'button'; node.addEventListener('click', action);
  return node;
}
function field(label, control) {
  const node = el('label', 'field'); node.append(el('span', 'field-label', label), control);
  return node;
}
function numberInput(value) {
  const node = el('input', 'field-input'); node.type = 'number'; node.min = '0'; node.max = '100';
  node.step = 'any'; node.value = value;
  return node;
}
function canvasBlob(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not encode the canvas.')), 'image/png'));
}

export function mount(root) {
  let pdf = null, bitmap = null, file = null, destroyed = false, generation = 0;
  let currentPage = 1, renderTask = null, working = false, drag = null;
  const rects = new Map();
  const wrap = el('div', 'stack redact-tool');
  const drop = createDropzone({ multiple: false, accept: 'image/png,image/jpeg,image/webp,application/pdf,.png,.jpg,.jpeg,.webp,.pdf',
    title: 'Drop an image or PDF here', note: 'PNG, JPG, WebP or PDF · processed locally',
    ariaLabel: 'Choose an image or PDF or drop it here', onFiles: (files) => openFile(files[0]) });
  const error = el('div');
  const options = el('section', 'panel stack-sm'); options.hidden = true;
  options.append(el('h2', 'panel-title', 'Redaction options'));
  const help = el('p', 'field-hint', 'Drag on the preview to mark a region, or enter its bounds below. Black boxes conceal content best. Pixelation replaces pixels but may leave shapes recognizable. Export rebuilds every PDF page from pixels only; selectable text and original metadata are removed.');
  const mode = el('select', 'field-select');
  for (const [value, text] of [['black', 'Solid black box'], ['pixelate', 'Pixelate']]) {
    const option = el('option', '', text); option.value = value; mode.append(option);
  }
  const pageInput = el('input', 'field-input'); pageInput.type = 'number'; pageInput.min = '1'; pageInput.step = '1'; pageInput.value = '1';
  const pageRow = el('div', 'row');
  const previous = button('Previous page', () => changePage(currentPage - 1));
  const next = button('Next page', () => changePage(currentPage + 1));
  const pageLabel = el('span', 'field-hint'); pageRow.append(previous, next, pageLabel);
  const pageControls = el('div', 'stack-sm'); pageControls.append(field('PDF page', pageInput), pageRow);
  const inputs = [numberInput('10'), numberInput('10'), numberInput('30'), numberInput('20')];
  const coords = el('div', 'field-grid');
  for (const [index, label] of ['Left (%)', 'Top (%)', 'Width (%)', 'Height (%)'].entries()) coords.append(field(label, inputs[index]));
  const add = button('Add rectangle', () => {
    const [x, y, width, height] = inputs.map((input) => Number(input.value));
    if (!inputs.every((input) => input.value.trim()) || ![x, y, width, height].every(Number.isFinite) || x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 100 || y + height > 100) {
      fail('Enter a rectangle with positive width and height inside the page.'); return;
    }
    addRect({ x: x / 100, y: y / 100, width: width / 100, height: height / 100 });
  });
  const undo = button('Undo last rectangle', () => {
    const list = rects.get(currentPage) || []; list.pop(); drawOverlay(); updateCount();
  });
  const clearPage = button('Clear page rectangles', () => { rects.delete(currentPage); drawOverlay(); updateCount(); });
  const editActions = el('div', 'row'); editActions.append(add, undo, clearPage);
  const count = el('p', 'field-hint'); count.setAttribute('aria-live', 'polite');
  options.append(help, field('Redaction mode', mode), pageControls, coords, editActions, count);

  const frame = el('div', 'redact-frame'); frame.hidden = true;
  const preview = el('canvas', 'redact-preview');
  const overlay = el('canvas', 'redact-overlay');
  overlay.setAttribute('role', 'img'); overlay.setAttribute('aria-label', 'Page preview; drag to mark a rectangle. Use the labeled percentage fields for keyboard input.');
  frame.append(preview, overlay);
  const actions = el('div', 'status-row row');
  const primary = createDownloadButton({ label: 'Download redacted file' });
  const clear = button('Clear', reset); clear.className = 'btn btn-text';
  const status = el('p', 'status', 'Add an image or PDF to begin.');
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  actions.append(primary.el, clear, status);
  wrap.append(drop.el, error, options, frame, actions); root.append(wrap);

  function setStatus(text, kind = '') { status.textContent = text; status.className = `status${kind ? ` is-${kind}` : ''}`; }
  function fail(text) {
    error.replaceChildren(); const block = el('div', 'block block-error'); block.setAttribute('role', 'alert');
    block.append(el('span', 'block-lead', 'Could not process this file.'), el('span', 'block-detail', text));
    error.append(block); setStatus('Could not process this file.', 'bad');
  }
  function release() {
    renderTask?.cancel(); renderTask = null;
    pdf?.destroy(); pdf = null;
    bitmap?.close(); bitmap = null;
    preview.width = preview.height = overlay.width = overlay.height = 0;
    file = null; rects.clear(); drag = null;
  }
  function reset() {
    generation++; release(); error.replaceChildren(); options.hidden = frame.hidden = true;
    drop.setCompact(false); pageControls.hidden = true;
    primary.setEnabled(false); setStatus('Add an image or PDF to begin.');
  }
  async function openFile(candidate) {
    if (!candidate || destroyed || working) return;
    const token = ++generation;
    error.replaceChildren(); setStatus('Reading file…');
    let nextPdf = null, nextBitmap = null;
    try {
      const isPdf = candidate.type === 'application/pdf' || /\.pdf$/i.test(candidate.name);
      const isImage = ['image/png', 'image/jpeg', 'image/webp'].includes(candidate.type) || /\.(png|jpe?g|webp)$/i.test(candidate.name);
      if (!isPdf && !isImage) throw new Error('Choose a PNG, JPG, WebP or PDF.');
      if (isPdf) {
        const data = new Uint8Array(await candidate.arrayBuffer());
        if (destroyed || token !== generation) return;
        if (String.fromCharCode(...data.subarray(0, 5)) !== '%PDF-') throw new Error('This is not a valid PDF.');
        const js = await loadPdfjs();
        if (destroyed || token !== generation) return;
        const task = js.getDocument({ data, disableAutoFetch: true, disableStream: true, verbosity: 0 });
        nextPdf = await task.promise;
        if (!nextPdf.numPages) throw new Error('This PDF has no pages.');
      } else {
        nextBitmap = await createImageBitmap(candidate);
        if (!nextBitmap.width || !nextBitmap.height) throw new Error('This image has no pixels.');
      }
      if (destroyed || token !== generation) return;
      release(); pdf = nextPdf; bitmap = nextBitmap; file = candidate; currentPage = 1;
      nextPdf = null; nextBitmap = null;
      pageInput.max = String(pdf?.numPages || 1); pageInput.value = '1';
      pageControls.hidden = !pdf;
      options.hidden = frame.hidden = false;
      drop.setCompact(true, `1 file · ${formatBytes(candidate.size)}`);
      const replace = button('Replace', () => drop.open()); replace.className = 'btn btn-text';
      drop.setCompactActions([replace]);
      setStatus(`Added ${candidate.name}.`); primary.setEnabled(true);
      await renderPreview(token);
    } catch (err) {
      if (!destroyed && token === generation) fail(/password|encrypt/i.test(String(err)) ? 'Password-protected PDFs cannot be opened.' : /Choose a|not a valid PDF|has no pixels/.test(String(err.message)) ? err.message : 'The file is damaged or could not be decoded. Try another file.');
    } finally { nextPdf?.destroy(); nextBitmap?.close(); }
  }
  function viewport(page) {
    const base = page.getViewport({ scale: 1 });
    return page.getViewport({ scale: Math.min(2, 4096 / Math.max(base.width, base.height)) });
  }
  async function renderPreview(token) {
    if (pdf) {
      const page = await pdf.getPage(currentPage);
      if (destroyed || token !== generation) return;
      const view = viewport(page);
      preview.width = Math.max(1, Math.round(view.width)); preview.height = Math.max(1, Math.round(view.height));
      renderTask = page.render({ canvasContext: preview.getContext('2d'), viewport: view, background: 'rgb(255,255,255)' });
      await renderTask.promise;
      renderTask = null; page.cleanup();
    } else {
      preview.width = bitmap.width; preview.height = bitmap.height;
      preview.getContext('2d').drawImage(bitmap, 0, 0);
    }
    if (destroyed || token !== generation) return;
    overlay.width = preview.width; overlay.height = preview.height;
    pageLabel.textContent = `Page ${currentPage} of ${pdf?.numPages || 1}`;
    previous.disabled = currentPage <= 1; next.disabled = currentPage >= (pdf?.numPages || 1);
    drawOverlay(); updateCount(); setStatus(`Page ${currentPage} ready. Drag or enter rectangle bounds.`);
  }
  function changePage(number) {
    if (!pdf || working || !Number.isInteger(number) || number < 1 || number > pdf.numPages) return;
    currentPage = number; pageInput.value = String(number);
    renderTask?.cancel(); renderTask = null;
    const token = ++generation; setStatus(`Rendering page ${number}…`);
    renderPreview(token).catch((err) => { if (!destroyed && token === generation && err?.name !== 'RenderingCancelledException') fail('This page could not be rendered.'); });
  }
  pageInput.addEventListener('change', () => {
    const number = Number(pageInput.value);
    if (!Number.isInteger(number) || number < 1 || number > pdf?.numPages) {
      pageInput.value = String(currentPage);
      fail(`Choose a page from 1 to ${pdf?.numPages || 1}.`);
      return;
    }
    changePage(number);
  });
  function updateCount() {
    const total = [...rects.values()].reduce((sum, list) => sum + list.length, 0);
    count.textContent = `${rects.get(currentPage)?.length || 0} rectangles on this page; ${total} total.`;
    undo.disabled = !(rects.get(currentPage)?.length); clearPage.disabled = undo.disabled;
  }
  function addRect(rect) {
    if (!preview.width || !clampRect({ x: rect.x * preview.width, y: rect.y * preview.height, width: rect.width * preview.width, height: rect.height * preview.height }, preview.width, preview.height)) return;
    const list = rects.get(currentPage) || []; list.push(rect); rects.set(currentPage, list);
    error.replaceChildren(); drawOverlay(); updateCount();
    setStatus('Rectangle added. Download to permanently flatten the result.');
  }
  function drawOverlay(pending) {
    const ctx = overlay.getContext('2d'); ctx.clearRect(0, 0, overlay.width, overlay.height);
    const style = getComputedStyle(document.documentElement);
    ctx.fillStyle = style.getPropertyValue('--select-tint');
    ctx.strokeStyle = style.getPropertyValue('--accent'); ctx.lineWidth = 3;
    for (const rect of [...(rects.get(currentPage) || []), ...(pending ? [pending] : [])]) {
      const x = rect.x * overlay.width, y = rect.y * overlay.height;
      const w = rect.width * overlay.width, h = rect.height * overlay.height;
      ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);
    }
  }
  function pointer(event) {
    const box = overlay.getBoundingClientRect();
    return { x: Math.max(0, Math.min(1, (event.clientX - box.left) / box.width)), y: Math.max(0, Math.min(1, (event.clientY - box.top) / box.height)) };
  }
  overlay.addEventListener('pointerdown', (event) => {
    if (working || !overlay.width) return;
    event.preventDefault(); overlay.setPointerCapture(event.pointerId); drag = pointer(event);
  });
  overlay.addEventListener('pointermove', (event) => {
    if (!drag) return;
    const end = pointer(event); drawOverlay({ x: Math.min(drag.x, end.x), y: Math.min(drag.y, end.y), width: Math.abs(end.x - drag.x), height: Math.abs(end.y - drag.y) });
  });
  overlay.addEventListener('pointerup', (event) => {
    if (!drag) return;
    const end = pointer(event);
    const rect = { x: Math.min(drag.x, end.x), y: Math.min(drag.y, end.y), width: Math.abs(end.x - drag.x), height: Math.abs(end.y - drag.y) };
    drag = null; addRect(rect); drawOverlay();
  });
  overlay.addEventListener('pointercancel', () => { drag = null; drawOverlay(); });

  async function flattenedCanvas(canvas, regions) {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const boxes = regions.map((rect) => ({ x: rect.x * canvas.width, y: rect.y * canvas.height, width: rect.width * canvas.width, height: rect.height * canvas.height }));
    const pixels = flattenPixels(image.data, canvas.width, canvas.height, boxes, mode.value);
    const fresh = document.createElement('canvas'); fresh.width = canvas.width; fresh.height = canvas.height;
    fresh.getContext('2d').putImageData(new ImageData(pixels, fresh.width, fresh.height), 0, 0);
    const blob = await canvasBlob(fresh);
    fresh.width = fresh.height = 0;
    return blob;
  }
  primary.el.addEventListener('click', async () => {
    if (!file || working) return;
    working = true; primary.setEnabled(false); primary.setLabel('Working…'); error.replaceChildren();
    const token = generation;
    try {
      const baseName = file.name.replace(/\.[^.]+$/, '') || 'redacted';
      if (!pdf) {
        setStatus('Flattening image pixels…');
        const blob = await flattenedCanvas(preview, rects.get(1) || []);
        if (destroyed || token !== generation) return;
        downloadBlob(blob, `${baseName}-redacted.png`);
        setStatus(`Done · ${formatBytes(blob.size)}.`, 'ok');
      } else {
        const lib = await loadPdfLib(), pages = [];
        for (let number = 1; number <= pdf.numPages; number++) {
          if (destroyed || token !== generation) return;
          setStatus(`Working… ${number} of ${pdf.numPages} pages`);
          const page = await pdf.getPage(number), view = viewport(page);
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(view.width)); canvas.height = Math.max(1, Math.round(view.height));
          renderTask = page.render({ canvasContext: canvas.getContext('2d'), viewport: view, background: 'rgb(255,255,255)' });
          await renderTask.promise; renderTask = null; page.cleanup();
          if (destroyed || token !== generation) return;
          const png = await flattenedCanvas(canvas, rects.get(number) || []);
          canvas.width = canvas.height = 0;
          pages.push({ png: new Uint8Array(await png.arrayBuffer()), width: page.getViewport({ scale: 1 }).width, height: page.getViewport({ scale: 1 }).height });
        }
        const bytes = await rebuildPdf(pages, lib);
        if (destroyed || token !== generation) return;
        downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `${baseName}-redacted.pdf`);
        setStatus(`Done · ${pages.length} pages · ${formatBytes(bytes.length)}.`, 'ok');
      }
      primary.el.focus();
    } catch (err) { if (!destroyed && token === generation) fail('Export failed. Check that the file can be rendered and try again.'); }
    finally { working = false; if (!destroyed) { primary.setLabel('Download redacted file'); primary.setEnabled(Boolean(file)); } }
  });
  reset();
  return () => { destroyed = true; generation++; release(); };
}
