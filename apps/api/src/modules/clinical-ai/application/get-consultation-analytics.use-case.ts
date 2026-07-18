import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  ConsultationAnalytics,
  TranscriptSegment,
} from '@kal-scribe/types';
import { ConsultationAiJobRepository } from '../infrastructure/consultation-ai-job.repository';
import { ConsultationAiRunRepository } from '../infrastructure/consultation-ai-run.repository';
import { ConsultationRecordingRepository } from '../infrastructure/consultation-recording.repository';
import { ConsultationTranscriptRepository } from '../infrastructure/consultation-transcript.repository';

/** Computed on read, never stored (docs/adr/0014) — speaking/silence
 * percentages are derived from `consultation_transcripts.segments` +
 * `consultation_recordings.duration_seconds`, so they never go stale
 * when a transcript is relabeled (RelabelTranscriptSpeakersUseCase).
 * Latency/token/cost figures surface the latest run's own metadata
 * rather than aggregating across every run. */
@Injectable()
export class GetConsultationAnalyticsUseCase {
  constructor(
    private readonly recordings: ConsultationRecordingRepository,
    private readonly transcripts: ConsultationTranscriptRepository,
    private readonly runs: ConsultationAiRunRepository,
    private readonly jobs: ConsultationAiJobRepository,
  ) {}

  async execute(recordingId: string): Promise<ConsultationAnalytics> {
    const recording = await this.recordings.findById(recordingId);
    if (!recording) {
      throw new NotFoundException(`No recording with id "${recordingId}".`);
    }

    const transcript = await this.transcripts.findByRecordingId(recordingId);
    const durationSeconds = recording.durationSeconds;
    let doctorSpeakingPercent: number | null = null;
    let patientSpeakingPercent: number | null = null;
    let silencePercent: number | null = null;

    if (transcript && durationSeconds && durationSeconds > 0) {
      const segments = transcript.segments as TranscriptSegment[];
      const speakingSeconds = (speaker: string) =>
        segments
          .filter((segment) => segment.speaker === speaker)
          .reduce((sum, segment) => sum + (segment.end - segment.start), 0);

      const doctorSeconds = speakingSeconds('Doctor');
      const patientSeconds = speakingSeconds('Patient');
      doctorSpeakingPercent = (doctorSeconds / durationSeconds) * 100;
      patientSpeakingPercent = (patientSeconds / durationSeconds) * 100;
      silencePercent = Math.max(
        0,
        100 - doctorSpeakingPercent - patientSpeakingPercent,
      );
    }

    const runs = await this.runs.findAllByRecordingId(recordingId);
    const latestRun = runs[0];

    const jobs = await this.jobs.findByRecordingId(recordingId);
    const totalProcessingLatencyMs = jobs.reduce((sum, job) => {
      if (!job.startedAt || !job.completedAt) return sum;
      return sum + (job.completedAt.getTime() - job.startedAt.getTime());
    }, 0);

    return {
      recordingId,
      durationSeconds,
      doctorSpeakingPercent,
      patientSpeakingPercent,
      silencePercent,
      transcriptionLatencyMs: transcript?.transcriptionLatencyMs ?? null,
      extractionLatencyMs: latestRun?.latencyMs ?? null,
      totalTokens: latestRun?.totalTokens ?? null,
      estimatedCostUsd: latestRun?.estimatedCostUsd ?? null,
      retryCount: latestRun?.retryCount ?? null,
      hadValidationRetry: latestRun?.hadValidationRetry ?? null,
      totalProcessingLatencyMs:
        jobs.length > 0 ? totalProcessingLatencyMs : null,
    };
  }
}
