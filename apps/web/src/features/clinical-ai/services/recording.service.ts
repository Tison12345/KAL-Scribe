import type {
  AcceptReviewDraftRequest,
  CompleteUploadRequest,
  CompleteUploadResponse,
  ConsultationAiJob,
  ReviewDraft,
  ConsultationRecording,
  ConsultationTranscript,
  RequestChunkUploadRequest,
  RequestChunkUploadResponse,
  StartRecordingRequest,
  StartRecordingResponse,
  UpdateReviewDraftRequest,
} from "@kal-scribe/types";
import { getApiBaseUrl } from "@/lib/env";

async function postJson<TResponse>(
  path: string,
  body?: unknown,
): Promise<TResponse> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`${path} failed: ${res.status} ${await res.text()}`);
  }
  // Some endpoints (e.g. confirm-chunk-upload) return NestJS's empty
  // 201 body, which res.json() can't parse ("Unexpected end of JSON
  // input") — read as text first and only parse if non-empty.
  const text = await res.text();
  return (text.length > 0 ? JSON.parse(text) : undefined) as TResponse;
}

async function patchJson<TResponse>(
  path: string,
  body: unknown,
): Promise<TResponse> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<TResponse>;
}

export function startRecording(
  request: StartRecordingRequest,
): Promise<StartRecordingResponse> {
  return postJson("/clinical-ai/recordings", request);
}

export function requestChunkUpload(
  recordingId: string,
  request: RequestChunkUploadRequest,
): Promise<RequestChunkUploadResponse> {
  return postJson(`/clinical-ai/recordings/${recordingId}/chunks`, request);
}

/** Audit finding E2 — call once the chunk's signed-URL PUT has actually
 * succeeded, not merely requested, so the server has a real record of
 * which chunks are genuinely done rather than inferring it implicitly. */
export function confirmChunkUpload(
  recordingId: string,
  sequence: number,
): Promise<void> {
  return postJson(`/clinical-ai/recordings/${recordingId}/chunks/${sequence}/confirm`);
}

export function completeUpload(
  recordingId: string,
  request: CompleteUploadRequest,
): Promise<CompleteUploadResponse> {
  return postJson(`/clinical-ai/recordings/${recordingId}/complete`, request);
}

/** Returns null (not a rejected promise) when the transcript doesn't
 * exist yet — normal while transcription is still processing in the
 * background, not an error the caller needs to handle specially. */
export async function getTranscript(
  recordingId: string,
): Promise<ConsultationTranscript | null> {
  const res = await fetch(
    `${getApiBaseUrl()}/clinical-ai/recordings/${recordingId}/transcript`,
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to get transcript: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<ConsultationTranscript>;
}

export function relabelTranscriptSpeakers(
  recordingId: string,
): Promise<ConsultationTranscript> {
  return postJson(`/clinical-ai/recordings/${recordingId}/transcript/relabel`);
}

/** Returns null (not a rejected promise) when the extraction doesn't
 * exist yet — normal while the extraction job is still processing in
 * the background. */
export async function getExtraction(
  recordingId: string,
): Promise<ReviewDraft | null> {
  const res = await fetch(
    `${getApiBaseUrl()}/clinical-ai/recordings/${recordingId}/extraction`,
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to get extraction: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<ReviewDraft>;
}

export function updateReviewDraft(
  recordingId: string,
  request: UpdateReviewDraftRequest,
): Promise<ReviewDraft> {
  return patchJson(`/clinical-ai/recordings/${recordingId}/extraction`, request);
}

export function acceptReviewDraft(
  recordingId: string,
  request: AcceptReviewDraftRequest,
): Promise<ReviewDraft> {
  return postJson(`/clinical-ai/recordings/${recordingId}/extraction/accept`, request);
}

export function discardReviewDraft(
  recordingId: string,
): Promise<ReviewDraft> {
  return postJson(`/clinical-ai/recordings/${recordingId}/extraction/discard`);
}

export async function getRecording(
  recordingId: string,
): Promise<ConsultationRecording | null> {
  const res = await fetch(`${getApiBaseUrl()}/clinical-ai/recordings/${recordingId}`);
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to get recording: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<ConsultationRecording>;
}

export async function getRecordingJobs(
  recordingId: string,
): Promise<ConsultationAiJob[]> {
  const res = await fetch(`${getApiBaseUrl()}/clinical-ai/recordings/${recordingId}/jobs`);
  if (!res.ok) {
    throw new Error(`Failed to get recording jobs: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<ConsultationAiJob[]>;
}

/** PUTs raw chunk bytes to the signed upload URL — a direct
 * browser-to-storage transfer, not proxied through the business API
 * (architecture.md §14's signed-URL model; the local-disk stand-in
 * just happens to point back at this same API). */
export async function uploadChunkBytes(
  uploadUrl: string,
  blob: Blob,
): Promise<void> {
  const absoluteUrl = uploadUrl.startsWith("http")
    ? uploadUrl
    : `${getApiBaseUrl()}${uploadUrl}`;
  const res = await fetch(absoluteUrl, {
    method: "PUT",
    headers: { "Content-Type": "application/octet-stream" },
    body: blob,
  });
  if (!res.ok) {
    throw new Error(`Chunk upload failed: ${res.status} ${await res.text()}`);
  }
}
