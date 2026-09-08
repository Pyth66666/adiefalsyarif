"use client";

import { useActionState } from "react";
import { saveSiteSettings } from "@/lib/actions/settings";
import { TextInput, TextArea } from "./fields";
import type { DbSiteSettings } from "@/lib/types";

export function SettingsForm({ item }: { item: DbSiteSettings | null }) {
  const [state, action, pending] = useActionState(
    async (prev: { ok: boolean; error?: string }, form: FormData) => saveSiteSettings(prev, form),
    { ok: false }
  );

  return (
    <form action={action} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput name="name" label="NAME" defaultValue={item?.name ?? "ADIEF"} />
        <TextInput name="family" label="FAMILY NAME" defaultValue={item?.family ?? "AL SYARIF"} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput name="domain" label="DOMAIN" defaultValue={item?.domain ?? "adiefalsyarif.com"} />
        <TextInput name="descriptors" label="DESCRIPTORS" defaultValue={item?.descriptors ?? ""} placeholder="COMPUTER SCIENCE / CYBERSECURITY / PHOTOGRAPHY" />
      </div>
      <TextArea name="intro" label="INTRO" defaultValue={item?.intro ?? ""} />
      <TextArea name="about" label="ABOUT" defaultValue={item?.about ?? ""} />
      <TextInput name="contact_email" label="CONTACT EMAIL" type="email" defaultValue={item?.contact_email ?? ""} />

      <button type="submit" disabled={pending} className="rounded bg-build/90 px-5 py-2 text-[0.65rem] font-semibold tracking-[0.25em] text-black hover:bg-build disabled:opacity-60">
        {pending ? "SAVING…" : "SAVE SETTINGS"}
      </button>
      {state.error && <p className="text-sm text-red-400">{state.error}</p>}
      {state.ok && !state.error && <p className="text-sm text-build">Saved.</p>}
    </form>
  );
}