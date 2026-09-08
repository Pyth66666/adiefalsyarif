"use client";

import { useActionState } from "react";
import { saveStatistics, deleteStatistic } from "@/lib/actions/settings";
import { TextInput, NumberInput, Toggle } from "./fields";
import { ConfirmAction } from "./ConfirmAction";
import type { DbStatistic } from "@/lib/types";

function StatForm({ item, onDone }: { item: DbStatistic | null; onDone?: () => void }) {
  const [state, action, pending] = useActionState(
    async (prev: { ok: boolean; id?: string; error?: string }, form: FormData) => {
      const res = await saveStatistics(prev, form);
      onDone?.();
      return res;
    },
    { ok: false }
  );

  return (
    <form action={action} className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-3">
      <input type="hidden" name="id" value={item?.id ?? ""} />
      <TextInput name="label" label="LABEL" defaultValue={item?.label} required placeholder="CTF RANK" />
      <NumberInput name="value" label="VALUE" defaultValue={item?.value ?? 0} />
      <div className="grid grid-cols-2 gap-2">
        <TextInput name="prefix" label="PREFIX" defaultValue={item?.prefix ?? ""} placeholder="#" />
        <TextInput name="suffix" label="SUFFIX" defaultValue={item?.suffix ?? ""} placeholder="+" />
      </div>
      <TextInput name="description" label="DESCRIPTION" defaultValue={item?.description ?? ""} />
      <TextInput name="display_order" label="DISPLAY ORDER" type="number" defaultValue={item?.display_order ?? 0} />
      <div className="flex items-end gap-2">
        <Toggle name="visible" label="VISIBLE" defaultChecked={item ? item.visible : true} />
      </div>
      <input type="hidden" name="visual_type" value="number" />
      <div className="flex items-end gap-3 sm:col-span-3">
        <button type="submit" disabled={pending} className="rounded bg-build/85 px-4 py-2 text-[0.6rem] font-semibold tracking-[0.2em] text-black hover:bg-build disabled:opacity-60">
          {pending ? "SAVING…" : item ? "SAVE" : "ADD"}
        </button>
        {item && <ConfirmAction action={async () => deleteStatistic(item.id)} />}
      </div>
      {state.error && <p className="text-sm text-red-400 sm:col-span-3">{state.error}</p>}
    </form>
  );
}

export function StatisticsManager({ items }: { items: DbStatistic[] }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-[0.6rem] uppercase tracking-[0.3em] text-zinc-500">ADD STATISTIC</p>
        <StatForm item={null} />
      </div>
      <div>
        <p className="mb-2 text-[0.6rem] uppercase tracking-[0.3em] text-zinc-500">
          EXISTING ({items.length}) — visible stats appear on the public SYSTEM STATUS panel
        </p>
        <div className="space-y-3">
          {items.map((s) => (
            <StatForm key={s.id} item={s} />
          ))}
        </div>
      </div>
    </div>
  );
}