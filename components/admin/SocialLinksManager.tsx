"use client";

import { useActionState } from "react";
import { saveSocial, deleteSocial } from "@/lib/actions/settings";
import { TextInput, UrlInput, Select, Toggle } from "./fields";
import { ConfirmAction } from "./ConfirmAction";
import type { DbSocialLink } from "@/lib/types";

function SocialForm({ item }: { item: DbSocialLink | null }) {
  const [state, action, pending] = useActionState(
    async (prev: { ok: boolean; id?: string; error?: string }, form: FormData) => saveSocial(prev, form),
    { ok: false }
  );

  return (
    <form action={action} className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-2 lg:grid-cols-4">
      <input type="hidden" name="id" value={item?.id ?? ""} />
      <TextInput name="platform" label="PLATFORM" defaultValue={item?.platform} required placeholder="Instagram" />
      <TextInput name="label" label="DISPLAY NAME" defaultValue={item?.label ?? ""} placeholder="Instagram" />
      <UrlInput name="url" label="URL" defaultValue={item?.url} required placeholder="https://" />
      <TextInput name="icon" label="ICON" defaultValue={item?.icon ?? ""} placeholder="(optional)" />
      <Select
        name="group_name"
        label="GROUP"
        defaultValue={item?.group_name ?? "tech"}
        options={[{ value: "tech", label: "TECH" }, { value: "creative", label: "CREATIVE" }]}
      />
      <TextInput name="display_order" label="DISPLAY ORDER" type="number" defaultValue={item?.display_order ?? 0} />
      <Toggle name="visible" label="VISIBLE" defaultChecked={item ? item.visible : true} />
      <div className="flex items-end gap-2">
        <button type="submit" disabled={pending} className="rounded bg-build/85 px-4 py-2 text-[0.6rem] font-semibold tracking-[0.2em] text-black hover:bg-build disabled:opacity-60">
          {pending ? "SAVING…" : item ? "SAVE" : "ADD"}
        </button>
        {item && <ConfirmAction action={async () => deleteSocial(item.id)} />}
      </div>
      {state.error && <p className="text-sm text-red-400 sm:col-span-4">{state.error}</p>}
    </form>
  );
}

export function SocialLinksManager({ items }: { items: DbSocialLink[] }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-[0.6rem] uppercase tracking-[0.3em] text-zinc-500">ADD LINK</p>
        <SocialForm item={null} />
      </div>
      <div>
        <p className="mb-2 text-[0.6rem] uppercase tracking-[0.3em] text-zinc-500">EXISTING ({items.length}) — empty/invisible links are hidden on the public site</p>
        <div className="space-y-3">
          {items.map((s) => (
            <SocialForm key={s.id} item={s} />
          ))}
        </div>
      </div>
    </div>
  );
}