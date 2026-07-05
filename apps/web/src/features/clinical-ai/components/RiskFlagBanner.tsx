import type { RiskFlag } from "@kal-scribe/types";

/** Surfaces `extraction.riskFlags` prominently (architecture.md §6,
 * §11) — e.g. a possible medicine conflict or a red-flag symptom.
 * Deliberately loud relative to ConfidenceBadge: a risk flag is
 * something the doctor should see before anything else on the page,
 * not a subtle indicator. */
export interface RiskFlagBannerProps {
  riskFlags: RiskFlag[];
}

const SEVERITY_CLASSES: Record<RiskFlag["severity"], string> = {
  critical: "border-red-200 bg-red-50 text-red-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  info: "border-[var(--color-outline-variant)]/40 bg-[var(--color-surface-container-low)] text-[var(--color-on-surface-variant)]",
};

const SEVERITY_ICONS: Record<RiskFlag["severity"], string> = {
  critical: "warning",
  warning: "warning",
  info: "info",
};

const TYPE_LABELS: Record<RiskFlag["type"], string> = {
  possible_medicine_conflict: "Possible medicine conflict",
  red_flag_symptom: "Red-flag symptom",
  incomplete_info: "Incomplete information",
  other: "Flag",
};

export function RiskFlagBanner({ riskFlags }: RiskFlagBannerProps) {
  if (riskFlags.length === 0) return null;

  return (
    <div className="space-y-3">
      {riskFlags.map((flag, index) => (
        <div
          key={index}
          className={`rounded-2xl border px-5 py-4 text-xs ${SEVERITY_CLASSES[flag.severity]}`}
        >
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-base">
              {SEVERITY_ICONS[flag.severity]}
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide">
                {TYPE_LABELS[flag.type]}
              </p>
              <p className="mt-1 leading-relaxed">{flag.description}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
