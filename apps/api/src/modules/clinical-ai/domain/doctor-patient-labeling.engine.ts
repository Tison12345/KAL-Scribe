import type { TranscriptSegment } from '@kal-scribe/types';

/**
 * Pure business rule, no I/O (architecture.md §20 principle 1). MVP
 * heuristic per §9: "first to speak" combined with turn-count, since a
 * full LLM classification pass over clinical/directive language is out
 * of scope for now. This is a starting guess, not a guarantee — the
 * doctor can relabel with one tap in TranscriptViewer.tsx if it's
 * wrong (§9), which is what swapDoctorAndPatient below is for.
 */
export function labelDoctorAndPatient(
  segments: TranscriptSegment[],
): TranscriptSegment[] {
  const uniqueSpeakers = [
    ...new Set(segments.map((segment) => segment.speaker)),
  ];

  // Fewer than 2 distinguishable speakers — either diarization didn't
  // run (no HF_TOKEN configured yet) or genuinely one voice. Nothing
  // to label Doctor vs Patient yet; leave the placeholder as-is.
  if (uniqueSpeakers.length < 2) {
    return segments;
  }

  // clinical-ai-single branch: Gemini identifies Doctor/Patient
  // semantically from what's actually said, not from turn order — a
  // real improvement over this heuristic's "first to speak" guess,
  // which is wrong whenever the patient speaks first. If the segments
  // already carry exactly these two labels, trust them as-is instead
  // of re-guessing and potentially flipping a correct labeling.
  if (
    uniqueSpeakers.length === 2 &&
    uniqueSpeakers.every(
      (speaker) => speaker === 'Doctor' || speaker === 'Patient',
    )
  ) {
    return segments;
  }

  const firstSpeaker = uniqueSpeakers[0];
  return segments.map((segment) => ({
    ...segment,
    speaker: segment.speaker === firstSpeaker ? 'Doctor' : 'Patient',
  }));
}

/** One-tap correction when the heuristic guessed backwards (§9). */
export function swapDoctorAndPatient(
  segments: TranscriptSegment[],
): TranscriptSegment[] {
  return segments.map((segment) => {
    if (segment.speaker === 'Doctor') return { ...segment, speaker: 'Patient' };
    if (segment.speaker === 'Patient') return { ...segment, speaker: 'Doctor' };
    return segment;
  });
}
