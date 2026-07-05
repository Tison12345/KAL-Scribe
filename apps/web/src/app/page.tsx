"use client";

import { useEffect, useId } from "react";
import {
  ClinicalSessionProvider,
  useClinicalSession,
} from "@/features/clinical-ai/providers/ClinicalSessionProvider";
import { ConsentConfirmation } from "@/features/clinical-ai/components/ConsentConfirmation";
import { RecordButton } from "@/features/clinical-ai/components/RecordButton";
import { TranscriptViewer } from "@/features/clinical-ai/components/TranscriptViewer";
import { UploadProgress } from "@/features/clinical-ai/components/UploadProgress";
import { useAudioRecorder } from "@/features/clinical-ai/hooks/useAudioRecorder";
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
      {uploadSession.status === "completed" && (
        <TranscriptViewer
          transcript={transcript.transcript}
          isPolling={transcript.isPolling}
          error={transcript.error}
          onSwapSpeakers={() => void transcript.swapSpeakers()}
        />
      )}
    </div>
  );
}

export default function Home() {
  // useId (not crypto.randomUUID) so this is stable across the
  // server-rendered and client-hydrated pass — this is a dev-preview
  // session identifier, not a real appointment/consultation ref.
  const sessionRef = useId();

  return (
    <main className="min-h-screen px-12 pb-16 pt-16">
      <div className="mx-auto max-w-5xl">
        <p className="mb-5 text-[11px] font-bold uppercase tracking-widest text-[var(--color-on-surface-variant)]">
          Clinical AI · Milestone 6 dev preview
        </p>
        <div className="mb-12">
          <h2 className="mb-4 text-5xl font-extrabold tracking-tight text-[var(--color-on-background)]">
            Record Consultation
          </h2>
          <p className="text-lg font-medium leading-relaxed text-[var(--color-on-surface-variant)]">
            Session {sessionRef}
          </p>
        </div>
        <ClinicalSessionProvider sessionRef={sessionRef}>
          <RecordingSession />
        </ClinicalSessionProvider>
      </div>
    </main>
  );
}
