import type { ClinicalExtraction, TranscriptSegment } from "@kal-scribe/types";

/** One interface, swappable vendor implementations selected via
 * `LLM_PROVIDER` (architecture.md §10) — mirrors the STT
 * provider-abstraction pattern in python/asr-service exactly (one
 * file per vendor, no vendor SDK called from outside this package). */
export interface LlmExtractionRequest {
  transcriptId: string;
  segments: TranscriptSegment[];
}

export interface LlmProvider {
  readonly name: string;
  extractClinicalData(
    request: LlmExtractionRequest,
  ): Promise<ClinicalExtraction>;
}
