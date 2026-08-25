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
  uploadLive: boolean;
  transcriptionMs: number | null;
  transcriptionLive: boolean;
  extractionMs: number | null;
  extractionLive: boolean;
  totalMs: number | null;
  totalLive: boolean;
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

const LIVE_TICK_MS = 1000;

/**
 * Real (not simulated) pipeline progress — derived entirely from data
 * the system already tracks (`consultation_recordings` timestamps,
 * `consultation_ai_jobs.status`/`started_at`/`completed_at`), not a
 * time-based estimate. Answers "is this stuck or just slow" (the exact
 * confusion a 35-minute real-world stall caused). Timing counts up live
 * per stage while it's in progress (`*Live: true`), then holds its
 * final value once the stage completes.
 */
export function usePipelineProgress(
  recordingId: string | null,
): UsePipelineProgressResult {
  const [recording, setRecording] = useState<ConsultationRecording | null>(null);
  const [jobs, setJobs] = useState<ConsultationAiJob[]>([]);
  // Ticks once a second so an in-progress stage's elapsed time visibly
  // counts up, not just the final duration once a stage completes.
  const [now, setNow] = useState(() => Date.now());

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

  // Ticks once a second only while there's an active stage to count up
  // — no point re-rendering every second once the pipeline is done or
  // dead-lettered.
  useEffect(() => {
    if (stage === "ready" || stage === "failed") return;
    const intervalId = setInterval(() => setNow(Date.now()), LIVE_TICK_MS);
    return () => clearInterval(intervalId);
  }, [stage]);

  const uploadDone = recording?.status === "uploaded" || recording?.status === "processed";
  const uploadMs =
    recording && uploadDone
      ? new Date(recording.updatedAt).getTime() - new Date(recording.createdAt).getTime()
      : recording && !uploadDone
        ? now - new Date(recording.createdAt).getTime()
        : null;

  const transcriptionMs = transcriptionJob?.completedAt
    ? durationMs(transcriptionJob.startedAt, transcriptionJob.completedAt)
    : transcriptionJob?.startedAt
      ? now - new Date(transcriptionJob.startedAt).getTime()
      : null;

  const extractionMs = extractionJob?.completedAt
    ? durationMs(extractionJob.startedAt, extractionJob.completedAt)
    : extractionJob?.startedAt
      ? now - new Date(extractionJob.startedAt).getTime()
      : null;

  const totalMs = recording
    ? (extractionJob?.completedAt
        ? new Date(extractionJob.completedAt).getTime()
        : now) - new Date(recording.createdAt).getTime()
    : null;

  return {
    stage,
    failedJobType: failedJob?.jobType ?? null,
    errorMessage: failedJob?.errorMessage ?? null,
    timing: {
      uploadMs,
      uploadLive: !uploadDone,
      transcriptionMs,
      transcriptionLive: !!transcriptionJob && !transcriptionJob.completedAt,
      extractionMs,
      extractionLive: !!extractionJob && !extractionJob.completedAt,
      totalMs,
      totalLive: stage !== "ready",
    },
  };
}
