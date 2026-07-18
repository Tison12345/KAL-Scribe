import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Agent, fetch as undiciFetch, FormData as UndiciFormData } from "undici";
import type {
  ConsultationTranscript,
  CreateExtractionResultRequest,
  CreateExtractionResultResponse,
  CreateTranscriptRequest,
  CreateTranscriptResponse,
  ProcessAudioResponse,
  SttDevice,
  UpdateRecordingAudioMetadataRequest,
} from "@kal-scribe/types";

/**
 * Everything workers/clinical-ai-worker calls over HTTP: apps/api (for
 * anything needing the DB or a queue producer) and python/asr-service
 * (for STT+diarization inference). Consolidated into one file rather
 * than one near-duplicate file per endpoint group — see docs/adr/0010
 * for why the worker calls apps/api over HTTP at all instead of
 * importing its NestJS use-cases directly, and for why this whole file
 * gets deleted (not migrated) at Repo B integration.
 */

// ---------------------------------------------------------------------------
// Low-level helpers — shared error handling for JSON calls to apps/api.
// ---------------------------------------------------------------------------

/** `TResponse` is `void` for endpoints with no response body (e.g.
 * enqueue-extraction) — those return NestJS's empty 201 body, which
 * `res.json()` cannot parse ("Unexpected end of JSON input"). Read as
 * text first and only parse if non-empty, rather than assuming every
 * POST response is JSON. */
async function postJson<TResponse>(
  apiBaseUrl: string,
  urlPath: string,
  body?: unknown,
): Promise<TResponse> {
  const res = await fetch(`${apiBaseUrl}${urlPath}`, {
    method: "POST",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`POST ${urlPath} failed: ${res.status} ${await res.text()}`);
  }
  const text = await res.text();
  return (text.length > 0 ? JSON.parse(text) : undefined) as TResponse;
}

/** Same "TResponse is void for empty bodies" reasoning as postJson. */
async function patchJson<TResponse>(
  apiBaseUrl: string,
  urlPath: string,
  body?: unknown,
): Promise<TResponse> {
  const res = await fetch(`${apiBaseUrl}${urlPath}`, {
    method: "PATCH",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`PATCH ${urlPath} failed: ${res.status} ${await res.text()}`);
  }
  const text = await res.text();
  return (text.length > 0 ? JSON.parse(text) : undefined) as TResponse;
}

/** Returns null (not a rejected promise) on 404 — several apps/api
 * resources are legitimately "not yet created" while the pipeline is
 * still running. */
async function getJson<TResponse>(
  apiBaseUrl: string,
  urlPath: string,
): Promise<TResponse | null> {
  const res = await fetch(`${apiBaseUrl}${urlPath}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`GET ${urlPath} failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<TResponse>;
}

// ---------------------------------------------------------------------------
// apps/api — recording audio (fetch + stitch every chunk)
// ---------------------------------------------------------------------------

async function fetchChunkAudio(
  apiBaseUrl: string,
  recordingId: string,
  sequence: number,
): Promise<Buffer | null> {
  const readUrlBody = await getJson<{ readUrl: string }>(
    apiBaseUrl,
    `/clinical-ai/recordings/${recordingId}/chunks/${sequence}/read-url`,
  );
  if (readUrlBody === null) return null; // no more chunks — end of recording

  const absoluteUrl = readUrlBody.readUrl.startsWith("http")
    ? readUrlBody.readUrl
    : `${apiBaseUrl}${readUrlBody.readUrl}`;

  const audioRes = await fetch(absoluteUrl);
  if (audioRes.status === 404) return null;
  if (!audioRes.ok) {
    throw new Error(
      `Failed to download chunk ${sequence}: ${audioRes.status} ${await audioRes.text()}`,
    );
  }
  return Buffer.from(await audioRes.arrayBuffer());
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    proc.on("error", reject);
    proc.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
    });
  });
}

export interface StitchedRecordingAudio {
  path: string;
  cleanup: () => Promise<void>;
}

/**
 * Fetches every chunk of a recording (via signed read URLs,
 * architecture.md §14 — never a raw disk path) and, if there's more
 * than one, stitches them into a single continuous file via ffmpeg's
 * concat demuxer. Stream-copied (`-c copy`, no re-encoding) since every
 * chunk shares the same codec — they all came from the same
 * MediaRecorder session (Milestone 2). Each chunk is independently
 * valid audio by design, so this is a genuine concatenation, not a
 * workaround for broken input.
 */
export async function fetchAndStitchRecordingAudio(
  apiBaseUrl: string,
  recordingId: string,
): Promise<StitchedRecordingAudio> {
  const workDir = await mkdtemp(path.join(tmpdir(), "kal-scribe-stitch-"));
  const chunkPaths: string[] = [];

  for (let sequence = 0; ; sequence++) {
    const audio = await fetchChunkAudio(apiBaseUrl, recordingId, sequence);
    if (audio === null) break;
    const chunkPath = path.join(
      workDir,
      `chunk-${String(sequence).padStart(6, "0")}.webm`,
    );
    await writeFile(chunkPath, audio);
    chunkPaths.push(chunkPath);
  }

  if (chunkPaths.length === 0) {
    await rm(workDir, { recursive: true, force: true });
    throw new Error(`No chunks found for recording ${recordingId}.`);
  }

  const cleanup = () => rm(workDir, { recursive: true, force: true });

  if (chunkPaths.length === 1) {
    return { path: chunkPaths[0], cleanup };
  }

  const listPath = path.join(workDir, "concat-list.txt");
  const listContent = chunkPaths
    .map((chunkPath) => `file '${chunkPath.replace(/'/g, String.raw`'\''`)}'`)
    .join("\n");
  await writeFile(listPath, listContent);

  const outputPath = path.join(workDir, "stitched.webm");
  await runFfmpeg(["-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outputPath]);

  return { path: outputPath, cleanup };
}

interface FfprobeStream {
  codec_type?: string;
  codec_name?: string;
  sample_rate?: string;
  channels?: number;
}

interface FfprobeOutput {
  streams?: FfprobeStream[];
}

/** Audio metadata (docs/adr/0014, `consultation_recordings.sample_rate_hz`
 * etc.) — informational only, for debugging transcription issues
 * later, never load-bearing for the pipeline itself. Returns all-null
 * on any ffprobe failure rather than throwing — a recording still
 * needs to get transcribed even if this side metadata can't be read. */
export async function getAudioMetadata(filePath: string): Promise<{
  sampleRateHz: number | null;
  channels: number | null;
  codec: string | null;
}> {
  try {
    const stdout = await new Promise<string>((resolve, reject) => {
      const proc = spawn("ffprobe", [
        "-v",
        "error",
        "-show_streams",
        "-select_streams",
        "a:0",
        "-print_format",
        "json",
        filePath,
      ]);
      let out = "";
      let stderr = "";
      proc.stdout.on("data", (chunk: Buffer) => {
        out += chunk.toString();
      });
      proc.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      proc.on("error", reject);
      proc.on("exit", (code) => {
        if (code === 0) resolve(out);
        else reject(new Error(`ffprobe exited with code ${code}: ${stderr}`));
      });
    });

    const parsed = JSON.parse(stdout) as FfprobeOutput;
    const stream = parsed.streams?.find((s) => s.codec_type === "audio");
    return {
      sampleRateHz: stream?.sample_rate ? Number(stream.sample_rate) : null,
      channels: stream?.channels ?? null,
      codec: stream?.codec_name ?? null,
    };
  } catch (error) {
    console.error(
      `[clinical-ai-worker] ffprobe failed for ${filePath}, continuing without audio metadata: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
    return { sampleRateHz: null, channels: null, codec: null };
  }
}

/** Persists audio metadata read via ffprobe. Best-effort, informational
 * — see UpdateRecordingAudioMetadataUseCase. */
export function updateRecordingAudioMetadata(
  apiBaseUrl: string,
  recordingId: string,
  request: UpdateRecordingAudioMetadataRequest,
): Promise<void> {
  return patchJson(
    apiBaseUrl,
    `/clinical-ai/recordings/${recordingId}/audio-metadata`,
    request,
  );
}

// ---------------------------------------------------------------------------
// apps/api — transcripts
// ---------------------------------------------------------------------------

/** Persists the transcript once asr-service has produced it
 * (architecture.md §7 step 7) — via apps/api, not a direct DB
 * connection from the worker (docs/adr/0010). Returns the new
 * transcript's id, needed to enqueue the extraction job. */
export function createTranscript(
  apiBaseUrl: string,
  recordingId: string,
  request: CreateTranscriptRequest,
): Promise<CreateTranscriptResponse> {
  return postJson(apiBaseUrl, `/clinical-ai/recordings/${recordingId}/transcript`, request);
}

/** Fetches the persisted transcript so the extraction job has
 * something to feed the LLM provider (architecture.md §7 step 8). */
export function getTranscript(
  apiBaseUrl: string,
  recordingId: string,
): Promise<ConsultationTranscript | null> {
  return getJson(apiBaseUrl, `/clinical-ai/recordings/${recordingId}/transcript`);
}

// ---------------------------------------------------------------------------
// apps/api — extraction job orchestration
// ---------------------------------------------------------------------------

/** Enqueues the extraction job (architecture.md §7 step 7→8 hand-off).
 * apps/api owns the only queue *producer* in this repo (docs/adr/0010,
 * docs/adr/0015) — the worker asks it to enqueue rather than becoming
 * a producer itself. */
export function enqueueExtractionJob(
  apiBaseUrl: string,
  recordingId: string,
  transcriptId: string,
  requestedProvider?: string,
): Promise<void> {
  return postJson(apiBaseUrl, `/clinical-ai/recordings/${recordingId}/enqueue-extraction`, {
    transcriptId,
    requestedProvider,
  });
}

/** Persists the LLM's extraction output (architecture.md §7 step 8,
 * §12's `consultation_ai_runs`). */
export function persistExtractionResult(
  apiBaseUrl: string,
  recordingId: string,
  request: CreateExtractionResultRequest,
): Promise<CreateExtractionResultResponse> {
  return postJson(apiBaseUrl, `/clinical-ai/recordings/${recordingId}/extraction`, request);
}

// ---------------------------------------------------------------------------
// apps/api — job-lifecycle status reporting (docs/adr/0015)
// ---------------------------------------------------------------------------

/** Reports a job-lifecycle transition (docs/adr/0015) — replaces the
 * old BullMQ `QueueEvents` (Redis pub/sub) listener that used to keep
 * `consultation_ai_jobs.status` in sync from apps/api's side. pg-boss
 * has no cross-process event stream equivalent, but the worker already
 * knows exactly when each transition happens since it's the one
 * running the job, so it just tells apps/api directly. */
export function updateJobStatus(
  apiBaseUrl: string,
  jobId: string,
  status: "active" | "completed" | "failed" | "dead_letter",
  errorMessage?: string | null,
): Promise<void> {
  return patchJson(apiBaseUrl, `/clinical-ai/admin/jobs/${jobId}/status`, {
    status,
    errorMessage,
  });
}

// ---------------------------------------------------------------------------
// python/asr-service
// ---------------------------------------------------------------------------

// Node's default fetch (undici) agent has its own headersTimeout/
// bodyTimeout of 300s, tracked independently of any AbortSignal passed
// to `fetch()` — an AbortSignal only stops the request early, it
// cannot raise undici's built-in connection-level timeouts. A real
// multi-minute consultation on CPU-only WhisperX+Pyannote (docs/adr/
// 0009) blocks python/asr-service's single event loop for the entire
// transcribe+diarize duration before it can send any response bytes,
// so any recording whose processing exceeds 300s hits
// UND_ERR_HEADERS_TIMEOUT regardless of AbortSignal — confirmed via a
// direct reproduction (docs/log/2026-07-07-headers-timeout-bug-fix.md).
// Both timeouts must be raised on a dedicated Agent (the global fetch
// has no way to configure this); once the client actually waits long
// enough for a response, python/asr-service — which has no idea the
// client disconnected — no longer piles up abandoned CPU/memory work
// across retries.
const ASR_SERVICE_TIMEOUT_MS = 20 * 60 * 1000;
const asrServiceAgent = new Agent({
  headersTimeout: ASR_SERVICE_TIMEOUT_MS,
  bodyTimeout: ASR_SERVICE_TIMEOUT_MS,
});

/** Calls python/asr-service (architecture.md §3.2, §8). `device`
 * (docs/adr/0012) is forwarded as-is ("cpu"/"gpu") — asr-service maps
 * "gpu" to torch's "cuda" internally; omitted defers to its own
 * `STT_DEVICE` default. */
export async function processAudio(
  asrServiceUrl: string,
  audio: Buffer,
  filename: string,
  device?: SttDevice,
): Promise<ProcessAudioResponse> {
  // undici's own FormData/fetch (not the global lib.dom ones) — the
  // global fetch has no way to attach a custom Agent, and undici's
  // fetch type only accepts its own FormData as a BodyInit.
  const formData = new UndiciFormData();
  // new Uint8Array(audio) (not `audio` directly) guarantees a plain
  // ArrayBuffer backing, not the ArrayBuffer|SharedArrayBuffer union
  // Node's Buffer type carries — Blob's constructor type requires the
  // former.
  formData.append("file", new Blob([new Uint8Array(audio)]), filename);
  if (device) {
    formData.append("device", device);
  }

  const res = await undiciFetch(`${asrServiceUrl}/v1/process-audio`, {
    method: "POST",
    body: formData,
    signal: AbortSignal.timeout(ASR_SERVICE_TIMEOUT_MS),
    dispatcher: asrServiceAgent,
  });

  if (!res.ok) {
    throw new Error(
      `asr-service /v1/process-audio failed: ${res.status} ${await res.text()}`,
    );
  }

  const body = (await res.json()) as {
    transcript_segments: Array<{
      speaker: string;
      text: string;
      start: number;
      end: number;
      word_confidence: number | null;
    }>;
    speaker_turns: Array<{ speaker: string; start: number; end: number }>;
    language_detected: string[];
  };

  return {
    transcriptSegments: body.transcript_segments.map((segment) => ({
      speaker: segment.speaker,
      text: segment.text,
      start: segment.start,
      end: segment.end,
      wordConfidence: segment.word_confidence,
    })),
    speakerTurns: body.speaker_turns,
    languageDetected: body.language_detected,
  };
}
