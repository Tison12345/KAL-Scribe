import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { ClinicalExtraction } from '@kal-scribe/types';
import type {
  CmsIntegrationAdapter,
  SubmitPrescriptionDraftResult,
} from './cms-integration.adapter';

/**
 * Phase 1 stand-in (architecture.md §17): logs the call and returns a
 * realistic-shaped fake ref instead of actually creating anything in a
 * real CMS — this repo has no CMS to call yet. Swapped for a real
 * implementation calling Repo B's actual Consultations/Prescriptions
 * modules at Phase 3/4 integration; nothing upstream of this class
 * changes when that happens.
 */
@Injectable()
export class StubCmsIntegrationAdapter implements CmsIntegrationAdapter {
  private readonly logger = new Logger(StubCmsIntegrationAdapter.name);

  async submitPrescriptionDraft(
    consultationSessionRef: string,
    extraction: ClinicalExtraction,
  ): Promise<SubmitPrescriptionDraftResult> {
    const cmsPrescriptionRef = `stub-prescription-${randomUUID()}`;
    this.logger.log(
      `[stub cms-integration] submitPrescriptionDraft(sessionRef="${consultationSessionRef}") -> ${cmsPrescriptionRef} ` +
        `(${extraction.medicinesMentioned.length} medicine(s), ${extraction.treatmentsMentioned.length} treatment(s))`,
    );
    return Promise.resolve({ cmsPrescriptionRef });
  }
}
