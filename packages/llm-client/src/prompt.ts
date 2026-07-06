import type { TranscriptSegment } from "@kal-scribe/types";
import { CLINICAL_EXTRACTION_SCHEMA_VERSION, SROTAS_KEYS } from "@kal-scribe/types";

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

/**
 * This mirrors the REAL clinical form fields, verified against the
 * CMS's own source (see packages/types/src/clinical-extraction.ts's
 * header comment and docs/modules/clinical-extraction-schema.md) —
 * NOT architecture.md §11's original generic placeholder schema.
 *
 * Restated as plain-English instructions rather than relying purely on
 * a vendor's structured-output guarantee — JSON-mode-class support
 * varies per model/vendor (architecture.md §10's own evaluation notes
 * this), so the actual JSON shape is validated against
 * packages/validation's zod schema after the call, with one
 * retry-with-feedback if it doesn't conform (see groq-provider.ts).
 */
const SCHEMA_INSTRUCTIONS = `Return ONLY a single JSON object (no markdown fences, no commentary) with exactly this shape (camelCase keys):

{
  "schemaVersion": "${CLINICAL_EXTRACTION_SCHEMA_VERSION}",

  "complaints": string[],
  "treatmentHistory": string[],
  "personalHistory": {
    "diet": string[], "bowel": string[], "appetite": string[], "bladder": string[],
    "sleep": string[], "addiction": string[], "exercise": string[], "eatingOut": string[]
  },
  "familyHistory": { "<disease name>": string[] /* relations, e.g. "Father" */ } | null,
  "gynec": { "menstrualHistory": string[], "daysOfFlow": number|null, "lastMenstrualDate": string|null /* YYYY-MM-DD */, "details": string|null } | null,
  "vitals": { "bpSystolic": number|null, "bpDiastolic": number|null, "bpPosition": "Sitting"|"Standing"|"Lying"|null, "pulse": number|null, "temperatureF": number|null },

  "ashtavidhaPariksha": { "nadi": string|null, "mutra": string|null, "mala": string|null, "jivha": string|null, "shabda": string|null, "sparsha": string|null, "drik": string|null, "akruti": string|null },
  "srotasPariksha": { "<srotas key>": { "status": "normal"|"disturbed", "disturbanceTypes": string[], "notes": string } },
  "prakrithi": string|null,
  "dosha": string|null,
  "aama": "0"|"1"|"2"|"3"|null,
  "agni": string|null,
  "ojas": string|null,
  "vyaadhi": string|null,
  "modernDiagnosis": string|null,
  "clinicalNotes": string,

  "medicines": [ { "medicineName": string, "quantityUnit": "mL"|"gm"|"tabs"|"tspn"|"Patch"|null, "dosageMorning": number|null, "dosageAfternoon": number|null, "dosageEvening": number|null, "dosageNight": number|null, "anupana": string|null, "timing": string|null, "durationDays": number|null, "instructions": string|null, "matchConfidence": null } ],
  "treatments": [ { "treatmentName": string, "sessions": number|null, "sessionDurationMinutes": number|null, "durationDays": number|null, "oilName": string|null, "oilQuantityMl": number|null, "oilTempF": number|null, "strokeDirection": "anuloma"|"pratiloma"|null, "bodyPart": string|null, "pressure": "high"|"medium"|"low"|null, "specialFocus": string|null } ],
  "labTests": string[],
  "dietEat": string[],
  "dietAvoid": string[],
  "lifestyleMaintain": string[],
  "lifestyleAvoid": string[],
  "followUpValue": number|null,
  "followUpUnit": "days"|"weeks"|"months"|null,

  "riskFlags": [ { "type": "possible_medicine_conflict"|"red_flag_symptom"|"incomplete_info"|"other", "description": string, "severity": "info"|"warning"|"critical" } ],
  "aiConfidence": { "overall": number (0-1), "perField": { "complaints": number, "modernDiagnosis": number, "medicines": number, "ashtavidhaPariksha": number }, "lowConfidenceReason": string|null },
  "transcriptReference": { "consultationTranscriptId": string, "segmentsUsed": string[] }
}

Canonical option lists (use these exact strings when the field applies; if the patient/doctor clearly meant something not on this list, use your best free-text description instead — do not force a bad fit):
- nadi / prakrithi / dosha: "Vata", "Vata Pitta", "Vata Kapha", "Pitta", "Pitta Vata", "Pitta Kapha", "Kapha", "Kapha Vata", "Kapha Pitta", "Vata Pitta Kapha"
- mutra / drik: "Prakritam (Normal)", "Vikritam (Abnormal)"
- mala: "Samyak Mala Pravruti (Regular)", "Mala Sanga / Vibhanda (Constipated)", "Drava Mala Pravruti (Loose)", "Vishama Mala Pravruti (Irregular)"
- jivha: "Lipta (Coated)", "Nirlipta (Non-coated)", "Sputana (Cracked)"
- shabda: "Prakritam (Normal)", "Vishama (Irregular)", "Durbala (Weak)"
- sparsha: "Ushna (Hot)", "Sheeta (Cold)", "Sushka (Dry)", "Ruksha (Rough)", "Sukshma (Sensitive)", "Snigdha (Oily)"
- akruti: "Sthula (Obese)", "Madhyama (Medium)", "Krisha (Lean)"
- agni (fixed set, no free text): "Sama (Normal)", "Manda (Low)", "Vishama (Variable)", "Tikshna (Sharp)"
- ojas (fixed set, no free text): "Pravara (Optimal)", "Ojo Kshayam (Depleted)", "Ojo Vyapat (Vitiated)", "Ojo Visramsa (Displaced)"
- srotas keys (only include a key if that srotas was actually assessed aloud): ${SROTAS_KEYS.join(", ")}
- srotas disturbanceTypes (only when status is "disturbed"): "Sanga", "Vimarga Gamana", "Atipravritti", "Granthi"
- personalHistory.bowel: "Normal", "Hard/Constipated", "Soft/Loose", "Irregular"
- personalHistory.bladder (can be multiple): "Normal (4–6×/day)", "Frequent (7+/day)", "Reduced [Quantity]", "Burning", "Painful", "Nocturnal"
- personalHistory.sleep: "Sound (7-8 hrs)", "Adequate but Light", "Insufficient (<6 hrs)", "Disturbed/Interrupted", "Insomnia", "Excessive (>9 hrs)"
- personalHistory.appetite: "Normal", "Low", "Variable", "Sharp"
- personalHistory.diet: "Vegetarian", "Eggetarian", "Non-Vegetarian", "Vegan", "Jain Vegetarian"
- personalHistory.eatingOut: "Rarely/Never", "One meal a week", "3-4 meals a week", "4+ meals a week"
- personalHistory.addiction (can be multiple): "None", "Tobacco (smoking)", "Tobacco (chewing)", "Vaping", "Alcohol — Occasional", "Alcohol — Regular", "Caffeine (excessive)", "Betel nut/Paan"
- personalHistory.exercise: "Sedentary: little or no exercise", "Yoga/Pranayama Only", "Exercise 1-3 times/week", "Exercise 4-5 times/week", "Daily exercise or intense exercise 3-4 times/week", "Intense exercise 6-7 times/week", "Very intense exercise daily, or physical job"
- gynec.menstrualHistory (can be multiple): "Regular", "Irregular", "Scanty", "Heavy", "Clotty", "Painful", "Perimenopause", "Menopause", "Hysterectomy", "Pregnant", "Postpartum/Breastfeeding", "Not Started"
- familyHistory disease names: ONLY these exact 7 keys are ever shown in the review UI: "Diabetes", "Thyroid", "Blood Pressure", "Heart Diseases", "Arthritis", "Respiratory Issues", "Cancer". Do NOT invent other disease names as keys — any family history that doesn't fit one of these 7 (e.g. "acid reflux", "migraines") goes into a single special key "_other" instead, as one sentence describing it (e.g. "familyHistory": { "_other": ["Father has acid reflux"] }).
- familyHistory relations (values under the 7 canonical disease keys): "Father", "Mother", "Siblings", "Grandparents"
- medicines[].quantityUnit (fixed set, no free text): "mL", "gm", "tabs", "tspn", "Patch"
- medicines[].anupana common values (free text also allowed): "Warm Water", "Plain Water", "Jeera Water (Warm)", "Ghee", "Milk", "Honey"
- medicines[].timing common values (free text also allowed): "Before Meals", "With Meals", "After Meals"
- treatments[].strokeDirection (fixed set, no free text): "anuloma" (with the hair), "pratiloma" (against the hair)
- treatments[].pressure (fixed set, no free text): "high", "medium", "low"
- treatments[].oilName common values (free text also allowed): "Dhanwantharam Tailam", "Mahanarayana Tailam", "Sahacharadi Tailam", "Karpasasthyadi Tailam", "Murivenna", "Dhanwantharam Kuzhambu", "Mahamasha Tailam", "Pinda Tailam", "Eladi Tailam", "Nalpamaradi Tailam", "Winsoria Oil"

Critical rules, in order of importance:
1. Physical-examination findings — "ashtavidhaPariksha" (all 8 fields), "srotasPariksha", "prakrithi", "dosha", "aama", "agni", "ojas" — are things ONLY the doctor can observe by physically examining the patient (pulse, tongue, skin, pressing on the abdomen, etc.). Populate these ONLY if the doctor states the finding out loud in the transcript (e.g. "pulse shows Vata Pitta", "tongue is coated", "abdomen srotas — normal"). NEVER infer, guess, or derive these from the patient's symptoms, complaints, or general context — a patient describing digestive symptoms does NOT mean you may fill in agni or udakavaha srotas unless the doctor actually states an examination finding for it. Leave the field null (or omit the srotas key entirely) if it wasn't stated.
2. "modernDiagnosis" is a clinical-safety field: populate it ONLY if the doctor explicitly stated a diagnosis out loud. If no diagnosis was explicitly stated, it MUST be null — never infer or guess one.
3. "medicines[].matchConfidence" MUST always be null — it is filled by a separate deterministic step, never by you.
4. "gynec" MUST be null unless the patient is clearly female AND something gynecological was actually discussed in the transcript — never fill this in just because gender was mentioned, and never guess gender from voice.
5. "familyHistory" MUST be null if no family medical history was mentioned at all.
6. Every array field defaults to an empty array (never null) when nothing relevant was said; every nullable string/enum field is null (never an empty string) when not stated.
7. "transcriptReference.segmentsUsed" lists the bracketed segment index numbers (as strings, e.g. "0", "3") that this extraction actually drew from.
8. Base every field strictly on what was actually said in the transcript below — do not invent facts, do not pull in outside medical knowledge beyond understanding the terms used.`;

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
