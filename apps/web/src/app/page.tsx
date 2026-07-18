"use client";

import { Suspense, useEffect, useId } from "react";
import { useSearchParams } from "next/navigation";
import {
  ClinicalSessionProvider,
  useClinicalSession,
} from "@/features/clinical-ai/providers/ClinicalSessionProvider";
import { ConsentConfirmation } from "@/features/clinical-ai/components/ConsentConfirmation";
import { PipelineProgressTracker } from "@/features/clinical-ai/components/PipelineProgressTracker";
import { RecordButton } from "@/features/clinical-ai/components/RecordButton";
import { ReviewDraftPanel } from "@/features/clinical-ai/components/ReviewDraftPanel";
import { TranscriptViewer } from "@/features/clinical-ai/components/TranscriptViewer";
import { UploadProgress } from "@/features/clinical-ai/components/UploadProgress";
import { useAudioRecorder } from "@/features/clinical-ai/hooks/useAudioRecorder";
import { usePipelineProgress } from "@/features/clinical-ai/hooks/usePipelineProgress";
import { useReviewDraft } from "@/features/clinical-ai/hooks/useReviewDraft";
import { useTranscript } from "@/features/clinical-ai/hooks/useTranscript";
import { useUploadSession } from "@/features/clinical-ai/hooks/useUploadSession";

// No auth/identity exists yet in this standalone repo (architecture.md
// §17 Phase 1 — stub what the real CMS would provide until Phase 3/4).
const DEV_DOCTOR_ID_REF = "dev-doctor";

/**
 * Milestone 2/3 dev preview: hosts the recording + upload feature
 * standalone, against a locally generated session ref, until this repo
 * has a real consultation screen to mount into.
 */
function RecordingSession() {
  const { sessionRef, consentConfirmed } = useClinicalSession();
  const recorder = useAudioRecorder();
  const uploadSession = useUploadSession(recorder.chunks);
  const transcript = useTranscript(uploadSession.recordingId);
  const reviewDraft = useReviewDraft(uploadSession.recordingId);
  const pipelineProgress = usePipelineProgress(uploadSession.recordingId);

  const handleStart = () => {
    void uploadSession.begin({
      consultationSessionRef: sessionRef,
      doctorIdRef: DEV_DOCTOR_ID_REF,
    });
    void recorder.start();
  };

  // Once recording has stopped and every captured chunk has finished
  // uploading, finalize the recording server-side.
  useEffect(() => {
    if (recorder.status !== "stopped") return;
    if (uploadSession.status !== "active") return;
    if (recorder.chunks.length === 0) return;

    const allUploaded = recorder.chunks.every((chunk) =>
      uploadSession.chunkUploads.some(
        (upload) =>
          upload.sequence === chunk.sequence && upload.status === "uploaded",
      ),
    );
    if (allUploaded) {
      void uploadSession.complete(recorder.durationSeconds);
    }
  }, [
    recorder.status,
    recorder.chunks,
    recorder.durationSeconds,
    uploadSession,
  ]);

  return (
    <div className="space-y-8">
      <ConsentConfirmation />
      <RecordButton
        status={recorder.status}
        error={recorder.error}
        durationSeconds={recorder.durationSeconds}
        audioLevel={recorder.audioLevel}
        disabled={!consentConfirmed}
        onStart={handleStart}
        onPause={recorder.pause}
        onResume={recorder.resume}
        onStop={recorder.stop}
      />
      <UploadProgress
        status={uploadSession.status}
        error={uploadSession.error}
        chunkUploads={uploadSession.chunkUploads}
        onRetryChunk={uploadSession.retryChunk}
      />
      {uploadSession.status === "completed" && uploadSession.recordingId && (
        <>
          <ReopenLink recordingId={uploadSession.recordingId} />
          <PipelineProgressTracker
            stage={pipelineProgress.stage}
            failedJobType={pipelineProgress.failedJobType}
            errorMessage={pipelineProgress.errorMessage}
            timing={pipelineProgress.timing}
          />
          <TranscriptViewer
            transcript={transcript.transcript}
            isPolling={transcript.isPolling}
            error={transcript.error}
            onSwapSpeakers={() => void transcript.swapSpeakers()}
          />
          <ReviewDraftPanel
            result={reviewDraft.result}
            draft={reviewDraft.draft}
            isPolling={reviewDraft.isPolling}
            isSaving={reviewDraft.isSaving}
            error={reviewDraft.error}
            onChange={reviewDraft.updateDraft}
            onAccept={() => void reviewDraft.accept()}
            onDiscard={() => void reviewDraft.discard()}
          />
        </>
      )}
    </div>
  );
}

/** This dev-preview page has no persistence across a full reload — a
 * refresh starts a brand-new session (useId) with no memory of the
 * prior recordingId. Rather than build a real consultation-history
 * screen (out of scope for this standalone dev preview), surface a
 * copyable `?recordingId=` link the moment one exists, so a refresh or
 * closed tab doesn't strand access to an already-processed
 * transcript/draft. */
function ReopenLink({ recordingId }: { recordingId: string }) {
  const reopenPath = `/?recordingId=${recordingId}`;
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-[var(--color-surface-container-low)] px-5 py-3 text-[11px] font-medium text-[var(--color-on-surface-variant)]">
      <span className="material-symbols-outlined text-sm text-[var(--color-primary)]">link</span>
      Bookmark this to reopen after a refresh:
      <a href={reopenPath} className="font-bold text-[var(--color-primary)] hover:underline">
        {reopenPath}
      </a>
    </div>
  );
}

/** Reopens an already-processed recording by id (from `?recordingId=`)
 * without going through the record/upload flow again — the same
 * TranscriptViewer/ReviewDraftPanel, just fed a known recordingId
 * directly instead of one just-produced by useUploadSession. */
function ReopenedRecording({ recordingId }: { recordingId: string }) {
  const transcript = useTranscript(recordingId);
  const reviewDraft = useReviewDraft(recordingId);
  const pipelineProgress = usePipelineProgress(recordingId);

  return (
    <div className="space-y-8">
      <PipelineProgressTracker
        stage={pipelineProgress.stage}
        failedJobType={pipelineProgress.failedJobType}
        errorMessage={pipelineProgress.errorMessage}
        timing={pipelineProgress.timing}
      />
      <TranscriptViewer
        transcript={transcript.transcript}
        isPolling={transcript.isPolling}
        error={transcript.error}
        onSwapSpeakers={() => void transcript.swapSpeakers()}
      />
      <ReviewDraftPanel
        result={reviewDraft.result}
        draft={reviewDraft.draft}
        isPolling={reviewDraft.isPolling}
        isSaving={reviewDraft.isSaving}
        error={reviewDraft.error}
        onChange={reviewDraft.updateDraft}
        onAccept={() => void reviewDraft.accept()}
        onDiscard={() => void reviewDraft.discard()}
      />
    </div>
  );
}

function HomeContent() {
  // useId (not crypto.randomUUID) so this is stable across the
  // server-rendered and client-hydrated pass — this is a dev-preview
  // session identifier, not a real appointment/consultation ref.
  const sessionRef = useId();
  const reopenRecordingId = useSearchParams().get("recordingId");

  return (
    <main className="min-h-screen px-12 pb-16 pt-16">
      <div className="mx-auto max-w-5xl">
        <p className="mb-5 text-[11px] font-bold uppercase tracking-widest text-[var(--color-on-surface-variant)]">
          Clinical AI · Milestone 8 dev preview
        </p>
        <div className="mb-12">
          <h2 className="mb-4 text-5xl font-extrabold tracking-tight text-[var(--color-on-background)]">
            {reopenRecordingId ? "Review Consultation" : "Record Consultation"}
          </h2>
          <p className="text-lg font-medium leading-relaxed text-[var(--color-on-surface-variant)]">
            {reopenRecordingId ? `Recording ${reopenRecordingId}` : `Session ${sessionRef}`}
          </p>
        </div>
        {reopenRecordingId ? (
          <ReopenedRecording recordingId={reopenRecordingId} />
        ) : (
          <ClinicalSessionProvider sessionRef={sessionRef}>
            <RecordingSession />
          </ClinicalSessionProvider>
        )}
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="max-w-5xl mx-auto p-8 text-sm text-[var(--color-on-surface-variant)]">Loading…</div>}>
      <HomeContent />
    </Suspense>
  );
}
