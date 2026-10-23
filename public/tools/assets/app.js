// App shell: renders the tool list in the sidebar, wires the search filter,
// opens tools and manages the narrow-screen top block. Tools are loaded
// lazily once their modules exist. No icons, no emoji — text only.
import { TOOLS, findTool, groupTools } from './tools.js';
import { isExternalRequest } from './netwatch.js';
import { createGeneration } from '../tools/image/image.js';

const sidebar = document.querySelector('.sidebar');
const listEl = document.getElementById('tool-list');
const homeGroupListEl = document.getElementById('home-group-list');
const searchEl = document.getElementById('tool-search');
const clearEl = document.getElementById('search-clear');
const countEl = document.getElementById('search-count');
const emptyEl = document.getElementById('empty-state');
const emptyMsgEl = document.getElementById('empty-message');

const homeView = document.getElementById('home-view');
const toolView = document.getElementById('tool-view');
const toolTitle = document.getElementById('tool-title');
const toolDesc = document.getElementById('tool-desc');
const toolMount = document.getElementById('tool-mount');
const backBtn = document.getElementById('back-btn');
const netWatch = document.getElementById('network-watch');

/* ---------- tool list ---------- */

/** Monotonic counter so every rendered group heading gets a unique id. */
let groupSeq = 0;

/**
 * One row for a tool. Placeholder (soon) tools are a non-interactive `div`
 * with a muted "Coming soon" line; real tools are a `<button>`.
 */
function buildToolRow(tool) {
  const row = tool.soon ? document.createElement('div') : document.createElement('button');
  if (!tool.soon) row.type = 'button';
  row.className = 'tool-row' + (tool.soon ? ' is-soon' : '');
  row.dataset.id = tool.id;

  const name = document.createElement('span');
  name.className = 'tool-row-name';
  name.textContent = tool.name;

  const desc = document.createElement('span');
  desc.className = 'tool-row-desc';
  desc.textContent = tool.desc;

  row.append(name, desc);

  if (tool.soon) {
    const soon = document.createElement('span');
    soon.className = 'tool-row-soon';
    soon.textContent = 'Coming soon';
    row.append(soon);
  }
  return row;
}

/**
 * Rebuild one grouped tool list (the sidebar `<ul>` or the home `<ul>`).
 * Each non-empty group becomes an `<li>` holding an `h3.tool-group-title`
 * (announced as a heading, and the group's `role="group"` is labelled by it)
 * followed by the group's tool rows. Empty categories never render.
 */
function renderGroupedList(listEl, groups) {
  const frag = document.createDocumentFragment();
  for (const { category, tools } of groups) {
    groupSeq += 1;
    const titleId = `${listEl.id}-group-${groupSeq}`;

    const groupLi = document.createElement('li');
    groupLi.className = 'tool-group';

    const title = document.createElement('h3');
    title.className = 'tool-group-title';
    title.id = titleId;
    title.textContent = category.name;

    const sublist = document.createElement('ul');
    sublist.className = 'tool-group-items';
    sublist.setAttribute('role', 'group');
    sublist.setAttribute('aria-labelledby', titleId);

    for (const tool of tools) {
      const toolLi = document.createElement('li');
      toolLi.append(buildToolRow(tool));
      sublist.append(toolLi);
    }

    groupLi.append(title, sublist);
    frag.append(groupLi);
  }
  listEl.replaceChildren(frag);
}

function renderList() {
  renderGroupedList(listEl, groupTools(TOOLS, ''));
}

// Home view: the same tools, grouped the same way, as a simple readable list.
function renderHomeList() {
  renderGroupedList(homeGroupListEl, groupTools(TOOLS, ''));
}

// Re-render the sidebar from the current search term. The grouping/filtering
// is the pure groupTools() helper; here we only update the a11y count, the
// clear button and the empty message, exactly as before.
function filterList() {
  const q = searchEl.value.trim();
  const groups = groupTools(TOOLS, q);
  const shown = groups.reduce((n, g) => n + g.tools.length, 0);

  renderGroupedList(listEl, groups);

  // The rebuilt rows are new nodes, so re-apply the current-tool indicator
  // (searching while a tool is open must not drop its highlight).
  markCurrent(currentToolId);

  clearEl.hidden = q.length === 0;
  emptyEl.hidden = shown !== 0;
  if (q) emptyMsgEl.textContent = `No tools match \u201C${q}\u201D.`;
  countEl.textContent = q ? `${shown} of ${TOOLS.length} tools` : '';
}

/* ---------- views ---------- */

const HOME_HASH = '#/';

/** Tool currently mounted in the tool view (null while on home). */
let currentToolId = null;

/**
 * Cleanup registered by the mounted tool (its mount() return value or its
 * exported unmount()). Called before the mount is cleared and when navigating
 * away (review F09: floating bars, observers, caches and object URLs must be
 * released, not orphaned on document.body).
 */
let currentCleanup = null;

/** The module object of the currently mounted tool (for its exported unmount). */
let currentModule = null;

/**
 * Navigation generation token (review F08). Bumped on every openTool/closeTool
 * so a lazy-loaded tool that resolves after the user has already left (or
 * opened another tool) does not mount into a container that is no longer
 * theirs — e.g. PDF then quickly Image, or a tool mounting after going home.
 */
const navGen = createGeneration();

/** Run the mounted tool's cleanup (returned by mount or exported unmount). */
function teardownCurrentTool(mod) {
  const cleanup = currentCleanup;
  currentCleanup = null;
  if (typeof cleanup === 'function') {
    try { cleanup(); } catch { /* a failed cleanup must not break navigation */ }
  }
  // Also honour a module-level unmount() if one is exported and no cleanup was
  // returned, so both lifecycle styles are supported.
  if (!cleanup && mod && typeof mod.unmount === 'function') {
    try { mod.unmount(); } catch { /* ignore */ }
  }
}

/** Read the tool id from the location hash ('#/pdf' -> 'pdf'; '#/' -> null). */
function toolIdFromHash() {
  const raw = (location.hash || '').replace(/^#\/?/, '').trim().toLowerCase();
  const tool = raw ? findTool(raw) : null;
  return tool && !tool.soon ? tool.id : null;
}

function markCurrent(id) {
  for (const row of listEl.querySelectorAll('.tool-row')) {
    const on = row.dataset.id === id;
    row.classList.toggle('is-current', on);
    if (on) row.setAttribute('aria-current', 'true');
    else row.removeAttribute('aria-current');
  }
}

function openTool(id, opts = {}) {
  const tool = findTool(id);
  if (!tool) return;

  // Re-opening the already-open tool (e.g. a trailing hashchange) would reset
  // its state; keep the mounted view as-is.
  if (opts.fromRoute && currentToolId === id) return;

  // Any previously mounted tool is leaving: release its resources and
  // invalidate its in-flight load (its .then must not mount into the new view).
  teardownCurrentTool(currentModule);
  currentModule = null;
  const gen = navGen.next();

  toolTitle.textContent = tool.name;
  toolDesc.textContent = tool.desc;
  toolMount.replaceChildren();

  if (tool.soon || typeof tool.load !== 'function') {
    toolMount.append(buildPlaceholder());
  } else {
    // Lazy-load the tool module when it exists.
    tool.load()
      .then((mod) => {
        if (!navGen.isCurrent(gen)) return; // navigated away while loading
        if (typeof mod.mount === 'function') {
          currentModule = mod;
          currentCleanup = mod.mount(toolMount, tool) || null;
        } else {
          toolMount.append(buildPlaceholder());
        }
      })
      .catch(() => {
        if (!navGen.isCurrent(gen)) return;
        toolMount.append(buildPlaceholder());
      });
  }

  markCurrent(id);
  currentToolId = id;
  sidebar.classList.remove('is-home');
  homeView.hidden = true;
  toolView.hidden = false;
  backBtn.hidden = false;
  document.title = `${tool.name} \u00B7 Utility Hub`;
  if (!opts.keepFocus) toolTitle.focus();
  window.scrollTo(0, 0);

  // Keep the address bar in sync without re-triggering hashchange routing.
  const target = `#/${tool.id}`;
  if (location.hash !== target && !opts.fromRoute) location.hash = target;
}

function buildPlaceholder() {
  const p = document.createElement('p');
  p.className = 'block block-warning';
  p.textContent = 'This tool is planned for a later step.';
  return p;
}

function closeTool(opts = {}) {
  // Leaving the tool view: release the mounted tool's resources and invalidate
  // any lazy load still in flight so it cannot mount after we return home.
  teardownCurrentTool(currentModule);
  currentModule = null;
  navGen.next();
  currentToolId = null;
  homeView.hidden = false;
  toolView.hidden = true;
  backBtn.hidden = true;
  toolMount.replaceChildren();
  markCurrent(null);
  sidebar.classList.add('is-home');
  document.title = 'Utility Hub';
  window.scrollTo(0, 0);
  if (!opts.fromRoute && location.hash && location.hash !== HOME_HASH) {
    location.hash = HOME_HASH;
  }
}

/* ---------- hash routing ---------- */
// Tools are bookmarkable: '#/pdf', '#/image', '#/text', '#/qr'; '#/' is home.
// Unknown hashes fall back to home. Opening a tool updates the hash so the
// browser Back button returns to the previous view.

function applyHash() {
  const id = toolIdFromHash();
  if (id) openTool(id, { fromRoute: true });
  else closeTool({ fromRoute: true });
}

window.addEventListener('hashchange', applyHash);

/* ---------- wiring ---------- */

function onToolListClick(e) {
  const row = e.target.closest('.tool-row');
  if (!row || row.classList.contains('is-soon')) return;
  openTool(row.dataset.id);
}

listEl.addEventListener('click', onToolListClick);
homeGroupListEl.addEventListener('click', onToolListClick);

searchEl.addEventListener('input', filterList);
clearEl.addEventListener('click', () => {
  searchEl.value = '';
  filterList();
  searchEl.focus();
});

backBtn.addEventListener('click', closeTool);

document.addEventListener('keydown', (e) => {
  // `/` focuses the search box, unless the user is already typing in a control.
  if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) {
    e.preventDefault();
    searchEl.focus();
    return;
  }
  if (e.key === 'Escape' && !toolView.hidden) closeTool();
});

/* ---------- network watch ---------- */
// Keep the logic: flag anything unexpected trying to leave the page. Same-origin
// requests (the lazily loaded tools, the vendored pdf-lib script, the
// stylesheet) are not a privacy problem and are never flagged. Shown as a plain
// danger sentence under the privacy caption, never a pill.
const origFetch = window.fetch;
if (typeof origFetch === 'function') {
  window.fetch = function (input, ...rest) {
    const url = typeof input === 'string' ? input : (input && input.url);
    if (isExternalRequest(url, location.origin)) flagNetwork();
    return origFetch.call(this, input, ...rest);
  };
}
const OrigXHR = window.XMLHttpRequest;
if (typeof OrigXHR === 'function') {
  window.XMLHttpRequest = function () {
    const xhr = new OrigXHR();
    const open = xhr.open;
    xhr.open = function (method, url, ...rest) {
      if (isExternalRequest(url, location.origin)) flagNetwork();
      return open.call(xhr, method, url, ...rest);
    };
    return xhr;
  };
}
// WebSockets and sendBeacon can only ever reach another host, so any of them is
// by definition external. Subclassing preserves the prototype chain and the
// readyState constants on window.WebSocket.
const OrigWS = window.WebSocket;
if (typeof OrigWS === 'function') {
  window.WebSocket = class extends OrigWS {
    constructor(url, protocols) {
      flagNetwork();
      super(url, protocols);
    }
  };
}
if (navigator.sendBeacon) {
  const origBeacon = navigator.sendBeacon.bind(navigator);
  navigator.sendBeacon = function (url, data) {
    flagNetwork();
    return origBeacon(url, data);
  };
}

function flagNetwork() {
  if (!netWatch) return;
  netWatch.textContent = ' Unexpected network request detected.';
  netWatch.className = 'net-bad';
}

/* ---------- init ---------- */

renderList();
renderHomeList();
filterList();
applyHash();