import { z } from "zod";

export const startRecordingSchema = z.object({
  consultationSessionRef: z.string().min(1),
  doctorIdRef: z.string().min(1),
  // literal(true), not boolean() — architecture.md §15: consent must be
  // an explicit, deliberate value, never merely truthy/defaulted.
  consentConfirmed: z.literal(true),
});

export const requestChunkUploadSchema = z.object({
  sequence: z.number().int().nonnegative(),
});

export const completeUploadSchema = z.object({
  durationSeconds: z.number().nonnegative(),
});
