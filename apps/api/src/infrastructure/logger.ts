import pino from "pino";

/**
 * Structured logging (audit finding — "the single highest-leverage
 * addition" per the readiness doc). Most of apps/api's own logging
 * goes through nestjs-pino (`LoggerModule.forRoot()` in app.module.ts,
 * wired as the app-wide logger in main.ts) — this standalone instance
 * exists only for the one call site that isn't inside NestJS's DI
 * container: queue.module.ts's pg-boss error handler, set up inside a
 * factory provider before any class instance (and its injectable
 * logger) exists. Same redact/format config as nestjs-pino's, kept
 * separate rather than shared to avoid the module-init-order problem
 * of needing the Nest app's logger before the app exists.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: ["rawResponse", "audio"],
    censor: "[REDACTED]",
  },
  transport:
    process.env.NODE_ENV === "production"
      ? undefined
      : { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:HH:MM:ss" } },
});
