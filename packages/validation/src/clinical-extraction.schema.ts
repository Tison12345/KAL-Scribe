import { z } from "zod";
import { SROTAS_DISTURBANCE_TYPES } from "@kal-scribe/types";

/** Runtime-checked mirror of the REAL clinical form fields (see
 * packages/types/src/clinical-extraction.ts and
 * docs/modules/clinical-extraction-schema.md for the full derivation
 * against the CMS's own source). This is the contract validated at
 * every boundary the LLM's JSON output crosses (architecture.md §20
 * principle 10): once past this schema, the rest of the system trusts
 * the shape. */

// Strict enums — confirmed NO "Other" escape hatch exists for these in
// the live CMS form (verified against the actual dropdown components,
// not just the type file).
const bpPositionSchema = z.enum(["Sitting", "Standing", "Lying"]).nullable();
const quantityUnitSchema = z.enum(["mL", "gm", "tabs", "tspn", "Patch"]).nullable();
const strokeDirectionSchema = z.enum(["anuloma", "pratiloma"]).nullable();
const pressureSchema = z.enum(["high", "medium", "low"]).nullable();
const followUpUnitSchema = z.enum(["days", "weeks", "months"]).nullable();
const aamaSchema = z.enum(["0", "1", "2", "3"]).nullable();
const srotasStatusSchema = z.enum(["normal", "disturbed"]);
const srotasDisturbanceTypeSchema = z.enum(SROTAS_DISTURBANCE_TYPES);

const riskFlagTypeSchema = z.enum([
  "possible_medicine_conflict",
  "red_flag_symptom",
  "incomplete_info",
  "other",
]);
const riskFlagSeveritySchema = z.enum(["info", "warning", "critical"]);

const personalHistorySchema = z.object({
  diet: z.array(z.string()),
  bowel: z.array(z.string()),
  appetite: z.array(z.string()),
  bladder: z.array(z.string()),
  sleep: z.array(z.string()),
  addiction: z.array(z.string()),
  exercise: z.array(z.string()),
  eatingOut: z.array(z.string()),
});

// Disease name -> relations mentioned; matches FamilyHistorySection's
// own "_other" free-text key convention.
const familyHistorySchema = z.record(z.string(), z.array(z.string()));

const gynecInfoSchema = z.object({
  menstrualHistory: z.array(z.string()),
  daysOfFlow: z.number().int().nullable(),
  lastMenstrualDate: z.string().nullable(),
  details: z.string().nullable(),
});

const vitalsSchema = z.object({
  bpSystolic: z.number().nullable(),
  bpDiastolic: z.number().nullable(),
  bpPosition: bpPositionSchema,
  pulse: z.number().nullable(),
  temperatureF: z.number().nullable(),
});

// Ashtavidha fields are plain strings (each has a real "Other"
// free-text escape hatch in the live UI) — not strict enums. The LLM
// prompt constrains these to the canonical option lists.
const ashtavidhaSchema = z.object({
  nadi: z.string().nullable(),
  mutra: z.string().nullable(),
  mala: z.string().nullable(),
  jivha: z.string().nullable(),
  shabda: z.string().nullable(),
  sparsha: z.string().nullable(),
  drik: z.string().nullable(),
  akruti: z.string().nullable(),
});

const srotasEntrySchema = z.object({
  status: srotasStatusSchema,
  disturbanceTypes: z.array(srotasDisturbanceTypeSchema),
  notes: z.string(),
});

// Plain string keys (not z.enum(SROTAS_KEYS)) — zod's record type
// requires every enum key present when the key schema is an enum
// (matching TS's exhaustive Record<K,V>), but srotasPariksha is
// deliberately sparse (Partial<Record<SrotasKey, SrotasEntry>>): only
// the srotas the doctor actually assessed aloud should appear.
const srotasParikshaSchema = z.record(z.string(), srotasEntrySchema);

const medicineSchema = z.object({
  medicineName: z.string(),
  quantityUnit: quantityUnitSchema,
  dosageMorning: z.number().nullable(),
  dosageAfternoon: z.number().nullable(),
  dosageEvening: z.number().nullable(),
  dosageNight: z.number().nullable(),
  anupana: z.string().nullable(),
  timing: z.string().nullable(),
  durationDays: z.number().nullable(),
  instructions: z.string().nullable(),
  matchConfidence: z.number().min(0).max(1).nullable(),
});

const treatmentSchema = z.object({
  treatmentName: z.string(),
  sessions: z.number().nullable(),
  sessionDurationMinutes: z.number().nullable(),
  durationDays: z.number().nullable(),
  oilName: z.string().nullable(),
  oilQuantityMl: z.number().nullable(),
  oilTempF: z.number().nullable(),
  strokeDirection: strokeDirectionSchema,
  bodyPart: z.string().nullable(),
  pressure: pressureSchema,
  specialFocus: z.string().nullable(),
});

const riskFlagSchema = z.object({
  type: riskFlagTypeSchema,
  description: z.string(),
  severity: riskFlagSeveritySchema,
});

const aiConfidenceSchema = z.object({
  overall: z.number().min(0).max(1),
  perField: z.record(z.string(), z.number().min(0).max(1)),
  lowConfidenceReason: z.string().nullable(),
});

const transcriptReferenceSchema = z.object({
  consultationTranscriptId: z.string(),
  segmentsUsed: z.array(z.string()),
});

/** The full real-clinical-form schema. Used both to validate an LLM's
 * raw JSON output (packages/llm-client) and to validate the
 * CreateExtractionResult request body at apps/api's boundary. */
export const clinicalExtractionSchema = z.object({
  schemaVersion: z.string(),

  // Examination tab: Case Sheet
  complaints: z.array(z.string()),
  treatmentHistory: z.array(z.string()),
  personalHistory: personalHistorySchema,
  familyHistory: familyHistorySchema.nullable(),
  gynec: gynecInfoSchema.nullable(),
  vitals: vitalsSchema,

  // Examination tab: Detailed Assessment
  ashtavidhaPariksha: ashtavidhaSchema,
  srotasPariksha: srotasParikshaSchema,
  prakrithi: z.string().nullable(),
  dosha: z.string().nullable(),
  aama: aamaSchema,
  agni: z.string().nullable(),
  ojas: z.string().nullable(),
  vyaadhi: z.string().nullable(),
  modernDiagnosis: z.string().nullable(),
  clinicalNotes: z.string(),

  // Prescription tab
  medicines: z.array(medicineSchema),
  treatments: z.array(treatmentSchema),
  labTests: z.array(z.string()),
  dietEat: z.array(z.string()),
  dietAvoid: z.array(z.string()),
  lifestyleMaintain: z.array(z.string()),
  lifestyleAvoid: z.array(z.string()),
  followUpValue: z.number().nullable(),
  followUpUnit: followUpUnitSchema,

  // Shared safety/traceability layer
  riskFlags: z.array(riskFlagSchema),
  aiConfidence: aiConfidenceSchema,
  transcriptReference: transcriptReferenceSchema,
});

export const createExtractionResultSchema = z.object({
  transcriptId: z.string().min(1),
  llmProvider: z.string().min(1),
  extraction: clinicalExtractionSchema,
});

export const enqueueExtractionJobSchema = z.object({
  transcriptId: z.string().min(1),
});

export const updateReviewDraftSchema = z.object({
  extraction: clinicalExtractionSchema,
});

export const acceptReviewDraftSchema = z.object({
  reviewedByRef: z.string().min(1),
});
