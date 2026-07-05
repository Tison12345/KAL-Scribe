import "dotenv/config";
import IORedis from "ioredis";
import { Worker, type Job } from "bullmq";
import { parseWorkerEnv } from "@kal-scribe/config";
import {
  BULLMQ_PREFIX,
  CLINICAL_AI_QUEUE_NAMES,
  type ExtractionJobPayload,
  type TranscriptionJobPayload,
} from "@kal-scribe/types";
import { loadLlmProvider } from "@kal-scribe/llm-client";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  createTranscript,
  enqueueExtractionJob,
  fetchAndStitchRecordingAudio,
  getTranscript,
  persistExtractionResult,
  processAudio,
} from "./internal-api-client";

const env = parseWorkerEnv();

/**
 * BullMQ requires `maxRetriesPerRequest: null` for its blocking
 * commands to work correctly. Duplicated from apps/api's own
 * redis-connection.ts rather than imported — this worker is a
 * separately deployed process (architecture.md §5) and deliberately
 * doesn't depend on apps/api's source tree; a 3-line helper isn't
 * worth a shared package.
 */
function createRedisConnection(redisUrl: string): IORedis {
  return new IORedis(redisUrl, { maxRetriesPerRequest: null });
}

/**
 * Real transcription + diarization (Milestones 5-6, architecture.md §7
 * stages 5-7). Fetches every chunk and stitches them into one
 * continuous file (internal-api-client.ts), transcribes it, and
 * persists the resulting speaker-labeled transcript via apps/api, then
 * enqueues the extraction job (stage 7→8 hand-off).
 */
async function processTranscriptionJob(
  job: Job<TranscriptionJobPayload>,
): Promise<void> {
  const { recordingId } = job.data;

  // Idempotency guard (same reasoning as CompleteUploadUseCase): a
  // retry can fire after the real work already succeeded — e.g. this
  // job's own HTTP call to apps/api throwing on an unexpected response
  // shape after the transcript was already persisted and the
  // extraction job already enqueued. Without this check, a retry
  // would re-transcribe and create a duplicate transcript + a
  // duplicate extraction job.
  const existingTranscript = await getTranscript(env.API_BASE_URL, recordingId);
  if (existingTranscript) {
    console.log(
      `[clinical-ai-worker] transcript already exists for recording ${recordingId}, skipping (retry of an already-completed job)`,
    );
    return;
  }

  console.log(`[clinical-ai-worker] fetching audio for recording ${recordingId}...`);
  const { path: audioPath, cleanup } = await fetchAndStitchRecordingAudio(
    env.API_BASE_URL,
    recordingId,
  );

  try {
    const audio = await readFile(audioPath);
    console.log(
      `[clinical-ai-worker] transcribing recording ${recordingId} (${audio.length} bytes)...`,
    );
    const result = await processAudio(env.ASR_SERVICE_URL, audio, path.basename(audioPath));

    console.log(
      `[clinical-ai-worker] transcript for recording ${recordingId}:\n` +
        result.transcriptSegments
          .map((segment) => `  [${segment.start}s-${segment.end}s] ${segment.speaker}: ${segment.text}`)
          .join("\n"),
    );

    // "pyannote" (not a specific submodel version) — asr-service tries
    // multiple pyannote models in sequence (pyannote_provider.py) and
    // doesn't report back which one actually loaded, so asserting a
    // specific version here would be a guess, not a fact.
    const diarizationProvider = result.speakerTurns.length > 0 ? "pyannote" : null;
    const { transcriptId } = await createTranscript(env.API_BASE_URL, recordingId, {
      segments: result.transcriptSegments,
      sttProvider: "whisperx",
      diarizationProvider,
      languageDetected: result.languageDetected.length > 0 ? result.languageDetected : null,
    });
    console.log(`[clinical-ai-worker] persisted transcript ${transcriptId} for recording ${recordingId}`);

    await enqueueExtractionJob(env.API_BASE_URL, recordingId, transcriptId);
    console.log(`[clinical-ai-worker] enqueued extraction job for recording ${recordingId}`);
  } finally {
    await cleanup();
  }
}

/**
 * Clinical entity extraction + SOAP generation (Milestone 7,
 * architecture.md §7 stages 8-9, folded into a single LLM call per
 * §7 stage 9's MVP recommendation — see docs/adr/0011). Fetches the
 * persisted transcript, calls the configured LLM provider, and
 * persists the result via apps/api.
 */
async function processExtractionJob(
  job: Job<ExtractionJobPayload>,
): Promise<void> {
  const { recordingId, transcriptId } = job.data;
  const transcript = await getTranscript(env.API_BASE_URL, recordingId);
  if (!transcript) {
    throw new Error(`No transcript found for recording ${recordingId}.`);
  }

  console.log(`[clinical-ai-worker] extracting clinical data for recording ${recordingId}...`);
  const provider = loadLlmProvider({
    LLM_PROVIDER: env.LLM_PROVIDER,
    GROQ_API_KEY: env.GROQ_API_KEY,
    GROQ_MODEL: env.GROQ_MODEL,
  });
  const extraction = await provider.extractClinicalData({
    transcriptId,
    segments: transcript.segments,
  });

  const { resultId } = await persistExtractionResult(env.API_BASE_URL, recordingId, {
    transcriptId,
    llmProvider: provider.name,
    extraction,
  });
  console.log(
    `[clinical-ai-worker] persisted extraction result ${resultId} for recording ${recordingId} (provider=${provider.name})`,
  );
}

const transcriptionWorker = new Worker<TranscriptionJobPayload>(
  CLINICAL_AI_QUEUE_NAMES.transcription,
  processTranscriptionJob,
  {
    connection: createRedisConnection(env.REDIS_URL),
    concurrency: env.TRANSCRIPTION_WORKER_CONCURRENCY,
    // Must match apps/api's BullModule.forRootAsync prefix exactly —
    // otherwise producer and consumer write/read different Redis
    // keyspaces and never see each other's jobs.
    prefix: BULLMQ_PREFIX,
  },
);

const extractionWorker = new Worker<ExtractionJobPayload>(
  CLINICAL_AI_QUEUE_NAMES.extraction,
  processExtractionJob,
  {
    connection: createRedisConnection(env.REDIS_URL),
    concurrency: env.EXTRACTION_WORKER_CONCURRENCY,
    prefix: BULLMQ_PREFIX,
  },
);

for (const [name, worker] of [
  ["transcription", transcriptionWorker],
  ["extraction", extractionWorker],
] as const) {
  worker.on("completed", (job) => {
    console.log(`[clinical-ai-worker:${name}] completed job ${job.id}`);
  });
  worker.on("failed", (job, error) => {
    console.error(`[clinical-ai-worker:${name}] job ${job?.id ?? "?"} failed: ${error.message}`);
  });
}

console.log(
  `[clinical-ai-worker] listening on "${CLINICAL_AI_QUEUE_NAMES.transcription}" ` +
    `(concurrency=${env.TRANSCRIPTION_WORKER_CONCURRENCY}) and "${CLINICAL_AI_QUEUE_NAMES.extraction}" ` +
    `(concurrency=${env.EXTRACTION_WORKER_CONCURRENCY})`,
);

async function shutdown(): Promise<void> {
  await Promise.all([transcriptionWorker.close(), extractionWorker.close()]);
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
