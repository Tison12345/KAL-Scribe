import type { ConsultationRecordingStatus } from '@kal-scribe/types';

/** Pure business rule, no I/O — architecture.md §20 principle 1.
 * Testable with plain strings in, throw/no-throw out. */
const ALLOWED_TRANSITIONS: Record<
  ConsultationRecordingStatus,
  ReadonlySet<ConsultationRecordingStatus>
> = {
  recording: new Set(['uploading', 'uploaded']),
  uploading: new Set(['uploaded', 'processing_failed']),
  uploaded: new Set(['processed', 'processing_failed']),
  processing_failed: new Set(['uploading']),
  processed: new Set(),
};

export class InvalidStatusTransitionError extends Error {
  constructor(
    public readonly from: ConsultationRecordingStatus,
    public readonly to: ConsultationRecordingStatus,
  ) {
    super(
      `Invalid consultation_recordings status transition: ${from} -> ${to}`,
    );
    this.name = 'InvalidStatusTransitionError';
  }
}

export function assertValidStatusTransition(
  from: ConsultationRecordingStatus,
  to: ConsultationRecordingStatus,
): void {
  if (from === to) return;
  if (!ALLOWED_TRANSITIONS[from].has(to)) {
    throw new InvalidStatusTransitionError(from, to);
  }
}
