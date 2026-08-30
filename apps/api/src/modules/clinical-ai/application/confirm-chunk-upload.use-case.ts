import { Injectable } from '@nestjs/common';
import { ConsultationRecordingChunkRepository } from '../infrastructure/consultation-recording-chunk.repository';

/** Audit finding E2 — the browser calls this right after a chunk's
 * signed-URL PUT actually succeeds (not when the URL is merely
 * requested), giving chunk state a real server-side row instead of
 * being purely implicit (a signed read URL 404ing or not). */
@Injectable()
export class ConfirmChunkUploadUseCase {
  constructor(private readonly chunks: ConsultationRecordingChunkRepository) {}

  async execute(recordingId: string, sequence: number): Promise<void> {
    await this.chunks.confirm(recordingId, sequence);
  }
}
