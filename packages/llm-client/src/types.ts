import type { ClinicalExtraction, TranscriptSegment } from "@kal-scribe/types";

/** Swappable vendor implementations selected via `EXTRACTION_PROVIDER`
 * (docs/adr/0014 — renamed from `LlmProvider`/`LLM_PROVIDER`: "LLM" was
 * never accurate for the speech side, and pins the vocabulary to a
 * kind of model rather than a job). One file per vendor, no vendor SDK
 * called from outside this package. */
export interface ClinicalExtractionRequest {
  transcriptId: string;
  segments: TranscriptSegment[];
}

/** What a run needs beyond the parsed extraction itself (docs/adr/0014
 * — `consultation_ai_runs`' metadata columns). `latencyMs` is always
 * known (the provider timed its own call); tokens/cost are null until
 * the provider's response actually reports them. */
export interface ClinicalExtractionMetadata {
  model: string;
  promptVersion: string;
  temperature: number | null;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  estimatedCostUsd: number | null;
  retryCount: number;
  hadValidationRetry: boolean;
  rawResponse: unknown;
}

export interface ClinicalExtractionResult {
  extraction: ClinicalExtraction;
  metadata: ClinicalExtractionMetadata;
}

export interface ClinicalExtractionProvider {
  readonly name: string;
  extractClinicalData(
    request: ClinicalExtractionRequest,
  ): Promise<ClinicalExtractionResult>;
}

/** A provider that can transcribe + diarize audio directly (Gemini is
 * the sole implementation today — docs/adr/0017). A provider
 * implementing this does NOT need to also implement
 * `ClinicalExtractionProvider`, but `GeminiProvider` does both since
 * it's one model doing the whole job. Renamed from
 * `AudioTranscriptionProvider` (docs/adr/0014) to match
 * `ClinicalExtractionProvider`'s job-based naming, not a model-kind name. */
export interface SpeechUnderstandingRequest {
  audio: Buffer;
  /** e.g. "audio/webm" — chunks are recorded/stitched as webm
   * (internal-api-client.ts's fetchAndStitchRecordingAudio). */
  mimeType: string;
}

export interface SpeechUnderstandingMetadata {
  latencyMs: number;
  isMultilingual: boolean;
  /** Only meaningfully reportable by a model that understands the
   * audio directly — null when the provider has no signal for it. */
  isCodeSwitched: boolean | null;
  /** Same reasoning as ClinicalExtractionMetadata's token fields —
   * null until the provider's response actually reports them. */
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  rawResponse: unknown;
}

export interface SpeechUnderstandingResult {
  segments: TranscriptSegment[];
  /** ISO 639-1 codes — empty array if the provider didn't report one. */
  languageDetected: string[];
  metadata: SpeechUnderstandingMetadata;
}

export interface SpeechUnderstandingProvider {
  readonly name: string;
  transcribeAudio(
    request: SpeechUnderstandingRequest,
  ): Promise<SpeechUnderstandingResult>;
}
