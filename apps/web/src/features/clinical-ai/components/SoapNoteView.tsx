import type { SoapNote } from "@kal-scribe/types";

/** SOAP narrative section of the review draft (architecture.md §6,
 * §7 stage 9 — folded into the same extraction call as a single pass
 * for MVP, docs/adr/0011). Editable: the doctor can correct the
 * narrative directly, same as every other draft field. */
export interface SoapNoteViewProps {
  soap: SoapNote;
  onChange: (next: SoapNote) => void;
}

const FIELDS: Array<{ key: keyof SoapNote; label: string }> = [
  { key: "subjective", label: "Subjective" },
  { key: "objective", label: "Objective" },
  { key: "assessment", label: "Assessment" },
  { key: "plan", label: "Plan" },
];

export function SoapNoteView({ soap, onChange }: SoapNoteViewProps) {
  return (
    <div className="space-y-4">
      {FIELDS.map(({ key, label }) => (
        <div key={key}>
          <label className="mb-2 block text-[11px] font-extrabold uppercase tracking-widest text-[var(--color-on-surface-variant)]">
            {label}
          </label>
          <textarea
            value={soap[key]}
            onChange={(e) => onChange({ ...soap, [key]: e.target.value })}
            rows={3}
            className="w-full resize-none rounded-2xl bg-[var(--color-surface-container-low)] px-5 py-4 text-sm font-medium text-[var(--color-on-surface)] form-input-focus transition-all"
            placeholder={`${label} not mentioned`}
          />
        </div>
      ))}
    </div>
  );
}
