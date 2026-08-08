"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AudioChunk } from "./useAudioRecorder";
import {
  completeUpload,
  requestChunkUpload,
  startRecording,
  uploadChunkBytes,
} from "../services/recording.service";

export type ChunkUploadStatus = "uploading" | "uploaded" | "failed";

export interface ChunkUploadState {
  sequence: number;
  status: ChunkUploadStatus;
  error?: string;
}

export type UploadSessionStatus =
  | "idle"
  | "starting"
  | "active"
  | "completing"
  | "completed"
  | "error";

export interface BeginUploadSessionParams {
  consultationSessionRef: string;
  doctorIdRef: string;
}

export interface UseUploadSessionResult {
  recordingId: string | null;
  status: UploadSessionStatus;
  error: string | null;
  chunkUploads: ChunkUploadState[];
  begin: (params: BeginUploadSessionParams) => Promise<void>;
  complete: (durationSeconds: number) => Promise<void>;
  retryChunk: (sequence: number) => void;
}

/**
 * Resumable upload state machine (architecture.md §6) — watches
 * useAudioRecorder's chunks and uploads each one independently as it
 * arrives, so a single failed chunk retries on its own rather than
 * derailing the whole session (§7 step 2).
 */
export function useUploadSession(chunks: AudioChunk[]): UseUploadSessionResult {
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [status, setStatus] = useState<UploadSessionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [chunkUploads, setChunkUploads] = useState<
    Map<number, ChunkUploadState>
  >(new Map());

  // Effects/callbacks need the *current* recordingId without forcing
  // every chunk-upload closure to be recreated on each state change.
  const recordingIdRef = useRef<string | null>(null);
  const inFlightRef = useRef<Set<number>>(new Set());

  const uploadOneChunk = useCallback(async (chunk: AudioChunk) => {
    const currentRecordingId = recordingIdRef.current;
    if (!currentRecordingId || inFlightRef.current.has(chunk.sequence)) return;
    inFlightRef.current.add(chunk.sequence);

    setChunkUploads((prev) => {
      const next = new Map(prev);
      next.set(chunk.sequence, { sequence: chunk.sequence, status: "uploading" });
      return next;
    });

    try {
      const target = await requestChunkUpload(currentRecordingId, {
        sequence: chunk.sequence,
      });
      await uploadChunkBytes(target.uploadUrl, chunk.blob);
      setChunkUploads((prev) => {
        const next = new Map(prev);
        next.set(chunk.sequence, { sequence: chunk.sequence, status: "uploaded" });
        return next;
      });
    } catch (err) {
      setChunkUploads((prev) => {
        const next = new Map(prev);
        next.set(chunk.sequence, {
          sequence: chunk.sequence,
          status: "failed",
          error: err instanceof Error ? err.message : "Upload failed.",
        });
        return next;
      });
    } finally {
      inFlightRef.current.delete(chunk.sequence);
    }
  }, []);

  useEffect(() => {
    if (!recordingId) return;
    for (const chunk of chunks) {
      if (!chunkUploads.has(chunk.sequence)) {
        void uploadOneChunk(chunk);
      }
    }
    // chunkUploads intentionally excluded — it's this effect's own
    // output; including it would re-run on every upload state change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chunks, recordingId, uploadOneChunk]);

  const begin = useCallback(
    async ({ consultationSessionRef, doctorIdRef }: BeginUploadSessionParams) => {
      setStatus("starting");
      setError(null);
      try {
        const response = await startRecording({
          consultationSessionRef,
          doctorIdRef,
          consentConfirmed: true,
        });
        recordingIdRef.current = response.recordingId;
        setRecordingId(response.recordingId);
        setChunkUploads(new Map());
        setStatus("active");
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to start recording session.",
        );
        setStatus("error");
      }
    },
    [],
  );

  const complete = useCallback(async (durationSeconds: number) => {
    const currentRecordingId = recordingIdRef.current;
    if (!currentRecordingId) return;
    setStatus("completing");
    try {
      await completeUpload(currentRecordingId, { durationSeconds });
      setStatus("completed");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to finalize recording.",
      );
      setStatus("error");
    }
  }, []);

  const retryChunk = useCallback(
    (sequence: number) => {
      const chunk = chunks.find((c) => c.sequence === sequence);
      if (!chunk) return;
      setChunkUploads((prev) => {
        const next = new Map(prev);
        next.delete(sequence);
        return next;
      });
      void uploadOneChunk(chunk);
    },
    [chunks, uploadOneChunk],
  );

  return {
    recordingId,
    status,
    error,
    chunkUploads: Array.from(chunkUploads.values()).sort(
      (a, b) => a.sequence - b.sequence,
    ),
    begin,
    complete,
    retryChunk,
  };
}
