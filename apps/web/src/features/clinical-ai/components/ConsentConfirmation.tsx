"use client";

import { useClinicalSession } from "../providers/ClinicalSessionProvider";

/**
 * Explicit, per-session consent gate (architecture.md §15). Never a
 * pre-checked box — the doctor must take a deliberate action every
 * session before recording is allowed to start.
 */
export function ConsentConfirmation() {
  const { consentConfirmed, consentConfirmedAt, confirmConsent } =
    useClinicalSession();

  if (consentConfirmed) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-outline-variant)]/40 bg-[var(--color-surface-container-low)] px-5 py-4">
        <span className="material-symbols-outlined text-lg text-[var(--color-primary)]">
          verified_user
        </span>
        <p className="text-sm font-semibold text-emerald-700">
          Patient consent confirmed at{" "}
          {consentConfirmedAt &&
            new Date(consentConfirmedAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-[var(--color-outline-variant)]/40 bg-[var(--color-surface-container-low)] px-5 py-4">
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-lg text-[var(--color-primary)]">
          verified_user
        </span>
        <p className="text-xs leading-relaxed text-[var(--color-on-surface-variant)]">
          Recording requires the patient&apos;s explicit consent for this
          consultation. Confirm with the patient before starting, then
          confirm here — this is required every session and can&apos;t be
          preset.
        </p>
      </div>
      <button
        type="button"
        onClick={confirmConsent}
        className="flex items-center gap-3 rounded-2xl bg-[var(--color-primary)] px-8 py-4 text-sm font-extrabold text-[var(--color-on-primary)] shadow-lg shadow-[var(--color-primary)]/30 transition-all hover:bg-[var(--color-primary-hover)] hover:shadow-xl active:scale-[0.98]"
      >
        Confirm Patient Consent
      </button>
    </div>
  );
}
