import { z } from "zod";

const transcriptSegmentSchema = z.object({
  speaker: z.string().min(1),
  text: z.string(),
  start: z.number().nonnegative(),
  end: z.number().nonnegative(),
  wordConfidence: z.number().min(0).max(1).nullable(),
  // docs/adr/0016 — null on the classic WhisperX path, only
  // meaningfully reportable by a provider that understands audio
  // directly (currently Gemini only).
  originalText: z.string().nullable(),
  originalLanguage: z.string().min(2).nullable(),
});

export const createTranscriptSchema = z.object({
  segments: z.array(transcriptSegmentSchema),
  sttProvider: z.string().min(1),
  diarizationProvider: z.string().min(1).nullable(),
  languageDetected: z.array(z.string()).nullable(),
  isMultilingual: z.boolean().nullable().optional(),
  isCodeSwitched: z.boolean().nullable().optional(),
  inputTokens: z.number().int().nonnegative().nullable().optional(),
  outputTokens: z.number().int().nonnegative().nullable().optional(),
  totalTokens: z.number().int().nonnegative().nullable().optional(),
  rawResponse: z.unknown().optional(),
  transcriptionLatencyMs: z.number().int().nonnegative().nullable().optional(),
});
