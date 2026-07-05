const LOW_THRESHOLD = 0.5;
const MEDIUM_THRESHOLD = 0.75;

/** Per-field "AI confidence" indicator (architecture.md §6, §11's
 * ai_confidence.per_field) — every AI-suggested field must visually
 * read as "suggested," never as already-authoritative (CLAUDE.md's
 * "no silent AI authority" rule). Color mapping is a display-only
 * concern; the backend's extraction-confidence.engine.ts owns the
 * business rule of whether to show the stronger RiskFlagBanner
 * warning. */
export interface ConfidenceBadgeProps {
  score: number;
}

export function ConfidenceBadge({ score }: ConfidenceBadgeProps) {
  const pct = Math.round(score * 100);
  const classes =
    score < LOW_THRESHOLD
      ? "bg-amber-50 text-amber-900"
      : score < MEDIUM_THRESHOLD
        ? "bg-[var(--color-accent)]/10 text-[var(--color-accent)]"
        : "bg-[var(--color-primary)]/10 text-[var(--color-primary)]";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${classes}`}
      title="AI confidence — suggested, not yet doctor-confirmed"
    >
      <span className="material-symbols-outlined text-[12px]">auto_awesome</span>
      {pct}%
    </span>
  );
}
