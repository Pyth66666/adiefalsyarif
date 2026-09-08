"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { saveCollectionItem, deleteCollectionItem } from "@/lib/actions/collection";
import { TextInput, UrlInput, TextArea, Select, Toggle } from "./fields";
import { ImageUploader } from "./ImageUploader";
import { ConfirmAction } from "./ConfirmAction";
import type { DbCollectionItem } from "@/lib/types";

interface Props {
  item: DbCollectionItem | null;
  projects: { id: string; title: string }[];
}

export function CollectionForm({ item, projects }: Props) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    async (prev: { ok: boolean; id?: string; error?: string }, form: FormData) => {
      const res = await saveCollectionItem(prev, form);
      if (res.ok && !item && res.id) router.push(`/admin/collection/${res.id}`);
      return res;
    },
    { ok: false }
  );

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="id" value={item?.id ?? ""} />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput name="title" label="NAME" defaultValue={item?.title} required />
        <TextInput name="event" label="EVENT" defaultValue={item?.event ?? ""} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextInput name="organization" label="ORGANIZATION" defaultValue={item?.organization ?? ""} />
        <TextInput name="year" label="YEAR" defaultValue={item?.year ?? ""} />
        <Select
          name="related_project"
          label="RELATED PROJECT"
          defaultValue={item?.related_project ?? ""}
          options={[{ value: "", label: "None" }, ...projects.map((p) => ({ value: p.id, label: p.title }))]}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ImageUploader name="front_image" label="FRONT IMAGE" value={item?.front_image ?? ""} />
        <ImageUploader name="back_image" label="BACK IMAGE" value={item?.back_image ?? ""} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <TextArea name="story" label="STORY" defaultValue={item?.story ?? ""} />
        <TextArea name="what_happened" label="WHAT HAPPENED" defaultValue={item?.what_happened ?? ""} />
        <TextArea name="what_i_built" label="WHAT I BUILT" defaultValue={item?.what_i_built ?? ""} />
      </div>
      <TextArea name="people_i_met" label="PEOPLE I MET" defaultValue={item?.people_i_met ?? ""} />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput name="photos" label="RELATED PHOTOS (comma-separated URLs)" defaultValue={(item?.photos ?? []).join(", ")} />
        <UrlInput name="external_link" label="EXTERNAL LINK" defaultValue={item?.external_link ?? ""} />
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
        {item && <ConfirmAction action={async () => deleteCollectionItem(item.id)} />}
      </div>

      {state.error && <p className="text-sm text-red-400">{state.error}</p>}
    </form>
  );
}