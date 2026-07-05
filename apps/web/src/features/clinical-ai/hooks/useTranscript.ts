"use client";

import { useCallback, useEffect, useState } from "react";
import type { ConsultationTranscript } from "@kal-scribe/types";
import {
  getTranscript,
  relabelTranscriptSpeakers,
} from "../services/recording.service";

const POLL_INTERVAL_MS = 3000;

export interface UseTranscriptResult {
  transcript: ConsultationTranscript | null;
  isPolling: boolean;
  error: string | null;
  swapSpeakers: () => Promise<void>;
}

/** Polls for the transcript until it exists — transcription happens
 * asynchronously in the background (architecture.md §13), so there's
 * no single moment the frontend can know it's "ready" other than
 * asking repeatedly. Stops polling once found. */
export function useTranscript(recordingId: string | null): UseTranscriptResult {
  const [transcript, setTranscript] = useState<ConsultationTranscript | null>(
    null,
  );
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!recordingId) return;
    let cancelled = false;
    // Not a "derive state from props" anti-pattern: this kicks off a
    // real side effect (a polling loop against an external system),
    // which is exactly what effects are for — the generic lint
    // heuristic can't tell that apart from a redundant mirrored-state
    // case.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsPolling(true);
    setError(null);

    const poll = async () => {
      try {
        const result = await getTranscript(recordingId);
        if (cancelled) return;
        if (result) {
          setTranscript(result);
          setIsPolling(false);
          return;
        }
        setTimeout(() => void poll(), POLL_INTERVAL_MS);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load transcript.");
        setIsPolling(false);
      }
    };

    void poll();
    return () => {
      cancelled = true;
    };
  }, [recordingId]);

  const swapSpeakers = useCallback(async () => {
    if (!recordingId) return;
    try {
      const updated = await relabelTranscriptSpeakers(recordingId);
      setTranscript(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to relabel speakers.");
    }
  }, [recordingId]);

  return { transcript, isPolling, error, swapSpeakers };
}
