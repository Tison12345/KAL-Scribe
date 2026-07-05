"""Provider-abstraction interface (architecture.md §8, §20 principle 3).
Every vendor (whisperx.py, future google_stt.py, ...) implements this
same interface; swapping providers is a one-file change selected via
the STT_PROVIDER env var, never a hardcoded vendor call from main.py."""

from abc import ABC, abstractmethod

from app.schemas.process_audio import SpeakerTurn, TranscriptSegment


class SttResult:
    def __init__(
        self,
        segments: list[TranscriptSegment],
        speaker_turns: list[SpeakerTurn],
        language_detected: str,
    ) -> None:
        self.segments = segments
        self.speaker_turns = speaker_turns
        self.language_detected = language_detected


class SttProvider(ABC):
    @abstractmethod
    def transcribe(self, audio_path: str, language: str | None = None) -> SttResult:
        """Returns timestamped segments plus, if diarization is
        configured (architecture.md §9), speaker turns and real
        speaker labels on each segment. Without diarization, every
        segment is a single placeholder speaker and speaker_turns is
        empty — never an error."""
        raise NotImplementedError
