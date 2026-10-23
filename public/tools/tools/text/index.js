// JSON / Base64 / UUID / SHA-256 — UI layer.
//
// Loaded lazily by the shell (see assets/tools.js -> load()). This module owns
// the DOM only; every transformation lives in ./text.js and stays pure.
//
// Four tabs, one per operation:
//   * JSON   — format / minify / validate a document, with line/column on error.
//   * Base64 — encode/decode text, URL-safe option, plus hashing a dropped file.
//   * UUID   — generate 1..1000 v4 UUIDs and copy/download the list.
//   * SHA-256 — hash typed text or a dropped file (crypto.subtle, JS fallback).
//
// No network, no libraries, no CDN — only browser built-ins.

import { createDropzone, createDownloadButton, downloadBlob, formatBytes } from '../../assets/ui.js';
import {
  formatJson,
  minifyJson,
  validateJson,
  runBase64,
  uuidMany,
  sha256Hex,
  sha256HasSubtle,
  TextToolError,
} from './text.js';

const OPERATIONS = [
  { id: 'json', label: 'JSON', help: 'Format, minify or validate a JSON document. Errors report line and column.' },
  { id: 'base64', label: 'Base64', help: 'Encode or decode text as Base64 (UTF-8, optional URL-safe). Drop a file to use its bytes; when both a file and typed text exist, the file wins.' },
  { id: 'uuid', label: 'UUID', help: 'Generate RFC 4122 version 4 UUIDs (1 to 1000 at a time).' },
  { id: 'sha256', label: 'SHA-256', help: 'Hash text or a dropped file. Uses Web Crypto, with a built-in fallback.' },
];

const B64_MODES = [
  { id: 'encode', label: 'Encode' },
  { id: 'decode', label: 'Decode' },
];

export function mount(root) {
  const state = {
    op: 'json',
    busy: false,
    file: null,          // { name, size, bytes } for the dropzone
    outBytes: null,      // bytes payload backing the Download button
    outName: '',
    outText: '',
  };

  /* ---- structure ---- */
  const wrap = el('div', 'stack text-tool');

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
  // The tab row and its description are one tight group.
  const tabHead = el('div', 'stack-sm');
  tabHead.append(opRow, opHelp);

  // Shared dropzone (file -> bytes), used by Base64 and SHA-256.
  const dz = createDropzone({
    multiple: false,
    title: 'Drop a file here',
    note: 'Its bytes are used as the input',
    ariaLabel: 'Choose a file or drop it here',
    onFiles: (files) => addFile(files),
  });

  const options = el('div', 'panel');
  const optionsTitle = el('h2', 'panel-title');
  optionsTitle.textContent = 'Options';
  const optionsBody = el('div', 'field-grid');

  // Input field: label above the textarea, both full-width.
  const inputField = el('div', 'field field-span');
  const label = el('label', 'field-label');
  label.setAttribute('for', 'text-input');
  label.textContent = 'Input';
  const input = document.createElement('textarea');
  input.id = 'text-input';
  input.className = 'field-textarea';
  input.spellcheck = false;
  input.autocomplete = 'off';
  input.placeholder = 'Paste or type here\u2026';
  inputField.append(label, input);

  const actions = el('div', 'status-row row');
  const runBtn = document.createElement('button');
  runBtn.type = 'button';
  runBtn.className = 'btn btn-secondary';
  runBtn.textContent = 'Run';
  runBtn.addEventListener('click', run);
  const copyBtn = document.createElement('button');
  copyBtn.type = 'button';
  copyBtn.className = 'btn btn-text';
  copyBtn.textContent = 'Copy';
  copyBtn.addEventListener('click', copyOutput);
  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = 'btn btn-text';
  clearBtn.textContent = 'Clear';
  clearBtn.addEventListener('click', clearAll);
  const dl = createDownloadButton({ label: 'Download' });
  dl.el.addEventListener('click', () => {
    if (state.outBytes) downloadBlob(new Blob([state.outBytes]), state.outName || 'output.txt');
  });
  actions.append(dl.el, runBtn, copyBtn, clearBtn);

  const status = el('p', 'status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  actions.append(status);

  // Output field: label above the read-only textarea, both full-width.
  const outputField = el('div', 'field field-span');
  const outputLabel = el('label', 'field-label');
  outputLabel.setAttribute('for', 'text-output');
  outputLabel.textContent = 'Output';
  const output = document.createElement('textarea');
  output.id = 'text-output';
  output.className = 'field-textarea is-mono output-block';
  output.spellcheck = false;
  output.readOnly = true;
  output.placeholder = 'Result appears here\u2026';
  outputField.append(outputLabel, output);

  options.append(optionsTitle, optionsBody);
  wrap.append(tabHead, dz.el, inputField, options, actions, outputField);
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

  const b64Mode = document.createElement('select');
  b64Mode.className = 'field-select';
  for (const m of B64_MODES) {
    const o = document.createElement('option');
    o.value = m.id;
    o.textContent = m.label;
    b64Mode.append(o);
  }
  b64Mode.addEventListener('change', () => { renderOptions(); updateRun(); });

  const urlSafe = checkbox('text-urlsafe', 'URL-safe alphabet (- and _)', false);
  const uuidCount = document.createElement('input');
  uuidCount.type = 'number';
  uuidCount.className = 'field-input';
  uuidCount.id = 'text-uuid-count';
  uuidCount.min = '1';
  uuidCount.max = '1000';
  uuidCount.value = '1';
  uuidCount.autocomplete = 'off';
  uuidCount.title = 'How many UUIDs to generate (1 to 1000)';

  function setStatus(text, kind) {
    status.textContent = text || '';
    status.className = 'status' + (kind ? ` is-${kind}` : '');
  }

  function setOutput(text, name, bytes) {
    state.outText = text == null ? '' : String(text);
    state.outName = name || '';
    state.outBytes = bytes || null;
    output.value = state.outText;
    const has = state.outText.length > 0 || Boolean(bytes);
    outputLabel.textContent = name ? `Output \u00B7 ${name}` : 'Output';
    dl.setEnabled(has && Boolean(state.outBytes));
  }

  function utf8(value) {
    return new Uint8Array(new TextEncoder().encode(value));
  }

  /* ---- tabs ---- */
  function currentB64Mode() {
    return b64Mode.value === 'decode' ? 'decode' : 'encode';
  }

  function renderOptions() {
    optionsBody.replaceChildren();
    // A panel with no fields is hidden entirely — never a heading over blank
    // space. JSON has no options, so its panel is hidden.
    if (state.op === 'base64') {
      const mode = currentB64Mode();
      optionsBody.append(
        field('Mode', b64Mode),
        ...(mode === 'encode' ? [urlSafe.el] : []),
      );
      // F14: be explicit that a dropped file takes precedence over typed text.
      if (state.file) {
        const note = el('p', 'field-hint field-span');
        note.textContent = mode === 'decode'
          ? `Using the dropped file "${state.file.name}" \u2014 its text is decoded; typed text is ignored.`
          : `Using the dropped file "${state.file.name}" \u2014 its bytes are encoded; typed text is ignored.`;
        optionsBody.append(note);
      }
    } else if (state.op === 'uuid') {
      optionsBody.append(field('How many', uuidCount));
    }
    options.hidden = optionsBody.childElementCount === 0;
  }

  const INPUT_LABEL = {
    json: 'JSON document',
    base64: 'Text to encode',
    uuid: 'Ignored \u2014 UUIDs are generated, not derived from input',
    sha256: 'Text to hash (or drop a file above)',
  };
  const RUN_LABEL = {
    json: 'Format',
    base64: 'Encode',
    uuid: 'Generate',
    sha256: 'Hash text',
  };
  const PLACEHOLDER = {
    json: '{"hello":"world"}',
    base64: 'Text, or drop a file to encode its bytes\u2026',
    uuid: '',
    sha256: 'Text to hash\u2026',
  };

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

    label.textContent = INPUT_LABEL[id] || 'Input';
    input.placeholder = PLACEHOLDER[id] || '';
    inputField.hidden = id === 'uuid';

    // Secondary actions per tab.
    if (id === 'json') {
      const minifyBtn = actionBtn('Minify', () => runMinify());
      const validateBtn = actionBtn('Validate', () => runValidate());
      actions.replaceChildren(dl.el, runBtn, minifyBtn, validateBtn, copyBtn, clearBtn, status);
    } else if (id === 'base64') {
      actions.replaceChildren(dl.el, runBtn, copyBtn, clearBtn, status);
    } else if (id === 'uuid') {
      actions.replaceChildren(dl.el, runBtn, copyBtn, clearBtn, status);
    } else {
      const hashFileBtn = actionBtn('Hash dropped file', () => runHashFile());
      actions.replaceChildren(dl.el, runBtn, hashFileBtn, copyBtn, clearBtn, status);
    }

    renderOptions();
    setStatus('');
    setOutput('', '', null);
    renderFileMeta();
    updateRun();
  }

  function actionBtn(text, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-text';
    b.textContent = text;
    b.addEventListener('click', onClick);
    return b;
  }

  /* ---- file handling ---- */
  async function addFile(files) {
    const f = files && files[0];
    if (!f) return;
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      state.file = { name: f.name, size: f.size, bytes };
      setStatus('');
      renderFileMeta();
      renderOptions();
      if (state.op === 'sha256') await runHashFile();
      updateRun();
    } catch {
      setStatus('Couldn\u2019t read this file.', 'bad');
    }
  }

  function renderFileMeta() {
    if (!state.file) { dz.reset(); return; }
    dz.setMeta(`${state.file.name} \u00B7 ${formatBytes(state.file.size)}`);
  }

  function updateRun() {
    runBtn.disabled = state.busy;
    runBtn.textContent = state.busy ? 'Working\u2026' : (RUN_LABEL[state.op] || 'Run');
    if (state.op === 'base64') {
      runBtn.textContent = state.busy ? 'Working\u2026' : (currentB64Mode() === 'decode' ? 'Decode' : 'Encode');
    }
  }

  function clearAll() {
    input.value = '';
    state.file = null;
    setOutput('', '', null);
    setStatus('');
    renderFileMeta();
    renderOptions();
    updateRun();
  }

  /* ---- run ---- */
  async function run() {
    if (state.busy) return;
    state.busy = true;
    updateRun();
    try {
      if (state.op === 'json') await runJson('format');
      else if (state.op === 'base64') await runBase64Text();
      else if (state.op === 'uuid') runUuid();
      else await runHashText();
    } catch (err) {
      setStatus(errMsg(err), 'bad');
    } finally {
      state.busy = false;
      updateRun();
    }
  }

  async function runJson(mode) {
    const src = input.value;
    if (mode === 'validate') { runValidate(); return; }
    if (mode === 'minify') { runMinify(); return; }
    setStatus('Working\u2026');
    const out = formatJson(src, 2);
    setOutput(out, 'formatted.json', utf8(out));
    const v = validateJson(src);
    setStatus(v.ok ? 'Done \u2014 valid JSON, formatted.' : 'Done \u2014 formatted.', 'ok');
  }

  function runMinify() {
    try {
      const out = minifyJson(input.value);
      setOutput(out, 'minified.json', utf8(out));
      setStatus(`Done \u00B7 ${formatBytes(utf8(input.value).length)} \u2192 ${formatBytes(utf8(out).length)}.`, 'ok');
    } catch (err) {
      setStatus(errMsg(err), 'bad');
    }
  }

  function runValidate() {
    const r = validateJson(input.value);
    if (r.ok) {
      setOutput('Valid JSON.', '', null);
      setStatus('Valid JSON.', 'ok');
    } else {
      const where = r.error.line != null ? `line ${r.error.line}, column ${r.error.column}` : 'an unknown position';
      setOutput(`Invalid JSON at ${where}: ${r.error.message}`, '', null);
      setStatus(`Couldn\u2019t read this JSON. Check the syntax at ${where}.`, 'bad');
    }
  }

  async function runBase64Text() {
    const mode = currentB64Mode();
    // F14: dispatch through the pure helper so a dropped file is actually used
    // (its bytes win over typed text), respecting the URL-safe option.
    const fileBytes = state.file ? state.file.bytes : null;
    const usesFile = Boolean(fileBytes); // the file wins whenever one is present
    setStatus('Working\u2026');
    const result = runBase64({
      mode,
      text: input.value,
      fileBytes,
      urlSafe: urlSafe.input.checked,
    });
    const name = mode === 'decode' ? 'decoded.txt' : 'encoded.txt';
    setOutput(result.output, name, utf8(result.output));
    if (mode === 'decode') {
      setStatus(usesFile
        ? `Done \u2014 decoded the dropped file\u2019s text ("${state.file.name}"); the file wins over typed text.`
        : 'Done \u2014 decoded to UTF-8 text.', 'ok');
    } else {
      const srcBytes = usesFile ? state.file.bytes.length : utf8(input.value).length;
      setStatus(usesFile
        ? `Done \u2014 encoded "${state.file.name}" (${formatBytes(srcBytes)}); the file wins over typed text.`
        : `Done \u00B7 encoded ${formatBytes(srcBytes)} of text.`, 'ok');
    }
  }

  function runUuid() {
    const n = Number(uuidCount.value) || 1;
    const list = uuidMany(n);
    const text = list.join('\n');
    setOutput(text, 'uuids.txt', utf8(text));
    const capped = n > 1000 ? ' (capped at 1000)' : '';
    setStatus(`Done \u2014 ${list.length} version 4 UUID${list.length > 1 ? 's' : ''}${capped}.`, 'ok');
  }

  async function runHashText() {
    const src = input.value;
    if (src === '') { setStatus('Heads up \u2014 type some text to hash, or drop a file.', 'warn'); return; }
    setStatus('Working\u2026');
    const hex = await sha256Hex(utf8(src));
    setOutput(hex, 'sha256.txt', utf8(hex));
    setStatus(`Done \u2014 SHA-256 of ${formatBytes(utf8(src).length)} of text${subtleNote()}.`, 'ok');
  }

  async function runHashFile() {
    if (!state.file) { setStatus('Heads up \u2014 drop a file first, or type text to hash.', 'warn'); return; }
    state.busy = true;
    updateRun();
    try {
      setStatus('Working\u2026');
      const hex = await sha256Hex(state.file.bytes);
      setOutput(hex, `${state.file.name}.sha256.txt`, utf8(hex));
      setStatus(`Done \u2014 SHA-256 of "${state.file.name}" (${formatBytes(state.file.size)})${subtleNote()}.`, 'ok');
    } catch (err) {
      setStatus(errMsg(err), 'bad');
    } finally {
      state.busy = false;
      updateRun();
    }
  }

  function subtleNote() {
    return sha256HasSubtle() ? '' : ' \u00B7 using the built-in JS fallback (no Web Crypto here)';
  }

  function errMsg(err) {
    return err instanceof TextToolError ? err.message : String((err && err.message) || err);
  }

  /* ---- copy ---- */
  async function copyOutput() {
    if (!state.outText) { setStatus('Heads up \u2014 nothing to copy yet.', 'warn'); return; }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(state.outText);
      } else {
        output.select();
        document.execCommand('copy');
      }
      setStatus('Done \u2014 copied to clipboard.', 'ok');
    } catch {
      setStatus('Heads up \u2014 could not copy automatically. Select the output and copy manually.', 'warn');
    }
  }

  /* ---- init ---- */
  setOp('json');
  // setOp early-returns for the already-current tab, so run the options/state
  // sync explicitly: JSON has no options and its panel must start hidden.
  renderOptions();
  updateRun();
}