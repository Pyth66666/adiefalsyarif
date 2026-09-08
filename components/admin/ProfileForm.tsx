"use client";

import { useActionState } from "react";
import { saveProfile } from "@/lib/actions/settings";
import { TextInput, UrlInput, TextArea } from "./fields";
import { ImageUploader } from "./ImageUploader";
import type { DbProfile } from "@/lib/types";

export function ProfileForm({ item }: { item: DbProfile | null }) {
  const [state, action, pending] = useActionState(
    async (prev: { ok: boolean; error?: string }, form: FormData) => saveProfile(prev, form),
    { ok: false }
  );

  return (
    <form action={action} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput name="name" label="NAME" defaultValue={item?.name ?? ""} />
        <TextInput name="title" label="TITLE" defaultValue={item?.title ?? ""} placeholder="Computer Science student" />
      </div>
      <TextArea name="short_bio" label="SHORT BIO" defaultValue={item?.short_bio ?? ""} />
      <TextArea name="long_bio" label="LONG BIO" defaultValue={item?.long_bio ?? ""} />
      <div className="grid gap-4 sm:grid-cols-3">
        <TextInput name="location" label="LOCATION" defaultValue={item?.location ?? ""} />
        <TextInput name="email" label="LOGIN EMAIL (private)" defaultValue={item?.email ?? ""} />
        <TextInput name="email_public" label="CONTACT EMAIL (public)" defaultValue={item?.email_public ?? ""} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <ImageUploader name="profile_image" label="PROFILE IMAGE" value={item?.profile_image ?? ""} />
        <UrlInput name="resume_url" label="CV / RESUME LINK" defaultValue={item?.resume_url ?? ""} />
      </div>

      <button type="submit" disabled={pending} className="rounded bg-build/90 px-5 py-2 text-[0.65rem] font-semibold tracking-[0.25em] text-black hover:bg-build disabled:opacity-60">
        {pending ? "SAVING…" : "SAVE PROFILE"}
      </button>
      {state.error && <p className="text-sm text-red-400">{state.error}</p>}
      {state.ok && !state.error && <p className="text-sm text-build">Saved.</p>}
    </form>
  );
}