import { Injectable } from '@nestjs/common';
import type {
  CreateTranscriptRequest,
  CreateTranscriptResponse,
} from '@kal-scribe/types';
import { labelDoctorAndPatient } from '../domain/doctor-patient-labeling.engine';
import { ConsultationTranscriptRepository } from '../infrastructure/consultation-transcript.repository';

/** Persists the transcript once the worker has it (architecture.md
 * §7 step 7) — the durable, human-readable artifact and the input to
 * every downstream LLM step. Applies the Doctor/Patient labeling
 * heuristic before storing, so every reader downstream sees "Doctor"/
 * "Patient", never raw diarization cluster IDs. */
@Injectable()
export class CreateTranscriptUseCase {
  constructor(private readonly repository: ConsultationTranscriptRepository) {}

  async execute(
    recordingId: string,
    request: CreateTranscriptRequest,
  ): Promise<CreateTranscriptResponse> {
    const labeledSegments = labelDoctorAndPatient(request.segments);

    const row = await this.repository.create({
      recordingId,
      segments: labeledSegments,
      sttProvider: request.sttProvider,
      diarizationProvider: request.diarizationProvider,
      languageDetected: request.languageDetected,
      isMultilingual: request.isMultilingual ?? null,
      isCodeSwitched: request.isCodeSwitched ?? null,
      rawResponse: request.rawResponse ?? null,
      transcriptionLatencyMs: request.transcriptionLatencyMs ?? null,
    });

    return { transcriptId: row.id };
  }
}
