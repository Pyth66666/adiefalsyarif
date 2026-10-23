import { createDropzone, createDownloadButton, downloadBlob, formatBytes } from '../../assets/ui.js';
import { assetUrl } from '../../assets/assetUrl.js';
import { addPageNumbers, addSignature, inkBounds, previewToPoints, visibleBox, visualSize, rotationOf } from './logic.js';

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
  if (!jsPromise) jsPromise = import(/* @vite-ignore */ PDFJS_URL).then((js) => {
    js.GlobalWorkerOptions.workerSrc = WORKER_URL;
    return js;
  }).catch((error) => { jsPromise = null; throw error; });
  return jsPromise;
}
function el(tag, cls, text) {
  const element = document.createElement(tag);
  if (cls) element.className = cls;
  if (text) element.textContent = text;
  return element;
}
function field(label, control) {
  const wrap = el('label', 'field');
  wrap.append(el('span', 'field-label', label), control);
  return wrap;
}
function input(type, value, min, max) {
  const control = el('input', 'field-input');
  control.type = type; control.value = value;
  if (min !== undefined) control.min = min;
  if (max !== undefined) control.max = max;
  return control;
}
function select(entries) {
  const control = el('select', 'field-select');
  for (const [value, name] of entries) {
    const option = el('option', '', name); option.value = value; control.append(option);
  }
  return control;
}
function checkbox(label) {
  const row = el('label', 'check-row'), control = input('checkbox', '');
  control.className = '';
  row.append(control, el('span', '', label));
  return { row, control };
}
function button(label, action) {
  const control = el('button', 'btn btn-secondary', label);
  control.type = 'button'; control.addEventListener('click', action);
  return control;
}

export function mount(root) {
  let file = null, bytes = null, pdfjsDoc = null, output = null, mode = 'number', destroyed = false, generation = 0;
  let previewTask = null, previewPage = null, signatureUrl = null, signaturePng = null, signatureAspect = 2;
  let strokes = [], currentStroke = null, placement = null, previewSize = null, pageBox = null;
  const wrap = el('div', 'stack signpdf-tool');
  const tabs = el('div', 'tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', 'PDF operation');
  const numberTab = el('button', 'tab', 'Page numbers'), signTab = el('button', 'tab', 'Sign');
  for (const tab of [numberTab, signTab]) { tab.type = 'button'; tab.setAttribute('role', 'tab'); tabs.append(tab); }
  const drop = createDropzone({ multiple: false, accept: 'application/pdf,.pdf', title: 'Drop a PDF here', note: 'One PDF · processed locally', ariaLabel: 'Choose a PDF or drop it here', onFiles: (files) => openFile(files[0]) });
  const error = el('div');
  const options = el('section', 'panel stack-sm');
  const title = el('h2', 'panel-title', 'Options');
  const numbers = el('div', 'field-grid'), signing = el('div', 'stack-sm');
  const format = select([['number', 'N'], ['page', 'Page N of M'], ['fraction', 'N / M']]);
  const position = select(['bottom-left', 'bottom-center', 'bottom-right', 'top-left', 'top-center', 'top-right'].map((v) => [v, v.replace('-', ' ')]));
  position.value = 'bottom-center';
  const size = input('number', '12', '1', '100');
  const margin = input('number', '24', '0');
  const start = input('number', '1');
  const range = input('text', ''); range.placeholder = 'All pages, or 1-3,5';
  const skip = checkbox('Skip first page');
  numbers.append(field('Format', format), field('Position', position), field('Font size (pt)', size), field('Margin (pt)', margin), field('Start number', start), field('Page range', range), skip.row);

  const note = el('p', 'field-hint', 'This is a visual image signature, NOT a certificate-based digital signature.');
  const editorTabs = el('div', 'tabs');
  const drawTab = button('Draw', () => setEditor('draw'));
  const typeTab = button('Type', () => setEditor('type'));
  drawTab.className = typeTab.className = 'tab'; editorTabs.append(drawTab, typeTab);
  const drawing = el('div', 'stack-sm');
  const inkCanvas = el('canvas', 'signpdf-ink'); inkCanvas.width = 600; inkCanvas.height = 180;
  inkCanvas.setAttribute('aria-label', 'Draw a signature; alternatively use Type');
  const lineWidth = input('range', '3', '1', '10');
  const inkActions = el('div', 'row');
  inkActions.append(button('Undo stroke', () => { strokes.pop(); redrawInk(); updateSignature(); }), button('Clear drawing', () => { strokes = []; redrawInk(); updateSignature(); }));
  drawing.append(inkCanvas, field('Line width', lineWidth), inkActions);
  const typing = el('div', 'field-grid');
  const typedName = input('text', ''); typedName.placeholder = 'Your name';
  const handwriting = select([['cursive', 'Script'], ['serif', 'Italic'], ['hand', 'Handwritten']]);
  typing.append(field('Name', typedName), field('Signature look', handwriting));
  const signaturePreview = el('div', 'signpdf-signature-preview');
  const pageField = input('number', '1', '1');
  const pageControls = el('div', 'row');
  const previous = button('Previous page', () => { pageField.value = String(Math.max(1, Number(pageField.value) - 1)); renderPreview(); });
  const next = button('Next page', () => { pageField.value = String(Math.min(pdfjsDoc?.numPages || 1, Number(pageField.value) + 1)); renderPreview(); });
  pageControls.append(previous, next);
  const previewHint = el('p', 'field-hint', 'Click the page to place the signature; drag it to move, or drag its corner to resize. X, Y and width use points from the visible top-left corner.');
  const previewFrame = el('div', 'signpdf-frame');
  const pageCanvas = el('canvas', 'signpdf-page');
  const overlay = el('div', 'signpdf-overlay');
  const signatureImage = el('img', 'signpdf-placed'); signatureImage.alt = 'Signature position'; signatureImage.draggable = false;
  const resize = el('span', 'signpdf-resize'); resize.setAttribute('aria-hidden', 'true');
  overlay.append(signatureImage, resize); previewFrame.append(pageCanvas, overlay);
  const xField = input('number', '24', '0'); xField.step = 'any';
  const yField = input('number', '24', '0'); yField.step = 'any';
  const widthField = input('number', '150', '1'); widthField.step = 'any';
  const coords = el('div', 'field-grid'); coords.append(field('X (pt)', xField), field('Y (pt)', yField), field('Width (pt)', widthField));
  const dateCheck = checkbox('Add date text beside signature');
  signing.append(note, editorTabs, drawing, typing, signaturePreview, field('PDF page', pageField), pageControls, previewHint, previewFrame, coords, dateCheck.row);
  options.append(title, numbers, signing);
  const actions = el('div', 'status-row row');
  const primary = createDownloadButton({ label: 'Download PDF' });
  const clear = button('Clear', () => reset()); clear.className = 'btn btn-text';
  const status = el('p', 'status', 'Add a PDF to begin.'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  actions.append(primary.el, clear, status);
  wrap.append(tabs, drop.el, error, options, actions); root.append(wrap);

  function statusText(text, kind = '') { status.textContent = text; status.className = `status${kind ? ` is-${kind}` : ''}`; }
  function fail(text) {
    error.replaceChildren();
    const block = el('div', 'block block-error'); block.setAttribute('role', 'alert');
    block.append(el('span', 'block-lead', 'Couldn’t process this PDF.'), el('span', 'block-detail', text));
    error.append(block); statusText('Couldn’t process this PDF.', 'bad');
  }
  function friendly(err) {
    const message = String(err?.message || err);
    if (/password|encrypt/i.test(message)) return 'This PDF is password-protected or encrypted and cannot be edited.';
    if (err instanceof RangeError) return message;
    if (/pdf|header|xref|parse|trailer|invalid/i.test(message)) return 'This PDF is damaged or is not a valid PDF.';
    return 'Check that the PDF is valid and try again.';
  }
  function setMode(nextMode) {
    if (mode !== nextMode) output = null;
    mode = nextMode;
    for (const [tab, active] of [[numberTab, mode === 'number'], [signTab, mode === 'sign']]) {
      tab.classList.toggle('is-active', active); tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1;
    }
    numbers.hidden = mode !== 'number'; signing.hidden = mode !== 'sign';
    if (mode === 'sign' && pdfjsDoc) renderPreview();
    primary.setEnabled(Boolean(file) && (mode === 'number' || Boolean(signaturePng)));
  }
  numberTab.addEventListener('click', () => setMode('number'));
  signTab.addEventListener('click', () => setMode('sign'));
  for (const tab of [numberTab, signTab]) tab.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault(); (tab === numberTab ? signTab : numberTab).click(); (tab === numberTab ? signTab : numberTab).focus();
  });
  let editor = 'draw';
  function setEditor(nextEditor) {
    editor = nextEditor;
    drawing.hidden = editor !== 'draw'; typing.hidden = editor !== 'type';
    drawTab.classList.toggle('is-active', editor === 'draw'); typeTab.classList.toggle('is-active', editor === 'type');
    updateSignature();
  }
  async function openFile(nextFile) {
    if (!nextFile || destroyed) return;
    const token = ++generation;
    if (!/\.pdf$/i.test(nextFile.name) && nextFile.type !== 'application/pdf') { fail('Choose a PDF file.'); return; }
    error.replaceChildren(); statusText('Reading PDF…');
    try {
      const data = new Uint8Array(await nextFile.arrayBuffer());
      if (destroyed || token !== generation) return;
      const lib = await loadLib();
      const parsed = await lib.PDFDocument.load(data);
      if (!parsed.getPageCount()) throw new Error('No PDF pages');
      const js = await loadJs();
      const task = js.getDocument({ data: data.slice(), disableAutoFetch: true, disableStream: true, verbosity: 0 });
      const documentProxy = await task.promise;
      if (destroyed || token !== generation) { await documentProxy.destroy(); return; }
      releasePdf();
      file = nextFile; bytes = data; pdfjsDoc = documentProxy; output = null;
      pageField.max = String(pdfjsDoc.numPages); pageField.value = '1';
      drop.setCompact(true, `1 file · ${formatBytes(nextFile.size)}`);
      drop.setCompactActions([button('Replace', () => drop.open())]);
      options.hidden = false; statusText(`Added ${nextFile.name} · ${pdfjsDoc.numPages} pages.`);
      setMode(mode);
    } catch (err) { if (!destroyed && token === generation) fail(friendly(err)); }
  }
  function releasePdf() {
    previewTask?.cancel(); previewTask = null;
    previewPage?.cleanup(); previewPage = null;
    pdfjsDoc?.destroy(); pdfjsDoc = null;
    pageCanvas.width = 0; pageCanvas.height = 0; previewSize = null; pageBox = null;
  }
  function reset() {
    generation++; releasePdf(); file = null; bytes = null; output = null; placement = null;
    options.hidden = true; error.replaceChildren(); drop.setCompact(false);
    primary.setEnabled(false); statusText('Add a PDF to begin.');
  }

  function redrawInk() {
    const context = inkCanvas.getContext('2d');
    context.clearRect(0, 0, inkCanvas.width, inkCanvas.height);
    context.strokeStyle = '#111'; context.fillStyle = '#111';
    context.lineCap = 'round'; context.lineJoin = 'round';
    for (const stroke of strokes) {
      if (!stroke.points.length) continue;
      context.lineWidth = stroke.width;
      context.beginPath(); context.moveTo(stroke.points[0].x, stroke.points[0].y);
      if (stroke.points.length === 1) { context.arc(stroke.points[0].x, stroke.points[0].y, stroke.width / 2, 0, Math.PI * 2); context.fill(); continue; }
      for (let i = 1; i < stroke.points.length - 1; i++) {
        const a = stroke.points[i], b = stroke.points[i + 1];
        context.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2);
      }
      const last = stroke.points.at(-1); context.lineTo(last.x, last.y); context.stroke();
    }
  }
  function pointerPos(event) {
    const rect = inkCanvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * inkCanvas.width / rect.width, y: (event.clientY - rect.top) * inkCanvas.height / rect.height };
  }
  inkCanvas.addEventListener('pointerdown', (event) => {
    event.preventDefault(); inkCanvas.setPointerCapture(event.pointerId);
    currentStroke = { width: Number(lineWidth.value), points: [pointerPos(event)] }; strokes.push(currentStroke); redrawInk();
  });
  inkCanvas.addEventListener('pointermove', (event) => {
    if (!currentStroke) return;
    currentStroke.points.push(pointerPos(event)); redrawInk();
  });
  for (const name of ['pointerup', 'pointercancel']) inkCanvas.addEventListener(name, () => { currentStroke = null; updateSignature(); });
  let signatureRevision = 0;
  function updateSignature() {
    output = null;
    const revision = ++signatureRevision;
    if (signatureUrl) URL.revokeObjectURL(signatureUrl);
    signatureUrl = null; signaturePng = null; signaturePreview.replaceChildren(); signatureImage.removeAttribute('src');
    if (editor === 'draw' && strokes.length === 0 || editor === 'type' && !typedName.value.trim()) {
      overlay.hidden = true;
      primary.setEnabled(mode === 'number' && Boolean(file));
      return;
    }
    const canvas = editor === 'draw' ? inkCanvas : document.createElement('canvas');
    if (editor === 'type') {
      canvas.width = 800; canvas.height = 180;
      const context = canvas.getContext('2d');
      const families = { cursive: 'italic 72px cursive', serif: 'italic 68px Georgia, serif', hand: 'italic 68px "Segoe Print", "Comic Sans MS", cursive' };
      context.font = families[handwriting.value]; context.fillStyle = '#111'; context.textBaseline = 'middle';
      context.fillText(typedName.value.trim(), 12, 90, 776);
    }
    const context = canvas.getContext('2d');
    const bounds = inkBounds(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, 4);
    if (bounds) {
      const trimmed = document.createElement('canvas'); trimmed.width = bounds.width; trimmed.height = bounds.height;
      trimmed.getContext('2d').drawImage(canvas, bounds.x, bounds.y, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);
      signatureAspect = bounds.width / bounds.height;
      trimmed.toBlob(async (blob) => {
        trimmed.width = 0; trimmed.height = 0;
        if (!blob || destroyed || revision !== signatureRevision) return;
        const png = new Uint8Array(await blob.arrayBuffer());
        if (destroyed || revision !== signatureRevision) return;
        signaturePng = png;
        signatureUrl = URL.createObjectURL(blob);
        const image = el('img'); image.alt = 'Signature preview'; image.src = signatureUrl; signaturePreview.append(image);
        signatureImage.src = signatureUrl;
        if (pageBox) refreshPlacement();
        primary.setEnabled(Boolean(file));
      }, 'image/png');
    }
    if (editor === 'type') { canvas.width = 0; canvas.height = 0; }
    primary.setEnabled(mode === 'number' && Boolean(file));
  }
  typedName.addEventListener('input', updateSignature); handwriting.addEventListener('change', updateSignature);
  async function renderPreview() {
    if (!pdfjsDoc || mode !== 'sign') return;
    const token = ++generation;
    const number = Number(pageField.value);
    if (!Number.isInteger(number) || number < 1 || number > pdfjsDoc.numPages) { fail(`Choose a page from 1 to ${pdfjsDoc.numPages}.`); return; }
    previewTask?.cancel(); previewTask = null;
    previewPage?.cleanup(); previewPage = null;
    pageCanvas.width = 0; pageCanvas.height = 0; previewSize = null;
    pageBox = null; overlay.hidden = true;
    statusText(`Rendering page ${number}…`);
    try {
      const page = await pdfjsDoc.getPage(number);
      if (destroyed || token !== generation) return;
      previewPage = page;
      const viewport = page.getViewport({ scale: 1 });
      const scale = Math.min(1, 640 / viewport.width);
      const display = page.getViewport({ scale });
      const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
      pageCanvas.width = Math.ceil(display.width * pixelRatio); pageCanvas.height = Math.ceil(display.height * pixelRatio);
      pageCanvas.style.width = `${display.width}px`; pageCanvas.style.height = `${display.height}px`;
      previewFrame.style.width = `${display.width}px`;
      const context = pageCanvas.getContext('2d');
      previewTask = page.render({ canvasContext: context, viewport: display, transform: [pixelRatio, 0, 0, pixelRatio, 0, 0] });
      await previewTask.promise;
      if (destroyed || token !== generation) return;
      previewTask = null;
      previewSize = { width: display.width, height: display.height };
      // The PDF's CropBox can be non-zero; use pdf-lib's box for final coordinates.
      const doc = await window.PDFLib.PDFDocument.load(bytes);
      if (destroyed || token !== generation) return;
      const sourcePage = doc.getPage(number - 1);
      pageBox = { box: visibleBox(sourcePage), rotation: rotationOf(sourcePage) };
      if (!placement) placement = { x: 24, y: 24, width: 150 };
      refreshPlacement(); statusText(`Page ${number} ready. Place the signature.`);
    } catch (err) {
      if (!destroyed && token === generation && err?.name !== 'RenderingCancelledException') fail(friendly(err));
    }
  }
  pageField.addEventListener('change', renderPreview);
  function refreshPlacement() {
    if (!previewSize || !pageBox || !placement || !signaturePng) { overlay.hidden = true; return; }
    output = null;
    const visual = visualSize(pageBox.box, pageBox.rotation);
    placement.width = Math.min(Math.max(1, placement.width), visual.width, visual.height * signatureAspect);
    placement.x = Math.max(0, Math.min(placement.x, visual.width - placement.width));
    const height = placement.width / signatureAspect;
    placement.y = Math.max(0, Math.min(placement.y, Math.max(0, visual.height - height)));
    overlay.hidden = false;
    overlay.style.left = `${placement.x / visual.width * 100}%`;
    overlay.style.top = `${placement.y / visual.height * 100}%`;
    overlay.style.width = `${placement.width / visual.width * 100}%`;
    overlay.style.height = `${height / visual.height * 100}%`;
    xField.value = String(Math.round(placement.x * 10) / 10);
    yField.value = String(Math.round(placement.y * 10) / 10);
    widthField.value = String(Math.round(placement.width * 10) / 10);
  }
  for (const coord of [xField, yField, widthField]) coord.addEventListener('change', () => {
    placement = { x: Number(xField.value), y: Number(yField.value), width: Number(widthField.value) };
    refreshPlacement();
  });
  pageCanvas.addEventListener('pointerdown', (event) => {
    if (!previewSize || !signaturePng) return;
    const rect = pageCanvas.getBoundingClientRect(), visual = visualSize(pageBox.box, pageBox.rotation);
    const pt = previewToPoints({ x: event.clientX - rect.left, y: event.clientY - rect.top, width: 0, height: 0 }, { width: rect.width, height: rect.height }, visual);
    placement = { x: pt.x, y: pt.y, width: placement?.width || 150 }; refreshPlacement();
  });
  let drag = null;
  overlay.addEventListener('pointerdown', (event) => {
    if (!placement) return;
    event.preventDefault(); overlay.setPointerCapture(event.pointerId);
    drag = { x: event.clientX, y: event.clientY, origin: { ...placement }, resize: event.target === resize };
  });
  overlay.addEventListener('pointermove', (event) => {
    if (!drag || !pageBox || !previewSize) return;
    const visual = visualSize(pageBox.box, pageBox.rotation);
    const rendered = pageCanvas.getBoundingClientRect();
    const dx = (event.clientX - drag.x) * visual.width / rendered.width;
    const dy = (event.clientY - drag.y) * visual.height / rendered.height;
    placement = drag.resize ? { ...drag.origin, width: drag.origin.width + dx } : { ...drag.origin, x: drag.origin.x + dx, y: drag.origin.y + dy };
    refreshPlacement();
  });
  for (const name of ['pointerup', 'pointercancel']) overlay.addEventListener(name, () => { drag = null; });

  primary.el.addEventListener('click', async () => {
    if (!file || !bytes || mode === 'sign' && !signaturePng) return;
    if (output?.mode === mode) { downloadBlob(new Blob([output.bytes], { type: 'application/pdf' }), output.name); return; }
    const token = generation;
    primary.setEnabled(false); primary.setLabel('Working…'); error.replaceChildren(); statusText('Working…');
    try {
      const lib = await loadLib();
      let result;
      if (mode === 'number') result = await addPageNumbers(bytes, { format: format.value, position: position.value, size: size.value, margin: margin.value, start: start.value, range: range.value, skipFirst: skip.control.checked }, lib);
      else {
        if (!placement || !pageBox || !previewSize) throw new RangeError('Choose a page and place the signature.');
        const visual = visualSize(pageBox.box, pageBox.rotation);
        const rect = previewToPoints({ x: Number(xField.value) * previewSize.width / visual.width, y: Number(yField.value) * previewSize.height / visual.height, width: Number(widthField.value) * previewSize.width / visual.width, height: Number(widthField.value) / signatureAspect * previewSize.height / visual.height }, previewSize, visual);
        result = await addSignature(bytes, signaturePng, { page: Number(pageField.value), ...rect, addDate: dateCheck.control.checked }, lib);
      }
      if (destroyed || token !== generation) return;
      output = { mode, bytes: result, name: file.name.replace(/\.pdf$/i, '') + (mode === 'number' ? '-numbered.pdf' : '-signed.pdf') };
      downloadBlob(new Blob([result], { type: 'application/pdf' }), output.name);
      statusText(`Done · ${formatBytes(result.length)}.`, 'ok'); primary.el.focus();
    } catch (err) { if (!destroyed) fail(friendly(err)); }
    finally { if (!destroyed) { primary.setLabel('Download PDF'); primary.setEnabled(Boolean(file) && (mode === 'number' || Boolean(signaturePng))); } }
  });
  for (const control of [format, position, size, margin, start, range, skip.control, pageField, xField, yField, widthField, dateCheck.control, typedName, handwriting]) control.addEventListener('input', () => { output = null; });
  setEditor('draw'); setMode('number'); options.hidden = true;
  return () => {
    destroyed = true; generation++; signatureRevision++; releasePdf();
    if (signatureUrl) URL.revokeObjectURL(signatureUrl);
    inkCanvas.width = 0; inkCanvas.height = 0;
    file = null; bytes = null; output = null; signaturePng = null;
  };
}
