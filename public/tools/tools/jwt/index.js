import { decodeJwt, describeClaims } from './logic.js';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function field(id, label, readOnly = false) {
  const container = element('div', 'field');
  const caption = element('label', 'field-label', label);
  caption.htmlFor = id;
  const textarea = element('textarea', `field-textarea is-mono${readOnly ? ' output-block' : ''}`);
  textarea.id = id;
  textarea.spellcheck = false;
  textarea.autocomplete = 'off';
  textarea.readOnly = readOnly;
  container.append(caption, textarea);
  return { container, textarea };
}

export function mount(root) {
  const wrap = element('div', 'stack jwt-tool');
  const note = element('p', 'block block-warning', 'Decoded only: not verified - do not trust claims. No signature verification is performed. Your token stays in this browser tab and is never sent or stored.');
  const input = field('jwt-input', 'JWT token');
  const actions = element('div', 'status-row row');
  const decode = element('button', 'btn btn-secondary', 'Decode');
  decode.type = 'button'; decode.id = 'jwt-decode';
  const clear = element('button', 'btn btn-text', 'Clear');
  clear.type = 'button'; clear.id = 'jwt-clear';
  const status = element('p', 'status', 'Paste a JWT to inspect its claims.');
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  actions.append(decode, clear, status);
  const error = element('p', 'block block-error');
  error.setAttribute('role', 'alert'); error.hidden = true;
  const results = element('div', 'stack'); results.hidden = true;
  const header = field('jwt-header', 'Header (decoded JSON)', true);
  const payload = field('jwt-payload', 'Payload (decoded JSON)', true);
  const signature = field('jwt-signature', 'Signature (raw base64url; not verified)', true);
  const claims = element('section', 'stack-sm');
  claims.append(element('h2', '', 'Time claims (local time)'));
  results.append(header.container, payload.container, claims, signature.container);
  wrap.append(note, input.container, actions, error, results);
  root.append(wrap);

  function resetResults() {
    results.hidden = true;
    header.textarea.value = '';
    payload.textarea.value = '';
    signature.textarea.value = '';
    claims.replaceChildren(element('h2', '', 'Time claims (local time)'));
    error.hidden = true;
    error.textContent = '';
  }

  input.textarea.addEventListener('input', () => {
    resetResults();
    status.textContent = 'Paste a JWT to inspect its claims.';
  });
  clear.addEventListener('click', () => {
    input.textarea.value = '';
    resetResults();
    status.textContent = 'Paste a JWT to inspect its claims.';
    input.textarea.focus();
  });
  decode.addEventListener('click', () => {
    resetResults();
    try {
      const decoded = decodeJwt(input.textarea.value);
      const details = describeClaims(decoded);
      header.textarea.value = JSON.stringify(decoded.header, null, 2);
      payload.textarea.value = JSON.stringify(decoded.payload, null, 2);
      signature.textarea.value = decoded.signature;
      for (const name of ['exp', 'iat', 'nbf']) {
        const claim = details[name];
        if (claim) claims.append(element('p', 'field-hint', `${name}: ${claim.local}${claim.relative ? ` (${claim.relative})` : ''}`));
      }
      for (const warning of details.warnings) claims.append(element('p', 'block block-warning', warning));
      results.hidden = false;
      status.textContent = 'Decoded locally. Signature not verified - do not trust claims.';
    } catch (cause) {
      error.textContent = `Could not decode JWT. ${cause.message} Check the token and try again.`;
      error.hidden = false;
      status.textContent = 'Could not decode JWT.';
    }
  });

  return () => { input.textarea.value = ''; resetResults(); };
}
