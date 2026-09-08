"use client";

import { useId, useState, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

const labelCls = "block text-[0.6rem] font-medium uppercase tracking-[0.25em] text-zinc-500 mb-1.5";
const inputCls =
  "w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors focus:border-build/60 focus:ring-1 focus:ring-build/40";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
      {hint && <p className="mt-1 text-[0.6rem] text-zinc-600">{hint}</p>}
    </div>
  );
}

export function TextInput({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <Field label={label} hint={hint}>
      <input id={id} className={inputCls} {...props} />
    </Field>
  );
}

export function UrlInput({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return <TextInput label={label} hint={hint} type="url" placeholder="https://" {...props} />;
}

export function TextArea({
  label,
  hint,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <Field label={label} hint={hint}>
      <textarea id={id} className={`${inputCls} min-h-[100px] resize-y`} {...props} />
    </Field>
  );
}

export function Select({
  label,
  options,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: { value: string; label: string }[] }) {
  const id = useId();
  return (
    <Field label={label}>
      <select id={id} className={inputCls} {...props}>
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-zinc-900">
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function Toggle({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-md border border-white/10 bg-black/30 px-3 py-2.5">
      <span className="text-xs uppercase tracking-[0.2em] text-zinc-300">{label}</span>
      <span className="relative inline-flex">
        <input type="checkbox" name={name} value="on" defaultChecked={defaultChecked} className="peer sr-only" />
        <span className="h-5 w-9 rounded-full border border-white/15 bg-zinc-800 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-zinc-400 after:transition-transform peer-checked:border-build peer-checked:bg-build/20 peer-checked:after:translate-x-4 peer-checked:after:bg-build" />
      </span>
    </label>
  );
}

export function TagInput({
  name,
  label,
  defaultValue = [],
}: {
  name: string;
  label: string;
  defaultValue?: string[];
}) {
  const [tags, setTags] = useState(defaultValue);
  const [draft, setDraft] = useState("");
  return (
    <div>
      <span className={labelCls}>{label}</span>
      <div
        className={`${inputCls} flex flex-wrap items-center gap-1.5`}
        onClick={(e) => (e.currentTarget.querySelector("input") as HTMLInputElement)?.focus()}
      >
        {tags.map((t, i) => (
          <span key={t} className="flex items-center gap-1 rounded-full border border-build/40 bg-build/10 px-2.5 py-0.5 text-xs text-zinc-200">
            {t}
            <button
              type="button"
              className="text-zinc-500 hover:text-zinc-100"
              onClick={() => setTags((prev) => prev.filter((_, j) => j !== i))}
              aria-label={`Remove ${t}`}
            >
              ×
            </button>
            <input type="hidden" name={name} value={t} />
          </span>
        ))}
        <input
          className="min-w-16 flex-1 bg-transparent text-sm outline-none"
          value={draft}
          placeholder="Add…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const v = draft.trim();
              if (v && !tags.includes(v)) setTags((prev) => [...prev, v]);
              setDraft("");
            } else if (e.key === "Backspace" && !draft && tags.length) {
              setTags((prev) => prev.slice(0, -1));
            }
          }}
        />
      </div>
    </div>
  );
}

export function NumberInput({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return <TextInput label={label} hint={hint} type="number" {...props} />;
}