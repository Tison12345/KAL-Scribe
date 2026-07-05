"use client";

/** Shared editor for the many `string[]` fields in ClinicalExtraction
 * (history, diet, lifestyle, adviceGiven, diagnosis.differentialMentioned)
 * — one implementation instead of six near-duplicate row-editors. Uses
 * the existing Add Item Ghost Button / Delete Button patterns from
 * docs/design/ui-reference.md §4.7/§4.8. */
export interface StringListEditorProps {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}

export function StringListEditor({
  label,
  items,
  onChange,
  placeholder,
}: StringListEditorProps) {
  const updateItem = (index: number, value: string) => {
    onChange(items.map((item, i) => (i === index ? value : item)));
  };
  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };
  const addItem = () => {
    onChange([...items, ""]);
  };

  return (
    <div>
      <label className="mb-2 block text-[11px] font-extrabold uppercase tracking-widest text-[var(--color-on-surface-variant)]">
        {label}
      </label>
      {items.length === 0 && (
        <p className="text-[11px] text-[var(--color-outline)]">Not mentioned</p>
      )}
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              type="text"
              value={item}
              onChange={(e) => updateItem(index, e.target.value)}
              placeholder={placeholder}
              className="w-full bg-white rounded-xl py-2 px-3 text-sm font-medium text-[var(--color-on-surface)] form-input-focus transition-all"
            />
            <button
              type="button"
              onClick={() => removeItem(index)}
              aria-label={`Remove ${label} item`}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--color-outline)] transition-all hover:bg-red-50 hover:text-red-600"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addItem}
        className="mt-3 flex items-center gap-1.5 rounded-xl px-4 py-2 text-[11px] font-bold text-[var(--color-primary)] transition-all hover:bg-[var(--color-primary)]/5"
      >
        <span className="material-symbols-outlined text-sm">add</span>
        Add
      </button>
    </div>
  );
}
