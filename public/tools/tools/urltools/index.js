import { processOne, processBatch } from './logic.js';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function mount(root) {
  const wrap = element('div', 'stack urltools-tool');
  const note = element('p', 'field-hint', 'Processed locally. No links are opened or fetched; nothing is sent or stored. Parse results identify the actual host, but are not a safety verdict.');
  const modeField = element('div', 'field');
  const modeLabel = element('label', 'field-label', 'Operation');
  modeLabel.htmlFor = 'urltools-mode';
  const mode = element('select', 'field-select');
  mode.id = 'urltools-mode';
  for (const [value, label] of [['encode', 'Encode URL component'], ['decode', 'Decode URL component'], ['parse', 'Parse full URL'], ['defang', 'Defang'], ['refang', 'Refang']]) {
    const option = element('option', '', label);
    option.value = value;
    mode.append(option);
  }
  modeField.append(modeLabel, mode);

  const batchField = element('label', 'check-row');
  const batch = element('input');
  batch.type = 'checkbox'; batch.id = 'urltools-batch';
  batchField.append(batch, element('span', '', 'Batch mode (one item per line, up to 1000 lines)'));

  const inputField = element('div', 'field');
  const inputLabel = element('label', 'field-label', 'Input');
  inputLabel.htmlFor = 'urltools-input';
  const input = element('textarea', 'field-textarea is-mono');
  input.id = 'urltools-input'; input.spellcheck = false; input.autocomplete = 'off';
  inputField.append(inputLabel, input);

  const actions = element('div', 'status-row row');
  const run = element('button', 'btn btn-secondary', 'Process');
  run.type = 'button'; run.id = 'urltools-run';
  const clear = element('button', 'btn btn-text', 'Clear');
  clear.type = 'button'; clear.id = 'urltools-clear';
  const status = element('p', 'status', 'Enter text to process.');
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  actions.append(run, clear, status);
  const error = element('p', 'block block-error');
  error.setAttribute('role', 'alert'); error.hidden = true;

  const outputField = element('div', 'field');
  const outputLabel = element('label', 'field-label', 'Plain-text output');
  outputLabel.htmlFor = 'urltools-output';
  const output = element('textarea', 'field-textarea is-mono output-block');
  output.id = 'urltools-output'; output.readOnly = true; output.spellcheck = false;
  outputField.append(outputLabel, output);
  wrap.append(note, modeField, batchField, inputField, actions, error, outputField);
  root.append(wrap);

  function reset() {
    output.value = '';
    error.hidden = true;
    error.textContent = '';
    status.textContent = 'Enter text to process.';
  }
  input.addEventListener('input', reset);
  mode.addEventListener('change', reset);
  batch.addEventListener('change', reset);
  clear.addEventListener('click', () => {
    input.value = '';
    reset();
    input.focus();
  });
  run.addEventListener('click', () => {
    reset();
    if (!input.value) {
      error.textContent = 'Enter text before processing.';
      error.hidden = false;
      return;
    }
    const result = batch.checked ? processBatch(input.value, mode.value) : processOne(input.value, mode.value);
    if (!result.ok) {
      error.textContent = result.error;
      error.hidden = false;
      status.textContent = 'Could not process input.';
    } else {
      output.value = result.output;
      status.textContent = batch.checked ? `Done: ${result.count} lines processed locally.` : 'Done: processed locally.';
    }
  });
  return () => { input.value = ''; reset(); };
}
