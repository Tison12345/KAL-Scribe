import type {
  CompleteUploadRequest,
  CompleteUploadResponse,
  RequestChunkUploadRequest,
  RequestChunkUploadResponse,
  StartRecordingRequest,
  StartRecordingResponse,
} from "@kal-scribe/types";
import { getApiBaseUrl } from "@/lib/env";

async function postJson<TResponse>(
  path: string,
  body: unknown,
): Promise<TResponse> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    method: "POST",
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

export function completeUpload(
  recordingId: string,
  request: CompleteUploadRequest,
): Promise<CompleteUploadResponse> {
  return postJson(`/clinical-ai/recordings/${recordingId}/complete`, request);
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
