import "dotenv/config";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { TranscriptSegment } from "@kal-scribe/types";
import { loadLlmProvider } from "@kal-scribe/llm-client";
import type { EvalExpectation } from "./expectation.js";
import { scoreExtraction } from "./score.js";

/**
 * Extraction accuracy harness (architecture.md §18 Milestone 7, §20
 * principle 7) — NOT a unit test suite. Runs each fixture transcript
 * through the real, configured LLM provider and scores the result
 * against hand-labeled expectations, so a prompt/model change has a
 * measurable before/after instead of a vibe.
 *
 * Audio-level fixtures (raw audio -> transcription WER) are a
 * documented follow-up, not built here — they need real or
 * de-identified audio plus hand-transcribed ground truth, which is a
 * content-creation task independent of this harness's code.
 */

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "fixtures",
);

async function loadFixture(baseName: string): Promise<{
  transcriptId: string;
  segments: TranscriptSegment[];
  expected: EvalExpectation;
}> {
  const segments = JSON.parse(
    await readFile(path.join(fixturesDir, `${baseName}.transcript.json`), "utf-8"),
  ) as TranscriptSegment[];
  const expected = JSON.parse(
    await readFile(path.join(fixturesDir, `${baseName}.expected.json`), "utf-8"),
  ) as EvalExpectation;
  return { transcriptId: `eval-fixture-${baseName}`, segments, expected };
}

async function main(): Promise<void> {
  const provider = loadLlmProvider({
    LLM_PROVIDER: process.env.LLM_PROVIDER ?? "groq",
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    GROQ_MODEL: process.env.GROQ_MODEL,
  });

  const files = await readdir(fixturesDir);
  const baseNames = files
    .filter((file) => file.endsWith(".transcript.json"))
    .map((file) => file.replace(/\.transcript\.json$/, ""));

  let totalChecks = 0;
  let totalPassed = 0;

  for (const baseName of baseNames) {
    const fixture = await loadFixture(baseName);
    console.log(`\n=== ${baseName} — ${fixture.expected.description} ===`);
    console.log(`provider: ${provider.name}`);

    const extraction = await provider.extractClinicalData({
      transcriptId: fixture.transcriptId,
      segments: fixture.segments,
    });

    const checks = scoreExtraction(extraction, fixture.expected);
    for (const check of checks) {
      totalChecks += 1;
      if (check.passed) totalPassed += 1;
      console.log(`  [${check.passed ? "PASS" : "FAIL"}] ${check.name} (${check.detail})`);
    }
  }

  const pct = totalChecks === 0 ? 0 : Math.round((totalPassed / totalChecks) * 100);
  console.log(`\n${totalPassed}/${totalChecks} checks passed (${pct}%)`);
  if (totalPassed < totalChecks) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
