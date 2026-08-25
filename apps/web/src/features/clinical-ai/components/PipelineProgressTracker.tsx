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

interface StepTiming {
  ms: number | null;
  live: boolean;
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

/** One step's timing, formatted for display — "—" before it's started,
 * a plain duration once it's finished, a duration with a "counting up"
 * marker while it's the currently-running stage. */
function formatStepTiming({ ms, live }: StepTiming): string {
  if (ms === null) return "—";
  return live ? `${formatDuration(ms)}…` : formatDuration(ms);
}

const STEP_TIMING_KEYS = [
  { msKey: "uploadMs", liveKey: "uploadLive" },
  { msKey: "transcriptionMs", liveKey: "transcriptionLive" },
  { msKey: "extractionMs", liveKey: "extractionLive" },
] as const;

/**
 * Real (not simulated) pipeline progress — every step/timing here
 * comes from usePipelineProgress's already-tracked job data, not a
 * time-based guess. Exists specifically to answer "is this stuck or
 * just slow," the exact question a 35-minute real-world stall left
 * unanswerable before this existed. Every step's elapsed time is shown
 * live, counting up while that step is in progress, so there's always
 * a visible answer to "how long has this taken so far" — not only a
 * summary once the whole pipeline finishes.
 */
export function PipelineProgressTracker({
  stage,
  failedJobType,
  errorMessage,
  timing,
}: PipelineProgressTrackerProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-2xl bg-[var(--color-surface-container-low)] px-6 py-4">
        {STEPS.map((step, index) => {
          const status = stepStatus(step, stage, failedJobType);
          const stepTiming: StepTiming = {
            ms: timing[STEP_TIMING_KEYS[index]!.msKey],
            live: timing[STEP_TIMING_KEYS[index]!.liveKey],
          };
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
                <span className="flex flex-col leading-tight">
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
                  <span
                    className={`font-mono text-[10px] tabular-nums ${
                      status === "current"
                        ? "text-[var(--color-accent)]"
                        : "text-[var(--color-outline)]"
                    }`}
                  >
                    {formatStepTiming(stepTiming)}
                  </span>
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div className="h-px flex-1 bg-[var(--color-outline-variant)]/30" />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 rounded-2xl bg-[var(--color-surface-container-low)] px-5 py-2.5 text-[11px] font-medium text-[var(--color-on-surface-variant)]">
        <span
          className={`material-symbols-outlined text-sm ${
            stage === "ready" ? "text-[var(--color-primary)]" : "text-[var(--color-accent)]"
          }`}
        >
          {stage === "ready" ? "check_circle" : "hourglass_empty"}
        </span>
        <span>
          Total:{" "}
          <span className="font-mono tabular-nums">
            {formatStepTiming({ ms: timing.totalMs, live: timing.totalLive })}
          </span>
        </span>
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
