import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import type {
  AcceptReviewDraftRequest,
  CompleteUploadRequest,
  CompleteUploadResponse,
  ConsultationAiJob,
  ConsultationAiResult,
  ConsultationRecording,
  ConsultationTranscript,
  CreateExtractionResultRequest,
  CreateExtractionResultResponse,
  CreateTranscriptRequest,
  CreateTranscriptResponse,
  EnqueueExtractionJobRequest,
  RequestChunkReadResponse,
  RequestChunkUploadRequest,
  RequestChunkUploadResponse,
  StartRecordingRequest,
  StartRecordingResponse,
  UpdateReviewDraftRequest,
} from '@kal-scribe/types';
import {
  acceptReviewDraftSchema,
  completeUploadSchema,
  createExtractionResultSchema,
  createTranscriptSchema,
  enqueueExtractionJobSchema,
  requestChunkUploadSchema,
  startRecordingSchema,
  updateReviewDraftSchema,
} from '@kal-scribe/validation';
import { ZodValidationPipe } from '../../../shared/zod-validation.pipe';
import { AcceptReviewDraftUseCase } from '../application/accept-review-draft.use-case';
import { CompleteUploadUseCase } from '../application/complete-upload.use-case';
import { CreateExtractionResultUseCase } from '../application/create-extraction-result.use-case';
import { CreateTranscriptUseCase } from '../application/create-transcript.use-case';
import { DiscardReviewDraftUseCase } from '../application/discard-review-draft.use-case';
import { EnqueueExtractionJobUseCase } from '../application/enqueue-extraction-job.use-case';
import { GetExtractionResultUseCase } from '../application/get-extraction-result.use-case';
import { GetRecordingUseCase } from '../application/get-recording.use-case';
import { GetTranscriptUseCase } from '../application/get-transcript.use-case';
import { ListRecordingJobsUseCase } from '../application/list-recording-jobs.use-case';
import { RelabelTranscriptSpeakersUseCase } from '../application/relabel-transcript-speakers.use-case';
import { RequestChunkReadUseCase } from '../application/request-chunk-read.use-case';
import { RequestChunkUploadUseCase } from '../application/request-chunk-upload.use-case';
import { StartRecordingUseCase } from '../application/start-recording.use-case';
import { UpdateReviewDraftUseCase } from '../application/update-review-draft.use-case';

/** Doctor-facing REST endpoints — thin, no business logic, one
 * use-case call each (architecture.md §5, §20 principle 1). */
@Controller('clinical-ai/recordings')
export class ClinicalAiController {
  constructor(
    private readonly startRecording: StartRecordingUseCase,
    private readonly requestChunkUpload: RequestChunkUploadUseCase,
    private readonly requestChunkReadUseCase: RequestChunkReadUseCase,
    private readonly completeUpload: CompleteUploadUseCase,
    private readonly createTranscript: CreateTranscriptUseCase,
    private readonly getTranscript: GetTranscriptUseCase,
    private readonly relabelTranscriptSpeakers: RelabelTranscriptSpeakersUseCase,
    private readonly enqueueExtractionJob: EnqueueExtractionJobUseCase,
    private readonly createExtractionResult: CreateExtractionResultUseCase,
    private readonly getExtractionResult: GetExtractionResultUseCase,
    private readonly updateReviewDraft: UpdateReviewDraftUseCase,
    private readonly acceptReviewDraft: AcceptReviewDraftUseCase,
    private readonly discardReviewDraft: DiscardReviewDraftUseCase,
    private readonly getRecording: GetRecordingUseCase,
    private readonly listRecordingJobs: ListRecordingJobsUseCase,
  ) {}

  @Post()
  async start(
    @Body(new ZodValidationPipe(startRecordingSchema))
    body: StartRecordingRequest,
  ): Promise<StartRecordingResponse> {
    return this.startRecording.execute(body);
  }

  @Get(':id')
  async getRecordingById(
    @Param('id') id: string,
  ): Promise<ConsultationRecording> {
    return this.getRecording.execute(id);
  }

  @Get(':id/jobs')
  async getRecordingJobs(
    @Param('id') id: string,
  ): Promise<ConsultationAiJob[]> {
    return this.listRecordingJobs.execute(id);
  }

  @Post(':id/chunks')
  async requestChunk(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(requestChunkUploadSchema))
    body: RequestChunkUploadRequest,
  ): Promise<RequestChunkUploadResponse> {
    return this.requestChunkUpload.execute(id, body);
  }

  @Get(':id/chunks/:sequence/read-url')
  async requestChunkRead(
    @Param('id') id: string,
    @Param('sequence') sequence: string,
  ): Promise<RequestChunkReadResponse> {
    return this.requestChunkReadUseCase.execute(id, Number(sequence));
  }

  @Post(':id/complete')
  async complete(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(completeUploadSchema))
    body: CompleteUploadRequest,
  ): Promise<CompleteUploadResponse> {
    return this.completeUpload.execute(id, body);
  }

  @Post(':id/transcript')
  async createRecordingTranscript(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createTranscriptSchema))
    body: CreateTranscriptRequest,
  ): Promise<CreateTranscriptResponse> {
    return this.createTranscript.execute(id, body);
  }

  @Get(':id/transcript')
  async getRecordingTranscript(
    @Param('id') id: string,
  ): Promise<ConsultationTranscript> {
    return this.getTranscript.execute(id);
  }

  @Post(':id/transcript/relabel')
  async relabelRecordingTranscriptSpeakers(
    @Param('id') id: string,
  ): Promise<ConsultationTranscript> {
    return this.relabelTranscriptSpeakers.execute(id);
  }

  @Post(':id/enqueue-extraction')
  async enqueueRecordingExtraction(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(enqueueExtractionJobSchema))
    body: EnqueueExtractionJobRequest,
  ): Promise<void> {
    return this.enqueueExtractionJob.execute(id, body.transcriptId);
  }

  @Post(':id/extraction')
  async createRecordingExtraction(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createExtractionResultSchema))
    body: CreateExtractionResultRequest,
  ): Promise<CreateExtractionResultResponse> {
    return this.createExtractionResult.execute(id, body);
  }

  @Get(':id/extraction')
  async getRecordingExtraction(
    @Param('id') id: string,
  ): Promise<ConsultationAiResult> {
    return this.getExtractionResult.execute(id);
  }

  @Patch(':id/extraction')
  async updateRecordingExtraction(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateReviewDraftSchema))
    body: UpdateReviewDraftRequest,
  ): Promise<ConsultationAiResult> {
    return this.updateReviewDraft.execute(id, body);
  }

  @Post(':id/extraction/accept')
  async acceptRecordingExtraction(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(acceptReviewDraftSchema))
    body: AcceptReviewDraftRequest,
  ): Promise<ConsultationAiResult> {
    return this.acceptReviewDraft.execute(id, body);
  }

  @Post(':id/extraction/discard')
  async discardRecordingExtraction(
    @Param('id') id: string,
  ): Promise<ConsultationAiResult> {
    return this.discardReviewDraft.execute(id);
  }
}
