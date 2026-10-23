// QR Code Generator — UI layer.
//
// Loaded lazily by the shell (see assets/tools.js -> load()). This module owns
// the DOM only; every matrix/SVG/contrast helper lives in ./qr.js and stays
// pure. The vendored MIT encoder (qrcode-generator) is injected as a plain
// <script> by qr.js so the qrcode global is available — no CDN, no network.
//
// The content never leaves the page: it is drawn to a canvas or serialised to
// an SVG string in-memory and nothing is logged or transmitted.

import { createDownloadButton, downloadBlob, formatBytes } from '../../assets/ui.js';
import {
  loadEncoder,
  matrixFromText,
  matrixToSvg,
  matrixToRgba,
  buildWifiPayload,
  buildVcardPayload,
  parseQrCsv,
  qrFilenames,
  contrastRatio,
  isInvertedContrast,
  QrError,
} from './qr.js';
import { zipStore } from '../imgpdf/zip.js';

const EC_LEVELS = [
  { id: 'L', label: 'L \u00B7 7%' },
  { id: 'M', label: 'M \u00B7 15%' },
  { id: 'Q', label: 'Q \u00B7 25%' },
  { id: 'H', label: 'H \u00B7 30%' },
];

const PRESETS = [
  { id: 'url', label: 'Plain URL' },
  { id: 'wifi', label: 'Wi-Fi' },
  { id: 'vcard', label: 'vCard 3.0' },
  { id: 'text', label: 'Free text' },
];

const MIN_CONTRAST = 3;

export function mount(root) {
  const state = {
    preset: 'url',
    text: '',
    ec: 'M',
    scale: 8,
    margin: 4,
    dark: '#000000',
    light: '#ffffff',
    svg: '',
    matrix: null,
    seq: 0,
    bulk: false,
    busy: false,
    destroyed: false,
    fileSeq: 0,
  };

  /* ---- structure ---- */
  const wrap = el('div', 'stack qr-tool');

  const presetRow = el('div', 'tabs');
  presetRow.setAttribute('role', 'tablist');
  presetRow.setAttribute('aria-label', 'Preset');
  const presetHelp = el('p', 'field-hint');
  const presetTabs = new Map();
  for (const p of PRESETS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tab';
    b.setAttribute('role', 'tab');
    b.dataset.preset = p.id;
    b.textContent = p.label;
    b.addEventListener('click', () => setPreset(p.id));
    presetTabs.set(p.id, b);
    presetRow.append(b);
  }
  // Tab row + short description (12px apart) live in the head group below.

  const options = el('div', 'panel');
  const optionsTitle = el('h2', 'panel-title');
  optionsTitle.textContent = 'Options';
  const optionsBody = el('div', 'field-grid');

  // Content field: label above the textarea, both full-width.
  const contentField = el('div', 'field field-span');
  const contentLabel = el('label', 'field-label');
  contentLabel.setAttribute('for', 'qr-content');
  contentLabel.textContent = 'Content';
  const content = document.createElement('textarea');
  content.id = 'qr-content';
  content.className = 'field-textarea is-mono';
  content.spellcheck = false;
  content.autocomplete = 'off';
  content.placeholder = 'Type or paste text to encode\u2026';
  content.addEventListener('input', () => { state.text = content.value; scheduleRender(); });
  contentField.append(contentLabel, content);

  const bulkToggle = checkbox('qr-bulk', 'Bulk CSV (one payload per row, up to 200)');
  const bulkField = el('div', 'stack-sm qr-bulk');
  const csvLabel = el('label', 'field');
  const csvTitle = el('span', 'field-label');
  csvTitle.textContent = 'CSV payloads (first column)';
  const csvInput = document.createElement('textarea');
  csvInput.className = 'field-textarea is-mono';
  csvInput.placeholder = 'One payload per row; use quotes for commas or line breaks';
  csvInput.addEventListener('input', () => { state.fileSeq += 1; updateBulk(); });
  csvLabel.append(csvTitle, csvInput);
  const fileLabel = el('label', 'field');
  const fileTitle = el('span', 'field-label');
  fileTitle.textContent = 'Or choose a UTF-8 CSV file';
  const csvFile = document.createElement('input');
  csvFile.type = 'file';
  csvFile.className = 'field-input';
  csvFile.accept = '.csv,text/csv';
  fileLabel.append(fileTitle, csvFile);
  const bulkHint = el('p', 'field-hint');
  bulkHint.textContent = 'Paste or choose a CSV. The first column of each non-empty row becomes a PNG.';
  bulkField.append(csvLabel, fileLabel, bulkHint);
  bulkField.hidden = true;
  bulkToggle.input.addEventListener('change', () => {
    state.fileSeq += 1;
    state.bulk = bulkToggle.input.checked;
    bulkField.hidden = !state.bulk;
    presetRow.hidden = state.bulk;
    presetHelp.hidden = state.bulk;
    contentField.hidden = state.bulk || state.preset === 'wifi' || state.preset === 'vcard';
    wifiFields.hidden = state.bulk || state.preset !== 'wifi';
    vcardFields.hidden = state.bulk || state.preset !== 'vcard';
    dl.setLabel(state.bulk ? 'Download ZIP' : 'Download PNG');
    svgBtn.hidden = state.bulk;
    copyBtn.hidden = state.bulk;
    updateBulk();
  });
  csvFile.addEventListener('change', async () => {
    const file = csvFile.files?.[0];
    if (!file) return;
    const seq = ++state.fileSeq;
    try {
      if (file.size > 1024 * 1024) throw new Error('CSV file exceeds 1 MB.');
      const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
      if (state.destroyed || seq !== state.fileSeq) return;
      csvInput.value = text;
      updateBulk();
    } catch {
      if (!state.destroyed && seq === state.fileSeq) {
        csvInput.value = '';
        updateBulk();
        setStatus('Could not read CSV. Choose a UTF-8 CSV under 1 MB.', 'bad');
      }
    }
  });

  // Preset field containers (only one is shown at a time).
  const wifiFields = el('div', 'field-grid qr-preset-fields');
  const vcardFields = el('div', 'field-grid qr-preset-fields');

  const ssid = textInput('qr-ssid', 'Network name (SSID)');
  const wifiPassword = passwordInput('qr-pass', 'Password');
  const wifiEnc = selectInput('qr-enc', 'Security', [
    { value: 'WPA', label: 'WPA / WPA2' },
    { value: 'WEP', label: 'WEP' },
    { value: 'nopass', label: 'Open (no password)' },
  ]);
  const wifiHidden = checkbox('qr-hidden', 'Hidden network');
  wifiFields.append(
    field('Network name (SSID)', ssid.input),
    field('Password', wifiPassword.input),
    field('Security', wifiEnc.input),
    wifiHidden.el,
  );

  const vcardName = textInput('qr-vc-name', 'Full name');
  const vcardOrg = textInput('qr-vc-org', 'Organisation');
  const vcardTel = textInput('qr-vc-tel', 'Phone');
  const vcardEmail = textInput('qr-vc-email', 'Email');
  const vcardUrl = textInput('qr-vc-url', 'Website');
  vcardFields.append(
    field('Full name', vcardName.input),
    field('Organisation', vcardOrg.input),
    field('Phone', vcardTel.input),
    field('Email', vcardEmail.input),
    field('Website', vcardUrl.input),
  );

  // Options: EC, scale, margin, colours.
  const ecSelect = selectInput('qr-ec', 'Error correction', EC_LEVELS.map((e) => ({ value: e.id, label: e.label })));
  ecSelect.input.value = 'M';
  ecSelect.input.addEventListener('change', () => { state.ec = ecSelect.input.value; scheduleRender(); });

  const scaleInput = rangeInput('qr-scale', 'Scale', 2, 20, state.scale);
  scaleInput.input.addEventListener('input', () => { state.scale = Number(scaleInput.input.value); scaleInput.out.textContent = `${state.scale}\u00D7`; scheduleRender(); });

  const marginInput = rangeInput('qr-margin', 'Quiet zone', 0, 8, state.margin);
  marginInput.input.addEventListener('input', () => { state.margin = Number(marginInput.input.value); marginInput.out.textContent = String(state.margin); scheduleRender(); });

  const darkInput = colorInput('qr-dark', 'Foreground', state.dark);
  const lightInput = colorInput('qr-light', 'Background', state.light);
  darkInput.input.addEventListener('input', () => { state.dark = darkInput.input.value; darkInput.out.textContent = darkInput.input.value; scheduleRender(); });
  lightInput.input.addEventListener('input', () => { state.light = lightInput.input.value; lightInput.out.textContent = lightInput.input.value; scheduleRender(); });

  const contrastWarn = el('div', 'block block-warning field-span');
  contrastWarn.setAttribute('role', 'status');
  contrastWarn.hidden = true;
  const contrastLead = el('span', 'block-lead');
  contrastLead.textContent = 'Heads up.';
  const contrastText = el('span', 'block-detail');
  contrastWarn.append(contrastLead, contrastText);

  // Foreground / background swatches side by side in one row.
  const colorsRow = el('div', 'qr-colors field-span');
  colorsRow.append(colorField('Foreground', darkInput), colorField('Background', lightInput));

  optionsBody.append(
    field('Error correction', ecSelect.input),
    rangeField('Module scale', scaleInput),
    rangeField('Quiet zone (modules)', marginInput),
    colorsRow,
    contrastWarn,
  );

  const previewWrap = el('div', 'qr-preview-wrap');
  const preview = el('div', 'qr-preview');
  preview.setAttribute('aria-live', 'polite');
  const previewMeta = el('p', 'qr-preview-meta');
  previewWrap.append(preview, previewMeta);

  const actions = el('div', 'status-row row');
  const dl = createDownloadButton({ label: 'Download PNG' });
  const svgBtn = actionBtn('Download SVG', () => downloadSvg());
  const copyBtn = actionBtn('Copy SVG', () => copySvg());
  dl.el.addEventListener('click', () => state.bulk ? downloadBulk() : downloadPng());
  actions.append(dl.el, svgBtn, copyBtn);

  const copyStatus = el('p', 'status');
  copyStatus.setAttribute('role', 'status');
  copyStatus.setAttribute('aria-live', 'polite');
  actions.append(copyStatus);

  options.append(optionsTitle, optionsBody);

  // Two independent column stacks at >= 900px so each column flows on its own
  // (no grid rows tying the preview to the first row only). Source order is the
  // narrow-screen stack order: tab row + description, input (preset fields),
  // options, then the preview and its download buttons.
  const headGroup = el('div', 'stack-sm qr-head');
  headGroup.append(presetRow, presetHelp);
  const inputGroup = el('div', 'stack qr-input');
  inputGroup.append(bulkToggle.el, bulkField, contentField, wifiFields, vcardFields);
  const optionsGroup = el('div', 'qr-options');
  optionsGroup.append(options);

  const left = el('div', 'stack qr-col');
  left.append(headGroup, inputGroup, optionsGroup);
  const right = el('div', 'stack qr-col qr-col-preview');
  right.append(previewWrap, actions);

  const grid = el('div', 'stack qr-grid');
  grid.append(left, right);
  wrap.append(grid);
  root.append(wrap);

  /* ---- helpers ---- */
  function el(tag, cls) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }

  function field(labelText, control) {
    const lab = el('label', 'field');
    const span = el('span', 'field-label');
    span.textContent = labelText;
    lab.append(span, control);
    return lab;
  }

  function rangeField(labelText, r) {
    const lab = el('label', 'field qr-field-range');
    const head = el('span', 'qr-range-head');
    const span = el('span', 'field-label');
    span.textContent = labelText;
    head.append(span, r.out);
    lab.append(head, r.input);
    return lab;
  }

  function colorField(labelText, c) {
    // One row: 40x40 swatch then its text value next to it.
    const row = el('div', 'qr-color-row');
    const lab = el('label', 'field-label');
    lab.setAttribute('for', c.input.id);
    lab.textContent = labelText;
    const value = el('span', 'qr-color-value');
    value.textContent = c.input.value;
    c.out = value;
    row.append(lab, c.input, value);
    return row;
  }

  function textInput(id, placeholder) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'field-input';
    input.id = id;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.placeholder = placeholder || '';
    return { input };
  }

  function passwordInput(id, placeholder) {
    const input = document.createElement('input');
    input.type = 'password';
    input.className = 'field-input';
    input.id = id;
    input.autocomplete = 'off';
    input.placeholder = placeholder || '';
    return { input };
  }

  function selectInput(id, label, opts) {
    const input = document.createElement('select');
    input.className = 'field-select';
    input.id = id;
    for (const o of opts) {
      const opt = document.createElement('option');
      opt.value = o.value;
      opt.textContent = o.label;
      input.append(opt);
    }
    return { input };
  }

  function rangeInput(id, label, min, max, value) {
    const input = document.createElement('input');
    input.type = 'range';
    input.id = id;
    input.min = String(min);
    input.max = String(max);
    input.step = '1';
    input.value = String(value);
    const out = el('span', 'qr-range-out');
    out.textContent = id === 'qr-scale' ? `${value}\u00D7` : String(value);
    return { input, out };
  }

  function colorInput(id, label, value) {
    const input = document.createElement('input');
    input.type = 'color';
    input.id = id;
    input.value = value;
    return { input };
  }

  function checkbox(id, text, checked) {
    const lab = el('label', 'check-row');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.id = id;
    box.checked = Boolean(checked);
    const span = document.createElement('span');
    span.textContent = text;
    lab.append(box, span);
    return { el: lab, input: box };
  }

  function actionBtn(text, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-text';
    b.textContent = text;
    b.addEventListener('click', onClick);
    return b;
  }

  function setStatus(text, kind) {
    copyStatus.textContent = text || '';
    copyStatus.className = 'status' + (kind ? ` is-${kind}` : '');
  }

  /* ---- payload composition ---- */
  function composeContent() {
    if (state.preset === 'wifi') {
      return buildWifiPayload({
        ssid: ssid.input.value,
        password: wifiPassword.input.value,
        encryption: wifiEnc.input.value,
        hidden: wifiHidden.input.checked,
      });
    }
    if (state.preset === 'vcard') {
      return buildVcardPayload({
        name: vcardName.input.value,
        org: vcardOrg.input.value,
        tel: vcardTel.input.value,
        email: vcardEmail.input.value,
        url: vcardUrl.input.value,
      });
    }
    return content.value;
  }

  function payloadIsEmpty(payload) {
    if (state.preset === 'wifi') return !ssid.input.value.trim();
    if (state.preset === 'vcard') {
      return !vcardName.input.value.trim() && !vcardOrg.input.value.trim() &&
             !vcardTel.input.value.trim() && !vcardEmail.input.value.trim() &&
             !vcardUrl.input.value.trim();
    }
    return payload.length === 0;
  }

  /* ---- rendering ---- */
  let renderTimer = null;
  function scheduleRender() {
    state.seq += 1;
    state.matrix = null;
    state.svg = '';
    dl.setEnabled(false);
    svgBtn.disabled = true;
    copyBtn.disabled = true;
    updateContrastWarning();
    if (state.bulk) return;
    if (renderTimer) clearTimeout(renderTimer);
    renderTimer = setTimeout(render, 90);
  }

  async function render() {
    if (state.destroyed || state.bulk) return;
    const seq = ++state.seq;
    setDownloadsEnabled(false);
    const payload = composeContent();
    updateContrastWarning();

    if (payloadIsEmpty(payload)) {
      state.matrix = null;
      state.svg = '';
      preview.replaceChildren();
      const empty = el('p', 'qr-empty');
      empty.textContent = 'Add some content to see a live preview.';
      preview.append(empty);
      previewMeta.textContent = '';
      setDownloadsEnabled(false);
      setStatus('');
      return;
    }

    try {
      const matrix = await matrixFromText(payload, state.ec);
      if (state.destroyed || seq !== state.seq || state.bulk) return;
      state.matrix = matrix;

      const svg = matrixToSvg(matrix, {
        scale: state.scale,
        margin: state.margin,
        dark: state.dark,
        light: state.light,
      });
      state.svg = svg;

      const { width, height, data } = matrixToRgba(matrix, {
        scale: state.scale,
        margin: state.margin,
        dark: state.dark,
        light: state.light,
      });
      putCanvas(preview, width, height, data);

      const version = (matrix.length - 17) / 4;
      const bytes = new TextEncoder().encode(payload).length;
      previewMeta.textContent =
        `Version ${version} \u00B7 ${matrix.length}\u00D7${matrix.length} modules \u00B7 ` +
        `${bytes} ${bytes === 1 ? 'byte' : 'bytes'} \u00B7 EC ${state.ec}`;
      setDownloadsEnabled(true);
      setStatus('Ready \u2014 nothing left your device.', 'ok');
    } catch (err) {
      if (state.destroyed || seq !== state.seq || state.bulk) return;
      state.matrix = null;
      state.svg = '';
      preview.replaceChildren();
      const box = el('p', 'qr-error');
      box.textContent = err instanceof QrError ? err.message : String((err && err.message) || err);
      preview.append(box);
      previewMeta.textContent = '';
      setDownloadsEnabled(false);
      setStatus('', '');
    }
  }

  function putCanvas(host, width, height, data) {
    host.replaceChildren();
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.className = 'qr-canvas';
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'QR code preview');
    const ctx = canvas.getContext('2d');
    const img = new ImageData(data, width, height);
    ctx.putImageData(img, 0, 0);
    host.append(canvas);
  }

  function updateContrastWarning() {
    let ratio = 0;
    try {
      ratio = contrastRatio(state.dark, state.light);
    } catch {
      ratio = 0;
    }
    const inverted = isInvertedContrast(state.dark, state.light);
    if (ratio >= MIN_CONTRAST && !inverted) {
      contrastWarn.hidden = true;
      contrastText.textContent = '';
    } else {
      contrastWarn.hidden = false;
      contrastText.textContent = inverted
        ? `Foreground is lighter than background (${ratio.toFixed(2)}:1). Downloads are disabled because inverted QR codes may not scan.`
        : `Low contrast (${ratio.toFixed(2)}:1). Aim for at least ${MIN_CONTRAST}:1 or scanners may fail.`;
    }
    if (inverted) setDownloadsEnabled(false);
  }

  function setDownloadsEnabled(on) {
    const allowed = on && !state.busy && !isInvertedContrast(state.dark, state.light);
    dl.setEnabled(allowed);
    svgBtn.disabled = !allowed || state.bulk;
    copyBtn.disabled = !allowed || state.bulk;
  }

  function updateBulk() {
    if (!state.bulk) { render(); return; }
    state.seq += 1;
    if (renderTimer) { clearTimeout(renderTimer); renderTimer = null; }
    state.matrix = null;
    state.svg = '';
    updateContrastWarning();
    try {
      const rows = parseQrCsv(csvInput.value);
      preview.replaceChildren();
      const message = el('p', 'qr-empty');
      message.textContent = rows.length ? `${rows.length} QR codes ready for ZIP export.` : 'Paste or choose a CSV to begin.';
      preview.append(message);
      previewMeta.textContent = `${rows.length} of 200 rows`;
      setDownloadsEnabled(rows.length > 0);
      setStatus(rows.length ? 'Ready - files stay on your device.' : '');
    } catch (err) {
      preview.replaceChildren();
      previewMeta.textContent = '';
      setDownloadsEnabled(false);
      setStatus(err instanceof QrError ? err.message : 'Could not parse CSV.', 'bad');
    }
  }

  /* ---- presets ---- */
  const CONTENT_LABEL = {
    url: 'URL',
    text: 'Text',
  };
  const PLACEHOLDER = {
    url: 'https://example.com/page',
    text: 'Type or paste text to encode\u2026',
  };

  function setPreset(id) {
    state.seq += 1;
    state.matrix = null;
    state.svg = '';
    state.preset = id;
    for (const [key, btn] of presetTabs) {
      const on = key === id;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    }

    presetHelp.textContent = presetInfo(id);

    const usesStructured = id === 'wifi' || id === 'vcard';
    wifiFields.hidden = state.bulk || id !== 'wifi';
    vcardFields.hidden = state.bulk || id !== 'vcard';
    contentField.hidden = state.bulk || usesStructured;

    if (id === 'url') {
      contentLabel.textContent = 'URL';
      content.placeholder = PLACEHOLDER.url;
    } else if (id === 'text') {
      contentLabel.textContent = 'Text';
      content.placeholder = PLACEHOLDER.text;
    }

    setStatus('');
    render();
  }

  function presetInfo(id) {
    switch (id) {
      case 'url':
        return 'Encodes a plain URL. Scanning opens it directly; make sure it starts with https://.';
      case 'wifi':
        return 'Joins a Wi-Fi network. Reserved characters in the SSID and password are escaped automatically.';
      case 'vcard':
        return 'A compact contact card. Empty fields are omitted.';
      default:
        return 'Any text \u2014 notes, codes, or a short message.';
    }
  }

  /* ---- download / copy ---- */
  function pngBlob(matrix) {
    const { width, height, data } = matrixToRgba(matrix, {
      scale: state.scale, margin: state.margin, dark: state.dark, light: state.light,
    });
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').putImageData(new ImageData(data, width, height), 0, 0);
    return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not encode PNG.')), 'image/png'));
  }

  async function downloadBulk() {
    if (!state.bulk || state.destroyed || state.busy || isInvertedContrast(state.dark, state.light)) return;
    let rows;
    try { rows = parseQrCsv(csvInput.value); }
    catch (err) { setStatus(err.message, 'bad'); return; }
    if (!rows.length) return;
    const token = state.seq;
    state.busy = true;
    setDownloadsEnabled(false);
    dl.setLabel('Working...');
    try {
      const names = qrFilenames(rows);
      const entries = [];
      for (let i = 0; i < rows.length; i += 1) {
        if (state.destroyed || token !== state.seq || !state.bulk) return;
        setStatus(`Working... ${i + 1} of ${rows.length} codes`);
        const matrix = await matrixFromText(rows[i], state.ec);
        const blob = await pngBlob(matrix);
        entries.push({ name: names[i], bytes: new Uint8Array(await blob.arrayBuffer()) });
        if (i % 10 === 9) await new Promise((resolve) => setTimeout(resolve, 0));
      }
      if (state.destroyed || token !== state.seq || !state.bulk) return;
      const bytes = zipStore(entries);
      downloadBlob(new Blob([bytes], { type: 'application/zip' }), 'qr-codes.zip');
      setStatus(`Done - ${entries.length} PNGs, ${formatBytes(bytes.length)}.`, 'ok');
    } catch (err) {
      if (!state.destroyed && token === state.seq) setStatus(
        err instanceof QrError ? `Could not export CSV: ${err.message}` : 'Could not export CSV. Check the rows and try again.', 'bad');
    } finally {
      state.busy = false;
      if (!state.destroyed) {
        dl.setLabel(state.bulk ? 'Download ZIP' : 'Download PNG');
        if (state.bulk) {
          try { setDownloadsEnabled(parseQrCsv(csvInput.value).length > 0); }
          catch { setDownloadsEnabled(false); }
        } else setDownloadsEnabled(Boolean(state.matrix));
      }
    }
  }

  function downloadPng() {
    if (!state.matrix || isInvertedContrast(state.dark, state.light)) { setStatus('Heads up - choose a darker foreground and add content first.', 'warn'); return; }
    try {
      const { width, height, data } = matrixToRgba(state.matrix, {
        scale: state.scale,
        margin: state.margin,
        dark: state.dark,
        light: state.light,
      });
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.putImageData(new ImageData(data, width, height), 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) { setStatus('Couldn\u2019t encode the PNG.', 'bad'); return; }
        downloadBlob(blob, 'qr-code.png');
        setStatus(`Done \u2014 PNG ${width}\u00D7${height} \u00B7 ${formatBytes(blob.size)}.`, 'ok');
      }, 'image/png');
    } catch (err) {
      setStatus(`Couldn\u2019t save the PNG. ${String((err && err.message) || err)}`, 'bad');
    }
  }

  function downloadSvg() {
    if (!state.svg || isInvertedContrast(state.dark, state.light)) { setStatus('Heads up - choose a darker foreground and add content first.', 'warn'); return; }
    const blob = new Blob([state.svg], { type: 'image/svg+xml' });
    downloadBlob(blob, 'qr-code.svg');
    setStatus(`Done \u2014 SVG \u00B7 ${formatBytes(blob.size)}.`, 'ok');
  }

  async function copySvg() {
    if (!state.svg || isInvertedContrast(state.dark, state.light)) { setStatus('Heads up - choose a darker foreground and add content first.', 'warn'); return; }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(state.svg);
      } else {
        const ta = document.createElement('textarea');
        ta.value = state.svg;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.append(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      setStatus('Done \u2014 SVG copied to clipboard.', 'ok');
    } catch {
      setStatus('Heads up \u2014 could not copy automatically. Use Download SVG instead.', 'warn');
    }
  }

  /* ---- init ---- */
  loadEncoder().catch(() => { /* surfaced on first render */ });
  setPreset('url');
  setTimeout(render, 0);

  // Lifecycle (review F09): cancel a pending debounced render and drop the
  // generated matrix/SVG so a queued timer cannot run against a detached view.
  return function unmount() {
    state.destroyed = true;
    state.fileSeq += 1;
    if (renderTimer) { clearTimeout(renderTimer); renderTimer = null; }
    state.seq += 1; // invalidate any in-flight matrix render
    state.matrix = null;
    state.svg = '';
  };
}
