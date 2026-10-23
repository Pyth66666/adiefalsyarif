import { createDropzone, formatBytes } from '../../assets/ui.js';
import { assessFile } from './logic.js';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function mount(root) {
  let generation = 0;
  let destroyed = false;
  const wrap = element('div', 'stack filetype-tool');
  const drop = createDropzone({ multiple: true, title: 'Drop files here',
    note: 'Any file type · up to 50 files · reads only the first 64 KB of each',
    ariaLabel: 'Choose files to check or drop them here', onFiles: inspect });
  const clear = element('button', 'btn btn-text', 'Clear'); clear.type = 'button';
  const status = element('p', 'status', 'Add files to check their type.');
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const actions = element('div', 'status-row row'); actions.append(clear, status);
  const error = element('div');
  const results = element('div', 'stack-sm');
  wrap.append(drop.el, error, actions, results); root.append(wrap);

  function reset() {
    generation++;
    results.replaceChildren(); error.replaceChildren();
    drop.setCompact(false);
    status.textContent = 'Add files to check their type.';
  }
  clear.addEventListener('click', reset);

  function render(file, result) {
    const item = element('section', 'panel stack-sm');
    item.append(element('h2', 'panel-title', file.name || '(unnamed file)'));
    item.append(element('p', 'field-hint', `Size: ${formatBytes(file.size)} · Detected: ${result.type.label}`));
    item.append(element('p', 'field-hint', `Claimed extension: ${result.extension ? '.' + result.extension : '(none)'} · Browser MIME: ${result.claimed || '(none)'}`));
    const mismatch = result.extensionMatch === false || result.mimeMatch === false;
    const verdict = element('p', `status${mismatch ? ' is-bad' : ''}`,
      mismatch ? 'MISMATCH: detected bytes disagree with the extension or browser MIME.' :
        result.type.id === 'unknown' || result.type.id === 'empty' ? 'Type uncertain: no recognizable signature.' :
          'No mismatch found in the available evidence.');
    item.append(verdict);
    if (result.dangerous) {
      const warning = element('p', 'block block-error', 'Warning: dangerous executable disguised as a document or other harmless file. Do not open it.');
      warning.setAttribute('role', 'alert'); item.append(warning);
    }
    results.append(item);
  }

  async function inspect(files) {
    const token = ++generation;
    results.replaceChildren(); error.replaceChildren();
    const selected = files.slice(0, 50);
    if (files.length > 50) {
      const warning = element('p', 'block block-warning', 'Only the first 50 files were checked.');
      warning.setAttribute('role', 'alert'); error.append(warning);
    }
    drop.setCompact(true, `${selected.length} file(s)`);
    const replace = element('button', 'btn btn-text', 'Replace'); replace.type = 'button';
    replace.addEventListener('click', () => drop.open()); drop.setCompactActions([replace]);
    for (const [index, file] of selected.entries()) {
      if (destroyed || token !== generation) return;
      status.textContent = `Working: ${index + 1} of ${selected.length} files.`;
      try {
        const bytes = new Uint8Array(await file.slice(0, 65536).arrayBuffer());
        if (destroyed || token !== generation) return;
        render(file, assessFile(file.name, file.type, bytes, file.size));
      } catch {
        if (destroyed || token !== generation) return;
        const warning = element('p', 'block block-error', `Could not read ${file.name || 'this file'}. Try choosing it again.`);
        warning.setAttribute('role', 'alert'); results.append(warning);
      }
    }
    status.textContent = `Checked ${selected.length} file(s). Files stayed on this device.`;
  }
  return () => { destroyed = true; generation++; };
}
