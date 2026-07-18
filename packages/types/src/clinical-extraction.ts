/**
 * Mirrors the REAL clinical form fields, verified directly against the
 * CMS's own source (C:\KAL-clinic-management-solution — `app/lib/types.ts`,
 * `ConsultationTab.tsx`, `PrescriptionTab.tsx`, and their child section
 * components), not architecture.md §11's original generic placeholder
 * schema. See docs/modules/clinical-extraction-schema.md for the full
 * field-by-field derivation and the discrepancies found while verifying
 * this against the live form.
 *
 * Field names deliberately match the CMS's own `Consultation`/
 * `Prescription` field names where the CMS's own type has one (e.g.
 * `dietEat`/`dietAvoid`, not a generic `diet.recommendations`) — this is
 * what keeps the eventual deterministic mapping step (architecture.md
 * §7 stage 11, Milestone 9) mechanical rather than a translation layer.
 *
 * Fields that exist on the CMS's `Consultation`/`Prescription` TypeScript
 * types but have no UI input anywhere in the live form (verified by
 * reading every section component, not just the type file) are
 * deliberately NOT included here: `weightKg`, `heightFt`, `heightIn`,
 * `sysGastrointestinal`, `sysRespiratory`, `sysNervous`,
 * `sysMusculoskeletal`, `sysOtherFindings`, `sara`, `ayurvedicDiagnosis`,
 * `examinationNotes`, `observations`, medicine `quantity` (the number —
 * only `quantityUnit` has a live input), treatment `notes`,
 * `treatmentType` (auto-derived client-side from the treatment name
 * text, never a field a doctor picks), and `emotionalMakeup` (genuinely
 * live in the CMS today, deliberately excluded here per an explicit
 * product decision, not an oversight).
 */
export const CLINICAL_EXTRACTION_SCHEMA_VERSION = "2.1";

/** The 15 srotas the live Srotas Pariksha section actually offers —
 * confirmed against `SrotasSection.tsx`'s own `SROTAS` list, NOT the
 * commonly-cited 16 (no `stanyavaha`). `shukravaha` only applies to
 * male patients and `artavavaha` only to female patients in the CMS UI
 * (gender-filtered there) — both keys still exist here since this
 * module doesn't know patient gender from audio alone; the CMS-side
 * mapping step is what actually applies that filter. */
export const SROTAS_KEYS = [
  "pranavaha",
  "annavaha",
  "udakavaha",
  "rasavaha",
  "raktavaha",
  "mamsavaha",
  "medovaha",
  "asthivaha",
  "majjavaha",
  "shukravaha",
  "artavavaha",
  "purishavaha",
  "mutravaha",
  "swedavaha",
  "manovaha",
] as const;
export type SrotasKey = (typeof SROTAS_KEYS)[number];

/** Exactly 4 — confirmed against `SrotasSection.tsx`'s `DISTURBANCE_TYPES`,
 * no "Other" escape hatch exists for this one. */
export const SROTAS_DISTURBANCE_TYPES = [
  "Sanga",
  "Vimarga Gamana",
  "Atipravritti",
  "Granthi",
] as const;
export type SrotasDisturbanceType = (typeof SROTAS_DISTURBANCE_TYPES)[number];

export type QuantityUnit = "mL" | "gm" | "tabs" | "tspn" | "Patch";
export type StrokeDirection = "anuloma" | "pratiloma";
export type Pressure = "high" | "medium" | "low";
export type FollowUpUnit = "days" | "weeks" | "months";
export type AamaLevel = "0" | "1" | "2" | "3";

export type RiskFlagType =
  | "possible_medicine_conflict"
  | "red_flag_symptom"
  | "incomplete_info"
  | "other";
export type RiskFlagSeverity = "info" | "warning" | "critical";

export interface PersonalHistory {
  diet: string[];
  bowel: string[];
  appetite: string[];
  bladder: string[];
  sleep: string[];
  addiction: string[];
  exercise: string[];
  eatingOut: string[];
}

/** Disease name -> relations mentioned (e.g. `{ "Diabetes": ["Father"] }`).
 * `_other` is a single-entry array holding free text, mirroring
 * `FamilyHistorySection.tsx`'s own `OTHER_KEY` convention exactly. */
export type FamilyHistory = Record<string, string[]>;

export interface GynecInfo {
  menstrualHistory: string[];
  daysOfFlow: number | null;
  lastMenstrualDate: string | null;
  details: string | null;
}

/** No `bpPosition` field — `ExaminationVitalsSection.tsx` has no input
 * for it at all; `Vitals` only covers the three vitals actually
 * collected in the live form. */
export interface Vitals {
  bpSystolic: number | null;
  bpDiastolic: number | null;
  pulse: number | null;
  temperatureF: number | null;
}

/** The 8 Ashtavidha Pariksha fields — all free-text-capable (each has
 * a real "Other" escape hatch in the live UI, so these are plain
 * strings, not strict enums), but constrained in the LLM prompt to the
 * canonical option lists below. These are physical-examination
 * findings (pulse, tongue, skin, etc.) — only fill if the doctor
 * states the finding aloud, never inferred from symptoms or context. */
export interface AshtavidhaPariksha {
  nadi: string | null;
  mutra: string | null;
  mala: string | null;
  jivha: string | null;
  shabda: string | null;
  sparsha: string | null;
  drik: string | null;
  akruti: string | null;
}

export interface SrotasEntry {
  status: "normal" | "disturbed";
  disturbanceTypes: SrotasDisturbanceType[];
  notes: string;
}

export interface ExtractedMedicine {
  medicineName: string;
  quantityUnit: QuantityUnit | null;
  dosageMorning: number | null;
  dosageAfternoon: number | null;
  dosageEvening: number | null;
  dosageNight: number | null;
  /** Free text with common presets (Warm Water, Plain Water, Ghee,
   * Milk, Honey, Jeera Water) — not a strict enum, matches the live
   * "Other" escape hatch in `MedicinesSection.tsx`. */
  anupana: string | null;
  /** Free text with common presets (Before/With/After Meals) — same
   * "Other" escape hatch reasoning as anupana. */
  timing: string | null;
  durationDays: number | null;
  instructions: string | null;
  /** Filled by the deterministic mapping step (Milestone 9), never by
   * the LLM — same clinical-safety reasoning as the original schema. */
  matchConfidence: number | null;
}

export interface ExtractedTreatment {
  treatmentName: string;
  sessions: number | null;
  sessionDurationMinutes: number | null;
  durationDays: number | null;
  oilName: string | null;
  oilQuantityMl: number | null;
  /** Categorical, NOT a Fahrenheit number despite the field name — the
   * live form (`therapy-instructions-format.ts`'s `OIL_TEMP_OPTIONS`)
   * is "Mrudu Ushna" | "Sukoshna" | "Ushnathara" | "Other: <text>". The
   * `oilTempF` name is inherited as-is from the CMS's own field name
   * (kept for mapping fidelity per this schema's own naming rule), even
   * though it no longer means Fahrenheit in practice. */
  oilTempF: string | null;
  strokeDirection: StrokeDirection | null;
  bodyPart: string | null;
  pressure: Pressure | null;
  specialFocus: string | null;
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

  // ── Examination tab: Case Sheet ──
  complaints: string[];
  treatmentHistory: string[];
  personalHistory: PersonalHistory;
  /** null if nothing was mentioned — never an empty object guessed
   * into existence. */
  familyHistory: FamilyHistory | null;
  /** null unless the patient is female AND something gynecological was
   * actually discussed — never inferred from gender alone. */
  gynec: GynecInfo | null;
  vitals: Vitals;

  // ── Examination tab: Detailed Assessment ──
  ashtavidhaPariksha: AshtavidhaPariksha;
  /** Keyed by `SrotasKey`. Only include a key if the doctor actually
   * assessed that srotas aloud — omit rather than default every key
   * to "normal" by assumption. */
  srotasPariksha: Partial<Record<SrotasKey, SrotasEntry>>;
  /** Prakrithi/Vikruta Dosha use the same 10 dosha-combination option
   * set; Agni and Ojas have their own fixed option sets — none of
   * these four have an "Other" escape hatch in the live form. */
  prakrithi: string | null;
  dosha: string | null;
  aama: AamaLevel | null;
  agni: string | null;
  ojas: string | null;
  /** Free text, no dropdown in the live form. */
  vyaadhi: string | null;
  /** Shared with the patient on the prescription — populate ONLY if
   * the doctor explicitly stated a diagnosis aloud, exactly the same
   * clinical-safety rule the original schema had for `diagnosis.stated`. */
  modernDiagnosis: string | null;
  /** Private, doctor-only reference — never shown to the patient. */
  clinicalNotes: string;

  // ── Prescription tab ──
  medicines: ExtractedMedicine[];
  treatments: ExtractedTreatment[];
  labTests: string[];
  dietEat: string[];
  dietAvoid: string[];
  lifestyleMaintain: string[];
  lifestyleAvoid: string[];
  followUpValue: number | null;
  followUpUnit: FollowUpUnit | null;

  // ── This module's own safety/traceability layer — not a CMS field ──
  riskFlags: RiskFlag[];
  aiConfidence: AiConfidence;
  transcriptReference: TranscriptReference;
}
