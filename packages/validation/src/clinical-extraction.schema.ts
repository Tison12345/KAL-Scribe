import { z } from "zod";

/** Runtime-checked mirror of architecture.md §11 / packages/types'
 * ClinicalExtraction — this is the contract validated at every
 * boundary the LLM's JSON output crosses (architecture.md §20
 * principle 10): once past this schema, the rest of the system trusts
 * the shape. */

const onsetSchema = z.enum(["gradual", "sudden"]).nullable();
const severitySchema = z.enum(["mild", "moderate", "severe"]).nullable();
const painTypeSchema = z
  .enum(["sharp", "dull", "throbbing", "burning", "stiffness"])
  .nullable();
const sleepQualitySchema = z.enum(["good", "poor", "disturbed"]).nullable();
const stressLevelSchema = z.enum(["low", "moderate", "high"]).nullable();
const treatmentTypeSchema = z
  .enum(["panchakarma", "other_treatment"])
  .nullable();
const riskFlagTypeSchema = z.enum([
  "possible_medicine_conflict",
  "red_flag_symptom",
  "incomplete_info",
  "other",
]);
const riskFlagSeveritySchema = z.enum(["info", "warning", "critical"]);

const chiefComplaintSchema = z.object({
  text: z.string(),
  duration: z.string().nullable(),
  onset: onsetSchema,
});

const painCharacteristicsSchema = z.object({
  type: painTypeSchema,
  aggravatingFactors: z.array(z.string()),
  relievingFactors: z.array(z.string()),
});

const symptomSchema = z.object({
  description: z.string(),
  location: z.string().nullable(),
  duration: z.string().nullable(),
  severity: severitySchema,
  painCharacteristics: painCharacteristicsSchema.nullable(),
});

const clinicalHistorySchema = z.object({
  pastMedicalHistoryMentioned: z.array(z.string()),
  familyHistoryMentioned: z.array(z.string()),
  priorTreatmentsMentioned: z.array(z.string()),
});

const diagnosisSchema = z.object({
  stated: z.string().nullable(),
  differentialMentioned: z.array(z.string()),
});

const medicineSchema = z.object({
  name: z.string(),
  dosage: z.string().nullable(),
  frequency: z.string().nullable(),
  duration: z.string().nullable(),
  instructions: z.string().nullable(),
  matchConfidence: z.number().min(0).max(1).nullable(),
});

const dietSchema = z.object({
  recommendations: z.array(z.string()),
  restrictions: z.array(z.string()),
});

const sleepInfoSchema = z.object({
  mentioned: z.boolean(),
  quality: sleepQualitySchema,
  notes: z.string().nullable(),
});

const stressInfoSchema = z.object({
  mentioned: z.boolean(),
  level: stressLevelSchema,
  notes: z.string().nullable(),
});

const lifestyleSchema = z.object({
  recommendations: z.array(z.string()),
  sleep: sleepInfoSchema,
  stress: stressInfoSchema,
  activityRecommendations: z.array(z.string()),
});

const treatmentSchema = z.object({
  name: z.string(),
  type: treatmentTypeSchema,
  notes: z.string().nullable(),
});

const followUpSchema = z.object({
  recommended: z.boolean(),
  timeframe: z.string().nullable(),
  reason: z.string().nullable(),
});

const soapSchema = z.object({
  subjective: z.string(),
  objective: z.string(),
  assessment: z.string(),
  plan: z.string(),
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

/** The full §11 schema. Used both to validate an LLM's raw JSON output
 * (packages/llm-client) and to validate the CreateExtractionResult
 * request body at apps/api's boundary. */
export const clinicalExtractionSchema = z.object({
  schemaVersion: z.string(),
  chiefComplaint: chiefComplaintSchema,
  symptoms: z.array(symptomSchema),
  history: clinicalHistorySchema,
  diagnosis: diagnosisSchema,
  medicinesMentioned: z.array(medicineSchema),
  diet: dietSchema,
  lifestyle: lifestyleSchema,
  treatmentsMentioned: z.array(treatmentSchema),
  adviceGiven: z.array(z.string()),
  followUp: followUpSchema,
  soap: soapSchema,
  clinicalNotes: z.string(),
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
