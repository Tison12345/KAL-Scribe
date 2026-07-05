"""Mirrors packages/types/src/transcript-segment.ts field-for-field
(architecture.md §16 — the TS side is the source of truth; keep these
in sync deliberately, flag any drift as a bug)."""

from pydantic import BaseModel


class TranscriptSegment(BaseModel):
    speaker: str
    text: str
    start: float
    end: float
    word_confidence: float | None = None


class SpeakerTurn(BaseModel):
    speaker: str
    start: float
    end: float


class ProcessAudioResponse(BaseModel):
    transcript_segments: list[TranscriptSegment]
    # Empty when diarization didn't run (no HF_TOKEN configured yet) —
    # see app/diarization/pyannote_provider.py.
    speaker_turns: list[SpeakerTurn] = []
    # Single detected language, wrapped in a list to match
    # consultation_transcripts.language_detected's array shape (§12) —
    # real code-switch detection (multiple languages in one clip) isn't
    # implemented, WhisperX detects one dominant language per call.
    language_detected: list[str] = []
