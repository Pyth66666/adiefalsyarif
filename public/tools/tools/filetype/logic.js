const TYPES = {
  png: ['PNG image', ['png'], ['image/png']],
  jpeg: ['JPEG image', ['jpg', 'jpeg', 'jpe'], ['image/jpeg']],
  gif: ['GIF image', ['gif'], ['image/gif']],
  webp: ['WebP image', ['webp'], ['image/webp']],
  bmp: ['BMP image', ['bmp'], ['image/bmp', 'image/x-ms-bmp']],
  ico: ['ICO icon', ['ico'], ['image/x-icon', 'image/vnd.microsoft.icon']],
  tiff: ['TIFF image', ['tif', 'tiff'], ['image/tiff']],
  pdf: ['PDF document', ['pdf'], ['application/pdf']],
  zip: ['ZIP archive', ['zip'], ['application/zip', 'application/x-zip-compressed']],
  docx: ['Word document (ZIP)', ['docx'], ['application/vnd.openxmlformats-officedocument.wordprocessingml.document']],
  xlsx: ['Excel workbook (ZIP)', ['xlsx'], ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']],
  pptx: ['PowerPoint presentation (ZIP)', ['pptx'], ['application/vnd.openxmlformats-officedocument.presentationml.presentation']],
  odt: ['OpenDocument text (ZIP)', ['odt'], ['application/vnd.oasis.opendocument.text']],
  jar: ['Java archive (ZIP)', ['jar'], ['application/java-archive']],
  apk: ['Android package (ZIP)', ['apk'], ['application/vnd.android.package-archive']],
  gzip: ['GZIP archive', ['gz', 'gzip'], ['application/gzip', 'application/x-gzip']],
  '7z': ['7z archive', ['7z'], ['application/x-7z-compressed']],
  rar: ['RAR archive', ['rar'], ['application/vnd.rar', 'application/x-rar-compressed']],
  tar: ['TAR archive', ['tar'], ['application/x-tar']],
  mp3: ['MP3 audio', ['mp3'], ['audio/mpeg']],
  mp4: ['MP4 video', ['mp4', 'm4v'], ['video/mp4']],
  mov: ['QuickTime video', ['mov'], ['video/quicktime']],
  wav: ['WAV audio', ['wav'], ['audio/wav', 'audio/x-wav']],
  ogg: ['Ogg media', ['ogg', 'oga', 'ogv'], ['audio/ogg', 'video/ogg', 'application/ogg']],
  flac: ['FLAC audio', ['flac'], ['audio/flac', 'audio/x-flac']],
  exe: ['Windows executable (MZ)', ['exe', 'dll', 'com', 'scr'], ['application/x-msdownload', 'application/vnd.microsoft.portable-executable']],
  elf: ['ELF executable', ['elf', 'so'], ['application/x-elf']],
  macho: ['Mach-O executable', ['dylib'], ['application/x-mach-binary']],
  sqlite: ['SQLite database', ['sqlite', 'sqlite3', 'db'], ['application/vnd.sqlite3', 'application/x-sqlite3']],
  html: ['HTML document', ['html', 'htm'], ['text/html']],
  xml: ['XML document', ['xml'], ['application/xml', 'text/xml']],
  json: ['JSON data', ['json'], ['application/json', 'text/json']],
  text: ['Plain text', ['txt', 'text', 'log', 'md', 'csv'], ['text/plain']],
  script: ['Script (shebang)', ['sh', 'bash', 'py', 'rb', 'pl', 'js'], ['text/x-shellscript', 'application/x-sh', 'text/x-python']],
  empty: ['Empty file', [], []],
  unknown: ['Unknown binary or unrecognized type', [], []],
};
const binaryTypes = Object.entries(TYPES).filter(([id]) =>
  !['html', 'xml', 'json', 'text', 'script', 'empty', 'unknown'].includes(id));

function type(id) { return { id, label: TYPES[id][0] }; }
function matches(bytes, signature, offset = 0) {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, i) => bytes[offset + i] === byte);
}
function ascii(bytes, offset, length) {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function zipType(bytes) {
  let offset = 0;
  let contentTypes = '';
  const names = new Set();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  while (offset + 30 <= bytes.length && matches(bytes, [0x50, 0x4b, 3, 4], offset)) {
    const flags = view.getUint16(offset + 6, true);
    const method = view.getUint16(offset + 8, true);
    const size = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const start = offset + 30 + nameLength + extraLength;
    if (start > bytes.length) break;
    const name = ascii(bytes, offset + 30, nameLength);
    names.add(name);
    if (name === 'mimetype' && method === 0 && start + size <= bytes.length &&
        ascii(bytes, start, size) === 'application/vnd.oasis.opendocument.text') return 'odt';
    if (name === '[Content_Types].xml' && method === 0 && start + size <= bytes.length) {
      contentTypes = ascii(bytes, start, size);
    }
    // Bit 3 means sizes follow a data descriptor: without a ZIP library we
    // cannot safely locate the next header. Never search arbitrary payloads.
    if (flags & 8 || size === 0xffffffff || start + size > bytes.length) break;
    offset = start + size;
  }
  if (names.has('word/document.xml') || contentTypes.includes('wordprocessingml.document.main+xml')) return 'docx';
  if (names.has('xl/workbook.xml') || contentTypes.includes('spreadsheetml.sheet.main+xml')) return 'xlsx';
  if (names.has('ppt/presentation.xml') || contentTypes.includes('presentationml.presentation.main+xml')) return 'pptx';
  if (names.has('AndroidManifest.xml')) return 'apk';
  if (names.has('META-INF/MANIFEST.MF')) return 'jar';
  return 'zip';
}

export function detectType(input) {
  const bytes = input.subarray(0, 65536);
  if (!bytes.length) return type('empty');
  let id;
  if (matches(bytes, [137, 80, 78, 71, 13, 10, 26, 10])) id = 'png';
  else if (matches(bytes, [255, 216, 255])) id = 'jpeg';
  else if (matches(bytes, [71, 73, 70, 56, 55, 97]) || matches(bytes, [71, 73, 70, 56, 57, 97])) id = 'gif';
  else if (matches(bytes, [82, 73, 70, 70]) && matches(bytes, [87, 69, 66, 80], 8)) id = 'webp';
  else if (matches(bytes, [66, 77])) id = 'bmp';
  else if (matches(bytes, [0, 0, 1, 0])) id = 'ico';
  else if (matches(bytes, [73, 73, 42, 0]) || matches(bytes, [77, 77, 0, 42])) id = 'tiff';
  else if (matches(bytes, [37, 80, 68, 70, 45])) id = 'pdf';
  else if (matches(bytes, [80, 75, 3, 4])) id = zipType(bytes);
  else if (matches(bytes, [80, 75, 5, 6]) || matches(bytes, [80, 75, 7, 8])) id = 'zip';
  else if (matches(bytes, [31, 139, 8])) id = 'gzip';
  else if (matches(bytes, [55, 122, 188, 175, 39, 28])) id = '7z';
  else if (matches(bytes, [82, 97, 114, 33, 26, 7, 0]) || matches(bytes, [82, 97, 114, 33, 26, 7, 1, 0])) id = 'rar';
  else if (matches(bytes, [117, 115, 116, 97, 114], 257)) id = 'tar';
  else if (matches(bytes, [73, 68, 51]) || (bytes.length >= 4 && bytes[0] === 255 && (bytes[1] & 0xe0) === 0xe0 && (bytes[2] & 0xf0) !== 0xf0)) id = 'mp3';
  else if (matches(bytes, [102, 116, 121, 112], 4) && bytes.length >= 12) id = ascii(bytes, 8, 4) === 'qt  ' ? 'mov' : 'mp4';
  else if (matches(bytes, [82, 73, 70, 70]) && matches(bytes, [87, 65, 86, 69], 8)) id = 'wav';
  else if (matches(bytes, [79, 103, 103, 83])) id = 'ogg';
  else if (matches(bytes, [102, 76, 97, 67])) id = 'flac';
  else if (matches(bytes, [77, 90])) id = 'exe';
  else if (matches(bytes, [127, 69, 76, 70])) id = 'elf';
  else if ([[0xfe, 0xed, 0xfa, 0xce], [0xce, 0xfa, 0xed, 0xfe], [0xfe, 0xed, 0xfa, 0xcf], [0xcf, 0xfa, 0xed, 0xfe], [0xca, 0xfe, 0xba, 0xbe], [0xbe, 0xba, 0xfe, 0xca]].some((sig) => matches(bytes, sig))) id = 'macho';
  else if (matches(bytes, [83, 81, 76, 105, 116, 101, 32, 102, 111, 114, 109, 97, 116, 32, 51, 0])) id = 'sqlite';
  if (id) return type(id);

  let decoded;
  try { decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return type('unknown'); }
  if (decoded.includes('\0') || /[\x01-\x08\x0e-\x1f]/.test(decoded)) return type('unknown');
  const content = decoded.replace(/^\uFEFF/, '').trimStart();
  if (content.startsWith('#!')) return type('script');
  if (/^(?:<!doctype\s+html\b|<html\b)/i.test(content)) return type('html');
  if (/^<\?xml\b/i.test(content)) return type('xml');
  if (/^[\[{]/.test(content)) {
    try { JSON.parse(content); return type('json'); } catch { /* may be incomplete text */ }
  }
  return type('text');
}

export function assessFile(name, mime, bytes, size) {
  const detected = detectType(bytes);
  const extension = /\.([^.]+)$/.exec(name)?.[1].toLowerCase() || '';
  const claimed = mime?.toLowerCase().split(';')[0].trim() || '';
  const known = TYPES[detected.id];
  const definitive = !['empty', 'unknown', 'text'].includes(detected.id);
  const binaryExtension = binaryTypes.some(([, entry]) => entry[1].includes(extension)) || ['doc', 'xls', 'ppt'].includes(extension);
  const binaryMime = binaryTypes.some(([, entry]) => entry[2].includes(claimed)) ||
    ['application/msword', 'application/vnd.ms-excel', 'application/vnd.ms-powerpoint'].includes(claimed);
  const extensionMatch = !extension ? null : definitive ? known[1].includes(extension) :
    detected.id === 'text' && binaryExtension ? false : null;
  const mimeMatch = !claimed || claimed === 'application/octet-stream' ? null : definitive ? known[2].includes(claimed) :
    detected.id === 'text' && binaryMime ? false : null;
  const dangerous = ['exe', 'elf', 'macho', 'script'].includes(detected.id) &&
    ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'txt', 'rtf', 'jpg', 'jpeg', 'png', 'gif', 'html'].includes(extension);
  return { type: detected, extension, claimed, size, extensionMatch, mimeMatch, dangerous };
}
