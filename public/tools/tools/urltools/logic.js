// Pure, local URL text transformations. Nothing here opens or requests a URL.
export function encode(text) {
  try {
    return encodeURIComponent(String(text));
  } catch {
    throw new Error('Input contains an invalid Unicode surrogate. Remove or replace it before encoding.');
  }
}

export function decode(text) {
  const input = String(text);
  const bad = /%(?![0-9a-fA-F]{2})/.exec(input);
  if (bad) return { ok: false, error: `Malformed percent escape at character ${bad.index + 1}; use % followed by two hexadecimal digits.` };
  try {
    return { ok: true, output: decodeURIComponent(input) };
  } catch {
    return { ok: false, error: 'Percent-encoded bytes are not valid UTF-8. Check the encoded characters.' };
  }
}

export function defang(text) {
  return String(text)
    .replace(/https?:\/\//gi, (match) => `${match.slice(0, 4).toLowerCase() === 'http' && match[4]?.toLowerCase() === 's' ? 'hxxps' : 'hxxp'}[://]`)
    .replace(/\./g, '[.]')
    .replace(/@/g, '[@]');
}

export function refang(text) {
  return String(text)
    .replace(/\[(?:dot|\.)\]|\(\.\)/gi, '.')
    .replace(/\[@\]/g, '@')
    .replace(/h(?:xx|\[tt\])ps?(?=\[\s*:\s*\/\/\s*\]|:\/\/|\[:\]\/\/)/gi,
      (match) => match.toLowerCase().endsWith('s') ? 'https' : 'http')
    .replace(/\[\s*:\s*\/\/\s*\]|\[:\]\/\//g, '://');
}

// Decode an IDNA xn-- label to inspect its scripts without network or libraries.
function decodePunycode(label) {
  const input = label.slice(4).toLowerCase();
  const output = [];
  const boundary = input.lastIndexOf('-');
  if (boundary >= 0) for (const char of input.slice(0, boundary)) output.push(char.codePointAt(0));
  let index = boundary < 0 ? 0 : boundary + 1;
  let n = 128, bias = 72, delta = 0;
  let firstTime = true;
  while (index < input.length) {
    let weight = 1;
    for (let k = 36; ; k += 36) {
      if (index >= input.length) return label;
      const code = input.charCodeAt(index++);
      const digit = code >= 97 && code <= 122 ? code - 97 : code >= 48 && code <= 57 ? code - 22 : 36;
      if (digit >= 36) return label;
      delta += digit * weight;
      const threshold = k <= bias ? 1 : k >= bias + 26 ? 26 : k - bias;
      if (digit < threshold) break;
      weight *= 36 - threshold;
      if (!Number.isSafeInteger(weight) || !Number.isSafeInteger(delta)) return label;
    }
    let distance = firstTime ? Math.floor(delta / 700) : Math.floor(delta / 2);
    firstTime = false;
    distance += Math.floor(distance / (output.length + 1));
    let k = 0;
    while (distance > 455) { distance = Math.floor(distance / 35); k += 36; }
    bias = k + Math.floor(36 * distance / (distance + 38));
    n += Math.floor(delta / (output.length + 1));
    delta %= output.length + 1;
    if (n > 0x10ffff) return label;
    output.splice(delta++, 0, n);
  }
  return String.fromCodePoint(...output);
}

function scriptOf(char) {
  if (/\p{Script=Latin}/u.test(char)) return 'Latin';
  if (/\p{Script=Cyrillic}/u.test(char)) return 'Cyrillic';
  if (/\p{Script=Greek}/u.test(char)) return 'Greek';
  if (/\p{Script=Han}/u.test(char)) return 'Han';
  if (/\p{Script=Hiragana}/u.test(char)) return 'Hiragana';
  if (/\p{Script=Katakana}/u.test(char)) return 'Katakana';
  if (/\p{Script=Hangul}/u.test(char)) return 'Hangul';
  if (/\p{Script=Arabic}/u.test(char)) return 'Arabic';
  if (/\p{Script=Hebrew}/u.test(char)) return 'Hebrew';
  if (/\p{Script=Devanagari}/u.test(char)) return 'Devanagari';
  return /\p{Letter}/u.test(char) ? 'Other' : null;
}

export function parseUrl(text) {
  const input = String(text).trim();
  if (!/^[a-z][a-z\d+.-]*:/i.test(input)) return { ok: false, error: 'Enter a full URL with a scheme, such as https://example.com/.' };
  let url;
  try { url = new URL(input); } catch { return { ok: false, error: 'Could not parse this full URL. Check the scheme, host and port.' }; }
  const host = url.hostname;
  const unicodeHost = host.split('.').map((part) => part.startsWith('xn--') ? decodePunycode(part) : part).join('.');
  const nonAsciiHost = /[^\x00-\x7f]/.test(unicodeHost);
  const mixedScriptHost = unicodeHost.split('.').some((label) => {
    const scripts = new Set([...label].map(scriptOf).filter(Boolean));
    return scripts.size > 1;
  });
  const warnings = [];
  if (url.username || url.password || /^[a-z][a-z\d+.-]*:\/\/[^/?#]*@/i.test(input)) {
    warnings.push('URL contains userinfo before @; the actual host is the host shown below, not the text before @.');
  }
  if (nonAsciiHost) warnings.push('Host contains non-ASCII characters; inspect its punycode form for lookalikes.');
  if (mixedScriptHost) warnings.push('Host has mixed-script characters within a label; this may be a lookalike hostname.');
  return {
    ok: true, scheme: url.protocol.slice(0, -1), host, unicodeHost, port: url.port,
    path: url.pathname, queryParams: [...url.searchParams.entries()], fragment: url.hash.slice(1),
    nonAsciiHost, mixedScriptHost, warnings,
  };
}

export function processBatch(text, mode) {
  const lines = String(text).split(/\r?\n/);
  if (lines.length > 1000) return { ok: false, error: 'Batch limit is 1000 lines. Remove extra lines and try again.' };
  const outputs = [];
  for (const [index, line] of lines.entries()) {
    const result = mode === 'parse' ? parseUrl(line) : processOne(line, mode);
    if (!result.ok) return { ok: false, error: `Line ${index + 1}: ${result.error}` };
    outputs.push(mode === 'parse' ? JSON.stringify(result) : result.output);
  }
  return { ok: true, output: outputs.join('\n'), count: lines.length };
}

export function processOne(text, mode) {
  try {
    if (mode === 'encode') return { ok: true, output: encode(text) };
    if (mode === 'decode') return decode(text);
    if (mode === 'defang') return { ok: true, output: defang(text) };
    if (mode === 'refang') return { ok: true, output: refang(text) };
    if (mode === 'parse') {
      const result = parseUrl(text);
      if (!result.ok) return result;
      return { ok: true, output: [
        `Scheme: ${result.scheme}`, `Host (punycode): ${result.host}`,
        `Host (Unicode): ${result.unicodeHost}`, `Port: ${result.port || '(none)'}`,
        `Path: ${result.path}`, `Query params: ${result.queryParams.length ? result.queryParams.map(([key, value]) => `${key} = ${value}`).join('; ') : '(none)'}`,
        `Fragment: ${result.fragment || '(none)'}`, ...result.warnings.map((warning) => `Warning: ${warning}`),
      ].join('\n') };
    }
    return { ok: false, error: 'Choose an operation.' };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}
