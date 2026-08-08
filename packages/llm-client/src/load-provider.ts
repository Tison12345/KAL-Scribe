import { GroqProvider } from "./groq-provider.js";
import { GeminiProvider } from "./gemini-provider.js";
import type {
  ClinicalExtractionProvider,
  SpeechUnderstandingProvider,
} from "./types.js";

export interface LlmClientEnv {
  EXTRACTION_PROVIDER: string;
  GROQ_API_KEY: string | undefined;
  GROQ_MODEL: string | undefined;
  GEMINI_API_KEY: string | undefined;
  GEMINI_MODEL: string | undefined;
}

/** One file per vendor, selected via env var, no vendor SDK called
 * from outside this package (architecture.md §10). `providerOverride`
 * (docs/adr/0014)
 * lets a single extraction attempt target a different vendor than the
 * deployment-wide default — what makes "run this recording again
 * against a different provider for comparison" (a new
 * `consultation_ai_runs` row) possible without redeploying. */
export function loadClinicalExtractionProvider(
  env: LlmClientEnv,
  providerOverride?: string,
): ClinicalExtractionProvider {
  const provider = providerOverride ?? env.EXTRACTION_PROVIDER;

  if (provider === "groq") {
    if (!env.GROQ_API_KEY) {
      throw new Error(
        'EXTRACTION_PROVIDER=groq but GROQ_API_KEY is not set. Unlike diarization\'s graceful "no token" degradation, there is no meaningful placeholder output for a missing extraction — this fails loudly instead.',
      );
    }
    return new GroqProvider(env.GROQ_API_KEY, env.GROQ_MODEL);
  }
  if (provider === "gemini") {
    return loadGeminiProvider(env);
  }
  throw new Error(
    `Unknown extraction provider "${provider}" — only "groq" and "gemini" exist today.`,
  );
}

/** Gemini is the sole speech-understanding provider (docs/adr/0017 —
 * the classic WhisperX+Pyannote path was removed entirely, not kept
 * as a fallback). Fails loudly if GEMINI_API_KEY is missing, same
 * reasoning as loadClinicalExtractionProvider. */
export function loadSpeechUnderstandingProvider(
  env: LlmClientEnv,
): SpeechUnderstandingProvider {
  return loadGeminiProvider(env);
}

function loadGeminiProvider(env: LlmClientEnv): GeminiProvider {
  if (!env.GEMINI_API_KEY) {
    throw new Error(
      "Gemini is the configured provider but GEMINI_API_KEY is not set. There is no meaningful placeholder output for a missing extraction or transcription — this fails loudly instead.",
    );
  }
  return new GeminiProvider(env.GEMINI_API_KEY, env.GEMINI_MODEL);
}
