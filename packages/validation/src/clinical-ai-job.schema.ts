import { z } from "zod";

export const updateJobStatusSchema = z.object({
  status: z.enum(["queued", "active", "completed", "failed", "dead_letter"]),
  errorMessage: z.string().nullable().optional(),
});
