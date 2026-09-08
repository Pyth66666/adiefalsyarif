export function str(form: FormData, key: string): string {
  return (form.get(key) as string | null)?.trim() ?? "";
}

export function strList(form: FormData, key: string, multi = false): string[] {
  if (multi) {
    const v = form.getAll(key) as string[];
    return v.map((x) => x.trim()).filter(Boolean);
  }
  return str(form, key)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export function bool(form: FormData, key: string): boolean {
  const v = form.get(key);
  return v === "on" || v === "true" || v === "1";
}

export function num(form: FormData, key: string, fallback = 0): number {
  const n = Number(str(form, key));
  return Number.isFinite(n) ? n : fallback;
}

export function splitLines(form: FormData, key: string): string[] {
  return str(form, key)
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
}

const URL_RE = /^https?:\/\/.+/i;

export function validateUrl(value: string, label: string): string | null {
  if (!value) return null;
  if (!URL_RE.test(value)) return `${label} must be a valid http(s) URL`;
  try {
    new URL(value);
  } catch {
    return `${label} must be a valid URL`;
  }
  return null;
}

const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
const MAX_UPLOAD = 15 * 1024 * 1024;

export function validateUpload(file: File): string | null {
  if (!IMAGE_MIMES.includes(file.type)) return `Unsupported file type: ${file.type || "unknown"}`;
  if (file.size > MAX_UPLOAD) return `File too large (max 15MB): ${file.name}`;
  return null;
}