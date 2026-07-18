import { Injectable, NotFoundException } from '@nestjs/common';
import type { UpdateRecordingAudioMetadataRequest } from '@kal-scribe/types';
import { ConsultationRecordingRepository } from '../infrastructure/consultation-recording.repository';

/** Populated post-stitch via ffprobe (docs/adr/0014) — informational
 * metadata for debugging transcription issues later, not load-bearing
 * for the pipeline itself. */
@Injectable()
export class UpdateRecordingAudioMetadataUseCase {
  constructor(private readonly repository: ConsultationRecordingRepository) {}

  async execute(
    recordingId: string,
    request: UpdateRecordingAudioMetadataRequest,
  ): Promise<void> {
    const recording = await this.repository.findById(recordingId);
    if (!recording) {
      throw new NotFoundException(`No recording with id "${recordingId}".`);
    }
    await this.repository.update(recordingId, {
      sampleRateHz: request.sampleRateHz,
      channels: request.channels,
      codec: request.codec,
      fileSizeBytes: request.fileSizeBytes,
    });
  }
}
