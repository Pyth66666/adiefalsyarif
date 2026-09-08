"use client";

import { useRef, useState } from "react";
import { uploadImage } from "@/lib/media-client";

interface ImageUploaderProps {
  name: string;
  label: string;
  value?: string;
}

/**
 * Single-image uploader (Supabase Storage). Writes the public
 * URL into a hidden form field.
 */
export function ImageUploader({ name, label, value: initial = "" }: ImageUploaderProps) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const onFile = async (file: File | undefined | null) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const { url } = await uploadImage(file);
      setValue(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <span className="mb-1.5 block text-[0.6rem] font-medium uppercase tracking-[0.25em] text-zinc-500">
        {label}
      </span>
      <input type="hidden" name={name} value={value} />

      {value ? (
        <div className="relative overflow-hidden rounded-md border border-white/10">
          <img src={value} alt="" className="h-36 w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 flex justify-between gap-2 bg-black/70 p-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="rounded bg-white/10 px-2 py-1 text-[0.6rem] tracking-[0.2em] text-zinc-200 hover:bg-white/20"
            >
              REPLACE
            </button>
            <button
              type="button"
              onClick={() => setValue("")}
              className="rounded bg-red-500/20 px-2 py-1 text-[0.6rem] tracking-[0.2em] text-red-300 hover:bg-red-500/40"
            >
              REMOVE
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex h-36 w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-white/20 bg-black/20 text-zinc-500 transition-colors hover:border-build/50 hover:text-zinc-300"
        >
          {busy ? (
            <span className="text-xs tracking-[0.2em]">UPLOADING…</span>
          ) : (
            <>
              <span className="text-xl">+</span>
              <span className="text-[0.6rem] tracking-[0.25em]">UPLOAD IMAGE</span>
            </>
          )}
        </button>
      )}
      {error && <p className="mt-1 text-[0.65rem] text-red-400">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
    </div>
  );
}