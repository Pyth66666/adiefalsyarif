"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { saveEvent, deleteEvent } from "@/lib/actions/events";
import { TextInput, UrlInput, TextArea, Select, Toggle } from "./fields";
import { ImageUploader } from "./ImageUploader";
import { ConfirmAction } from "./ConfirmAction";
import type { DbEvent } from "@/lib/types";

interface Props {
  item: DbEvent | null;
}

function toInputDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function EventForm({ item }: Props) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    async (prev: { ok: boolean; id?: string; error?: string }, form: FormData) => {
      const res = await saveEvent(prev, form);
      if (res.ok && !item && res.id) router.push(`/admin/events/${res.id}`);
      return res;
    },
    { ok: false }
  );

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="id" value={item?.id ?? ""} />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput name="name" label="EVENT NAME" defaultValue={item?.name} required />
        <TextInput name="org" label="ORGANIZATION" defaultValue={item?.org ?? ""} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextInput name="location" label="LOCATION" defaultValue={item?.location ?? ""} />
        <TextInput name="date" label="DATE" type="date" defaultValue={toInputDate(item?.date) || undefined} />
        <Select name="status" label="STATUS" defaultValue={item?.status ?? "upcoming"} options={[{ value: "upcoming", label: "UPCOMING" }, { value: "ongoing", label: "ONGOING" }, { value: "completed", label: "COMPLETED" }]} />
        <TextInput name="result" label="RESULT" defaultValue={item?.result ?? ""} />
        <TextInput name="project" label="PROJECT" defaultValue={item?.project ?? ""} />
      </div>
      <TextArea name="description" label="DESCRIPTION / STORY" defaultValue={item?.description ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <ImageUploader name="images" label="EVENT IMAGES (first one shown)" value={(item?.images ?? [])[0] ?? ""} />
        <div>
          <UrlInput name="external_link" label="EXTERNAL LINK" defaultValue={item?.external_link ?? ""} />
          <p className="mt-2 text-[0.55rem] text-zinc-600">Plural images are supported in the data model; the first image is used on the timeline.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Toggle name="featured" label="FEATURED" defaultChecked={item?.featured} />
        <Toggle name="published" label="PUBLISHED" defaultChecked={item?.published} />
        <TextInput name="display_order" label="DISPLAY ORDER" type="number" defaultValue={item?.display_order ?? 0} />
      </div>

      <div className="flex gap-3">
        <button type="submit" disabled={pending} className="rounded bg-build/90 px-5 py-2 text-[0.65rem] font-semibold tracking-[0.25em] text-black hover:bg-build disabled:opacity-60">
          {pending ? "SAVING…" : item ? "SAVE" : "CREATE & SAVE"}
        </button>
        {item && <ConfirmAction action={async () => deleteEvent(item.id)} />}
      </div>

      {state.error && <p className="text-sm text-red-400">{state.error}</p>}
    </form>
  );
}