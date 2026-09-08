"use client";

import { useActionState } from "react";
import { saveHackdev } from "@/lib/actions/hackdev";
import { TextInput, UrlInput, TextArea, NumberInput } from "./fields";
import { ImageUploader } from "./ImageUploader";
import type { DbHackdev } from "@/lib/types";

export function HackdevForm({ item }: { item: DbHackdev | null }) {
  const [state, action, pending] = useActionState(
    async (prev: { ok: boolean; error?: string }, form: FormData) => saveHackdev(prev, form),
    { ok: false }
  );

  return (
    <form action={action} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput name="name" label="COMMUNITY NAME" defaultValue={item?.name ?? "HACKDEV"} />
        <NumberInput name="members" label="MEMBERS" defaultValue={item?.members ?? 0} />
      </div>
      <TextArea name="description" label="DESCRIPTION" defaultValue={item?.description ?? ""} />
      <div className="grid gap-4 sm:grid-cols-3">
        <NumberInput name="universities" label="UNIVERSITIES" defaultValue={item?.universities ?? 0} />
        <NumberInput name="events" label="EVENTS" defaultValue={item?.events ?? 0} />
        <NumberInput name="workshops" label="WORKSHOPS" defaultValue={item?.workshops ?? 0} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <UrlInput name="discord_url" label="DISCORD URL" defaultValue={item?.discord_url ?? ""} />
        <UrlInput name="website_url" label="WEBSITE URL" defaultValue={item?.website_url ?? ""} />
      </div>
      <ImageUploader name="image" label="COMMUNITY IMAGE" value={item?.image ?? ""} />
      <TextArea name="story" label="STORY" defaultValue={item?.story ?? ""} />

      <button type="submit" disabled={pending} className="rounded bg-build/90 px-5 py-2 text-[0.65rem] font-semibold tracking-[0.25em] text-black hover:bg-build disabled:opacity-60">
        {pending ? "SAVING…" : "SAVE HACKDEV"}
      </button>
      {state.error && <p className="text-sm text-red-400">{state.error}</p>}
      {state.ok && !state.error && <p className="text-sm text-build">Saved.</p>}
    </form>
  );
}