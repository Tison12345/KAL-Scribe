import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import type {
  AcceptReviewDraftRequest,
  CompleteUploadRequest,
  CompleteUploadResponse,
  ConsultationAiJob,
  ConsultationAiRun,
  ConsultationAnalytics,
  ConsultationRecording,
  ConsultationTranscript,
  CreateExtractionResultRequest,
  CreateExtractionResultResponse,
  CreateTranscriptRequest,
  CreateTranscriptResponse,
  DuplicateTranscriptResponse,
  EnqueueExtractionJobRequest,
  RecordingChunk,
  RequestChunkReadResponse,
  RequestChunkUploadRequest,
  RequestChunkUploadResponse,
  ReviewDraft,
  StartRecordingRequest,
  StartRecordingResponse,
  UpdateRecordingAudioMetadataRequest,
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
  updateRecordingAudioMetadataSchema,
  updateReviewDraftSchema,
} from '@kal-scribe/validation';
import { ZodValidationPipe } from '../../../shared/zod-validation.pipe';
import { AcceptReviewDraftUseCase } from '../application/accept-review-draft.use-case';
import { CompleteUploadUseCase } from '../application/complete-upload.use-case';
import { ConfirmChunkUploadUseCase } from '../application/confirm-chunk-upload.use-case';
import { CreateExtractionResultUseCase } from '../application/create-extraction-result.use-case';
import { CreateTranscriptUseCase } from '../application/create-transcript.use-case';
import { DiscardReviewDraftUseCase } from '../application/discard-review-draft.use-case';
import { EnqueueExtractionJobUseCase } from '../application/enqueue-extraction-job.use-case';
import { FindDuplicateTranscriptUseCase } from '../application/find-duplicate-transcript.use-case';
import { GetConsultationAnalyticsUseCase } from '../application/get-consultation-analytics.use-case';
import { GetConsultationRunUseCase } from '../application/get-consultation-run.use-case';
import { GetExtractionResultUseCase } from '../application/get-extraction-result.use-case';
import { GetRecordingUseCase } from '../application/get-recording.use-case';
import { GetTranscriptUseCase } from '../application/get-transcript.use-case';
import { ListConsultationRunsUseCase } from '../application/list-consultation-runs.use-case';
import { ListRecordingChunksUseCase } from '../application/list-recording-chunks.use-case';
import { ListRecordingJobsUseCase } from '../application/list-recording-jobs.use-case';
import { RelabelTranscriptSpeakersUseCase } from '../application/relabel-transcript-speakers.use-case';
import { RequestChunkReadUseCase } from '../application/request-chunk-read.use-case';
import { RequestChunkUploadUseCase } from '../application/request-chunk-upload.use-case';
import { StartRecordingUseCase } from '../application/start-recording.use-case';
import { UpdateRecordingAudioMetadataUseCase } from '../application/update-recording-audio-metadata.use-case';
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
    private readonly updateRecordingAudioMetadata: UpdateRecordingAudioMetadataUseCase,
    private readonly listConsultationRuns: ListConsultationRunsUseCase,
    private readonly getConsultationRun: GetConsultationRunUseCase,
    private readonly getConsultationAnalytics: GetConsultationAnalyticsUseCase,
    private readonly findDuplicateTranscriptUseCase: FindDuplicateTranscriptUseCase,
    private readonly confirmChunkUploadUseCase: ConfirmChunkUploadUseCase,
    private readonly listRecordingChunksUseCase: ListRecordingChunksUseCase,
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

  @Patch(':id/audio-metadata')
  async updateAudioMetadata(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateRecordingAudioMetadataSchema))
    body: UpdateRecordingAudioMetadataRequest,
  ): Promise<void> {
    return this.updateRecordingAudioMetadata.execute(id, body);
  }

  @Get(':id/duplicate-transcript')
  async findDuplicateTranscript(
    @Param('id') id: string,
    @Query('audioHash') audioHash: string,
  ): Promise<DuplicateTranscriptResponse> {
    return this.findDuplicateTranscriptUseCase.execute(id, audioHash);
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

  @Post(':id/chunks/:sequence/confirm')
  async confirmChunkUpload(
    @Param('id') id: string,
    @Param('sequence') sequence: string,
  ): Promise<void> {
    return this.confirmChunkUploadUseCase.execute(id, Number(sequence));
  }

  @Get(':id/chunks')
  async listRecordingChunks(@Param('id') id: string): Promise<RecordingChunk[]> {
    return this.listRecordingChunksUseCase.execute(id);
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
    return this.enqueueExtractionJob.execute(
      id,
      body.transcriptId,
      body.requestedProvider,
    );
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
  async getRecordingExtraction(@Param('id') id: string): Promise<ReviewDraft> {
    return this.getExtractionResult.execute(id);
  }

  @Patch(':id/extraction')
  async updateRecordingExtraction(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateReviewDraftSchema))
    body: UpdateReviewDraftRequest,
  ): Promise<ReviewDraft> {
    return this.updateReviewDraft.execute(id, body);
  }

  @Post(':id/extraction/accept')
  async acceptRecordingExtraction(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(acceptReviewDraftSchema))
    body: AcceptReviewDraftRequest,
  ): Promise<ReviewDraft> {
    return this.acceptReviewDraft.execute(id, body);
  }

  @Post(':id/extraction/discard')
  async discardRecordingExtraction(
    @Param('id') id: string,
  ): Promise<ReviewDraft> {
    return this.discardReviewDraft.execute(id);
  }

  @Get(':id/runs')
  async listRecordingRuns(
    @Param('id') id: string,
  ): Promise<ConsultationAiRun[]> {
    return this.listConsultationRuns.execute(id);
  }

  @Get(':id/runs/:runId')
  async getRecordingRun(
    @Param('id') id: string,
    @Param('runId') runId: string,
  ): Promise<ConsultationAiRun> {
    return this.getConsultationRun.execute(id, runId);
  }

  @Get(':id/analytics')
  async getRecordingAnalytics(
    @Param('id') id: string,
  ): Promise<ConsultationAnalytics> {
    return this.getConsultationAnalytics.execute(id);
  }
}
