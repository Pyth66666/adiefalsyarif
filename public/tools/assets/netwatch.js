// Network watch — pure classification helper.
//
// The app runs entirely on the local file (or a local static server). A
// same-origin fetch (a lazily loaded local file, the vendored pdf-lib script,
// the stylesheet) is not a privacy problem, so it must NOT be flagged. Only
// requests whose resolved URL points at another origin are "unexpected".
//
// This module is deliberately free of DOM/browser globals so it can be unit
// tested under plain Node (see tests/netwatch.test.mjs).

/**
 * Decide whether a request URL points outside the current origin.
 *
 * Rules:
 *   - A relative URL resolves against `origin` and is therefore same-origin.
 *   - An absolute URL is external only when its protocol/host/port differ from
 *     the origin's.
 *   - `data:` and `blob:` URLs are never external (they are in-memory).
 *   - `javascript:` URLs are ignored (not external) — they never hit the network.
 *   - A malformed URL that cannot be resolved is treated as not external, so a
 *     bad string can never raise a false privacy alarm.
 *
 * @param {string} url        the raw request URL (may be relative)
 * @param {string} origin     the page origin, e.g. "https://example.com:8443"
 * @returns {boolean} true only when the resolved URL's origin differs
 */
export function isExternalRequest(url, origin) {
  if (typeof url !== 'string' || url === '') return false;

  const base = typeof origin === 'string' ? origin : '';

  // Ignore non-network schemes outright.
  if (/^\s*javascript:/i.test(url)) return false;

  let resolved;
  try {
    resolved = new URL(url, base || undefined);
  } catch {
    return false; // unparseable — never a privacy problem
  }

  // In-memory schemes never leave the page.
  if (resolved.protocol === 'data:' || resolved.protocol === 'blob:') return false;

  // Compare against the page origin. Without a usable origin we cannot prove a
  // request is external, so we stay quiet.
  let baseOrigin;
  try {
    baseOrigin = new URL(base).origin;
  } catch {
    return false;
  }
  if (!baseOrigin || baseOrigin === 'null') return false;

  return resolved.origin !== baseOrigin;
}