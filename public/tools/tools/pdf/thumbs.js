// pdf.js document cache for the page-picker thumbnails — DOM-free, no network.
//
// The picker keeps the original PDF bytes (in fileMeta/sources) so pdf-lib can
// rebuild the document on Download. pdf.js, however, TRANSFERS the underlying
// ArrayBuffer to its worker, which DETACHES it (byteLength becomes 0). Handing
// pdf.js the array we keep would therefore empty it, and pdf-lib would later
// read a zero-byte "damaged" file.
//
// createDocumentCache() isolates that behaviour:
//   - getDocument(fileId, bytes) always gives pdf.js its OWN copy, so the
//     caller's array is left intact;
//   - the loading PROMISE is memoized per fileId, so concurrent render jobs
//     await the same document instead of each calling getDocument() with the
//     same (already detached) bytes;
//   - release(fileId) drops the cached promise/doc (and destroys the proxy).
//
// The pdf.js namespace is injected through `loadPdfjs` so this module stays
// DOM-free and unit-testable in Node (tests/thumbs.test.mjs).

/**
 * @param {() => Promise<object>} loadPdfjs  resolves the pdf.js namespace
 *        (the object with getDocument / GlobalWorkerOptions).
 * @returns {{
 *   getDocument: (fileId: string, bytes: Uint8Array) => Promise<object>,
 *   release: (fileId: string) => void,
 *   has: (fileId: string) => boolean,
 *   size: () => number,
 * }}
 */
export function createDocumentCache(loadPdfjs) {
  const promises = new Map(); // fileId -> Promise<PDFDocumentProxy>

  function getDocument(fileId, bytes) {
    if (promises.has(fileId)) return promises.get(fileId);

    if (!(bytes instanceof Uint8Array)) {
      return Promise.reject(new TypeError('Expected PDF bytes as a Uint8Array.'));
    }

    // Copy before handing anything to pdf.js: it transfers (detaches) the
    // buffer of whatever it is given. `slice()` with no args copies the whole
    // array into a fresh ArrayBuffer, leaving `bytes` untouched.
    const owned = bytes.slice();

    const promise = Promise.resolve()
      .then(() => loadPdfjs())
      .then((pdfjs) =>
        pdfjs
          .getDocument({ data: owned, disableAutoFetch: true, disableStream: true, verbosity: 0 })
          .promise,
      );
    // Store BEFORE awaiting so concurrent callers share one load.
    promises.set(fileId, promise);

    // A failed load must not be cached, or every later thumbnail reuses the
    // rejection instead of retrying.
    promise.catch(() => {
      if (promises.get(fileId) === promise) promises.delete(fileId);
    });

    return promise;
  }

  function release(fileId) {
    const promise = promises.get(fileId);
    promises.delete(fileId);
    if (promise) {
      promise.then(
        (doc) => { try { if (doc && typeof doc.destroy === 'function') doc.destroy(); } catch { /* ignore */ } },
        () => { /* already failed; nothing to destroy */ },
      );
    }
  }

  return {
    getDocument,
    release,
    has: (fileId) => promises.has(fileId),
    size: () => promises.size,
  };
}
