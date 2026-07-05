"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ClinicalExtraction, ConsultationAiResult } from "@kal-scribe/types";
import {
  acceptReviewDraft,
  discardReviewDraft,
  getExtraction,
  updateReviewDraft,
} from "../services/recording.service";

const POLL_INTERVAL_MS = 3000;
const AUTOSAVE_DEBOUNCE_MS = 800;

// No auth/identity exists yet in this standalone repo (architecture.md
// §17 Phase 1) — matches the same DEV_DOCTOR_ID_REF stub app/page.tsx
// already uses for doctorIdRef when starting a recording.
const DEV_DOCTOR_ID_REF = "dev-doctor";

export interface UseReviewDraftResult {
  result: ConsultationAiResult | null;
  /** The editable working copy: `editedExtraction` if the doctor has
   * already edited something, otherwise the original AI `extraction`.
   * Never the same object reference as `result.extraction` once
   * edited — components can compare draft !== result.extraction to
   * tell "AI-suggested" from "doctor-edited" (CLAUDE.md's "no silent
   * AI authority" rule). */
  draft: ClinicalExtraction | null;
  isPolling: boolean;
  isSaving: boolean;
  error: string | null;
  updateDraft: (next: ClinicalExtraction) => void;
  accept: () => Promise<void>;
  discard: () => Promise<void>;
}

/** Polls for the extraction result until it exists (mirrors
 * useTranscript's reasoning — extraction happens asynchronously,
 * architecture.md §13), then holds local edit state for the doctor's
 * review draft, autosaving after a short pause rather than on every
 * keystroke. */
export function useReviewDraft(
  recordingId: string | null,
): UseReviewDraftResult {
  const [result, setResult] = useState<ConsultationAiResult | null>(null);
  const [draft, setDraft] = useState<ClinicalExtraction | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!recordingId) return;
    let cancelled = false;
    // Not the "derive state from props" anti-pattern: this kicks off a
    // real side effect (a polling loop against an external system) —
    // see useTranscript.ts for the identical, already-justified case.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsPolling(true);
    setError(null);

    const poll = async () => {
      try {
        const found = await getExtraction(recordingId);
        if (cancelled) return;
        if (found) {
          setResult(found);
          setDraft(found.editedExtraction ?? found.extraction);
          setIsPolling(false);
          return;
        }
        setTimeout(() => void poll(), POLL_INTERVAL_MS);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load extraction.");
        setIsPolling(false);
      }
    };

    void poll();
    return () => {
      cancelled = true;
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [recordingId]);

  const updateDraft = useCallback(
    (next: ClinicalExtraction) => {
      setDraft(next);
      if (!recordingId) return;

      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        setIsSaving(true);
        updateReviewDraft(recordingId, { extraction: next })
          .then((updated) => setResult(updated))
          .catch((err: unknown) => {
            setError(err instanceof Error ? err.message : "Failed to save edit.");
          })
          .finally(() => setIsSaving(false));
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [recordingId],
  );

  const accept = useCallback(async () => {
    if (!recordingId) return;
    try {
      const updated = await acceptReviewDraft(recordingId, {
        reviewedByRef: DEV_DOCTOR_ID_REF,
      });
      setResult(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept draft.");
    }
  }, [recordingId]);

  const discard = useCallback(async () => {
    if (!recordingId) return;
    try {
      const updated = await discardReviewDraft(recordingId);
      setResult(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to discard draft.");
    }
  }, [recordingId]);

  return { result, draft, isPolling, isSaving, error, updateDraft, accept, discard };
}
