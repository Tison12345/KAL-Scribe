import { GroqProvider } from "./groq-provider.js";
import { GeminiProvider } from "./gemini-provider.js";
import type {
  ClinicalExtractionProvider,
  SpeechUnderstandingProvider,
} from "./types.js";

export interface LlmClientEnv {
  EXTRACTION_PROVIDER: string;
  /** Unset means "no audio-native speech provider configured" — the
   * caller falls back to python/asr-service (docs/adr/0014). Split
   * from EXTRACTION_PROVIDER since one env var conflating "which model
   * extracts" and "which model transcribes" only got more confusing
   * once a single vendor (Groq) can do only one of the two jobs. */
  SPEECH_PROVIDER: string | undefined;
  GROQ_API_KEY: string | undefined;
  GROQ_MODEL: string | undefined;
  GEMINI_API_KEY: string | undefined;
  GEMINI_MODEL: string | undefined;
}

/** Mirrors python/asr-service's `_load_provider` pattern (architecture.md
 * §10) — one file per vendor, selected via env var, no vendor SDK
 * called from outside this package. `providerOverride` (docs/adr/0014)
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

/** clinical-ai-single branch only — returns a provider that can
 * transcribe+diarize audio directly (standing in for
 * python/asr-service) when a speech-capable provider is configured.
 * Returns null when none is (like Groq, which only does text
 * extraction), so callers can fall back to the classic asr-service
 * call. */
export function loadSpeechUnderstandingProvider(
  env: LlmClientEnv,
  providerOverride?: string,
): SpeechUnderstandingProvider | null {
  const provider = providerOverride ?? env.SPEECH_PROVIDER;
  if (provider !== "gemini") return null;
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
