"use client";

import { useState } from "react";

/** Chip/tag multi-value editor for `string[]` fields — matches the real
 * CMS's `ComboboxMultiSelect` chip pattern exactly (docs/design ADR:
 * verified against KAL-clinic-management-solution's
 * app/components/combobox/ComboboxMultiSelect.tsx), minus the
 * suggestions dropdown — this repo has no master-list backend to
 * search against yet (that's Milestone 9), so this is a free-text
 * "type + Enter to add" version of the same visual component. */
export interface ChipListEditorProps {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}

export function ChipListEditor({ items, onChange, placeholder }: ChipListEditorProps) {
  const [draft, setDraft] = useState("");

  const commitDraft = () => {
    const value = draft.trim();
    if (value && !items.includes(value)) onChange([...items, value]);
    setDraft("");
  };

  return (
    <div className="flex w-full flex-wrap items-center gap-2 rounded-2xl border border-transparent bg-[var(--color-surface-container-low)] p-2 transition-all focus-within:ring-2 focus-within:ring-[var(--color-primary)]/20">
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary)] px-3 py-1.5 text-xs font-bold text-[var(--color-on-primary)]"
        >
          {item}
          <button
            type="button"
            onClick={() => onChange(items.filter((i) => i !== item))}
            aria-label={`Remove ${item}`}
            className="flex h-4 w-4 items-center justify-center rounded-full transition-colors hover:bg-white/20"
          >
            <span className="material-symbols-outlined text-[14px]">close</span>
          </button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commitDraft();
          } else if (e.key === "Backspace" && draft === "" && items.length > 0) {
            onChange(items.slice(0, -1));
          }
        }}
        onBlur={commitDraft}
        placeholder={items.length === 0 ? placeholder : undefined}
        className="min-w-[120px] flex-1 border-none bg-transparent py-2 text-sm font-medium text-[var(--color-on-surface)] placeholder:text-[var(--color-outline)]/40 focus:outline-none focus:ring-0"
      />
    </div>
  );
}
