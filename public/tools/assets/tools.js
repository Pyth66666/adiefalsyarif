// Tool registry. Cards without a `load` are placeholders; once a tool exists,
// give it a lazy `load: () => import('../tools/<id>/index.js')` and drop the
// `soon: true` flag.

// Categories group the tools in the sidebar and on the home list. The array
// order is the display order; future tools slot into one of these groups.
export const CATEGORIES = [
  { id: 'pdf', name: 'PDF' },
  { id: 'image', name: 'Image' },
  { id: 'documents', name: 'Documents' },
  { id: 'security', name: 'Security' },
  { id: 'developer', name: 'Developer' },
  { id: 'text', name: 'Text' },
];

export const TOOLS = [
  {
    id: 'pdf',
    name: 'PDF Merge / Split / Rotate',
    desc: 'Combine PDFs, extract page ranges, and rotate pages.',
    keywords: 'pdf merge combine split extract rotate pages document',
    category: 'pdf',
    load: () => import('../tools/pdf/index.js'),
  },
  {
    id: 'imgpdf',
    name: 'Images to PDF / PDF to images',
    desc: 'Build a PDF from JPG/PNG/WebP images, or export a PDF\u2019s pages as PNG/JPEG or a ZIP.',
    keywords: 'pdf image jpg jpeg png webp convert export pages zip render scan',
    category: 'pdf',
    load: () => import('../tools/imgpdf/index.js'),
  },
  {
    id: 'compresspdf',
    name: 'Compress PDF',
    desc: 'Recompress embedded images while keeping text selectable.',
    keywords: 'pdf compress reduce file size images jpeg downscale',
    category: 'pdf',
    load: () => import('../tools/compresspdf/index.js'),
  },
  {
    id: 'signpdf',
    name: 'Page numbers and sign PDF',
    desc: 'Number PDF pages or place a visual signature.',
    keywords: 'pdf page numbers pagination sign signature draw type date',
    category: 'pdf',
    load: () => import('../tools/signpdf/index.js'),
  },
  {
    id: 'image',
    name: 'Image Resize / Convert',
    desc: 'Resize, convert, compress images and strip EXIF metadata.',
    keywords: 'image photo resize convert compress jpeg png webp exif metadata privacy',
    category: 'image',
    load: () => import('../tools/image/index.js'),
  },
  {
    id: 'exif',
    name: 'Image metadata (EXIF) viewer',
    desc: 'Inspect photo metadata and GPS, then download a clean copy.',
    keywords: 'image exif metadata gps privacy camera photo tiff',
    category: 'image',
    load: () => import('../tools/exif/index.js'),
  },
  {
    id: 'text',
    name: 'JSON / Base64 / UUID / SHA-256',
    desc: 'Format JSON, encode/decode Base64, generate UUIDs, and hash with SHA-256.',
    keywords: 'json base64 uuid guid sha256 hash format minify validate encode decode digest',
    category: 'developer',
    load: () => import('../tools/text/index.js'),
  },
  {
    id: 'jwt',
    name: 'JWT decoder',
    desc: 'Inspect JWT header, payload, and time claims without verifying signatures.',
    keywords: 'jwt token decode base64url claims expiration developer',
    category: 'developer',
    load: () => import('../tools/jwt/index.js'),
  },
  {
    id: 'cidr',
    name: 'IP / CIDR calculator',
    desc: 'Calculate IPv4 and IPv6 networks, subnets and address membership.',
    keywords: 'ip cidr ipv4 ipv6 subnet netmask wildcard network aggregate',
    category: 'developer',
    load: () => import('../tools/cidr/index.js'),
  },
  {
    id: 'qr',
    name: 'QR Code Generator',
    desc: 'Create QR codes for text, Wi-Fi or contacts, and export CSV batches.',
    keywords: 'qr code generator barcode url link qrcode wifi vcard csv bulk zip colour',
    category: 'documents',
    load: () => import('../tools/qr/index.js'),
  },
  {
    id: 'certificates',
    name: 'Certificate generator',
    desc: 'Place names on a template and export certificates as PDFs.',
    keywords: 'certificate pdf template csv names batch zip merged',
    category: 'documents',
    load: () => import('../tools/certificates/index.js'),
  },
  {
    id: 'scanner',
    name: 'Scanner (camera to PDF)',
    desc: 'Photograph pages with the camera, flatten the corners, and export one PDF.',
    keywords: 'scan scanner camera document photo capture flatten crop pdf pages edge corners black white grayscale',
    category: 'documents',
    load: () => import('../tools/scanner/index.js'),
  },
  {
    id: 'redact',
    name: 'Redact / blur',
    desc: 'Cover sensitive regions in images or PDFs and export flattened pixels.',
    keywords: 'redact blur pixelate censor black box privacy image pdf flatten',
    category: 'security',
    load: () => import('../tools/redact/index.js'),
  },
  {
    id: 'filetype',
    name: 'File type checker',
    desc: 'Check a file’s real type against its name and reported MIME.',
    keywords: 'file type magic bytes signature extension mime mismatch executable security',
    category: 'security',
    load: () => import('../tools/filetype/index.js'),
  },
  {
    id: 'urltools',
    name: 'URL encode / decode and defang',
    desc: 'Encode, decode, inspect, defang or refang URLs and text locally.',
    keywords: 'url encode decode parse punycode hostname defang refang batch security',
    category: 'security',
    load: () => import('../tools/urltools/index.js'),
  },
  {
    id: 'password',
    name: 'Password strength checker',
    desc: 'Estimate password strength locally and generate a random passphrase.',
    keywords: 'password strength entropy guesses passphrase security generator',
    category: 'security',
    load: () => import('../tools/password/index.js'),
  },
];

export function findTool(id) {
  return TOOLS.find((t) => t.id === id) || null;
}

/** Title of the trailing group for tools whose category is unknown or missing. */
export const OTHER_CATEGORY_NAME = 'Other';

/**
 * The search predicate used by both the sidebar and the home list: a
 * case-insensitive substring match on name, description and keywords. An empty
 * (or whitespace-only) query matches every tool. Pure.
 */
export function matchesQuery(tool, query) {
  const q = String(query == null ? '' : query).trim().toLowerCase();
  if (!q) return true;
  const haystack = `${tool.name} ${tool.desc} ${tool.keywords || ''}`.toLowerCase();
  return haystack.includes(q);
}

/**
 * Group tools by category for display. Pure: never mutates `tools` or
 * `categories`. Returns [{ category, tools: [...] }] where
 *   - `category` is the entry from `categories` ({ id, name }),
 *   - groups follow the order of `categories`,
 *   - empty groups are dropped,
 *   - tools are filtered by `matchesQuery(tool, query)`,
 *   - tools whose category is unknown or missing are collected into a trailing
 *     group with id `other` and name OTHER_CATEGORY_NAME, so no tool is lost.
 */
export function groupTools(tools, query = '', categories = CATEGORIES) {
  const list = Array.isArray(tools) ? tools : [];
  const cats = Array.isArray(categories) ? categories : [];
  const ids = new Set(cats.map((c) => c.id));

  const byId = new Map(cats.map((c) => [c.id, []]));
  const other = [];

  for (const tool of list) {
    if (!matchesQuery(tool, query)) continue;
    if (ids.has(tool.category)) byId.get(tool.category).push(tool);
    else other.push(tool);
  }

  const groups = [];
  for (const c of cats) {
    const group = byId.get(c.id);
    if (group.length) groups.push({ category: { id: c.id, name: c.name }, tools: group });
  }
  if (other.length) {
    groups.push({ category: { id: 'other', name: OTHER_CATEGORY_NAME }, tools: other });
  }
  return groups;
}

/**
 * Validate a registry. Pure; returns an array of problem strings (empty when
 * the registry is sound). Checks that
 *   - every tool id is unique,
 *   - every tool has id, name and desc (non-empty strings),
 *   - every tool has a lazy `load` function or a `soon` flag.
 */
export function validateRegistry(tools) {
  const problems = [];
  const list = Array.isArray(tools) ? tools : [];
  const seen = new Set();

  for (const tool of list) {
    const id = tool && tool.id;
    if (!id || typeof id !== 'string') {
      problems.push('tool is missing a valid id');
    } else if (seen.has(id)) {
      problems.push(`duplicate tool id: ${id}`);
    } else {
      seen.add(id);
    }
    const label = id || '(missing id)';
    if (!tool || typeof tool.name !== 'string' || !tool.name.trim()) {
      problems.push(`tool ${label} is missing a name`);
    }
    if (!tool || typeof tool.desc !== 'string' || !tool.desc.trim()) {
      problems.push(`tool ${label} is missing a desc`);
    }
    const hasLoad = tool && typeof tool.load === 'function';
    const hasSoon = !!(tool && tool.soon);
    if (!hasLoad && !hasSoon) {
      problems.push(`tool ${label} needs a lazy load or a soon flag`);
    }
  }
  return problems;
}
