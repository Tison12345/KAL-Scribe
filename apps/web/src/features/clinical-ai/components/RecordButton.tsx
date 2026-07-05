"use client";

import type { RecorderStatus } from "../hooks/useAudioRecorder";

export interface RecordButtonProps {
  status: RecorderStatus;
  error: string | null;
  durationSeconds: number;
  /** Instantaneous input level in [0, 1] — see docs/adr/0006. */
  audioLevel: number;
  /** True while patient consent for this session hasn't been
   * confirmed yet (architecture.md §15) — recording must not be
   * startable until it has. */
  disabled: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

const primaryButtonClasses =
  "flex items-center gap-3 rounded-2xl bg-[var(--color-primary)] px-10 py-4 text-sm font-extrabold text-[var(--color-on-primary)] shadow-lg shadow-[var(--color-primary)]/30 transition-all hover:bg-[var(--color-primary-hover)] hover:shadow-xl active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none";

const ghostButtonClasses =
  "flex items-center gap-2 rounded-2xl px-8 py-4 text-sm font-bold text-[var(--color-primary)] transition-all hover:bg-[var(--color-primary)]/5";

export function RecordButton({
  status,
  error,
  durationSeconds,
  audioLevel,
  disabled,
  onStart,
  onPause,
  onResume,
  onStop,
}: RecordButtonProps) {
  const showMeter = status === "recording" || status === "paused";

  return (
    <div className="space-y-4">
      {showMeter && (
        <div className="flex items-center gap-4">
          <span className="text-sm font-bold tabular-nums text-[var(--color-on-surface)]">
            {formatDuration(durationSeconds)}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-surface-container-low)]">
            <div
              className="h-full rounded-full bg-[var(--color-primary)] transition-[width] duration-75"
              style={{ width: `${Math.round(audioLevel * 100)}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        {status === "idle" || status === "stopped" || status === "error" ? (
          <button
            type="button"
            onClick={onStart}
            disabled={disabled}
            className={primaryButtonClasses}
          >
            <span className="material-symbols-outlined text-lg">mic</span>
            Start Recording
          </button>
        ) : status === "requesting-permission" ? (
          <button type="button" disabled className={primaryButtonClasses}>
            <span className="material-symbols-outlined text-lg">
              hourglass_empty
            </span>
            Requesting microphone access...
          </button>
        ) : status === "recording" ? (
          <>
            <button
              type="button"
              onClick={onPause}
              className={ghostButtonClasses}
            >
              <span className="material-symbols-outlined text-lg">
                pause_circle
              </span>
              Pause
            </button>
            <button
              type="button"
              onClick={onStop}
              className={primaryButtonClasses}
            >
              <span className="material-symbols-outlined text-lg">
                stop_circle
              </span>
              Stop
            </button>
          </>
        ) : status === "paused" ? (
          <>
            <button
              type="button"
              onClick={onResume}
              className={ghostButtonClasses}
            >
              <span className="material-symbols-outlined text-lg">
                play_circle
              </span>
              Resume
            </button>
            <button
              type="button"
              onClick={onStop}
              className={primaryButtonClasses}
            >
              <span className="material-symbols-outlined text-lg">
                stop_circle
              </span>
              Stop
            </button>
          </>
        ) : null}
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[12px] font-semibold text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
