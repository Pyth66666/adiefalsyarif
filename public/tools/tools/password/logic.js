import { wordlist as PASSPHRASE_WORDS } from './words.js';
import { commonPasswords } from './common.js';

export { PASSPHRASE_WORDS };

// A deliberately conservative heuristic, not an audit of a password or its true entropy.
const COMMON = new Set([...commonPasswords, 'p@ssw0rd', 'qwerty123', 'summer', 'winter', 'spring', 'autumn']);
const DICTIONARY = [...COMMON].filter((word) => word.length >= 4).sort((a, b) => b.length - a.length);
const ROWS = ['1234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const LEET = { '@': 'a', '4': 'a', '0': 'o', '1': 'i', '!': 'i', '3': 'e', '5': 's', '$': 's', '7': 't', '+': 't' };

export function estimatePassword(password) {
  if (!password) return { score: 0, bits: 0, guesses: 0, hints: ['Enter a password to see an estimate.'] };
  const text = String(password);
  const pool = (/[a-z]/.test(text) ? 26 : 0) + (/[A-Z]/.test(text) ? 26 : 0)
    + (/[0-9]/.test(text) ? 10 : 0) + (/[^a-zA-Z0-9\s]/.test(text) ? 33 : 0)
    + (/\s/.test(text) ? 1 : 0);
  let bits = text.length * Math.log2(pool || 1);
  const hints = [];
  if (text.length < 12) hints.push('Use more characters: aim for at least 12, preferably 16 or more.');
  const normalized = text.toLowerCase().replace(/[@401!3$57+]/g, (char) => LEET[char] || char);
  const lower = text.toLowerCase();
  const direct = COMMON.has(normalized) || COMMON.has(lower);
  if (direct) {
    bits = Math.min(bits, Math.log2(COMMON.size * 10));
    hints.push('Avoid common passwords, even with capitalization or symbol substitutions.');
  } else {
    let covered = Array(text.length).fill(false);
    let foundWord = false;
    for (const word of DICTIONARY) {
      let at = normalized.indexOf(word);
      while (at !== -1) {
        if (!covered.slice(at, at + word.length).some(Boolean)) {
          for (let i = at; i < at + word.length; i += 1) covered[i] = true;
          bits -= Math.max(0, word.length * Math.log2(pool || 1) - Math.log2(COMMON.size) - 3);
          foundWord = true;
        }
        at = normalized.indexOf(word, at + 1);
      }
    }
    if (foundWord) hints.push('Replace recognizable words with unrelated random words or characters.');
  }
  const repeats = [...text.matchAll(/(.)\1{2,}/g)].reduce((count, match) => count + match[0].length - 1, 0);
  if (repeats) {
    bits -= repeats * Math.log2(pool || 1);
    hints.push('Avoid repeated characters.');
  }
  const years = [...text.matchAll(/(?:19|20)\d{2}/g)].length;
  if (years) {
    bits -= years * 9;
    hints.push('Avoid predictable years and dates.');
  }
  let patterns = 0;
  for (let i = 0; i <= lower.length - 3; i += 1) {
    const slice = lower.slice(i, i + 3);
    const codes = [...slice].map((char) => char.charCodeAt(0));
    const sequence = codes[1] - codes[0];
    const alphabet = /^[a-z]{3}$/.test(slice) || /^\d{3}$/.test(slice);
    const walk = ROWS.some((row) => row.includes(slice) || row.includes([...slice].reverse().join('')));
    if ((alphabet && Math.abs(sequence) === 1 && codes[2] - codes[1] === sequence) || walk) patterns += 1;
  }
  if (patterns) {
    bits -= Math.min(text.length * 3, patterns * 5);
    hints.push('Avoid alphabet, number and keyboard sequences.');
  }
  bits = Math.max(0, Math.min(bits, 256));
  const guesses = Math.max(1, Math.round(2 ** Math.min(bits, 1023)));
  const score = bits < 20 ? 0 : bits < 35 ? 1 : bits < 55 ? 2 : bits < 75 ? 3 : 4;
  if (hints.length === 0) hints.push('For a new password, use a password manager to generate a unique random value.');
  return { score, bits, guesses, hints };
}

export function generatePassphrase(count = 5, source = globalThis.crypto) {
  if (!Number.isInteger(count) || count < 4 || count > 10) throw new RangeError('Word count must be between 4 and 10.');
  if (!source || typeof source.getRandomValues !== 'function') throw new Error('Cryptographic randomness is unavailable.');
  const length = PASSPHRASE_WORDS.length;
  const limit = Math.floor(0x100000000 / length) * length;
  const words = [];
  while (words.length < count) {
    const values = new Uint32Array(1);
    source.getRandomValues(values);
    if (values[0] < limit) words.push(PASSPHRASE_WORDS[values[0] % length]);
  }
  return { words, passphrase: words.join('-'), bits: count * Math.log2(length) };
}
