"use client";

import type { ChunkUploadState, UploadSessionStatus } from "../hooks/useUploadSession";

export interface UploadProgressProps {
  status: UploadSessionStatus;
  error: string | null;
  chunkUploads: ChunkUploadState[];
  onRetryChunk: (sequence: number) => void;
}

const STATUS_LABEL: Record<UploadSessionStatus, string> = {
  idle: "",
  starting: "Starting upload session…",
  active: "Uploading",
  completing: "Finalizing recording…",
  completed: "Recording saved",
  error: "Upload session error",
};

const CHUNK_BADGE_CLASSES: Record<ChunkUploadState["status"], string> = {
  uploading:
    "bg-[var(--color-surface-container-low)] text-[var(--color-on-surface-variant)]",
  uploaded: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-600",
};

export function UploadProgress({
  status,
  error,
  chunkUploads,
  onRetryChunk,
}: UploadProgressProps) {
  if (status === "idle") return null;

  const uploadedCount = chunkUploads.filter((c) => c.status === "uploaded").length;
  const failedCount = chunkUploads.filter((c) => c.status === "failed").length;

  return (
    <div className="space-y-3 rounded-2xl border border-[var(--color-outline-variant)]/40 bg-[var(--color-surface-container-low)] px-5 py-4">
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-lg text-[var(--color-primary)]">
          cloud_upload
        </span>
        <p className="text-sm font-semibold text-[var(--color-on-surface)]">
          {STATUS_LABEL[status]}
          {chunkUploads.length > 0 &&
            (status === "active" || status === "completing") &&
            ` — ${uploadedCount}/${chunkUploads.length} chunks uploaded`}
        </p>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[12px] font-semibold text-red-600">
          {error}
        </p>
      )}

      {failedCount > 0 && (
        <ul className="space-y-2">
          {chunkUploads
            .filter((chunk) => chunk.status === "failed")
            .map((chunk) => (
              <li
                key={chunk.sequence}
                className="flex items-center gap-3 rounded-xl bg-white px-4 py-2.5"
              >
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${CHUNK_BADGE_CLASSES[chunk.status]}`}
                >
                  Chunk {chunk.sequence + 1} failed
                </span>
                <span className="text-[11px] text-[var(--color-on-surface-variant)]">
                  {chunk.error}
                </span>
                <button
                  type="button"
                  onClick={() => onRetryChunk(chunk.sequence)}
                  className="ml-auto text-[11px] font-bold text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5 rounded-lg px-3 py-1.5 transition-all"
                >
                  Retry
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
