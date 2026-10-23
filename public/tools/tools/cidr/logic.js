const MAX = { 4: (1n << 32n) - 1n, 6: (1n << 128n) - 1n };

function ipv4(text) {
  const parts = text.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part))) throw new Error('Invalid IPv4 address: enter four decimal octets.');
  let value = 0n;
  for (const part of parts) {
    if (part.length > 1 && part.startsWith('0')) throw new Error('Leading zeros in IPv4 octets are ambiguous; remove them.');
    if (BigInt(part) > 255n) throw new Error('IPv4 octet must be between 0 and 255.');
    value = (value << 8n) | BigInt(part);
  }
  return value;
}

function ipv6(text) {
  let address = text;
  if (address.includes('.')) {
    const match = /^(.*:)([^:]+\.[^:]+)$/.exec(address);
    if (!match) throw new Error('Invalid IPv6 address or embedded IPv4 address.');
    const v4 = ipv4(match[2]);
    address = `${match[1]}${(v4 >> 16n).toString(16)}:${(v4 & 65535n).toString(16)}`;
  }
  if (!/^[0-9a-f:]+$/i.test(address) || (address.match(/::/g) || []).length > 1) throw new Error('Invalid IPv6 address.');
  const compressed = address.includes('::');
  const pieces = compressed ? address.split('::') : [address];
  const left = pieces[0] ? pieces[0].split(':') : [];
  const right = compressed && pieces[1] ? pieces[1].split(':') : [];
  if ([...left, ...right].some((part) => !/^[0-9a-f]{1,4}$/i.test(part)) ||
      (compressed ? left.length + right.length >= 8 : left.length !== 8)) throw new Error('Invalid IPv6 address: check hextets and :: compression.');
  const words = [...left, ...Array(compressed ? 8 - left.length - right.length : 0).fill('0'), ...right];
  return words.reduce((value, part) => (value << 16n) | BigInt(`0x${part}`), 0n);
}

export function formatIP(value, family, expanded = false) {
  if (family === 4) return [24n, 16n, 8n, 0n].map((shift) => Number((value >> shift) & 255n)).join('.');
  const words = Array.from({ length: 8 }, (_, i) => Number((value >> BigInt((7 - i) * 16)) & 65535n));
  if (expanded) return words.map((word) => word.toString(16).padStart(4, '0')).join(':');
  let bestStart = -1; let bestLength = 1;
  for (let i = 0; i < 8;) {
    if (words[i] !== 0) { i++; continue; }
    let end = i;
    while (end < 8 && words[end] === 0) end++;
    if (end - i > bestLength) { bestStart = i; bestLength = end - i; }
    i = end;
  }
  if (bestStart < 0) return words.map((word) => word.toString(16)).join(':');
  const before = words.slice(0, bestStart).map((word) => word.toString(16)).join(':');
  const after = words.slice(bestStart + bestLength).map((word) => word.toString(16)).join(':');
  return `${before}::${after}`;
}

function prefixMask(prefix, bits) {
  return ((1n << BigInt(prefix)) - 1n) << BigInt(bits - prefix);
}

export function parseCIDR(input) {
  const text = String(input).trim();
  const parts = text.split(/\s*\/\s*|\s+/);
  if (!text || parts.length > 2 || parts.some((part) => !part)) throw new Error('Enter one IP address with an optional /prefix, netmask or wildcard.');
  const family = parts[0].includes(':') ? 6 : 4;
  const bits = family === 4 ? 32 : 128;
  const value = family === 4 ? ipv4(parts[0]) : ipv6(parts[0]);
  let prefix = bits;
  if (parts.length === 2) {
    if (/^\d+$/.test(parts[1])) {
      if (BigInt(parts[1]) > BigInt(bits)) throw new Error(`Prefix out of range: use 0 to ${bits}.`);
      prefix = Number(parts[1]);
    } else if (family === 4 && parts[1].includes('.')) {
      const mask = ipv4(parts[1]);
      const ones = mask.toString(2).padStart(32, '0');
      if (/^1*0*$/.test(ones)) prefix = ones.indexOf('0') < 0 ? 32 : ones.indexOf('0');
      else {
        if (!/^0*1*$/.test(ones)) throw new Error('Netmask or wildcard must be contiguous.');
        prefix = ones.indexOf('1');
      }
    } else throw new Error(`Invalid prefix${family === 6 ? ': IPv6 requires a numeric prefix.' : ', netmask or wildcard.'}`);
  }
  const network = value & prefixMask(prefix, bits);
  return { value, family, prefix, network, end: network | (MAX[family] ^ prefixMask(prefix, bits)) };
}

function matches(value, family, base, prefix) {
  return (value & prefixMask(prefix, family === 4 ? 32 : 128)) === base;
}

function classify(value, family) {
  const ranges = family === 4 ? [
    ['127.0.0.0', 8, 'Loopback'], ['10.0.0.0', 8, 'Private RFC1918'],
    ['172.16.0.0', 12, 'Private RFC1918'], ['192.168.0.0', 16, 'Private RFC1918'],
    ['169.254.0.0', 16, 'Link-local'], ['100.64.0.0', 10, 'CGNAT'],
    ['224.0.0.0', 4, 'Multicast'], ['192.0.2.0', 24, 'Documentation'],
    ['198.51.100.0', 24, 'Documentation'], ['203.0.113.0', 24, 'Documentation'],
  ] : [
    ['::1', 128, 'Loopback'], ['fc00::', 7, 'ULA'], ['fe80::', 10, 'Link-local'],
    ['ff00::', 8, 'Multicast'], ['2001:db8::', 32, 'Documentation'],
  ];
  for (const [address, prefix, label] of ranges) {
    if (matches(value, family, family === 4 ? ipv4(address) : ipv6(address), prefix)) return label;
  }
  return family === 4 ? (value === 0n ? 'Unspecified' : value === MAX[4] ? 'Limited broadcast' : 'Public / other') : value === 0n ? 'Unspecified' : 'Global / other';
}

export function calculate(input) {
  const parsed = parseCIDR(input);
  const { value, family, prefix, network, end } = parsed;
  const count = end - network + 1n;
  const reserved = family === 4 && prefix <= 30;
  const mask = prefixMask(prefix, family === 4 ? 32 : 128);
  const result = {
    ...parsed, cidr: `${formatIP(network, family)}/${prefix}`,
    address: formatIP(value, family), first: formatIP(network + (reserved ? 1n : 0n), family),
    last: formatIP(end - (reserved ? 1n : 0n), family), hostCount: count - (reserved ? 2n : 0n),
    type: classify(value, family), binary: value.toString(2).padStart(family === 4 ? 32 : 128, '0'),
  };
  if (family === 4) {
    result.broadcast = formatIP(end, 4);
    result.netmask = formatIP(mask, 4);
    result.wildcard = formatIP(MAX[4] ^ mask, 4);
    result.ipClass = value < 0x80000000n ? 'A' : value < 0xc0000000n ? 'B' : value < 0xe0000000n ? 'C' : value < 0xf0000000n ? 'D' : 'E';
  } else result.expanded = formatIP(value, 6, true);
  return result;
}

export function contains(address, cidr) {
  const ip = parseCIDR(address);
  const range = parseCIDR(cidr);
  if (address.trim().includes('/') || address.trim().split(/\s+/).length > 1) throw new Error('Check a single IP address, without a prefix.');
  return ip.family === range.family && ip.value >= range.network && ip.value <= range.end;
}

export function splitCIDR(input, count) {
  const range = parseCIDR(input);
  if (!Number.isInteger(count) || count < 1 || (count & (count - 1)) !== 0) throw new Error('Subnet count must be a positive power of two.');
  if (count > 1024) throw new Error('At most 1024 subnet rows can be shown.');
  let extra = 0;
  for (let remaining = count; remaining > 1; remaining /= 2) extra++;
  const bits = range.family === 4 ? 32 : 128;
  if (range.prefix + extra > bits) throw new Error('CIDR is too small to split into that many subnets.');
  const size = 1n << BigInt(bits - range.prefix - extra);
  return Array.from({ length: count }, (_, i) => `${formatIP(range.network + BigInt(i) * size, range.family)}/${range.prefix + extra}`);
}

export function summarize(input) {
  const lines = String(input).split(/\r?\n|,/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) throw new Error('Enter at least one CIDR, one per line.');
  if (lines.length > 10000) throw new Error('Limit the list to 10000 CIDRs.');
  const output = [];
  for (const family of [4, 6]) {
    const ranges = lines.map((line, i) => {
      try { return parseCIDR(line); } catch (error) { throw new Error(`Line ${i + 1}: ${error.message}`); }
    }).filter((item) => item.family === family).sort((a, b) => a.network < b.network ? -1 : a.network > b.network ? 1 : 0);
    const merged = [];
    for (const range of ranges) {
      const last = merged.at(-1);
      if (last && range.network <= last.end + 1n) { if (range.end > last.end) last.end = range.end; }
      else merged.push({ start: range.network, end: range.end });
    }
    const bits = family === 4 ? 32 : 128;
    for (const range of merged) {
      let cursor = range.start;
      while (cursor <= range.end) {
        let prefix = 0;
        while (prefix < bits && (cursor & ((1n << BigInt(bits - prefix)) - 1n)) !== 0n) prefix++;
        while (cursor + (1n << BigInt(bits - prefix)) - 1n > range.end) prefix++;
        output.push(`${formatIP(cursor, family)}/${prefix}`);
        cursor += 1n << BigInt(bits - prefix);
      }
    }
  }
  return output;
}
