import { Body, Controller, Param, Post } from '@nestjs/common';
import type {
  CompleteUploadRequest,
  CompleteUploadResponse,
  RequestChunkUploadRequest,
  RequestChunkUploadResponse,
  StartRecordingRequest,
  StartRecordingResponse,
} from '@kal-scribe/types';
import {
  completeUploadSchema,
  requestChunkUploadSchema,
  startRecordingSchema,
} from '@kal-scribe/validation';
import { ZodValidationPipe } from '../../../shared/zod-validation.pipe';
import { CompleteUploadUseCase } from '../application/complete-upload.use-case';
import { RequestChunkUploadUseCase } from '../application/request-chunk-upload.use-case';
import { StartRecordingUseCase } from '../application/start-recording.use-case';

/** Doctor-facing REST endpoints — thin, no business logic, one
 * use-case call each (architecture.md §5, §20 principle 1). */
@Controller('clinical-ai/recordings')
export class ClinicalAiController {
  constructor(
    private readonly startRecording: StartRecordingUseCase,
    private readonly requestChunkUpload: RequestChunkUploadUseCase,
    private readonly completeUpload: CompleteUploadUseCase,
  ) {}

  @Post()
  async start(
    @Body(new ZodValidationPipe(startRecordingSchema))
    body: StartRecordingRequest,
  ): Promise<StartRecordingResponse> {
    return this.startRecording.execute(body);
  }

  @Post(':id/chunks')
  async requestChunk(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(requestChunkUploadSchema))
    body: RequestChunkUploadRequest,
  ): Promise<RequestChunkUploadResponse> {
    return this.requestChunkUpload.execute(id, body);
  }

  @Post(':id/complete')
  async complete(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(completeUploadSchema))
    body: CompleteUploadRequest,
  ): Promise<CompleteUploadResponse> {
    return this.completeUpload.execute(id, body);
  }
}
