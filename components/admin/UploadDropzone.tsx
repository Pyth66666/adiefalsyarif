"use client";

import { useRef, useState } from "react";
import { uploadImage, extractExifFromFile, hasGpsExif, type DetectedExif } from "@/lib/media-client";

export interface DroppedPhoto {
  key: string;
  url: string;
  filename: string;
  exif: DetectedExif;
  hasGps: boolean;
}

interface UploadDropzoneProps {
  /**
   * Behaves like a photo-creation queue: parent converts each dropped file into
   * a ready-to-publish metadata form / DB row.
   */
  onFile: (photo: DroppedPhoto) => void;
  label?: string;
}

/**
 * Multi-file drag & drop upload with per-file progress, EXIF extraction
 * (auto-filled), and GPS presence reporting (never auto-published).
 */
export function UploadDropzone({ onFile, label = "DRAG & DROP PHOTOS HERE" }: UploadDropzoneProps) {
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    for (const file of list) {
      try {
        const { url } = await uploadImage(file);
        const exif = await extractExifFromFile(file);
        const gps = await hasGpsExif(file);
        onFile({
          key: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          url,
          filename: file.name,
          exif,
          hasGps: gps,
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : `Failed: ${file.name}`);
      }
    }
    setBusy(false);
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          void handleFiles(e.dataTransfer.files);
        }}
        className={`flex min-h-40 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
          drag ? "border-build bg-build/10 text-zinc-200" : "border-white/20 bg-black/25 text-zinc-500 hover:border-white/40"
        }`}
      >
        {busy ? (
          <span className="animate-pulse text-xs tracking-[0.3em] text-build">UPLOADING…</span>
        ) : (
          <>
            <span className="text-2xl">＋</span>
            <span className="text-[0.65rem] tracking-[0.3em]">{label}</span>
            <span className="text-[0.55rem] tracking-[0.25em] text-zinc-600">
              OR SELECT FROM COMPUTER — JPEG · PNG · WEBP (max 15MB each)
            </span>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      {error && <p className="mt-2 text-[0.65rem] text-red-400">{error}</p>}
    </div>
  );
}