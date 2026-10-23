function decodePart(part, label) {
  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(part) || part.length % 4 === 1) {
    throw new Error(`${label} is not valid base64url.`);
  }
  const bare = part.replace(/=+$/, '');
  if (part.length !== bare.length && part !== bare + '='.repeat((4 - bare.length % 4) % 4)) {
    throw new Error(`${label} is not valid base64url padding.`);
  }
  try {
    const bytes = atob(bare.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - bare.length % 4) % 4));
    if (btoa(bytes).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_') !== bare) {
      throw new Error('Non-canonical base64url');
    }
    return Uint8Array.from(bytes, (char) => char.charCodeAt(0));
  } catch {
    throw new Error(`${label} is not valid base64url.`);
  }
}

function jsonPart(part, label) {
  const bytes = decodePart(part, label);
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`${label} is not valid UTF-8.`);
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error(`${label} is not valid JSON.`);
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  return value;
}

export function decodeJwt(input) {
  const parts = String(input).trim().split('.');
  if (parts.length !== 3) throw new Error('A JWT must have three parts separated by periods.');
  const header = jsonPart(parts[0], 'Header');
  const payload = jsonPart(parts[1], 'Payload');
  if (parts[2]) decodePart(parts[2], 'Signature');
  return { header, payload, signature: parts[2] };
}

function duration(ms) {
  const seconds = Math.ceil(Math.abs(ms) / 1000);
  const [amount, unit] = seconds >= 86400 ? [Math.floor(seconds / 86400), 'day'] :
    seconds >= 3600 ? [Math.floor(seconds / 3600), 'hour'] :
      seconds >= 60 ? [Math.floor(seconds / 60), 'minute'] : [seconds, 'second'];
  return `${amount} ${unit}${amount === 1 ? '' : 's'}`;
}

export function describeClaims(decoded, now = Date.now()) {
  const warnings = [];
  if (typeof decoded.header.alg === 'string' && decoded.header.alg.toLowerCase() === 'none') {
    warnings.push('Algorithm is none: token is unsigned.');
  }
  if (!Object.hasOwn(decoded.payload, 'exp')) warnings.push('Missing exp: no expiration claim.');
  const result = { warnings };
  for (const name of ['exp', 'iat', 'nbf']) {
    if (!Object.hasOwn(decoded.payload, name)) continue;
    const seconds = decoded.payload[name];
    const date = typeof seconds === 'number' && Number.isFinite(seconds) ? new Date(seconds * 1000) : new Date(NaN);
    if (Number.isNaN(date.getTime())) {
      result[name] = { seconds, local: 'Invalid timestamp', relative: '' };
      continue;
    }
    const difference = date.getTime() - now;
    const relative = name === 'exp' ? difference <= 0 ? `expired ${duration(difference)} ago` : `valid for ${duration(difference)}` :
      difference <= 0 ? `${duration(difference)} ago` : `in ${duration(difference)}`;
    result[name] = { seconds, local: date.toLocaleString(), relative };
  }
  return result;
}
