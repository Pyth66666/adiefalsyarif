# Vendored libraries

Third-party code checked into this repo so the app stays fully offline. Nothing
here is ever loaded from a CDN.

| Library | Version | Licence | Source | Files |
|---------|---------|---------|--------|-------|
| pdf-lib | 1.17.1 | MIT | https://www.npmjs.com/package/pdf-lib (`npm pack pdf-lib@1.17.1`) | `pdf-lib/pdf-lib.min.js`, `pdf-lib/LICENSE.md` |
| qrcode-generator | 1.4.4 | MIT | https://www.npmjs.com/package/qrcode-generator (`npm pack qrcode-generator@1.4.4`), author Kazuhiko Arase | `qrcode-generator/qrcode.js`, `qrcode-generator/LICENSE` |
| pdfjs-dist | 4.10.38 | Apache-2.0 | https://www.npmjs.com/package/pdfjs-dist (`npm pack pdfjs-dist@4.10.38`), legacy build | `pdfjs/pdf.min.js`, `pdfjs/pdf.worker.min.js`, `pdfjs/LICENSE` |

## How pdf-lib was vendored

```sh
mkdir -p .tmp/pdf-vendor && cd .tmp/pdf-vendor
npm pack pdf-lib@1.17.1
tar -xzf pdf-lib-1.17.1.tgz
cp package/dist/pdf-lib.min.js ../../vendor/pdf-lib/pdf-lib.min.js
cp package/LICENSE.md            ../../vendor/pdf-lib/LICENSE.md
```

`pdf-lib` is the browser UMD/IIFE build that attaches `window.PDFLib`. It is MIT
licensed (see `pdf-lib/LICENSE.md`); the copyright notice is kept alongside the
build as the licence requires.

## How qrcode-generator was vendored

```sh
mkdir -p .tmp/qr-vendor && cd .tmp/qr-vendor
npm pack qrcode-generator@1.4.4
tar -xzf qrcode-generator-1.4.4.tgz
cp package/qrcode.js ../../vendor/qrcode-generator/qrcode.js
# 1.4.4 ships no LICENSE file, so vendor/qrcode-generator/LICENSE reproduces the
# canonical MIT text with the copyright holder from package.json / the source header.
```

`qrcode.js` is the single-file build by Kazuhiko Arase. It defines a browser
global (`qrcode`) and also exports through CommonJS, so the same file is used by
the browser tool and by `tests/qr.test.mjs` in Node. It is MIT licensed; the
copyright notice is kept alongside the build as the licence requires.

## How pdfjs-dist was vendored

```sh
mkdir -p .tmp/pdfjs-vendor && cd .tmp/pdfjs-vendor
npm pack pdfjs-dist@4.10.38
tar -xzf pdfjs-dist-4.10.38.tgz
cp package/legacy/build/pdf.min.mjs         ../../vendor/pdfjs/pdf.min.js
cp package/legacy/build/pdf.worker.min.mjs  ../../vendor/pdfjs/pdf.worker.min.js
cp package/LICENSE                          ../../vendor/pdfjs/LICENSE
```

pdf.js is used **for thumbnails only** (pdf-lib stays the editor). The legacy
build is copied because it ships as a single self-contained ES module with no
top-level `import.meta.url` asset loading beyond the worker, which keeps the
offline `python3 -m http.server` setup working. The two files are **renamed**
from `.mjs` to `.js`: some versions of Python's `http.server` (notably on
Windows and older distributions) map `.mjs` to the wrong MIME type, and a
browser refuses to load an ES module served as `application/octet-stream`. The
content is unchanged ES-module code; only the served content type differs. The
worker is loaded same-origin via `GlobalWorkerOptions.workerSrc` and range/stream
fetching is disabled, so nothing is requested from the network. Apache-2.0
licensed (see `pdfjs/LICENSE`); the copyright notice is kept alongside the build
as the licence requires.