"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type RecorderStatus =
  | "idle"
  | "requesting-permission"
  | "recording"
  | "paused"
  | "stopped"
  | "error";

export interface AudioChunk {
  /** Ordering within this recording session — architecture.md §7 step 1:
   * chunks are tagged with a sequence number so a dropped/failed chunk
   * (M3's upload concern, not this hook's) loses at most itself. Each
   * chunk is its own complete, independently decodable audio file —
   * see the "segment" design note on `beginSegment` below for why. */
  sequence: number;
  blob: Blob;
  recordedAt: string;
}

export interface UseAudioRecorderOptions {
  /** Chunk cut interval in ms. Architecture.md §7 step 1 recommends
   * 15–30s segments so a crash/connectivity drop loses at most one
   * chunk, not the whole consultation. */
  chunkIntervalMs?: number;
}

export interface UseAudioRecorderResult {
  status: RecorderStatus;
  error: string | null;
  chunks: AudioChunk[];
  durationSeconds: number;
  /** Instantaneous input level in [0, 1], for a level meter. */
  audioLevel: number;
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

const DEFAULT_CHUNK_INTERVAL_MS = 15_000;

/** Why a segment isn't just `recorder.start(chunkIntervalMs)`'s
 * timeslice mode: with a timeslice, one MediaRecorder emits periodic
 * `dataavailable` blobs that are fragments of a single continuous
 * encoded stream — only the first fragment carries the container
 * header, so later fragments aren't independently decodable/playable
 * on their own. Architecture.md §7 step 1 requires each chunk to
 * survive on its own if a later one fails to upload, which needs each
 * chunk to be a genuinely complete file. So instead, a fresh
 * MediaRecorder is started on the same mic stream every interval,
 * stopped to flush one complete file, then immediately replaced. */
type SegmentEndReason = "boundary" | "pausing" | "ending";

/** Without an explicit `mimeType`, MediaRecorder falls back to a
 * browser-chosen default that isn't guaranteed to be an audio-specific
 * type even for an audio-only stream — Chromium has been observed
 * defaulting bare `video/webm`, which some `<audio>` playback paths
 * then reject outright (silently non-interactive controls, 0:00
 * duration). Picking the best supported *audio* type explicitly keeps
 * every recorded chunk reliably playable. */
function pickSupportedAudioMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

export function useAudioRecorder(
  options: UseAudioRecorderOptions = {},
): UseAudioRecorderResult {
  const chunkIntervalMs = options.chunkIntervalMs ?? DEFAULT_CHUNK_INTERVAL_MS;

  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [chunks, setChunks] = useState<AudioChunk[]>([]);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const sequenceRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const levelMeterFrameRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const segmentCutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const segmentEndReasonRef = useRef<SegmentEndReason>("boundary");

  const stopLevelMeter = useCallback(() => {
    if (levelMeterFrameRef.current !== null) {
      cancelAnimationFrame(levelMeterFrameRef.current);
      levelMeterFrameRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  const runLevelMeter = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteTimeDomainData(data);
      let sumSquares = 0;
      for (const value of data) {
        const normalized = (value - 128) / 128;
        sumSquares += normalized * normalized;
      }
      const rms = Math.sqrt(sumSquares / data.length);
      setAudioLevel(Math.min(1, rms * 4));
      levelMeterFrameRef.current = requestAnimationFrame(tick);
    };
    levelMeterFrameRef.current = requestAnimationFrame(tick);
  }, []);

  const stopDurationTimer = useCallback(() => {
    if (durationIntervalRef.current !== null) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  const startDurationTimer = useCallback(() => {
    durationIntervalRef.current = setInterval(() => {
      setDurationSeconds((prev) => prev + 1);
    }, 1000);
  }, []);

  const clearSegmentCutTimer = useCallback(() => {
    if (segmentCutTimerRef.current !== null) {
      clearTimeout(segmentCutTimerRef.current);
      segmentCutTimerRef.current = null;
    }
  }, []);

  /** Releases the mic/audio graph entirely. Only for a true end of
   * session (or unmount) — pausing keeps the stream alive so resume
   * doesn't need to re-prompt for mic permission. */
  const releaseAudioResources = useCallback(() => {
    stopLevelMeter();
    stopDurationTimer();
    clearSegmentCutTimer();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    analyserRef.current = null;
    mediaRecorderRef.current = null;
  }, [clearSegmentCutTimer, stopDurationTimer, stopLevelMeter]);

  // beginSegment recurses into itself (each segment's onstop starts the
  // next one). A direct self-reference through the `const` binding trips
  // the compiler's stricter self-reference check, so the recursive call
  // goes through this ref instead, kept in sync via the effect below —
  // external callers (start/resume) still call the memoized `beginSegment`
  // directly.
  const beginSegmentRef = useRef<(() => void) | null>(null);

  const beginSegment = useCallback(() => {
    const stream = mediaStreamRef.current;
    if (!stream) return;

    const mimeType = pickSupportedAudioMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorder.ondataavailable = (event) => {
      if (event.data.size === 0) return;
      const chunk: AudioChunk = {
        sequence: sequenceRef.current++,
        blob: event.data,
        recordedAt: new Date().toISOString(),
      };
      setChunks((prev) => [...prev, chunk]);
    };
    recorder.onerror = () => {
      setError("Recording failed unexpectedly.");
      setStatus("error");
      releaseAudioResources();
    };
    recorder.onstop = () => {
      mediaRecorderRef.current = null;
      const reason = segmentEndReasonRef.current;
      if (reason === "ending") {
        releaseAudioResources();
        setStatus("stopped");
        return;
      }
      if (reason === "pausing") {
        return; // stay paused — stream/audio graph remain open
      }
      // Natural interval boundary: keep recording, seamlessly.
      beginSegmentRef.current?.();
      segmentCutTimerRef.current = setTimeout(() => {
        segmentEndReasonRef.current = "boundary";
        mediaRecorderRef.current?.stop();
      }, chunkIntervalMs);
    };

    mediaRecorderRef.current = recorder;
    recorder.start();
  }, [chunkIntervalMs, releaseAudioResources]);

  useEffect(() => {
    beginSegmentRef.current = beginSegment;
  }, [beginSegment]);

  useEffect(() => {
    return () => {
      segmentEndReasonRef.current = "ending";
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }
      releaseAudioResources();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setStatus("requesting-permission");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      mediaStreamRef.current = stream;

      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      runLevelMeter();

      sequenceRef.current = 0;
      setChunks([]);
      setDurationSeconds(0);

      segmentEndReasonRef.current = "boundary";
      beginSegment();
      segmentCutTimerRef.current = setTimeout(() => {
        segmentEndReasonRef.current = "boundary";
        mediaRecorderRef.current?.stop();
      }, chunkIntervalMs);

      startDurationTimer();
      setStatus("recording");
    } catch {
      setError("Microphone access was denied or unavailable.");
      setStatus("error");
      releaseAudioResources();
    }
  }, [beginSegment, chunkIntervalMs, releaseAudioResources, runLevelMeter, startDurationTimer]);

  const pause = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    segmentEndReasonRef.current = "pausing";
    clearSegmentCutTimer();
    stopDurationTimer();
    stopLevelMeter();
    recorder.stop();
    setStatus("paused");
  }, [clearSegmentCutTimer, stopDurationTimer, stopLevelMeter]);

  const resume = useCallback(() => {
    if (status !== "paused" || !mediaStreamRef.current) return;
    segmentEndReasonRef.current = "boundary";
    beginSegment();
    segmentCutTimerRef.current = setTimeout(() => {
      segmentEndReasonRef.current = "boundary";
      mediaRecorderRef.current?.stop();
    }, chunkIntervalMs);
    startDurationTimer();
    runLevelMeter();
    setStatus("recording");
  }, [beginSegment, chunkIntervalMs, runLevelMeter, startDurationTimer, status]);

  const stop = useCallback(() => {
    if (!mediaStreamRef.current) return;
    segmentEndReasonRef.current = "ending";
    clearSegmentCutTimer();
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop(); // onstop tears down, since reason is "ending"
    } else {
      // Already paused (no active recorder) — nothing left to flush.
      releaseAudioResources();
      setStatus("stopped");
    }
  }, [clearSegmentCutTimer, releaseAudioResources]);

  return {
    status,
    error,
    chunks,
    durationSeconds,
    audioLevel,
    start,
    pause,
    resume,
    stop,
  };
}
