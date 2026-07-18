import type { ClinicalExtraction } from "@kal-scribe/types";
import { clinicalExtractionSchema } from "@kal-scribe/validation";
import { buildExtractionPrompt, EXTRACTION_PROMPT_VERSION } from "./prompt.js";
import type {
  ClinicalExtractionProvider,
  ClinicalExtractionRequest,
  ClinicalExtractionResult,
} from "./types.js";

const GROQ_CHAT_COMPLETIONS_URL =
  "https://api.groq.com/openai/v1/chat/completions";
const TEMPERATURE = 0.2;

interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface GroqChatCompletionResponse {
  choices: Array<{ message: { content: string } }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Groq-hosted Llama (architecture.md §10, docs/adr/0002 — MVP LLM
 * choice: fast, cheap, adequate for well-specified structured
 * extraction). Uses JSON mode (`response_format: json_object`), not a
 * vendor-specific strict-schema mode — §10's own evaluation notes
 * structured-output guarantees vary per model/vendor, so this
 * validates the result against packages/validation's zod schema and
 * retries once, with the validation error fed back to the model, if
 * it doesn't conform. See docs/adr/0011.
 */
export class GroqProvider implements ClinicalExtractionProvider {
  readonly name: string;

  constructor(
    private readonly apiKey: string,
    private readonly model: string = "llama-3.3-70b-versatile",
  ) {
    this.name = `groq/${model}`;
  }

  async extractClinicalData(
    request: ClinicalExtractionRequest,
  ): Promise<ClinicalExtractionResult> {
    const t0 = Date.now();
    const { system, user } = buildExtractionPrompt(request.segments);
    const messages: GroqMessage[] = [
      { role: "system", content: system },
      { role: "user", content: user },
    ];

    const first = await this.callAndValidate(messages, request.transcriptId);
    if (first.success) {
      return this.buildResult(first, t0, 0, false);
    }

    // One retry, with the validation failure fed back — LLM JSON-mode
    // output is "valid JSON" guaranteed, not "matches this exact
    // nested schema" guaranteed (architecture.md §10).
    messages.push(
      { role: "assistant", content: first.raw },
      {
        role: "user",
        content: `That JSON did not match the required schema: ${first.error}. Return the corrected, complete JSON object only.`,
      },
    );
    const second = await this.callAndValidate(messages, request.transcriptId);
    if (second.success) {
      return this.buildResult(second, t0, 1, true);
    }

    throw new Error(
      `Groq extraction did not produce schema-conforming JSON after retry: ${second.error}`,
    );
  }

  private buildResult(
    attempt: { success: true; data: ClinicalExtraction; raw: string; usage: GroqChatCompletionResponse["usage"] },
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
        inputTokens: attempt.usage?.prompt_tokens ?? null,
        outputTokens: attempt.usage?.completion_tokens ?? null,
        totalTokens: attempt.usage?.total_tokens ?? null,
        // Groq's per-token pricing varies by model and isn't returned
        // in the response itself — computing this needs a maintained
        // pricing table, a documented follow-up rather than a guess.
        estimatedCostUsd: null,
        retryCount,
        hadValidationRetry,
        rawResponse: attempt.raw,
      },
    };
  }

  private async callAndValidate(
    messages: GroqMessage[],
    transcriptId: string,
  ): Promise<
    | {
        success: true;
        data: ClinicalExtraction;
        raw: string;
        usage: GroqChatCompletionResponse["usage"];
      }
    | { success: false; error: string; raw: string }
  > {
    const res = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        response_format: { type: "json_object" },
        temperature: TEMPERATURE,
      }),
    });

    if (!res.ok) {
      throw new Error(
        `Groq chat completions failed: ${res.status} ${await res.text()}`,
      );
    }

    const body = (await res.json()) as GroqChatCompletionResponse;
    const raw = body.choices[0]?.message.content ?? "";

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
    return { success: true, data: result.data, raw, usage: body.usage };
  }
}
