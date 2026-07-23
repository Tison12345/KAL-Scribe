"use client";

import { useState } from "react";
import type { ConsultationTranscript } from "@kal-scribe/types";

export interface TranscriptViewerProps {
  transcript: ConsultationTranscript | null;
  isPolling: boolean;
  error: string | null;
  onSwapSpeakers: () => void;
}

const SPEAKER_BADGE_CLASSES: Record<string, string> = {
  Doctor: "bg-[var(--color-primary)]/10 text-[var(--color-primary)]",
  Patient: "bg-[var(--color-accent)]/10 text-[var(--color-accent)]",
};

function speakerBadgeClass(speaker: string): string {
  return (
    SPEAKER_BADGE_CLASSES[speaker] ??
    "bg-[var(--color-surface-container-low)] text-[var(--color-on-surface-variant)]"
  );
}

// docs/adr/0016 — maps a segment's originalLanguage to the matching
// scoped Noto Sans CSS variable declared in app/layout.tsx. Hindi and
// Sanskrit share Devanagari script. English/unmapped codes fall back
// to the inherited body font (Manrope) — no entry needed.
const ORIGINAL_TEXT_FONT_VARS: Record<string, string> = {
  hi: "var(--font-noto-devanagari)",
  sa: "var(--font-noto-devanagari)",
  kn: "var(--font-noto-kannada)",
  ta: "var(--font-noto-tamil)",
  ml: "var(--font-noto-malayalam)",
};

function formatTimestamp(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Speaker-labeled, timestamped transcript — the doctor's source-of-truth
 * reference (architecture.md §6, §7 step 7). Collapsible: collapsed by
 * default so it doesn't dominate the review screen, since the AI-drafted
 * fields (Milestone 7+) are the primary thing a doctor reviews, not the
 * raw transcript.
 */
export function TranscriptViewer({
  transcript,
  isPolling,
  error,
  onSwapSpeakers,
}: TranscriptViewerProps) {
  const [expanded, setExpanded] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  if (error) {
    return (
      <p className="rounded-xl bg-red-50 px-4 py-2.5 text-[12px] font-semibold text-red-600">
        {error}
      </p>
    );
  }

  if (!transcript) {
    if (!isPolling) return null;
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-outline-variant)]/40 bg-[var(--color-surface-container-low)] px-5 py-4">
        <span className="material-symbols-outlined text-lg text-[var(--color-primary)]">
          hourglass_empty
        </span>
        <p className="text-sm font-medium text-[var(--color-on-surface-variant)]">
          Transcribing consultation…
        </p>
      </div>
    );
  }

  const hasRealSpeakers = transcript.diarizationProvider !== null;

  // docs/adr/0016 — only worth showing when there's something to show:
  // a pure-English consultation has no badge and no toggle at all.
  const nonEnglishLanguages = (transcript.languageDetected ?? []).filter(
    (code) => code !== "en",
  );
  const hasOriginalLanguageContent = transcript.segments.some(
    (segment) => segment.originalLanguage !== null && segment.originalLanguage !== "en",
  );

  return (
    <div className="rounded-[2rem] bg-white ring-1 ring-[var(--color-outline-variant)]/20 shadow-lg shadow-[var(--color-primary)]/5">
      <div
        className="flex cursor-pointer select-none items-center gap-4 px-8 py-5 transition-colors hover:bg-[var(--color-surface-container-low)]/50"
        onClick={() => setExpanded((prev) => !prev)}
      >
        <span className="material-symbols-outlined text-lg text-[var(--color-primary)]">
          summarize
        </span>
        <h3 className="text-lg font-extrabold text-[var(--color-on-background)]">
          Transcript
        </h3>
        <span className="rounded-full bg-[var(--color-primary)]/10 px-2 py-0.5 text-[10px] font-bold text-[var(--color-primary)]">
          {transcript.segments.length} segment
          {transcript.segments.length === 1 ? "" : "s"}
        </span>
        {nonEnglishLanguages.length > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-[var(--color-accent)]/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--color-accent)]">
            {(transcript.languageDetected ?? []).join(" · ")}
            {transcript.isCodeSwitched && (
              <span
                className="material-symbols-outlined text-xs"
                title="Code-switched: multiple languages mixed within a single utterance"
              >
                sync_alt
              </span>
            )}
          </span>
        )}
        <span
          className="material-symbols-outlined ml-auto text-lg text-[var(--color-on-surface-variant)] transition-transform duration-200"
          style={{ transform: expanded ? "rotate(0deg)" : "rotate(-90deg)" }}
        >
          expand_more
        </span>
      </div>

      {expanded && (
        <div className="animate-[fadeIn_0.2s_ease-out] space-y-4 border-t border-[var(--color-outline-variant)]/15 px-8 pb-8 pt-2">
          <div className="flex flex-wrap gap-2">
            {hasRealSpeakers && (
              <button
                type="button"
                onClick={onSwapSpeakers}
                className="flex items-center gap-2 rounded-xl px-4 py-2 text-[11px] font-bold text-[var(--color-primary)] transition-all hover:bg-[var(--color-primary)]/5"
              >
                <span className="material-symbols-outlined text-sm">sync_alt</span>
                Swap Doctor / Patient
              </button>
            )}
            {hasOriginalLanguageContent && (
              <button
                type="button"
                onClick={() => setShowOriginal((prev) => !prev)}
                className="flex items-center gap-2 rounded-xl px-4 py-2 text-[11px] font-bold text-[var(--color-primary)] transition-all hover:bg-[var(--color-primary)]/5"
              >
                <span className="material-symbols-outlined text-sm">translate</span>
                {showOriginal ? "Show English" : "Show Original"}
              </button>
            )}
          </div>

          <ul className="space-y-3">
            {transcript.segments.map((segment, index) => {
              // docs/adr/0016 — segments with no original-language
              // content (already English) keep showing `text` even
              // while the toggle is on, rather than showing nothing.
              const showingOriginal =
                showOriginal &&
                segment.originalText !== null &&
                segment.originalLanguage !== null &&
                segment.originalLanguage !== "en";
              const fontVar = showingOriginal
                ? ORIGINAL_TEXT_FONT_VARS[segment.originalLanguage ?? ""]
                : undefined;

              return (
                <li key={index} className="flex gap-4">
                  <span className="mt-0.5 w-12 shrink-0 text-[10px] font-medium text-[var(--color-outline)]">
                    {formatTimestamp(segment.start)}
                  </span>
                  <div className="space-y-1">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${speakerBadgeClass(segment.speaker)}`}
                    >
                      {segment.speaker}
                    </span>
                    <p
                      lang={showingOriginal ? (segment.originalLanguage ?? undefined) : "en"}
                      style={fontVar ? { fontFamily: fontVar } : undefined}
                      className="text-sm font-medium text-[var(--color-on-surface)]"
                    >
                      {showingOriginal ? segment.originalText : segment.text}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
