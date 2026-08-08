/** Mirrors architecture.md §12's `consultation_transcripts.segments`
 * jsonb shape — this is the one place the shape is defined for the TS
 * side.
 *
 * `speaker` is real ("Doctor"/"Patient", assigned by
 * doctor-patient-labeling.engine.ts) once the speech-understanding
 * provider's diarization has identified distinct speakers.
 *
 * `originalText`/`originalLanguage` (docs/adr/0016) are only
 * meaningfully reportable by a provider that understands audio
 * directly and preserves original-language wording alongside the
 * English `text` — currently only Gemini; null when not reported. */
export interface TranscriptSegment {
  speaker: string;
  text: string;
  start: number;
  end: number;
  wordConfidence: number | null;
  originalText: string | null;
  originalLanguage: string | null;
}
