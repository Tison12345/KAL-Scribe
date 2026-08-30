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
  computeAudioHash,
  createTranscript,
  enqueueExtractionJob,
  fetchAndStitchRecordingAudio,
  findDuplicateTranscript,
  getAudioMetadata,
  getTranscript,
  listRecordingJobs,
  persistExtractionResult,
  updateJobStatus,
  updateRecordingAudioMetadata,
} from "./internal-api-client";
import { logger, withJobContext, type Logger } from "./logger";

const env = parseWorkerEnv();

// pg-boss instance for this process (docs/adr/0015 — replaces
// BullMQ/Redis). Runs on the same Postgres `DATABASE_URL` apps/api
// uses — no additional hosted service, no separate quota to exhaust.
// `supervise`/`schedule` stay at their defaults (true) here, unlike
// apps/api's producer-only instance — this process is the actual
// consumer and needs pg-boss's maintenance loops active.
// Explicit max, not pg-boss's own pg.Pool default of 10 — Supabase's
// Session pooler caps total concurrent clients at 15, shared across
// this pool and apps/api's two pools (docs/adr/0015). `useListenNotify:
// false` (audit finding E5) trades near-instant job pickup for one
// fewer held connection — this process was the only one of the three
// pools still holding an extra un-disabled LISTEN/NOTIFY connection on
// top of its own `max`, leaving the shared 15-connection budget
// uncomfortably tight (~12-13/15 used by one clean instance). Job
// pickup now happens on pg-boss's normal poll interval instead of
// instantly, which is an acceptable trade for this workload (audio
// processing jobs, not latency-sensitive request/response).
const boss = new PgBoss({
  connectionString: env.DATABASE_URL,
  max: 4,
  useListenNotify: false,
});
boss.on("error", (error) => {
  logger.error({ err: error }, "pg-boss internal error");
});

type JobPayload = { jobId: string; recordingId: string };

/** Wraps a job handler with status reporting (docs/adr/0015) —
 * `active` before, `completed` after, `failed` + re-throw on error so
 * pg-boss's own retry/backoff/dead-letter routing still applies. This
 * replaces the old BullMQ `QueueEvents` listener that used to do this
 * from apps/api's side by watching Redis pub/sub. Also the one place a
 * per-job logger gets created (`withJobContext`) — every log line for
 * this job, in this handler and everything it calls, carries the same
 * `jobId`/`recordingId`/`jobType` fields from here on. */
function withStatusReporting<TPayload extends JobPayload>(
  label: string,
  handler: (payload: TPayload, log: Logger) => Promise<void>,
): (jobs: Job<TPayload>[]) => Promise<void> {
  return async (jobs) => {
    const [job] = jobs;
    if (!job) return;
    const log = withJobContext(job.data.jobId, job.data.recordingId, label);

    await updateJobStatus(env.API_BASE_URL, job.data.jobId, "active");
    try {
      await handler(job.data, log);
      await updateJobStatus(env.API_BASE_URL, job.data.jobId, "completed");
    } catch (error) {
      log.error({ err: error }, `${label} job failed`);
      const message = error instanceof Error ? error.message : String(error);
      await updateJobStatus(env.API_BASE_URL, job.data.jobId, "failed", message);
      throw error;
    }
  };
}

/** Small consumer on a dead-letter queue, purely to mark
 * `consultation_ai_jobs.status = 'dead_letter'` once pg-boss has
 * exhausted retries and routed the job here (docs/adr/0015). No actual
 * work happens — the original job already ran out of attempts. */
function deadLetterHandler<TPayload extends JobPayload>(
  label: string,
): (jobs: Job<TPayload>[]) => Promise<void> {
  return async (jobs) => {
    const [job] = jobs;
    if (!job) return;
    const log = withJobContext(job.data.jobId, job.data.recordingId, label);
    log.error(`${label} job exhausted retries, dead-lettering`);
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
async function processTranscriptionJob(
  data: TranscriptionJobPayload,
  log: Logger,
): Promise<void> {
  const { recordingId } = data;

  // Idempotency guard (same reasoning as CompleteUploadUseCase): a
  // retry can fire after the real work already succeeded — e.g. this
  // job's own HTTP call to apps/api throwing on an unexpected response
  // shape after the transcript was already persisted and the
  // extraction job already enqueued. Without this check, a retry
  // would re-transcribe and create a duplicate transcript + a
  // duplicate extraction job.
  //
  // A transcript existing is NOT on its own proof the whole job
  // finished — if the worker died (or this HTTP call itself failed)
  // between createTranscript succeeding and enqueueExtractionJob
  // running, a naive "transcript exists -> return" here would report
  // this retry as completed while silently never enqueueing
  // extraction, stalling the pipeline with no failure signal (audit
  // finding D5). So: check whether extraction was actually enqueued,
  // and self-heal by enqueueing it now if not, instead of trusting
  // the transcript's existence alone.
  const existingTranscript = await getTranscript(env.API_BASE_URL, recordingId);
  if (existingTranscript) {
    const jobs = await listRecordingJobs(env.API_BASE_URL, recordingId);
    const extractionAlreadyEnqueued = jobs.some((job) => job.jobType === "extraction");
    if (extractionAlreadyEnqueued) {
      log.info("transcript and extraction job already exist, skipping (retry of an already-completed job)");
      return;
    }
    log.warn(
      "transcript exists but no extraction job was ever enqueued (worker likely died mid-handoff on a prior attempt) — enqueueing extraction now instead of re-transcribing",
    );
    await enqueueExtractionJob(env.API_BASE_URL, recordingId, existingTranscript.id);
    return;
  }

  log.info("fetching audio");
  const { path: audioPath, cleanup } = await fetchAndStitchRecordingAudio(
    env.API_BASE_URL,
    recordingId,
  );

  try {
    const audio = await readFile(audioPath);
    log.info({ audioBytes: audio.length }, "transcribing");

    // Audio metadata (docs/adr/0014) — best-effort, informational only,
    // never blocks transcription if ffprobe itself fails.
    const audioMetadata = await getAudioMetadata(audioPath, log);
    const audioHash = await computeAudioHash(audioPath);
    await updateRecordingAudioMetadata(env.API_BASE_URL, recordingId, {
      ...audioMetadata,
      fileSizeBytes: audio.length,
      audioHash,
    });

    // Content-hash dedup (audit finding E4) — before spending a Gemini
    // call, check whether another recording already has a transcript
    // for this exact byte-identical audio (e.g. an accidental
    // duplicate upload, or a retried recording session that re-sent
    // the same chunks under a new recording id). If so, copy that
    // transcript instead of re-transcribing and re-billing for the
    // same audio.
    const duplicate = await findDuplicateTranscript(env.API_BASE_URL, recordingId, audioHash);
    if (duplicate.transcript) {
      const existing = duplicate.transcript;
      log.info(
        { reusedTranscriptId: existing.id },
        "byte-identical duplicate of an already-transcribed recording — reusing transcript instead of re-transcribing",
      );
      const { transcriptId } = await createTranscript(env.API_BASE_URL, recordingId, {
        segments: existing.segments,
        sttProvider: `dedup-reuse:${existing.sttProvider}`,
        diarizationProvider: existing.diarizationProvider,
        model: existing.model,
        promptVersion: existing.promptVersion,
        languageDetected: existing.languageDetected,
        isMultilingual: existing.isMultilingual,
        isCodeSwitched: existing.isCodeSwitched,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        rawResponse: { dedupReusedFromTranscriptId: existing.id },
        transcriptionLatencyMs: 0,
      });
      await enqueueExtractionJob(env.API_BASE_URL, recordingId, transcriptId);
      log.info("enqueued extraction job (dedup path)");
      return;
    }

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
    const model: string = result.metadata.model;
    const promptVersion: string = result.metadata.promptVersion;
    const languageDetected: string[] = result.languageDetected;
    const isMultilingual: boolean | null = result.metadata.isMultilingual;
    const isCodeSwitched: boolean | null = result.metadata.isCodeSwitched;
    const inputTokens: number | null = result.metadata.inputTokens;
    const outputTokens: number | null = result.metadata.outputTokens;
    const totalTokens: number | null = result.metadata.totalTokens;
    const rawResponse: unknown = result.metadata.rawResponse;
    const transcriptionLatencyMs: number | null = result.metadata.latencyMs;

    // Deliberately no transcript text (verbatim patient speech, PHI) in
    // this log line — only shape/metadata, enough to debug without
    // putting clinical content wherever these logs end up retained
    // (audit finding D7). `logger.ts`'s redact config is a second,
    // independent line of defense if a field shaped like this ever
    // does carry text in the future.
    const speakerCounts = transcriptSegments.reduce<Record<string, number>>((counts, segment) => {
      counts[segment.speaker] = (counts[segment.speaker] ?? 0) + 1;
      return counts;
    }, {});
    log.info(
      { segmentCount: transcriptSegments.length, speakerCounts, languageDetected },
      "transcribed",
    );

    const { transcriptId } = await createTranscript(env.API_BASE_URL, recordingId, {
      segments: transcriptSegments,
      sttProvider,
      diarizationProvider,
      model,
      promptVersion,
      languageDetected: languageDetected.length > 0 ? languageDetected : null,
      isMultilingual,
      isCodeSwitched,
      inputTokens,
      outputTokens,
      totalTokens,
      rawResponse,
      transcriptionLatencyMs,
    });
    log.info({ transcriptId }, "persisted transcript");

    await enqueueExtractionJob(env.API_BASE_URL, recordingId, transcriptId);
    log.info("enqueued extraction job");
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
async function processExtractionJob(
  data: ExtractionJobPayload,
  log: Logger,
): Promise<void> {
  const { recordingId, transcriptId, requestedProvider, jobId } = data;

  // Idempotency guard (audit finding E3) — unlike transcription,
  // extraction previously had no dedupe at all: a pg-boss retry of a
  // job that had actually already succeeded (e.g. this job's own HTTP
  // call to apps/api throwing on an unexpected response shape after
  // the run was already persisted) would silently create an extra,
  // billable "run" indistinguishable from an intentional Run 2. This
  // distinguishes "retry of this same job" (same jobId, safe to skip)
  // from "a genuinely new extraction request" (a different jobId,
  // created by its own POST /enqueue-extraction call) by checking
  // *this job's own* recorded status rather than whether any run
  // exists for the recording at all — runs are deliberately
  // multi-valued by design (docs/adr/0014), so that broader check
  // would incorrectly block real re-runs.
  const jobs = await listRecordingJobs(env.API_BASE_URL, recordingId);
  const thisJob = jobs.find((job) => job.id === jobId);
  if (thisJob?.status === "completed") {
    log.info("extraction job already completed, skipping (retry of an already-completed job)");
    return;
  }

  const transcript = await getTranscript(env.API_BASE_URL, recordingId);
  if (!transcript) {
    throw new Error(`No transcript found for recording ${recordingId}.`);
  }

  log.info("extracting clinical data");
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
  log.info({ runId, provider: provider.name }, "persisted extraction run");
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

  logger.info(
    {
      transcriptionConcurrency: env.TRANSCRIPTION_WORKER_CONCURRENCY,
      extractionConcurrency: env.EXTRACTION_WORKER_CONCURRENCY,
    },
    `listening on "${CLINICAL_AI_QUEUE_NAMES.transcription}" and "${CLINICAL_AI_QUEUE_NAMES.extraction}"`,
  );
}

main().catch((error) => {
  logger.fatal({ err: error }, "fatal startup error");
  process.exit(1);
});

async function shutdown(): Promise<void> {
  await boss.stop();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());
