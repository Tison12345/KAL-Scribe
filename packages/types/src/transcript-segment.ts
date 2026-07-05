/** Mirrors architecture.md §12's `consultation_transcripts.segments` jsonb
 * shape, and is mirrored again into python/asr-service's Pydantic models
 * (architecture.md §16) — this is the one place the shape is defined for
 * the TS side.
 *
 * `speaker` is real ("Doctor"/"Patient", assigned by
 * doctor-patient-labeling.engine.ts) only once diarization has run
 * (architecture.md §9 — requires HF_TOKEN); otherwise it's the
 * placeholder "Speaker 1", since the ASR service alone can't tell who's
 * speaking without it. */
export interface TranscriptSegment {
  speaker: string;
  text: string;
  start: number;
  end: number;
  wordConfidence: number | null;
}

export interface SpeakerTurn {
  speaker: string;
  start: number;
  end: number;
}

/** Response shape from python/asr-service's POST /v1/process-audio
 * (architecture.md §8). `speakerTurns` is empty when diarization isn't
 * configured (no HF_TOKEN — architecture.md §9). */
export interface ProcessAudioResponse {
  transcriptSegments: TranscriptSegment[];
  speakerTurns: SpeakerTurn[];
  languageDetected: string[];
}
