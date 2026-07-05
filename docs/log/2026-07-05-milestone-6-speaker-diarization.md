---
date: 2026-07-05
task: milestone-6-speaker-diarization
---

# Milestone 6: Speaker Diarization

## What changed

Closed Milestone 5's biggest gap (multi-chunk recordings only
transcribing chunk 0) by adding real ffmpeg-based stitching, built and
wired in full Pyannote diarization (gracefully inactive without an
`HF_TOKEN`, per the user's choice to obtain one separately), added the
first durable transcript persistence (`consultation_transcripts`
table), a Doctor/Patient labeling heuristic, and a new
`TranscriptViewer` frontend component.

Verified end-to-end on a genuine multi-chunk test: uploaded two real
recorded clips as chunks 0 and 1 of one recording, confirmed they were
correctly stitched into one ~19-second continuous file, transcribed as
one correct, continuous transcript spanning both original clips, and
persisted/retrievable via the new endpoints.

## Files touched

- `workers/clinical-ai-worker/src/recording-client.ts` — rewritten:
  `fetchAndStitchRecordingAudio` replaces `fetchFirstChunkAudio`,
  fetching every chunk (via signed read URLs, stopping at the first
  404) and concatenating with `ffmpeg -f concat -c copy` when there's
  more than one.
- `apps/api/src/infrastructure/database/schema/
  consultation-transcripts.schema.ts` + migration — new.
- `apps/api/src/modules/clinical-ai/domain/
  doctor-patient-labeling.engine.ts` — new, pure domain logic.
- `apps/api/src/modules/clinical-ai/infrastructure/
  consultation-transcript.repository.ts` — new.
- `apps/api/src/modules/clinical-ai/application/
  {create-transcript,get-transcript,relabel-transcript-speakers}.use-case.ts`
  — new.
- `apps/api/src/modules/clinical-ai/presentation/clinical-ai.controller.ts`
  — three new routes; `clinical-ai.module.ts` — registered.
- `packages/types/src/{transcript-segment,consultation-transcript}.ts`
  — `SpeakerTurn`, `ConsultationTranscript`, `CreateTranscriptRequest/
  Response`; `ProcessAudioResponse` gained `languageDetected`.
- `packages/validation/src/consultation-transcript.schema.ts` — new.
- `python/asr-service/app/diarization/pyannote_provider.py` — new.
- `python/asr-service/app/stt/{base,whisperx_provider}.py` — `SttResult`
  (segments + speaker_turns + language_detected) replaces a bare
  segment list; diarization integrated via `assign_word_speakers`.
- `python/asr-service/app/schemas/process_audio.py` — `SpeakerTurn`,
  `language_detected` added to the response.
- `workers/clinical-ai-worker/src/{asr-client,transcript-client}.ts` —
  `asr-client.ts` updated for the richer response shape;
  `transcript-client.ts` new (persists via apps/api).
- `workers/clinical-ai-worker/src/main.ts` — uses stitching, persists
  the transcript instead of only logging it.
- `apps/web/src/features/clinical-ai/{hooks/useTranscript.ts,
  components/TranscriptViewer.tsx}` — new; `services/
  recording.service.ts` — `getTranscript`/`relabelTranscriptSpeakers`
  added; `app/page.tsx` — wired in.
- `docs/adr/0009` referenced (no new ADR this milestone — see
  Decisions).

## Decisions made

- **No new ADR for the Pyannote/diarization choice itself** —
  architecture.md §9 already specifies Pyannote in enough detail that
  there's no vendor decision to record; this milestone is
  implementation of an already-decided architecture, not a new
  decision.
- **Stitching happens in the worker (Node.js), not in apps/api or
  asr-service.** The worker already fetches chunks via signed URLs for
  Milestone 5; extending that same code path to fetch *all* chunks and
  shell out to ffmpeg (already available on this machine) kept the
  storage-abstraction boundary intact — apps/api's storage adapter
  still only knows about individual chunk keys, not stitching.
- **Doctor/Patient heuristic lives in apps/api's domain layer, applied
  at transcript-creation time**, not in Python. Diarization/ASR
  (inference) stays in Python; the deterministic "which cluster is the
  doctor" business rule is TypeScript domain logic, matching the
  existing Clean Architecture separation already established for
  `consultation-recording.entity.ts`. It's pure and testable with
  plain data (no I/O), consistent with architecture.md §20 principle 7.
- **Relabeling swaps the two roles wholesale**, not per-segment editing
  — matches architecture.md §9's "doctor can relabel with one tap"
  framing; a wrong heuristic guess is almost always backwards
  entirely, not wrong on individual segments.
- **`speaker_turns` is populated from Pyannote's raw diarization
  output when available**, not left permanently empty — architecture.md
  §8's contract names both `transcript_segments` and `speaker_turns`
  as real response fields, so once diarization actually runs, both are
  filled in properly rather than only ever returning one.

## Follow-ups / left undone

- **Diarization is entirely unverified against real multi-speaker
  audio** — no `HF_TOKEN` exists yet (user is setting one up
  separately). The code gracefully degrades to "Speaker 1" for
  everything today, which is what was verified; the actual
  Pyannote/WhisperX merge, the Doctor/Patient heuristic on real
  diarized clusters, and the relabel button on real data are all
  unverified. First thing to test once the token exists.
- **ffmpeg is now a real, undeclared operational dependency** for
  `workers/clinical-ai-worker` — works because it's on PATH on this
  dev machine, but nothing in the repo (Dockerfile, setup docs)
  captures this requirement yet.
- **No automated tests** for the new domain logic
  (`doctor-patient-labeling.engine.ts` is pure and trivially testable
  with plain data, per architecture.md §20 principle 7 — but the test
  suite itself wasn't written), the stitching logic, or the Python
  diarization integration.
- `consultation_ai_results` (Milestone 7's extraction output table)
  will eventually need to read from `consultation_transcripts` — no
  changes needed there yet, just noting the dependency.
