"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { savePhoto, deletePhoto, reorderPhotos } from "@/lib/actions/photos";
import { TextInput, TextArea, Select, Toggle } from "./fields";
import { MediaPickerButton } from "./MediaPicker";
import { ConfirmAction } from "./ConfirmAction";
import type { DbPhoto, DbMediaItem } from "@/lib/types";

interface Props {
  item: DbPhoto | null;
  media: DbMediaItem[];
}

export function PhotoEditor({ item, media }: Props) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    async (prev: { ok: boolean; id?: string; error?: string }, form: FormData) => {
      const res = await savePhoto(prev, form);
      if (res.ok && !item && res.id) router.push(`/admin/photography/${res.id}`);
      return res;
    },
    { ok: false }
  );

  const setSrc = (v: string) => {
    const el = document.querySelector("form")!.elements.namedItem("src") as HTMLInputElement | null;
    if (el) el.value = v;
  };

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="id" value={item?.id ?? ""} />
      <input type="hidden" name="src" value={item?.src ?? ""} />

      <div className="flex items-start gap-4">
        <div className="w-40 shrink-0 overflow-hidden rounded-md border border-white/10">
          {item?.src ? (
                        <img src={item.src} alt={item.title ?? ""} className="h-28 w-full object-cover" />
          ) : (
            <div className="flex h-28 items-center justify-center bg-zinc-900 text-[0.55rem] text-zinc-600">
              {state.id ? "UPLOADED" : "NO IMAGE"}
            </div>
          )}
        </div>
        <div className="space-y-2">
          <MediaPickerButton items={media} onPick={setSrc} label="CHOOSE IMAGE" />
          <p className="text-[0.55rem] text-zinc-600">Use Media Library or the NEW page for drag &amp; drop + EXIF.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput name="title" label="TITLE" defaultValue={item?.title ?? ""} />
        <Select name="category" label="CATEGORY" defaultValue={item?.category ?? "STREET"} options={["PEOPLE", "PLACES", "EVENTS", "STREET", "TRAVEL"].map((c) => ({ value: c, label: c }))} />
      </div>
      <TextArea name="description" label="DESCRIPTION" defaultValue={item?.description ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput name="location" label="LOCATION" defaultValue={item?.location ?? ""} />
        <TextInput name="date" label="DATE" defaultValue={item?.date ?? ""} placeholder="24.08.2026" />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <TextInput name="camera" label="CAMERA" defaultValue={item?.camera ?? ""} />
        <TextInput name="lens" label="LENS" defaultValue={item?.lens ?? ""} />
        <TextInput name="aperture" label="APERTURE" defaultValue={item?.aperture ?? ""} />
        <TextInput name="shutter_speed" label="SHUTTER SPEED" defaultValue={item?.shutter_speed ?? ""} />
        <TextInput name="iso" label="ISO" defaultValue={item?.iso ?? ""} />
        <TextInput name="width" label="WIDTH" type="number" defaultValue={item?.width ?? ""} />
        <TextInput name="height" label="HEIGHT" type="number" defaultValue={item?.height ?? ""} />
      </div>

      <div className="flex items-center gap-2 text-[0.55rem] text-zinc-600">
        <label className="flex cursor-pointer items-center gap-1.5">
          <input type="checkbox" name="show_location" value="on" defaultChecked={item?.show_location} />
          SHOW LOCATION
        </label>
        <span>— if on, only the readable LOCATION is shown. GPS coordinates are never published.</span>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Toggle name="featured" label="FEATURED" defaultChecked={item?.featured} />
        <Toggle name="published" label="PUBLISHED" defaultChecked={item?.published} />
        <TextInput name="display_order" label="DISPLAY ORDER" type="number" defaultValue={item?.display_order ?? 0} />
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="rounded bg-build/90 px-5 py-2 text-[0.65rem] font-semibold tracking-[0.25em] text-black hover:bg-build disabled:opacity-60">
          {pending ? "SAVING…" : "SAVE"}
        </button>
        {item && (
          <ConfirmAction action={async () => deletePhoto(item.id)} />
        )}
      </div>

      {state.error && <p className="text-sm text-red-400">{state.error}</p>}
    </form>
  );
}

export function PhotoReorder({ items }: { items: DbPhoto[] }) {
  const [order, setOrder] = useState(items);
  return (
    <div className="space-y-2">
      {order.map((p) => (
        <div key={p.id} className="flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.03] p-2">
          {p.src ? (
                        <img src={p.src} alt="" className="h-10 w-14 rounded object-cover" />
          ) : (
            <div className="h-10 w-14 rounded bg-zinc-900" />
          )}
          <span className="flex-1 truncate text-xs text-zinc-300">{p.title || "Untitled"}</span>
          <div className="flex gap-1">
            <button onClick={() => setOrder(move(p.id, -1))} className="rounded border border-white/10 px-2 text-zinc-500 hover:text-white">↑</button>
            <button onClick={() => setOrder(move(p.id, 1))} className="rounded border border-white/10 px-2 text-zinc-500 hover:text-white">↓</button>
          </div>
        </div>
      ))}
      <button
        onClick={() => { void reorderPhotos(order.map((p) => p.id)); location.reload(); }}
        className="rounded border border-white/20 px-3 py-1.5 text-[0.6rem] tracking-[0.2em] text-zinc-300 hover:border-build/60 hover:text-white"
      >
        SAVE ORDER
      </button>
    </div>
  );
}

function move(id: string, dir: -1 | 1) {
  return (prev: DbPhoto[]) => {
    const idx = prev.findIndex((p) => p.id === id);
    const next = [...prev];
    const target = idx + dir;
    if (target < 0 || target >= prev.length) return prev;
    [next[idx], next[target]] = [next[target], next[idx]];
    return next;
  };
}