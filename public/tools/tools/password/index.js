import { estimatePassword, generatePassphrase } from './logic.js';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function duration(seconds) {
  if (seconds < 1) return 'under a second';
  for (const [unit, size] of [['year', 31557600], ['day', 86400], ['hour', 3600], ['minute', 60], ['second', 1]]) {
    if (seconds >= size) {
      const amount = seconds / size;
      return `${amount >= 1e12 ? 'over a trillion' : amount >= 100 ? Math.round(amount).toLocaleString() : Number(amount.toPrecision(2)).toLocaleString()} ${unit}${amount >= 2 ? 's' : ''}`;
    }
  }
  return 'under a second';
}

export function mount(root) {
  const wrap = element('div', 'stack password-tool');
  const note = element('p', 'field-hint', 'Local estimate only, not a security guarantee. Nothing you type is sent or stored. Never reuse a password; real attackers may use smarter guesses.');
  const field = element('div', 'field');
  const label = element('label', 'field-label', 'Password to check'); label.htmlFor = 'password-input';
  const input = element('input', 'field-input');
  input.id = 'password-input'; input.type = 'password'; input.autocomplete = 'off'; input.spellcheck = false;
  input.setAttribute('autocapitalize', 'off');
  const actions = element('div', 'row');
  const toggle = element('button', 'btn btn-text', 'Show password');
  toggle.id = 'password-toggle'; toggle.type = 'button'; toggle.setAttribute('aria-controls', input.id);
  toggle.setAttribute('aria-pressed', 'false');
  const clear = element('button', 'btn btn-text', 'Clear'); clear.type = 'button'; clear.id = 'password-clear';
  actions.append(toggle, clear); field.append(label, input, actions);
  const status = element('p', 'status', 'Enter a password to see an estimate.');
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const result = element('section', 'stack-sm'); result.hidden = true;
  const heading = element('h2', '', 'Estimated strength');
  const score = element('p'); const guesses = element('p'); const times = element('p');
  const hintHeading = element('h3', '', 'Ways to improve'); const hints = element('ul');
  result.append(heading, score, guesses, times, hintHeading, hints);
  const generator = element('section', 'stack-sm');
  const genHeading = element('h2', '', 'Optional passphrase generator');
  const genNote = element('p', 'field-hint', 'Five independent words from a local 2,048-word list, selected with cryptographic randomness. The stated bits assume uniform selection, a private result, and no modifications. Do not use the checked password as a passphrase.');
  const generate = element('button', 'btn btn-primary', 'Generate passphrase'); generate.type = 'button';
  const generated = element('div', 'field'); generated.hidden = true;
  const generatedLabel = element('label', 'field-label', 'Generated passphrase'); generatedLabel.htmlFor = 'password-generated';
  const generatedInput = element('input', 'field-input'); generatedInput.id = 'password-generated';
  generatedInput.type = 'text'; generatedInput.readOnly = true; generatedInput.autocomplete = 'off'; generatedInput.spellcheck = false;
  const generatedBits = element('p', 'field-hint');
  generated.append(generatedLabel, generatedInput, generatedBits);
  const error = element('p', 'block block-error'); error.hidden = true; error.setAttribute('role', 'alert');
  generator.append(genHeading, genNote, generate, error, generated);
  wrap.append(note, field, status, result, generator); root.append(wrap);

  function update() {
    if (!input.value) { result.hidden = true; status.textContent = 'Enter a password to see an estimate.'; return; }
    const estimate = estimatePassword(input.value);
    score.textContent = `Score ${estimate.score} of 4 (${Math.round(estimate.bits)} estimated bits).`;
    guesses.textContent = `Estimated guesses: ${estimate.guesses.toExponential(2)}.`;
    times.textContent = `Estimated average crack time: offline fast hash at 10 billion guesses/second: ${duration(estimate.guesses / 2e10)}; online at 10 guesses/second: ${duration(estimate.guesses / 20)}. Rates are examples, not predictions.`;
    hints.replaceChildren(...estimate.hints.map((hint) => element('li', '', hint)));
    result.hidden = false;
    status.textContent = 'Estimate updated locally.';
  }
  input.addEventListener('input', update);
  toggle.addEventListener('click', () => {
    const visible = input.type === 'password';
    input.type = visible ? 'text' : 'password';
    toggle.textContent = visible ? 'Hide password' : 'Show password';
    toggle.setAttribute('aria-pressed', String(visible));
  });
  clear.addEventListener('click', () => { input.value = ''; update(); input.focus(); });
  generate.addEventListener('click', () => {
    error.hidden = true; error.textContent = ''; generated.hidden = true; generatedInput.value = '';
    try {
      const phrase = generatePassphrase();
      generatedInput.value = phrase.passphrase;
      generatedBits.textContent = `${phrase.bits} bits from ${phrase.words.length} uniformly chosen words (assuming the phrase remains private).`;
      generated.hidden = false;
    } catch {
      error.textContent = 'Could not generate a passphrase: cryptographic randomness is unavailable.';
      error.hidden = false;
    }
  });
  return () => { input.value = ''; generatedInput.value = ''; score.textContent = ''; guesses.textContent = ''; times.textContent = ''; hints.replaceChildren(); };
}
