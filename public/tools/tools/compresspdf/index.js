import { createDropzone, createDownloadButton, downloadBlob, formatBytes } from '../../assets/ui.js';
import { assetUrl } from '../../assets/assetUrl.js';
import { compressPdf } from './logic.js';
import { withOrientationReset } from '../imgpdf/logic.js';

const PDFLIB_URL = assetUrl('../../vendor/pdf-lib/pdf-lib.min.js', import.meta.url);
let libPromise;
function loadPdfLib() {
  if (window.PDFLib) return Promise.resolve(window.PDFLib);
  if (libPromise) return libPromise;
  libPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-pdflib]');
    const script = existing || document.createElement('script');
    script.src = PDFLIB_URL;
    script.async = true;
    script.dataset.pdflib = '1';
    script.addEventListener('load', () => window.PDFLib ? resolve(window.PDFLib) : reject(new Error('Bundled PDF library is unavailable.')));
    script.addEventListener('error', () => { libPromise = null; reject(new Error('Bundled PDF library is unavailable.')); });
    if (!existing) document.head.append(script);
  });
  return libPromise;
}

function node(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
}

export function mount(root) {
  let file = null;
  let output = null;
  let busy = false;
  let destroyed = false;
  let generation = 0;

  const wrap = node('div', 'stack compresspdf-tool');
  const drop = createDropzone({
    multiple: false, accept: 'application/pdf,.pdf', title: 'Drop a PDF here',
    note: 'One PDF file · processed locally', ariaLabel: 'Choose one PDF or drop it here',
    onFiles: async (files) => {
      if (busy || destroyed) return;
      const next = files[0];
      if (!next) return;
      if (!/\.pdf$/i.test(next.name) && next.type !== 'application/pdf') {
        showError('Couldn’t read this file. Add a PDF file.');
        return;
      }
      file = next;
      output = null;
      error.replaceChildren();
      setStatus(`Added ${next.name} · ${formatBytes(next.size)}.`);
      render();
    },
  });
  const options = node('div', 'panel');
  const heading = node('h2', 'panel-title', 'Options');
  const fields = node('div', 'field-grid');
  const qualityLabel = node('label', 'field');
  const qualityText = node('span', 'field-label', 'JPEG quality');
  const quality = node('input');
  quality.type = 'range'; quality.min = '1'; quality.max = '100'; quality.value = '60'; quality.id = 'compresspdf-quality';
  const qualityValue = node('span', 'field-hint', '60%');
  qualityLabel.append(qualityText, quality, qualityValue);
  const dimensionLabel = node('label', 'field');
  dimensionLabel.append(node('span', 'field-label', 'Maximum image dimension'));
  const dimension = node('select', 'field-select');
  dimension.id = 'compresspdf-dimension';
  for (const [value, label] of [['', 'None'], ['2000', '2000 px'], ['1500', '1500 px'], ['1000', '1000 px']]) {
    const option = node('option', '', label); option.value = value; dimension.append(option);
  }
  dimensionLabel.append(dimension);
  fields.append(qualityLabel, dimensionLabel);
  options.append(heading, fields);
  const error = node('div');
  const results = node('div', 'results');
  const actions = node('div', 'status-row row');
  const primary = createDownloadButton({ label: 'Compress PDF' });
  const clear = node('button', 'btn btn-text', 'Clear'); clear.type = 'button';
  const status = node('p', 'status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  actions.append(primary.el, clear, status);
  wrap.append(drop.el, error, options, actions, results);
  root.append(wrap);

  function setStatus(text, kind) { status.textContent = text; status.className = `status${kind ? ` is-${kind}` : ''}`; }
  function showError(text) {
    error.replaceChildren();
    const block = node('div', 'block block-error', text);
    block.setAttribute('role', 'alert'); error.append(block);
    setStatus('Couldn’t compress this PDF.', 'bad');
  }
  function render() {
    options.hidden = !file;
    primary.setEnabled(!!file && !busy);
    primary.setLabel(busy ? 'Working…' : output?.savings.smaller ? 'Download compressed PDF' : 'Compress PDF');
    clear.disabled = busy;
    drop.setCompact(!!file, file ? `1 file · ${formatBytes(file.size)}` : '');
    if (file) {
      const replace = node('button', 'btn btn-text', 'Replace'); replace.type = 'button';
      replace.disabled = busy; replace.addEventListener('click', () => drop.open());
      drop.setCompactActions([replace]);
    }
    results.replaceChildren();
    if (!output || !file) return;
    const { savings, recompressed, skipped, bytes } = output;
    const summary = node('p', 'field-hint',
      `Before: ${formatBytes(file.size)} · After: ${formatBytes(bytes.length)} · Saved: ${savings.percent.toFixed(1)}% · Images recompressed: ${recompressed} · Skipped: ${skipped}.`);
    results.append(summary);
    if (!savings.smaller) {
      results.append(node('p', 'field-hint', 'The output is not smaller. Keep the original PDF instead.'));
      const original = node('button', 'btn btn-secondary', 'Download original PDF');
      original.type = 'button'; original.addEventListener('click', () => downloadBlob(file, file.name));
      results.append(original);
    }
  }
  function invalidate() { generation++; output = null; results.replaceChildren(); if (file) setStatus('Options changed. Compress again.'); render(); }
  quality.addEventListener('input', () => { qualityValue.textContent = `${quality.value}%`; if (!busy) invalidate(); });
  dimension.addEventListener('change', () => { if (!busy) invalidate(); });
  clear.addEventListener('click', () => { if (busy) return; file = null; output = null; error.replaceChildren(); setStatus('Add a PDF to begin.'); render(); });
  primary.el.addEventListener('click', async () => {
    if (!file || busy) return;
    if (output?.savings.smaller) {
      downloadBlob(new Blob([output.bytes], { type: 'application/pdf' }), file.name.replace(/\.pdf$/i, '') + '-compressed.pdf');
      return;
    }
    busy = true;
    quality.disabled = true; dimension.disabled = true;
    const token = generation;
    const current = file;
    render(); setStatus('Working…'); error.replaceChildren();
    try {
      const lib = await loadPdfLib();
      if (destroyed || token !== generation) return;
      const bytes = new Uint8Array(await current.arrayBuffer());
      if (destroyed || token !== generation) return;
      const result = await compressPdf(bytes, {
        lib, quality: Number(quality.value), maxDimension: Number(dimension.value) || null,
        encode, cancelled: () => destroyed || token !== generation,
        onProgress: (done, total) => { if (!destroyed) setStatus(`Working… ${done} of ${total} images`); },
      });
      if (!result || destroyed || token !== generation) return;
      output = result;
      const { savings, recompressed, skipped } = result;
      setStatus(savings.smaller
        ? `Done · ${savings.percent.toFixed(1)}% saved · ${recompressed} images recompressed, ${skipped} skipped.`
        : 'Done · The output is not smaller; the original is available below.', savings.smaller ? 'ok' : '');
      render();
      if (savings.smaller) primary.el.focus();
    } catch (err) {
      if (!destroyed) showError(err.message === 'This PDF is password-protected or encrypted and cannot be compressed.' ||
        err.message === 'This file is not a valid PDF or is damaged.' ? err.message : 'Could not process this PDF. Check that the file is valid and try again.');
    } finally { busy = false; if (!destroyed) { quality.disabled = false; dimension.disabled = false; render(); } }
  });

  async function encode({ jpeg, pixels, width, height, target, quality: q }) {
    let bitmap = null;
    let source = null;
    const canvas = document.createElement('canvas');
    try {
      if (jpeg) {
        // The PDF's dimensions describe raw JPEG pixels. Some browsers still
        // honour embedded EXIF even with imageOrientation:'none'.
        bitmap = await createImageBitmap(new Blob([withOrientationReset(jpeg)], { type: 'image/jpeg' }), { imageOrientation: 'none' });
        if (bitmap.width !== width || bitmap.height !== height) throw new Error('Unexpected JPEG dimensions');
      } else {
        source = document.createElement('canvas'); source.width = width; source.height = height;
        const ctx = source.getContext('2d');
        if (!ctx) throw new Error('Canvas unavailable');
        ctx.putImageData(new ImageData(pixels, width, height), 0, 0);
        bitmap = await createImageBitmap(source);
      }
      canvas.width = target.width; canvas.height = target.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, target.width, target.height);
      ctx.drawImage(bitmap, 0, 0, target.width, target.height);
      const blob = await new Promise((resolve, reject) => canvas.toBlob(
        (b) => b && b.type === 'image/jpeg' ? resolve(b) : reject(new Error('JPEG encoding unavailable')),
        'image/jpeg', q / 100));
      return { bytes: new Uint8Array(await blob.arrayBuffer()) };
    } finally {
      bitmap?.close?.();
      canvas.width = 0; canvas.height = 0;
      if (source) { source.width = 0; source.height = 0; }
    }
  }
  setStatus('Add a PDF to begin.'); render();
  return () => { destroyed = true; generation++; file = null; output = null; };
}
