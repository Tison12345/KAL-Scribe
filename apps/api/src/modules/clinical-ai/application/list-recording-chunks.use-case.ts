import { Injectable } from '@nestjs/common';
import type { RecordingChunk } from '@kal-scribe/types';
import { ConsultationRecordingChunkRepository } from '../infrastructure/consultation-recording-chunk.repository';

/** Audit finding E2 — confirmed-uploaded chunks for one recording,
 * sequence-ordered. Not wired into a resume-on-reload UX yet (that's a
 * separate frontend follow-up); this is the server-side state that UX
 * would read from. */
@Injectable()
export class ListRecordingChunksUseCase {
  constructor(private readonly chunks: ConsultationRecordingChunkRepository) {}

  async execute(recordingId: string): Promise<RecordingChunk[]> {
    const rows = await this.chunks.findByRecordingId(recordingId);
    return rows.map((row) => ({
      sequence: row.sequence,
      uploadedAt: row.uploadedAt.toISOString(),
    }));
  }
}
