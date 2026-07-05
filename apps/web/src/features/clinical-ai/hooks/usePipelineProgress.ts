"use client";

import { useEffect, useState } from "react";
import type { ConsultationAiJob, ConsultationRecording } from "@kal-scribe/types";
import { getRecording, getRecordingJobs } from "../services/recording.service";

const POLL_INTERVAL_MS = 2000;

export type PipelineStage =
  | "uploading"
  | "queued"
  | "transcribing"
  | "extracting"
  | "ready"
  | "failed";

export interface PipelineTiming {
  uploadMs: number | null;
  transcriptionMs: number | null;
  extractionMs: number | null;
  totalMs: number | null;
}

export interface UsePipelineProgressResult {
  stage: PipelineStage;
  failedJobType: ConsultationAiJob["jobType"] | null;
  errorMessage: string | null;
  timing: PipelineTiming;
}

function durationMs(startedAt: string | null, completedAt: string | null): number | null {
  if (!startedAt || !completedAt) return null;
  return new Date(completedAt).getTime() - new Date(startedAt).getTime();
}

/**
 * Real (not simulated) pipeline progress — derived entirely from data
 * the system already tracks (`consultation_recordings` timestamps,
 * `consultation_ai_jobs.status`/`started_at`/`completed_at`), not a
 * time-based estimate. Answers "is this stuck or just slow" (the exact
 * confusion a 35-minute real-world stall caused) and gives an honest
 * per-stage timing breakdown once the pipeline finishes.
 */
export function usePipelineProgress(
  recordingId: string | null,
): UsePipelineProgressResult {
  const [recording, setRecording] = useState<ConsultationRecording | null>(null);
  const [jobs, setJobs] = useState<ConsultationAiJob[]>([]);

  useEffect(() => {
    if (!recordingId) return;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        const [rec, jobList] = await Promise.all([
          getRecording(recordingId),
          getRecordingJobs(recordingId),
        ]);
        if (cancelled) return;
        setRecording(rec);
        setJobs(jobList);

        const extractionJob = jobList.find((j) => j.jobType === "extraction");
        const isDone = extractionJob?.status === "completed";
        const isFailed = jobList.some((j) => j.status === "dead_letter");
        if (!isDone && !isFailed) {
          timeoutId = setTimeout(() => void poll(), POLL_INTERVAL_MS);
        }
      } catch {
        // Transient fetch blip — retry on the next interval rather
        // than surfacing it as a hard error to the doctor.
        if (!cancelled) timeoutId = setTimeout(() => void poll(), POLL_INTERVAL_MS);
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [recordingId]);

  const transcriptionJob = jobs.find((j) => j.jobType === "transcription") ?? null;
  const extractionJob = jobs.find((j) => j.jobType === "extraction") ?? null;
  const failedJob = jobs.find((j) => j.status === "dead_letter") ?? null;

  const stage: PipelineStage = failedJob
    ? "failed"
    : extractionJob?.status === "completed"
      ? "ready"
      : extractionJob || transcriptionJob?.status === "completed"
        ? "extracting"
        : transcriptionJob
          ? "transcribing"
          : recording?.status === "uploaded" || recording?.status === "processed"
            ? "queued"
            : "uploading";

  const uploadMs =
    recording && (recording.status === "uploaded" || recording.status === "processed")
      ? new Date(recording.updatedAt).getTime() - new Date(recording.createdAt).getTime()
      : null;
  const transcriptionMs = transcriptionJob
    ? durationMs(transcriptionJob.startedAt, transcriptionJob.completedAt)
    : null;
  const extractionMs = extractionJob
    ? durationMs(extractionJob.startedAt, extractionJob.completedAt)
    : null;
  const totalMs =
    recording && extractionJob?.completedAt
      ? new Date(extractionJob.completedAt).getTime() - new Date(recording.createdAt).getTime()
      : null;

  return {
    stage,
    failedJobType: failedJob?.jobType ?? null,
    errorMessage: failedJob?.errorMessage ?? null,
    timing: { uploadMs, transcriptionMs, extractionMs, totalMs },
  };
}
