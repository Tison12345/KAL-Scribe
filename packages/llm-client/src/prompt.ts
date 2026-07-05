import type { TranscriptSegment } from "@kal-scribe/types";
import { CLINICAL_EXTRACTION_SCHEMA_VERSION } from "@kal-scribe/types";

/** Renders the transcript exactly as shown in architecture.md §9's
 * example — timestamped, speaker-labeled, plain text — since that's
 * the sole input the extraction step consumes. Segment index (not a
 * stable id — TranscriptSegment has none) doubles as the
 * `segments_used` reference the schema asks for. */
function renderTranscript(segments: TranscriptSegment[]): string {
  return segments
    .map((segment, index) => {
      const start = formatTimestamp(segment.start);
      const end = formatTimestamp(segment.end);
      return `[${index}] [${start}–${end}] ${segment.speaker}: ${segment.text}`;
    })
    .join("\n");
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/** This is architecture.md §11's schema, restated as instructions
 * rather than relying purely on a vendor's structured-output guarantee
 * — JSON-mode-class support varies per model/vendor (§10's own
 * evaluation notes this), so the actual JSON shape is validated
 * against packages/validation's zod schema after the call, with one
 * retry-with-feedback if it doesn't conform (see groq-provider.ts). */
const SCHEMA_INSTRUCTIONS = `Return ONLY a single JSON object (no markdown fences, no commentary) with exactly this shape (camelCase keys):

{
  "schemaVersion": "${CLINICAL_EXTRACTION_SCHEMA_VERSION}",
  "chiefComplaint": { "text": string, "duration": string|null, "onset": "gradual"|"sudden"|null },
  "symptoms": [ { "description": string, "location": string|null, "duration": string|null, "severity": "mild"|"moderate"|"severe"|null, "painCharacteristics": { "type": "sharp"|"dull"|"throbbing"|"burning"|"stiffness"|null, "aggravatingFactors": string[], "relievingFactors": string[] } | null } ],
  "history": { "pastMedicalHistoryMentioned": string[], "familyHistoryMentioned": string[], "priorTreatmentsMentioned": string[] },
  "diagnosis": { "stated": string|null, "differentialMentioned": string[] },
  "medicinesMentioned": [ { "name": string, "dosage": string|null, "frequency": string|null, "duration": string|null, "instructions": string|null, "matchConfidence": null } ],
  "diet": { "recommendations": string[], "restrictions": string[] },
  "lifestyle": { "recommendations": string[], "sleep": { "mentioned": boolean, "quality": "good"|"poor"|"disturbed"|null, "notes": string|null }, "stress": { "mentioned": boolean, "level": "low"|"moderate"|"high"|null, "notes": string|null }, "activityRecommendations": string[] },
  "treatmentsMentioned": [ { "name": string, "type": "panchakarma"|"other_treatment"|null, "notes": string|null } ],
  "adviceGiven": string[],
  "followUp": { "recommended": boolean, "timeframe": string|null, "reason": string|null },
  "soap": { "subjective": string, "objective": string, "assessment": string, "plan": string },
  "clinicalNotes": string,
  "riskFlags": [ { "type": "possible_medicine_conflict"|"red_flag_symptom"|"incomplete_info"|"other", "description": string, "severity": "info"|"warning"|"critical" } ],
  "aiConfidence": { "overall": number (0-1), "perField": { "chiefComplaint": number, "diagnosis": number, "medicinesMentioned": number, "soap": number }, "lowConfidenceReason": string|null },
  "transcriptReference": { "consultationTranscriptId": string, "segmentsUsed": string[] }
}

Critical rules, in order of importance:
1. "diagnosis.stated" is a clinical-safety field: populate it ONLY if the doctor explicitly stated a diagnosis out loud in this transcript. If no diagnosis was explicitly stated, it MUST be null — never infer or guess one.
2. "medicinesMentioned[].matchConfidence" MUST always be null — it is filled by a separate deterministic step, never by you.
3. Every array field defaults to an empty array (never null) when nothing relevant was said; every nullable string/enum field is null (never an empty string) when not stated.
4. "transcriptReference.segmentsUsed" lists the bracketed segment index numbers (as strings, e.g. "0", "3") that this extraction actually drew from.
5. Base every field strictly on what was actually said in the transcript below — do not invent facts, do not pull in outside medical knowledge beyond understanding the terms used.`;

export function buildExtractionPrompt(segments: TranscriptSegment[]): {
  system: string;
  user: string;
} {
  const system =
    "You are a clinical documentation assistant extracting structured data from a doctor-patient consultation transcript for an Ayurvedic clinic. " +
    "You never fabricate clinical facts, and you follow the requested JSON shape exactly. " +
    SCHEMA_INSTRUCTIONS;

  const user = `Transcript (speaker-labeled, [segment index] [start–end]):\n\n${renderTranscript(segments)}\n\nExtract the JSON now.`;

  return { system, user };
}
