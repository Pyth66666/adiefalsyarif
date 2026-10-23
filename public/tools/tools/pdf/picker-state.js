// Pure, DOM-free state for the PDF page picker.
//
// The picker is a list of page entries in grid order; every edit is
// non-destructive until applyPlan() writes the final PDF. This module holds all
// of the logic (selection, ranges, rotation, reordering, undo) and has no DOM,
// no network and no pdf-lib dependency, so it runs unchanged in the browser and
// in `node tests/picker.test.mjs`.
//
// An entry is:
//   { id, fileId, fileName, pageIndex, rotation, thumbIndex }
// where `rotation` is the accumulated rotation in degrees (0/90/180/270),
// `pageIndex` is the zero-based index inside its source file and `thumbIndex`
// is the render/de-duplication key for the thumbnail cache (it is unique only
// within the current grid snapshot, not after reordering/deletions).

const UNDO_LIMIT = 20;

export function createPickerState() {
  return {
    entries: [],
    selected: new Set(),
    anchorId: null,
    focusedId: null,
    editSeq: 0,
    undoStack: [],
  };
}

/* ---------- lookups ---------- */

export function indexOfId(state, id) {
  return state.entries.findIndex((e) => e.id === id);
}

export function getEntry(state, id) {
  const i = indexOfId(state, id);
  return i === -1 ? null : state.entries[i];
}

export function isSelected(state, id) {
  return state.selected.has(id);
}

export function selectedCount(state) {
  return state.selected.size;
}

export function count(state) {
  return state.entries.length;
}

/** Selected ids in grid order. */
export function selectedIds(state) {
  return state.entries.filter((e) => state.selected.has(e.id)).map((e) => e.id);
}

/* ---------- file / page ingestion ---------- */

/**
 * Set the source files (one or more) and rebuild the grid entries. Each file's
 * pages are appended in order. `sources` may be:
 *   [{ id, name, pageCount }]
 * Passing a single file resets the grid; passing several behaves the same
 * (files are appended in the order given). An optional `preselect` predicate
 * decides whether a page starts selected (Rotate mode preselects all).
 */
export function setFiles(state, sources, opts = {}) {
  const preselect = typeof opts.preselect === 'function' ? opts.preselect : () => false;
  state.entries = [];
  state.selected = new Set();
  state.anchorId = null;
  state.focusedId = null;

  for (const file of sources) {
    const pageCount = Math.max(0, Number(file.pageCount) || 0);
    for (let p = 0; p < pageCount; p += 1) {
      const entry = {
        id: `${file.id}:${p}`,
        fileId: file.id,
        fileName: file.name,
        pageIndex: p,
        rotation: 0,
        thumbIndex: state.entries.length,
      };
      if (preselect(entry)) state.selected.add(entry.id);
      state.entries.push(entry);
    }
  }
  if (state.entries.length) state.focusedId = state.entries[0].id;
  state.anchorId = null;
  state.editSeq += 1;
  state.undoStack = [];
  return state;
}

/**
 * Append one file's pages to the existing grid, keeping the current edits.
 *
 * Review F11: adding files CLEARS the undo history. Snapshots taken before the
 * file existed would otherwise restore a grid that omits it, so the second undo
 * after "add A, delete, add B, delete" would silently drop B even though its
 * buffers are still stored. Clearing is the simplest correct behaviour: pages
 * already deleted before the add are not resurrected, and no undo can resurrect
 * a grid without the newly added file. Returns whether a history was discarded
 * so the caller can say so.
 *
 * @param {object} state
 * @param {{ id, name, pageCount, startThumbIndex?: number, preselect?: (entry) => boolean }} file
 * @returns {boolean} true when a non-empty undo history was cleared
 */
export function appendFilePages(state, file) {
  const pageCount = Math.max(0, Number(file.pageCount) || 0);
  // Thumb indices must stay unique within the grid snapshot even after earlier
  // deletions; the caller passes its monotonic counter as startThumbIndex.
  const base = Number.isInteger(file.startThumbIndex) ? file.startThumbIndex : state.entries.length;
  for (let p = 0; p < pageCount; p += 1) {
    const entry = {
      id: `${file.id}:${p}`,
      fileId: file.id,
      fileName: file.name,
      pageIndex: p,
      rotation: 0,
      thumbIndex: base + p,
    };
    state.entries.push(entry);
    if (typeof file.preselect === 'function' && file.preselect(entry)) state.selected.add(entry.id);
  }
  if (!state.focusedId && state.entries.length) state.focusedId = state.entries[0].id;
  const cleared = state.undoStack.length > 0;
  state.undoStack = [];
  state.editSeq += 1;
  return cleared;
}

/* ---------- selection ---------- */

/** Toggle one tile; sets it as the range anchor. */
export function toggle(state, id) {
  if (indexOfId(state, id) === -1) return state;
  if (state.selected.has(id)) state.selected.delete(id);
  else state.selected.add(id);
  state.anchorId = id;
  return state;
}

/**
 * Add the inclusive range from `fromId` to `toId` to the selection. Works for
 * both grid orders (a selection made backwards from the anchor is included).
 * `fromId` defaults to the current anchor.
 */
export function selectRange(state, fromId, toId) {
  const from = fromId == null ? state.anchorId : fromId;
  if (from == null) return toggle(state, toId);
  const a = indexOfId(state, from);
  const b = indexOfId(state, toId);
  if (a === -1 || b === -1) return state;
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  for (let i = lo; i <= hi; i += 1) state.selected.add(state.entries[i].id);
  state.anchorId = toId;
  return state;
}

export function selectAll(state) {
  for (const e of state.entries) state.selected.add(e.id);
  return state;
}

export function clearSelection(state) {
  state.selected = new Set();
  return state;
}

/* ---------- edits ---------- */

function pushUndo(state, label, snapshotEntries, snapshotSelected) {
  state.undoStack.push({ label, entries: snapshotEntries, selected: snapshotSelected });
  if (state.undoStack.length > UNDO_LIMIT) state.undoStack.shift();
  state.editSeq += 1;
}

function cloneEntries(entries) {
  return entries.map((e) => ({ ...e }));
}

export function canUndo(state) {
  return state.undoStack.length > 0;
}

/**
 * Remove pages by id. Deleted pages leave the grid immediately. The tile
 * selection is cleared of the removed ids and the focus/anchor fall back to a
 * neighbouring surviving page.
 */
export function deleteIds(state, ids) {
  const list = Array.isArray(ids) ? ids : [ids];
  const doomed = new Set(list);
  const before = state.entries;
  const kept = before.filter((e) => !doomed.has(e.id));
  if (kept.length === before.length) return state;
  pushUndo(state, `Deleted ${before.length - kept.length} page${before.length - kept.length === 1 ? '' : 's'}`, cloneEntries(before), new Set(state.selected));

  // Focus/anchor fall back to a neighbouring surviving page.
  const firstRemoved = before.findIndex((e) => doomed.has(e.id));
  const neighbour = kept[Math.min(firstRemoved, kept.length - 1)];
  // R2-07: when the FOCUSED page is deleted, focus must move relative to that
  // page, not relative to the first removed id. Prefer the next surviving page
  // after the focused one, then the previous surviving one, else no target.
  let focusFallback = neighbour ? neighbour.id : null;
  if (doomed.has(state.focusedId)) {
    const fi = before.findIndex((e) => e.id === state.focusedId);
    let nextSurvivor = null;
    for (let i = fi + 1; i < before.length; i += 1) {
      if (!doomed.has(before[i].id)) { nextSurvivor = before[i].id; break; }
    }
    let prevSurvivor = null;
    for (let i = fi - 1; i >= 0; i -= 1) {
      if (!doomed.has(before[i].id)) { prevSurvivor = before[i].id; break; }
    }
    focusFallback = nextSurvivor || prevSurvivor || null;
  }
  state.entries = kept;
  for (const id of doomed) state.selected.delete(id);
  if (doomed.has(state.focusedId)) state.focusedId = focusFallback;
  if (doomed.has(state.anchorId)) state.anchorId = neighbour ? neighbour.id : null;
  return state;
}

export function deleteSelected(state) {
  return deleteIds(state, selectedIds(state));
}

/**
 * Rotate the given pages by `delta` degrees (+90 / -90), wrapping modulo 360 so
 * the stored value stays within {0,90,180,270}.
 */
export function rotate(state, ids, delta) {
  const list = Array.isArray(ids) ? ids : [ids];
  const set = new Set(list);
  let changed = false;
  for (const e of state.entries) {
    if (!set.has(e.id)) continue;
    changed = true;
  }
  if (changed) {
    pushUndo(state, `Rotated ${list.length} page${list.length === 1 ? '' : 's'}`, cloneEntries(state.entries), new Set(state.selected));
    for (const e of state.entries) {
      if (!set.has(e.id)) continue;
      e.rotation = (((e.rotation + Number(delta)) % 360) + 360) % 360;
    }
  }
  return state;
}

/**
 * Move the selected block so it lands at `targetIndex`, a gap index into the
 * *current* grid (0..length) meaning "insert before the page currently at that
 * index" (and length = the end). Only the ids in `ids` move; they keep their
 * relative order. Dropping the block onto its own position is a no-op.
 */
export function movePages(state, ids, targetIndex) {
  const list = Array.isArray(ids) ? ids : [ids];
  const moving = new Set(list);
  if (moving.size === 0) return state;

  const before = state.entries;
  const block = before.filter((e) => moving.has(e.id));
  const rest = before.filter((e) => !moving.has(e.id));

  // targetIndex is expressed against `before`: everything before it is `rest`
  // that the block does not contain.
  let restBeforeTarget = 0;
  for (let i = 0; i < Math.min(targetIndex, before.length); i += 1) {
    if (!moving.has(before[i].id)) restBeforeTarget += 1;
  }

  const next = rest.slice();
  next.splice(restBeforeTarget, 0, ...block);

  // No-op if nothing actually moved.
  if (next.length === before.length && next.every((e, i) => e.id === before[i].id)) {
    return state;
  }
  pushUndo(state, `Moved ${block.length} page${block.length === 1 ? '' : 's'}`, cloneEntries(before), new Set(state.selected));
  state.entries = next;
  return state;
}

/**
 * Move the given block by one place: `dir` -1 (left/up one tile) or +1
 * (right/down one tile). At the edges this is a no-op. The block moves as a
 * unit so a non-contiguous selection keeps its order.
 */
export function moveByKeyboard(state, ids, dir) {
  const list = Array.isArray(ids) ? ids : [ids];
  const moving = new Set(list);
  if (moving.size === 0 || (dir !== -1 && dir !== 1)) return state;

  const before = state.entries;
  const indices = [];
  before.forEach((e, i) => { if (moving.has(e.id)) indices.push(i); });
  if (indices.length === 0) return state;

  const first = Math.min(...indices);
  const last = Math.max(...indices);

  if (dir === -1) {
    if (first === 0) return state;
    const targetIndex = first - 1;
    return movePages(state, list, targetIndex);
  }
  if (last === before.length - 1) return state;
  const targetIndex = last + 2; // insert after the neighbour following the block
  return movePages(state, list, targetIndex);
}

/** Undo the last edit (delete, rotate, move). */
export function undo(state) {
  const entry = state.undoStack.pop();
  if (!entry) return state;
  state.entries = cloneEntries(entry.entries);
  state.selected = new Set(entry.selected);
  state.editSeq += 1;
  // Keep focus valid after restoring.
  if (!state.focusedId || !getEntry(state, state.focusedId)) {
    state.focusedId = state.entries.length ? state.entries[0].id : null;
  }
  if (!state.anchorId || !getEntry(state, state.anchorId)) state.anchorId = null;
  return state;
}

/**
 * The kind of the edit that `undo()` would reverse, or `null` when there is
 * nothing to undo. Used for the toolbar button's accessible name/title
 * ("Undo rotate" / "Undo delete" / "Undo move"). The undo stack labels are
 * written by the edit functions ("Rotated 1 page", "Deleted 2 pages",
 * "Moved 3 pages"), so the kind is derived from that label's leading word.
 */
export function describeLastEdit(state) {
  const entry = state.undoStack[state.undoStack.length - 1];
  if (!entry) return null;
  const word = String(entry.label || '').trim().split(/\s+/)[0].toLowerCase();
  if (word === 'rotated') return 'rotate';
  if (word === 'deleted') return 'delete';
  if (word === 'moved') return 'move';
  return null;
}

/**
 * Choose the tile to focus after a re-render that changed the grid.
 *
 * @param {string[]} entriesBefore ids of the grid in order before the edit
 * @param {string[]} entriesAfter  ids of the grid in order after the edit
 * @param {string|null} focusedId  the id that had focus before the edit
 * @returns {string|null} the surviving id to focus:
 *   - the same id when it still exists;
 *   - otherwise the id now at the same index;
 *   - otherwise the previous tile (the last one) when the focused tile was
 *     the last and everything after it is gone;
 *   - otherwise null (the grid is empty).
 */
export function nextFocusId(entriesBefore, entriesAfter, focusedId) {
  const after = Array.isArray(entriesAfter) ? entriesAfter : [];
  if (after.length === 0) return null;
  if (focusedId != null && after.includes(focusedId)) return focusedId;
  const before = Array.isArray(entriesBefore) ? entriesBefore : [];
  const idx = focusedId == null ? -1 : before.indexOf(focusedId);
  if (idx === -1) return after[0];
  if (idx < after.length) return after[idx];
  return after[after.length - 1];
}

/* ---------- plans (pure extraction, no mutation) ---------- */

/** The plan for the selected pages, in grid order, without touching state. */
export function extractPlan(state) {
  return state.entries
    .filter((e) => state.selected.has(e.id))
    .map((e) => ({ fileId: e.fileId, pageIndex: e.pageIndex, rotation: e.rotation }));
}

/** The plan for everything remaining, in grid order. */
export function toPlan(state) {
  return state.entries.map((e) => ({ fileId: e.fileId, pageIndex: e.pageIndex, rotation: e.rotation }));
}

/* ---------- summaries ---------- */

/** "3 of 12 pages selected" — pluralised, else "Add a PDF to begin." */
export function summary(state) {
  const total = state.entries.length;
  if (total === 0) return 'Add a PDF to begin.';
  const n = state.selected.size;
  return `${n} of ${total} page${total === 1 ? '' : 's'} selected`;
}

export { UNDO_LIMIT };