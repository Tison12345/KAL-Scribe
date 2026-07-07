"use client";

import type { SttDevice } from "@kal-scribe/types";

interface SttDeviceToggleProps {
  value: SttDevice;
  onChange: (device: SttDevice) => void;
  disabled?: boolean;
}

const OPTIONS: { value: SttDevice; label: string }[] = [
  { value: "gpu", label: "GPU" },
  { value: "cpu", label: "CPU" },
];

/** Per-recording transcription device choice (docs/adr/0012) — GPU is
 * ~6x faster on this machine's RTX 4050 but a hosting decision for
 * production is still open, so both stay selectable rather than
 * hardcoding one. Pill toggle group per ui-reference.md §4.4. */
export function SttDeviceToggle({ value, onChange, disabled }: SttDeviceToggleProps) {
  return (
    <div className="space-y-2 rounded-2xl border border-[var(--color-outline-variant)]/40 bg-[var(--color-surface-container-low)] px-5 py-4">
      <p className="text-xs font-semibold text-[var(--color-on-surface-variant)]">
        Transcription device
      </p>
      <div role="radiogroup" aria-label="Transcription device" className="flex gap-2">
        {OPTIONS.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={
                selected
                  ? "rounded-2xl px-6 py-3 text-sm font-bold bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-lg shadow-[var(--color-primary)]/30 transition-all disabled:cursor-not-allowed disabled:opacity-50"
                  : "rounded-2xl px-6 py-3 text-sm font-bold bg-[var(--color-surface-container-low)] text-[var(--color-on-surface-variant)] hover:bg-[var(--color-surface-container-high)] transition-all disabled:cursor-not-allowed disabled:opacity-50"
              }
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
