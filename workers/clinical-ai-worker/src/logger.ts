import pino from "pino";

/**
 * Structured logging (audit finding, "the single highest-leverage
 * addition" per the readiness doc) — replaces every `console.log`/
 * `console.error` in this package. Two concrete problems this solves:
 *
 * 1. No way to trace one job end-to-end — `jobId`/`recordingId` used to
 *    appear only as free text inside a message string, not a queryable
 *    field. `withJobContext` below binds them as real fields on every
 *    log line for the lifetime of one job.
 * 2. PHI leaked into logs by accident (D7 — a full verbatim transcript
 *    was once logged in full). `redact` below is defense-in-depth: even
 *    if a future call site accidentally logs a field shaped like
 *    transcript segments, the actual text never reaches the sink.
 *
 * JSON in production (the shape a real log aggregator wants); pretty,
 * readable output in development via pino-pretty.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: [
      "segments[*].text",
      "segments[*].originalText",
      "rawResponse",
      "audio",
    ],
    censor: "[REDACTED]",
  },
  transport:
    process.env.NODE_ENV === "production"
      ? undefined
      : { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:HH:MM:ss" } },
});

export type Logger = typeof logger;

/** One child logger per job, bound with the fields that make a job's
 * whole lifecycle greppable/filterable — created once in
 * `withStatusReporting` and threaded explicitly through every function
 * that handles that job, rather than relying on ambient/global state. */
export function withJobContext(
  jobId: string,
  recordingId: string,
  jobType: string,
): Logger {
  return logger.child({ jobId, recordingId, jobType });
}
