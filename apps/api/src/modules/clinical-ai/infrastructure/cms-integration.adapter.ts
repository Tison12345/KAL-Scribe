import type { ClinicalExtraction } from '@kal-scribe/types';

export interface SubmitPrescriptionDraftResult {
  cmsPrescriptionRef: string;
}

/**
 * The ONE seam this repo has into "the rest of the CMS" (architecture.md
 * §16, §17). Everything upstream of this adapter speaks this module's
 * own vocabulary (`ClinicalExtraction`); this file is the only place
 * allowed to know about CMS concepts like "Prescription".
 *
 * Only `submitPrescriptionDraft` exists so far — Milestone 8's accept
 * flow is the first caller. `fetchConsultationContext`,
 * `resolveMedicineMasterList`, `resolveTreatmentMasterList` (§17 Phase
 * 1) belong to Milestone 9 (CMS Mapping), which is what actually
 * consumes them; adding unused methods now would be speculative.
 *
 * `prescription` is the full (possibly doctor-edited) ClinicalExtraction
 * for now, not a dedicated PrescriptionMappingResult shape — that
 * deterministic mapping step (architecture.md §7 stage 11) is
 * Milestone 9's job. Passing the richer shape today costs nothing and
 * doesn't need revisiting when M9 adds the mapping step in front of
 * this same call.
 */
export interface CmsIntegrationAdapter {
  submitPrescriptionDraft(
    consultationSessionRef: string,
    extraction: ClinicalExtraction,
  ): Promise<SubmitPrescriptionDraftResult>;
}

export const CMS_INTEGRATION_ADAPTER = Symbol('CMS_INTEGRATION_ADAPTER');
