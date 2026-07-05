import { GroqProvider } from "./groq-provider.js";
import type { LlmProvider } from "./types.js";

export interface LlmClientEnv {
  LLM_PROVIDER: string;
  GROQ_API_KEY: string | undefined;
  GROQ_MODEL: string | undefined;
}

/** Mirrors python/asr-service's `_load_provider` pattern (architecture.md
 * §10) — one file per vendor, selected via env var, no vendor SDK
 * called from outside this package. */
export function loadLlmProvider(env: LlmClientEnv): LlmProvider {
  if (env.LLM_PROVIDER === "groq") {
    if (!env.GROQ_API_KEY) {
      throw new Error(
        'LLM_PROVIDER=groq but GROQ_API_KEY is not set. Unlike diarization\'s graceful "no token" degradation, there is no meaningful placeholder output for a missing extraction — this fails loudly instead.',
      );
    }
    return new GroqProvider(env.GROQ_API_KEY, env.GROQ_MODEL);
  }
  throw new Error(
    `Unknown LLM_PROVIDER "${env.LLM_PROVIDER}" — only "groq" exists today.`,
  );
}
