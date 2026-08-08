import "dotenv/config";
import { PgBoss, type Job } from "pg-boss";
import { parseWorkerEnv } from "@kal-scribe/config";
import {
  CLINICAL_AI_QUEUE_NAMES,
  DEFAULT_QUEUE_JOB_OPTIONS,
  type ExtractionJobPayload,
  type TranscriptionJobPayload,
  type TranscriptSegment,
} from "@kal-scribe/types";
import {
  loadClinicalExtractionProvider,
  loadSpeechUnderstandingProvider,
} from "@kal-scribe/llm-client";
import { readFile } from "node:fs/promises";
import {
  createTranscript,
  enqueueExtractionJob,
  fetchAndStitchRecordingAudio,
  getAudioMetadata,
  getTranscript,
  persistExtractionResult,
  updateJobStatus,
  updateRecordingAudioMetadata,
} from "./internal-api-client";

const env = parseWorkerEnv();

// pg-boss instance for this process (docs/adr/0015 — replaces
// BullMQ/Redis). Runs on the same Postgres `DATABASE_URL` apps/api
// uses — no additional hosted service, no separate quota to exhaust.
// `supervise`/`schedule` stay at their defaults (true) here, unlike
// apps/api's producer-only instance — this process is the actual
// consumer and needs pg-boss's maintenance loops active.
// Explicit max, not pg-boss's own pg.Pool default of 10 — Supabase's
// Session pooler caps total concurrent clients at 15, shared across
// this pool, its own LISTEN/NOTIFY connection, and apps/api's two
// pools (docs/adr/0015).
const boss = new PgBoss({ connectionString: env.DATABASE_URL, max: 4 });
boss.on("error", (error) => {
  console.error("[clinical-ai-worker:pg-boss]", error);
});

/** Wraps a job handler with status reporting (docs/adr/0015) —
 * `active` before, `completed` after, `failed` + re-throw on error so
 * pg-boss's own retry/backoff/dead-letter routing still applies. This
 * replaces the old BullMQ `QueueEvents` listener that used to do this
 * from apps/api's side by watching Redis pub/sub. */
function withStatusReporting<TPayload extends { jobId: string }>(
  label: string,
  handler: (payload: TPayload) => Promise<void>,
): (jobs: Job<TPayload>[]) => Promise<void> {
  return async (jobs) => {
    const [job] = jobs;
    if (!job) return;

    await updateJobStatus(env.API_BASE_URL, job.data.jobId, "active");
    try {
      await handler(job.data);
      await updateJobStatus(env.API_BASE_URL, job.data.jobId, "completed");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[clinical-ai-worker] ${label} job ${job.data.jobId} failed: ${message}`);
      await updateJobStatus(env.API_BASE_URL, job.data.jobId, "failed", message);
      throw error;
    }
  };
}

/** Small consumer on a dead-letter queue, purely to mark
 * `consultation_ai_jobs.status = 'dead_letter'` once pg-boss has
 * exhausted retries and routed the job here (docs/adr/0015). No actual
 * work happens — the original job already ran out of attempts. */
function deadLetterHandler<TPayload extends { jobId: string }>(
  label: string,
): (jobs: Job<TPayload>[]) => Promise<void> {
  return async (jobs) => {
    const [job] = jobs;
    if (!job) return;
    console.error(
      `[clinical-ai-worker] ${label} job ${job.data.jobId} exhausted retries, dead-lettering`,
    );
    await updateJobStatus(env.API_BASE_URL, job.data.jobId, "dead_letter");
  };
}

/**
 * Real transcription + diarization (Milestones 5-6, architecture.md §7
 * stages 5-7). Fetches every chunk and stitches them into one
 * continuous file (internal-api-client.ts), transcribes it, and
 * persists the resulting speaker-labeled transcript via apps/api, then
 * enqueues the extraction job (stage 7→8 hand-off).
 */
async function processTranscriptionJob(data: TranscriptionJobPayload): Promise<void> {
  const { recordingId } = data;

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

    // Audio metadata (docs/adr/0014) — best-effort, informational only,
    // never blocks transcription if ffprobe itself fails.
    const audioMetadata = await getAudioMetadata(audioPath);
    await updateRecordingAudioMetadata(env.API_BASE_URL, recordingId, {
      ...audioMetadata,
      fileSizeBytes: audio.length,
    });

    // Gemini is the sole speech-understanding provider (docs/adr/0017 —
    // the classic WhisperX+Pyannote path was removed entirely).
    const speechProvider = loadSpeechUnderstandingProvider({
      EXTRACTION_PROVIDER: env.EXTRACTION_PROVIDER,
      GROQ_API_KEY: env.GROQ_API_KEY,
      GROQ_MODEL: env.GROQ_MODEL,
      GEMINI_API_KEY: env.GEMINI_API_KEY,
      GEMINI_MODEL: env.GEMINI_MODEL,
    });

    const result = await speechProvider.transcribeAudio({
      audio,
      // Chunks are recorded/stitched as webm (internal-api-client.ts's
      // fetchAndStitchRecordingAudio) — same container for every
      // recording regardless of provider.
      mimeType: "audio/webm",
    });
    const transcriptSegments: TranscriptSegment[] = result.segments;
    const sttProvider: string = speechProvider.name;
    const diarizationProvider: string | null = speechProvider.name;
    const languageDetected: string[] = result.languageDetected;
    const isMultilingual: boolean | null = result.metadata.isMultilingual;
    const isCodeSwitched: boolean | null = result.metadata.isCodeSwitched;
    const rawResponse: unknown = result.metadata.rawResponse;
    const transcriptionLatencyMs: number | null = result.metadata.latencyMs;

    console.log(
      `[clinical-ai-worker] transcript for recording ${recordingId}:\n` +
        transcriptSegments
          .map((segment) => `  [${segment.start}s-${segment.end}s] ${segment.speaker}: ${segment.text}`)
          .join("\n"),
    );

    const { transcriptId } = await createTranscript(env.API_BASE_URL, recordingId, {
      segments: transcriptSegments,
      sttProvider,
      diarizationProvider,
      languageDetected: languageDetected.length > 0 ? languageDetected : null,
      isMultilingual,
      isCodeSwitched,
      rawResponse,
      transcriptionLatencyMs,
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
 * persisted transcript, calls the configured extraction provider
 * (or `requestedProvider`, docs/adr/0014, when this run targets a
 * specific vendor rather than the deployment default), and persists
 * the resulting run + review via apps/api.
 */
async function processExtractionJob(data: ExtractionJobPayload): Promise<void> {
  const { recordingId, transcriptId, requestedProvider } = data;
  const transcript = await getTranscript(env.API_BASE_URL, recordingId);
  if (!transcript) {
    throw new Error(`No transcript found for recording ${recordingId}.`);
  }

  console.log(`[clinical-ai-worker] extracting clinical data for recording ${recordingId}...`);
  const provider = loadClinicalExtractionProvider(
    {
      EXTRACTION_PROVIDER: env.EXTRACTION_PROVIDER,
      GROQ_API_KEY: env.GROQ_API_KEY,
      GROQ_MODEL: env.GROQ_MODEL,
      GEMINI_API_KEY: env.GEMINI_API_KEY,
      GEMINI_MODEL: env.GEMINI_MODEL,
    },
    requestedProvider,
  );
  const { extraction, metadata } = await provider.extractClinicalData({
    transcriptId,
    segments: transcript.segments,
  });

  // provider.name is "vendor/model" (e.g. "gemini/gemini-2.5-flash") —
  // metadata.model already carries the model half; provider is the
  // vendor prefix of provider.name.
  const [providerVendor] = provider.name.split("/");
  const { runId } = await persistExtractionResult(env.API_BASE_URL, recordingId, {
    transcriptId,
    provider: providerVendor,
    model: metadata.model,
    extraction,
    promptVersion: metadata.promptVersion,
    temperature: metadata.temperature,
    latencyMs: metadata.latencyMs,
    inputTokens: metadata.inputTokens,
    outputTokens: metadata.outputTokens,
    totalTokens: metadata.totalTokens,
    estimatedCostUsd: metadata.estimatedCostUsd,
    retryCount: metadata.retryCount,
    hadValidationRetry: metadata.hadValidationRetry,
    rawResponse: metadata.rawResponse,
  });
  console.log(
    `[clinical-ai-worker] persisted extraction run ${runId} for recording ${recordingId} (provider=${provider.name})`,
  );
}

async function main(): Promise<void> {
  await boss.start();

  // Idempotent (ON CONFLICT DO NOTHING internally) — safe to call every
  // boot, and ensures the queues exist even if this process starts
  // before apps/api ever has (docs/adr/0015).
  await boss.createQueue(CLINICAL_AI_QUEUE_NAMES.transcriptionDeadLetter);
  await boss.createQueue(CLINICAL_AI_QUEUE_NAMES.transcription, {
    ...DEFAULT_QUEUE_JOB_OPTIONS,
    deadLetter: CLINICAL_AI_QUEUE_NAMES.transcriptionDeadLetter,
  });
  await boss.createQueue(CLINICAL_AI_QUEUE_NAMES.extractionDeadLetter);
  await boss.createQueue(CLINICAL_AI_QUEUE_NAMES.extraction, {
    ...DEFAULT_QUEUE_JOB_OPTIONS,
    deadLetter: CLINICAL_AI_QUEUE_NAMES.extractionDeadLetter,
  });

  await boss.work<TranscriptionJobPayload>(
    CLINICAL_AI_QUEUE_NAMES.transcription,
    { localConcurrency: env.TRANSCRIPTION_WORKER_CONCURRENCY },
    withStatusReporting("transcription", processTranscriptionJob),
  );
  await boss.work<TranscriptionJobPayload>(
    CLINICAL_AI_QUEUE_NAMES.transcriptionDeadLetter,
    deadLetterHandler("transcription"),
  );

  await boss.work<ExtractionJobPayload>(
    CLINICAL_AI_QUEUE_NAMES.extraction,
    { localConcurrency: env.EXTRACTION_WORKER_CONCURRENCY },
    withStatusReporting("extraction", processExtractionJob),
  );
  await boss.work<ExtractionJobPayload>(
    CLINICAL_AI_QUEUE_NAMES.extractionDeadLetter,
    deadLetterHandler("extraction"),
  );

  console.log(
    `[clinical-ai-worker] listening on "${CLINICAL_AI_QUEUE_NAMES.transcription}" ` +
      `(concurrency=${env.TRANSCRIPTION_WORKER_CONCURRENCY}) and "${CLINICAL_AI_QUEUE_NAMES.extraction}" ` +
      `(concurrency=${env.EXTRACTION_WORKER_CONCURRENCY})`,
  );
}

main().catch((error) => {
  console.error("[clinical-ai-worker] fatal startup error:", error);
  process.exit(1);
});

async function shutdown(): Promise<void> {
  await boss.stop();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
