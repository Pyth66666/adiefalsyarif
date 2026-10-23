import { calculate, contains, splitCIDR, summarize } from './logic.js';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function field(id, label, multiline = false, readOnly = false) {
  const wrap = element('div', 'field');
  const caption = element('label', 'field-label', label);
  caption.htmlFor = id;
  const control = element(multiline ? 'textarea' : 'input', multiline ? 'field-textarea is-mono' : 'field-input');
  control.id = id; control.spellcheck = false; control.autocomplete = 'off'; control.readOnly = readOnly;
  if (readOnly) control.classList.add('output-block');
  wrap.append(caption, control);
  return { wrap, control };
}

export function mount(root) {
  const tool = element('div', 'stack cidr-tool');
  tool.append(element('p', 'field-hint', 'Calculations stay on this device. No network requests or storage. IPv4 /31 and IPv6 /127 include both endpoints.'));
  const input = field('cidr-input', 'IP / CIDR (address, /prefix, netmask or wildcard)');
  const result = field('cidr-result', 'Network details', true, true);
  const checkIP = field('cidr-check-ip', 'IP to check');
  const checkRange = field('cidr-check-range', 'CIDR to check against');
  const splitCount = field('cidr-split-count', 'Number of equal subnets (power of two, max 1024)');
  splitCount.control.type = 'number'; splitCount.control.min = '1'; splitCount.control.max = '1024'; splitCount.control.step = '1';
  const list = field('cidr-list', 'CIDRs to summarize (one per line)', true);
  const output = field('cidr-output', 'Check, split or summary output', true, true);
  const actions = element('div', 'row status-row');
  const run = element('button', 'btn btn-primary', 'Calculate'); run.type = 'button'; run.id = 'cidr-calculate';
  const clear = element('button', 'btn btn-text', 'Clear'); clear.type = 'button';
  const status = element('p', 'status', 'Enter an address to calculate.');
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  actions.append(run, clear, status);
  const error = element('p', 'block block-error'); error.hidden = true; error.setAttribute('role', 'alert');
  const checkButton = element('button', 'btn btn-secondary', 'Check membership'); checkButton.type = 'button';
  const splitButton = element('button', 'btn btn-secondary', 'Split CIDR'); splitButton.type = 'button';
  const summaryButton = element('button', 'btn btn-secondary', 'Summarize CIDRs'); summaryButton.type = 'button';
  const check = element('section', 'stack-sm'); check.append(element('h2', '', 'Membership'), checkIP.wrap, checkRange.wrap, checkButton);
  const split = element('section', 'stack-sm'); split.append(element('h2', '', 'Split'), splitCount.wrap, splitButton);
  const summary = element('section', 'stack-sm'); summary.append(element('h2', '', 'Summarize / aggregate'), list.wrap, summaryButton);
  tool.append(input.wrap, actions, error, result.wrap, check, split, summary, output.wrap);
  root.append(tool);

  const fields = [input, result, checkIP, checkRange, splitCount, list, output];
  function reset() { result.control.value = ''; output.control.value = ''; error.hidden = true; error.textContent = ''; status.textContent = 'Enter an address to calculate.'; }
  for (const item of [input, checkIP, checkRange, splitCount, list]) item.control.addEventListener('input', reset);
  function execute(fn, destination) {
    reset();
    try { destination.control.value = fn(); status.textContent = 'Calculated locally.'; }
    catch (cause) { error.textContent = cause.message; error.hidden = false; status.textContent = 'Could not calculate. Check the input.'; }
  }
  run.addEventListener('click', () => execute(() => {
    const data = calculate(input.control.value);
    const rows = [
      ['Address', data.address], ['Network', data.cidr],
      ...(data.broadcast ? [['Broadcast', data.broadcast]] : []),
      ['First usable', data.first], ['Last usable', data.last], ['Usable hosts', data.hostCount.toString()],
      ...(data.netmask ? [['Netmask', data.netmask], ['Wildcard', data.wildcard], ['IPv4 class', data.ipClass]] :
        [['Expanded IPv6', data.expanded], ['Compressed IPv6', data.address]]),
      ['Address type', data.type], ['Binary address', data.binary.replace(/(.{8})/g, '$1 ').trim()],
    ];
    return rows.map(([label, value]) => `${label}: ${value}`).join('\n');
  }, result));
  checkButton.addEventListener('click', () => execute(() => `${checkIP.control.value.trim()} ${contains(checkIP.control.value, checkRange.control.value) ? 'belongs' : 'does not belong'} to ${checkRange.control.value.trim()}.`, output));
  splitButton.addEventListener('click', () => execute(() => splitCIDR(input.control.value, Number(splitCount.control.value)).join('\n'), output));
  summaryButton.addEventListener('click', () => execute(() => summarize(list.control.value).join('\n'), output));
  clear.addEventListener('click', () => { for (const item of fields) item.control.value = ''; reset(); input.control.focus(); });
  return () => { for (const item of fields) item.control.value = ''; reset(); };
}
