"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { saveProject } from "@/lib/actions/projects";
import { TextInput, UrlInput, TextArea, Select, Toggle, TagInput } from "./fields";
import { ImageUploader } from "./ImageUploader";
import { MediaPickerButton } from "./MediaPicker";
import { PreviewProject } from "./PreviewProject";
import type { DbProject, DbMediaItem } from "@/lib/types";

interface Props {
  item: DbProject | null;
  media: DbMediaItem[];
}

export function ProjectForm({ item, media }: Props) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    async (prev: { ok: boolean; id?: string; error?: string }, form: FormData) => {
      const res = await saveProject(prev, form);
      if (res.ok && !item && res.id) router.push(`/admin/projects/${res.id}`);
      return res;
    },
    { ok: false }
  );

  const setUrl = (name: string, v: string, form: HTMLFormElement | null) => {
    if (!form) return;
    const el = form.elements.namedItem(name) as HTMLInputElement | null;
    if (el) el.value = v;
  };

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="id" value={item?.id ?? ""} />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput name="title" label="PROJECT NAME" defaultValue={item?.title} required />
        <TextInput name="category" label="CATEGORY" defaultValue={item?.category ?? ""} placeholder="AI / WEB / PRODUCT" />
      </div>
      <TextArea name="tagline" label="SHORT DESCRIPTION" defaultValue={item?.tagline ?? ""} />
      <TextArea name="description" label="FULL DESCRIPTION" defaultValue={item?.description ?? ""} />
      <div className="grid gap-4 sm:grid-cols-3">
        <TextInput name="year" label="YEAR" defaultValue={item?.year ?? ""} placeholder="2026" />
        <Select name="status" label="STATUS" defaultValue={item?.status ?? "completed"} options={[{ value: "completed", label: "Completed" }, { value: "ongoing", label: "Ongoing" }, { value: "archived", label: "Archived" }]} />
        <TextInput name="role" label="ROLE" defaultValue={item?.role ?? ""} />
      </div>
      <TagInput name="technologies" label="TECHNOLOGIES" defaultValue={item?.technologies ?? []} />
      <TextArea name="problem" label="PROBLEM" defaultValue={item?.problem ?? ""} />
      <TextArea name="solution" label="SOLUTION" defaultValue={item?.solution ?? ""} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3">
          <ImageUploader name="hero_image" label="HERO IMAGE" value={item?.hero_image ?? ""} />
          <MediaPickerButton items={media} onPick={(v) => setUrl("hero_image", v, document.querySelector("form"))} label="CHOOSE FROM MEDIA" />
        </div>
        <div>
          <UrlInput name="github" label="GITHUB" defaultValue={item?.github ?? ""} />
          <div className="mt-3" />
          <UrlInput name="demo" label="LIVE DEMO" defaultValue={item?.demo ?? ""} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Toggle name="featured" label="FEATURED" defaultChecked={item?.featured} />
        <Toggle name="published" label="PUBLISHED" defaultChecked={item?.published} />
        <TextInput name="display_order" label="DISPLAY ORDER" type="number" defaultValue={item?.display_order ?? 0} />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-build/90 px-5 py-2 text-[0.65rem] font-semibold tracking-[0.25em] text-black hover:bg-build disabled:opacity-60"
        >
          {pending ? "SAVING…" : item ? "SAVE" : "CREATE & SAVE"}
        </button>
        <PreviewProject />
      </div>

      {state.error && <p className="text-sm text-red-400">{state.error}</p>}
      {state.ok && !state.error && (
        <p className="text-sm text-build">Saved successfully.</p>
      )}
    </form>
  );
}