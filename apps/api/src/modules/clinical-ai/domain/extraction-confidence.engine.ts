import type { AiConfidence } from '@kal-scribe/types';

/** Pure business rules for confidence display — no I/O, testable with
 * plain data (architecture.md §20 principle 7). Decides how
 * ConfidenceBadge/RiskFlagBanner should present a score, not what the
 * score itself is (that's the LLM's ai_confidence output, §11). */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

const LOW_CONFIDENCE_THRESHOLD = 0.5;
const MEDIUM_CONFIDENCE_THRESHOLD = 0.75;

export function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score < LOW_CONFIDENCE_THRESHOLD) return 'low';
  if (score < MEDIUM_CONFIDENCE_THRESHOLD) return 'medium';
  return 'high';
}

/** "Is this extraction confident enough to show without a warning
 * banner" (architecture.md §5's own description of this file's job) —
 * a low overall score OR an explicit low-confidence reason from the
 * LLM both warrant surfacing the warning, not just the raw number. */
export function shouldShowLowConfidenceWarning(
  aiConfidence: AiConfidence,
): boolean {
  return (
    aiConfidence.overall < LOW_CONFIDENCE_THRESHOLD ||
    aiConfidence.lowConfidenceReason !== null
  );
}
