// Resolve a path relative to a MODULE file into an absolute URL.
//
// The bug this exists to prevent (review F07): a tool module lives at
// tools/<tool>/index.js, but any URL handed to a <script src> (or a pdf.js
// workerSrc) is resolved by the browser against the DOCUMENT, not the module.
// Vendored assets are addressed as '../../vendor/...' from inside a tool module,
// which is correct relative to the module file but wrong relative to the page:
// served at /utility/ the page would request /vendor/... and 404.
//
// new URL(relative, moduleUrl) performs exactly the resolution the module
// system uses for `import`, so the result stays correct whatever route the app
// is served from (site root, a sub-path, a file:// URL, ...).
//
// Pure and DOM-free, so it is unit-tested in node (tests/asseturl.test.mjs).

/**
 * Resolve `relative` against the URL of the module that contains it.
 *
 * @param {string} relative  a path relative to the module file, e.g.
 *                           '../../vendor/pdf-lib/pdf-lib.min.js'
 * @param {string} moduleUrl the module's own URL, e.g. `import.meta.url`.
 *                           Defaults to `import.meta.url` of THIS file when
 *                           omitted, which is only ever right for callers in
 *                           assets/ — tool modules must pass their own.
 * @returns {string} the absolute URL string
 */
export function assetUrl(relative, moduleUrl = import.meta.url) {
  return new URL(relative, moduleUrl).href;
}