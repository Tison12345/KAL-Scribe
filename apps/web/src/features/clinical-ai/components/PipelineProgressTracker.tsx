import type { ClinicalAiJobType } from "@kal-scribe/types";
import type { PipelineStage, PipelineTiming } from "../hooks/usePipelineProgress";

export interface PipelineProgressTrackerProps {
  stage: PipelineStage;
  failedJobType: ClinicalAiJobType | null;
  errorMessage: string | null;
  timing: PipelineTiming;
}

type StepStatus = "done" | "current" | "failed" | "pending";

interface Step {
  label: string;
  icon: string;
  stages: PipelineStage[];
}

const STEPS: Step[] = [
  { label: "Uploading", icon: "cloud_upload", stages: ["uploading"] },
  {
    label: "Transcribing & diarizing",
    icon: "graphic_eq",
    stages: ["queued", "transcribing"],
  },
  { label: "Extracting clinical data", icon: "auto_awesome", stages: ["extracting"] },
];

const STAGE_ORDER: PipelineStage[] = [
  "uploading",
  "queued",
  "transcribing",
  "extracting",
  "ready",
];

function stepStatus(
  step: Step,
  stage: PipelineStage,
  failedJobType: PipelineProgressTrackerProps["failedJobType"],
): StepStatus {
  if (failedJobType) {
    const failedStep =
      failedJobType === "extraction"
        ? STEPS[2]
        : STEPS[1]; // transcription/diarization share one visual step
    if (step === failedStep) return "failed";
    // Steps before the failed one are still shown as done — they did
    // complete before the failure happened.
    return STAGE_ORDER.indexOf(step.stages[0]!) < STAGE_ORDER.indexOf(failedStep.stages[0]!)
      ? "done"
      : "pending";
  }
  if (step.stages.includes(stage)) return "current";
  const stepIndex = STAGE_ORDER.indexOf(step.stages[0]!);
  const currentIndex = STAGE_ORDER.indexOf(stage);
  return currentIndex > stepIndex ? "done" : "pending";
}

const STATUS_CLASSES: Record<StepStatus, string> = {
  done: "bg-[var(--color-primary)]/10 text-[var(--color-primary)]",
  current: "bg-[var(--color-accent)]/10 text-[var(--color-accent)]",
  failed: "bg-red-50 text-red-600",
  pending: "bg-[var(--color-surface-container-low)] text-[var(--color-outline)]",
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

/**
 * Real (not simulated) pipeline progress — every step/timing here
 * comes from usePipelineProgress's already-tracked job data, not a
 * time-based guess. Exists specifically to answer "is this stuck or
 * just slow," the exact question a 35-minute real-world stall left
 * unanswerable before this existed.
 */
export function PipelineProgressTracker({
  stage,
  failedJobType,
  errorMessage,
  timing,
}: PipelineProgressTrackerProps) {
  if (stage === "ready") {
    // Always show all four labels — a missing one (e.g. no upload/
    // transcription job because a transcript was injected directly
    // for testing, skipping the normal record→upload→transcribe flow)
    // should read as "no data for this stage," not silently vanish
    // and look like the summary itself is incomplete.
    const parts = [
      `Upload: ${timing.uploadMs !== null ? formatDuration(timing.uploadMs) : "—"}`,
      `Transcription & diarization: ${timing.transcriptionMs !== null ? formatDuration(timing.transcriptionMs) : "—"}`,
      `Extraction: ${timing.extractionMs !== null ? formatDuration(timing.extractionMs) : "—"}`,
      `Total: ${timing.totalMs !== null ? formatDuration(timing.totalMs) : "—"}`,
    ];

    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl bg-[var(--color-surface-container-low)] px-5 py-3 text-[11px] font-medium text-[var(--color-on-surface-variant)]">
        <span className="material-symbols-outlined text-sm text-[var(--color-primary)]">
          check_circle
        </span>
        {parts.join(" · ")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-2xl bg-[var(--color-surface-container-low)] px-6 py-4">
        {STEPS.map((step, index) => {
          const status = stepStatus(step, stage, failedJobType);
          return (
            <div key={step.label} className="flex flex-1 items-center gap-3">
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${STATUS_CLASSES[status]}`}
                >
                  <span className="material-symbols-outlined text-sm">
                    {status === "done"
                      ? "check"
                      : status === "failed"
                        ? "error"
                        : status === "current"
                          ? "hourglass_empty"
                          : step.icon}
                  </span>
                </span>
                <span
                  className={`text-[11px] font-bold ${
                    status === "pending"
                      ? "text-[var(--color-outline)]"
                      : status === "failed"
                        ? "text-red-600"
                        : "text-[var(--color-on-surface)]"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div className="h-px flex-1 bg-[var(--color-outline-variant)]/30" />
              )}
            </div>
          );
        })}
      </div>
      {stage === "failed" && (
        <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[12px] font-semibold text-red-600">
          {failedJobType === "extraction" ? "Extraction" : "Transcription"} failed after
          all retries{errorMessage ? `: ${errorMessage}` : "."}
        </p>
      )}
    </div>
  );
}
