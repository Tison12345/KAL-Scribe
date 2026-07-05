/** Mirrors architecture.md §11 exactly — this is the contract the LLM
 * extraction step must produce. `packages/validation`'s zod schema is
 * the runtime-checked mirror of this type; Python's Pydantic models
 * (once extraction touches Python, if ever) would mirror it too
 * (architecture.md §16, §20 principle 5). */
export const CLINICAL_EXTRACTION_SCHEMA_VERSION = "1.0";

export type Onset = "gradual" | "sudden" | null;
export type Severity = "mild" | "moderate" | "severe" | null;
export type PainType = "sharp" | "dull" | "throbbing" | "burning" | "stiffness" | null;
export type SleepQuality = "good" | "poor" | "disturbed" | null;
export type StressLevel = "low" | "moderate" | "high" | null;
export type TreatmentType = "panchakarma" | "other_treatment" | null;
export type RiskFlagType =
  | "possible_medicine_conflict"
  | "red_flag_symptom"
  | "incomplete_info"
  | "other";
export type RiskFlagSeverity = "info" | "warning" | "critical";

export interface ChiefComplaint {
  text: string;
  duration: string | null;
  onset: Onset;
}

export interface PainCharacteristics {
  type: PainType;
  aggravatingFactors: string[];
  relievingFactors: string[];
}

export interface ExtractedSymptom {
  description: string;
  location: string | null;
  duration: string | null;
  severity: Severity;
  painCharacteristics: PainCharacteristics | null;
}

export interface ClinicalHistory {
  pastMedicalHistoryMentioned: string[];
  familyHistoryMentioned: string[];
  priorTreatmentsMentioned: string[];
}

export interface Diagnosis {
  /** Populated ONLY if the doctor explicitly stated a diagnosis in the
   * audio — never inferred. Null, full stop, if not said. */
  stated: string | null;
  differentialMentioned: string[];
}

export interface ExtractedMedicine {
  name: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  instructions: string | null;
  /** Filled by the deterministic mapping step (architecture.md §7
   * stage 11, Milestone 9) — the LLM always leaves this null. */
  matchConfidence: number | null;
}

export interface Diet {
  recommendations: string[];
  restrictions: string[];
}

export interface SleepInfo {
  mentioned: boolean;
  quality: SleepQuality;
  notes: string | null;
}

export interface StressInfo {
  mentioned: boolean;
  level: StressLevel;
  notes: string | null;
}

export interface Lifestyle {
  recommendations: string[];
  sleep: SleepInfo;
  stress: StressInfo;
  activityRecommendations: string[];
}

export interface ExtractedTreatment {
  name: string;
  type: TreatmentType;
  notes: string | null;
}

export interface FollowUp {
  recommended: boolean;
  timeframe: string | null;
  reason: string | null;
}

export interface SoapNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export interface RiskFlag {
  type: RiskFlagType;
  description: string;
  severity: RiskFlagSeverity;
}

export interface AiConfidence {
  overall: number;
  perField: Record<string, number>;
  lowConfidenceReason: string | null;
}

export interface TranscriptReference {
  consultationTranscriptId: string;
  segmentsUsed: string[];
}

export interface ClinicalExtraction {
  schemaVersion: string;
  chiefComplaint: ChiefComplaint;
  symptoms: ExtractedSymptom[];
  history: ClinicalHistory;
  diagnosis: Diagnosis;
  medicinesMentioned: ExtractedMedicine[];
  diet: Diet;
  lifestyle: Lifestyle;
  treatmentsMentioned: ExtractedTreatment[];
  adviceGiven: string[];
  followUp: FollowUp;
  soap: SoapNote;
  clinicalNotes: string;
  riskFlags: RiskFlag[];
  aiConfidence: AiConfidence;
  transcriptReference: TranscriptReference;
}
