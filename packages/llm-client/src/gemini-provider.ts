import { z } from "zod";
import type { ClinicalExtraction, TranscriptSegment } from "@kal-scribe/types";
import { clinicalExtractionSchema } from "@kal-scribe/validation";
import { buildExtractionPrompt, EXTRACTION_PROMPT_VERSION } from "./prompt.js";
import type {
  ClinicalExtractionProvider,
  ClinicalExtractionRequest,
  ClinicalExtractionResult,
  SpeechUnderstandingProvider,
  SpeechUnderstandingRequest,
  SpeechUnderstandingResult,
} from "./types.js";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const TEMPERATURE = 0.2;

/** `inline_data` requests are capped at 20MB total (Gemini API audio
 * docs) — comfortably covers a typical 20-45 min consultation at the
 * opus bitrates MediaRecorder produces, but not arbitrarily long
 * recordings. Failing loudly here (same philosophy as
 * load-provider.ts's missing-API-key check) beats silently truncating
 * or guessing — if this trips in practice, the fix is switching to
 * Gemini's File API (upload + reference by URI), not raising this
 * constant. */
const MAX_INLINE_AUDIO_BYTES = 19 * 1024 * 1024;

interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

interface GeminiUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
}

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  usageMetadata?: GeminiUsageMetadata;
}

interface GeminiCallResult {
  text: string;
  usage: GeminiUsageMetadata | undefined;
}

/**
 * clinical-ai-single branch — one Gemini model standing in for the
 * whole pipeline: `transcribeAudio` replaces python/asr-service
 * (Whisper+pyannote), `extractClinicalData` replaces GroqProvider's
 * role, both against the same `gemini-*` model (see docs/adr for the
 * model choice). Uses the REST API directly (no `@google/genai` SDK),
 * matching this package's "no vendor SDK called from outside the
 * provider file" convention (architecture.md §10, groq-provider.ts).
 */
export class GeminiProvider
  implements ClinicalExtractionProvider, SpeechUnderstandingProvider
{
  readonly name: string;

  constructor(
    private readonly apiKey: string,
    private readonly model: string = "gemini-2.5-flash",
  ) {
    this.name = `gemini/${model}`;
  }

  // ---------------------------------------------------------------------
  // Audio transcription + diarization (replaces python/asr-service)
  // ---------------------------------------------------------------------

  async transcribeAudio(
    request: SpeechUnderstandingRequest,
  ): Promise<SpeechUnderstandingResult> {
    if (request.audio.length > MAX_INLINE_AUDIO_BYTES) {
      throw new Error(
        `Audio (${request.audio.length} bytes) exceeds Gemini's inline_data limit ` +
          `(${MAX_INLINE_AUDIO_BYTES} bytes) — this recording needs the File API upload ` +
          `path, which GeminiProvider does not implement yet.`,
      );
    }

    const t0 = Date.now();
    const contents: GeminiContent[] = [
      {
        role: "user",
        parts: [
          { text: "Transcribe and diarize the attached consultation audio now." },
          {
            inline_data: {
              mime_type: request.mimeType,
              data: request.audio.toString("base64"),
            },
          },
        ],
      },
    ];

    const { text: raw } = await this.generate(
      TRANSCRIPTION_SYSTEM_INSTRUCTION,
      contents,
      TRANSCRIPTION_RESPONSE_SCHEMA,
    );

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error(
        `Gemini transcription response was not valid JSON: ${
          error instanceof Error ? error.message : "unknown parse error"
        }`,
      );
    }

    const result = transcriptionResponseSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(
        `Gemini transcription response did not match the expected shape: ${result.error.message}`,
      );
    }

    const segments: TranscriptSegment[] = result.data.segments.map((segment) => ({
      speaker: segment.speaker,
      text: segment.text,
      start: segment.start,
      end: segment.end,
      // Gemini doesn't report per-word confidence the way WhisperX does
      // — there's no equivalent signal to put here.
      wordConfidence: null,
    }));

    return {
      segments,
      languageDetected: result.data.languageDetected,
      metadata: {
        latencyMs: Date.now() - t0,
        isMultilingual: result.data.languageDetected.length > 1,
        isCodeSwitched: result.data.codeSwitched,
        rawResponse: raw,
      },
    };
  }

  // ---------------------------------------------------------------------
  // Clinical extraction (same contract as GroqProvider)
  // ---------------------------------------------------------------------

  async extractClinicalData(
    request: ClinicalExtractionRequest,
  ): Promise<ClinicalExtractionResult> {
    const t0 = Date.now();
    const { system, user } = buildExtractionPrompt(request.segments);
    const contents: GeminiContent[] = [{ role: "user", parts: [{ text: user }] }];

    const first = await this.callAndValidateExtraction(
      system,
      contents,
      request.transcriptId,
    );
    if (first.success) {
      return this.buildExtractionResult(first, t0, 0, false);
    }

    // One retry, with the validation failure fed back — same reasoning
    // as GroqProvider: JSON-mode output is "valid JSON" guaranteed, not
    // "matches this exact nested schema" guaranteed.
    contents.push(
      { role: "model", parts: [{ text: first.raw }] },
      {
        role: "user",
        parts: [
          {
            text: `That JSON did not match the required schema: ${first.error}. Return the corrected, complete JSON object only.`,
          },
        ],
      },
    );
    const second = await this.callAndValidateExtraction(
      system,
      contents,
      request.transcriptId,
    );
    if (second.success) {
      return this.buildExtractionResult(second, t0, 1, true);
    }

    throw new Error(
      `Gemini extraction did not produce schema-conforming JSON after retry: ${second.error}`,
    );
  }

  private buildExtractionResult(
    attempt: {
      success: true;
      data: ClinicalExtraction;
      raw: string;
      usage: GeminiUsageMetadata | undefined;
    },
    t0: number,
    retryCount: number,
    hadValidationRetry: boolean,
  ): ClinicalExtractionResult {
    return {
      extraction: attempt.data,
      metadata: {
        model: this.model,
        promptVersion: EXTRACTION_PROMPT_VERSION,
        temperature: TEMPERATURE,
        latencyMs: Date.now() - t0,
        inputTokens: attempt.usage?.promptTokenCount ?? null,
        outputTokens: attempt.usage?.candidatesTokenCount ?? null,
        totalTokens: attempt.usage?.totalTokenCount ?? null,
        // Gemini's per-token pricing varies by model and isn't returned
        // in the response itself — computing this needs a maintained
        // pricing table, a documented follow-up rather than a guess.
        estimatedCostUsd: null,
        retryCount,
        hadValidationRetry,
        rawResponse: attempt.raw,
      },
    };
  }

  private async callAndValidateExtraction(
    system: string,
    contents: GeminiContent[],
    transcriptId: string,
  ): Promise<
    | {
        success: true;
        data: ClinicalExtraction;
        raw: string;
        usage: GeminiUsageMetadata | undefined;
      }
    | { success: false; error: string; raw: string }
  > {
    const { text: raw, usage } = await this.generate(system, contents);

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return {
        success: false,
        raw,
        error: error instanceof Error ? error.message : "Invalid JSON",
      };
    }

    // transcriptReference.consultationTranscriptId is ours to set, not
    // the model's — overwrite whatever it guessed rather than trusting
    // it to echo an opaque id back correctly.
    if (parsed && typeof parsed === "object") {
      const candidate = parsed as Record<string, unknown>;
      candidate.transcriptReference = {
        ...(typeof candidate.transcriptReference === "object" &&
        candidate.transcriptReference !== null
          ? candidate.transcriptReference
          : {}),
        consultationTranscriptId: transcriptId,
      };
    }

    const result = clinicalExtractionSchema.safeParse(parsed);
    if (!result.success) {
      return { success: false, raw, error: result.error.message };
    }
    return { success: true, data: result.data, raw, usage };
  }

  // ---------------------------------------------------------------------
  // Shared REST call
  // ---------------------------------------------------------------------

  private async generate(
    systemInstruction: string,
    contents: GeminiContent[],
    responseSchema?: unknown,
  ): Promise<GeminiCallResult> {
    const res = await fetch(
      `${GEMINI_API_BASE}/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents,
          generationConfig: {
            responseMimeType: "application/json",
            ...(responseSchema ? { responseSchema } : {}),
            temperature: TEMPERATURE,
          },
        }),
      },
    );

    if (!res.ok) {
      throw new Error(
        `Gemini generateContent failed: ${res.status} ${await res.text()}`,
      );
    }

    const body = (await res.json()) as GeminiGenerateContentResponse;
    const candidate = body.candidates?.[0];
    const text = candidate?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";

    if (!text) {
      throw new Error(
        `Gemini generateContent returned no text ` +
          `(finishReason=${candidate?.finishReason ?? "unknown"}, ` +
          `blockReason=${body.promptFeedback?.blockReason ?? "none"})`,
      );
    }

    return { text, usage: body.usageMetadata };
  }
}

// ---------------------------------------------------------------------
// Transcription prompt + response schema
// ---------------------------------------------------------------------

const TRANSCRIPTION_SYSTEM_INSTRUCTION = `You are transcribing and diarizing a single audio recording of one doctor-patient consultation at an Ayurvedic clinic.

Tasks:
1. Transcribe every spoken word verbatim, segment by segment. If speech is not in English, translate it into English but keep Ayurvedic/medical terms as actually spoken (e.g. "Vata", "Pitta", "srotas") rather than translating them away.
2. Identify exactly two speaker roles — "Doctor" (asks clinical questions, gives diagnosis/advice/instructions/prescriptions) and "Patient" (describes symptoms, answers the doctor's questions) — using what is actually said to tell them apart, never turn order or voice alone. Every segment's "speaker" must be exactly "Doctor" or "Patient".
3. Split the conversation into natural speaker turns — start a new segment whenever the speaker changes. Report "start" and "end" as seconds (numbers, may be fractional) from the beginning of the audio file.
4. Report every distinct spoken language you detect as ISO 639-1 codes (e.g. "en", "hi", "kn").
5. Report whether any single utterance mixes more than one language mid-sentence (code-switching, e.g. an English sentence with Hindi words dropped in) as "codeSwitched" — this is different from simply multiple languages being spoken at different points.

Return ONLY the JSON object matching the provided response schema — no markdown fences, no commentary.`;

const TRANSCRIPTION_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    languageDetected: { type: "ARRAY", items: { type: "STRING" } },
    codeSwitched: { type: "BOOLEAN" },
    segments: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          speaker: { type: "STRING", enum: ["Doctor", "Patient"] },
          text: { type: "STRING" },
          start: { type: "NUMBER" },
          end: { type: "NUMBER" },
        },
        required: ["speaker", "text", "start", "end"],
      },
    },
  },
  required: ["segments", "languageDetected", "codeSwitched"],
} as const;

const transcriptionResponseSchema = z.object({
  segments: z.array(
    z.object({
      speaker: z.enum(["Doctor", "Patient"]),
      text: z.string(),
      start: z.number().nonnegative(),
      end: z.number().nonnegative(),
    }),
  ),
  languageDetected: z.array(z.string()),
  codeSwitched: z.boolean(),
});
