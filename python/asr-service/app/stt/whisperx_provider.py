"""WhisperX implementation of SttProvider (docs/adr/0001, 0009).

Config mirrors a proven-working local reference setup exactly: model
size "small", device "cpu", compute_type "int8". GPU is a deliberate
future upgrade, not built yet — see docs/adr/0009. Set STT_DEVICE=cuda
once a GPU-provisioned deployment exists; nothing else in this file
needs to change for that swap.
"""

import logging
import os

import whisperx

from app.diarization.pyannote_provider import load_diarization_pipeline
from app.schemas.process_audio import SpeakerTurn, TranscriptSegment
from app.stt.base import SttProvider, SttResult

WHISPER_MODEL_SIZE = os.environ.get("WHISPER_MODEL_SIZE", "small")
# TODO(GPU upgrade): set STT_DEVICE=cuda once this service is deployed
# on GPU-provisioned infrastructure (docs/adr/0009). Everything else
# here — model size, compute_type — should be revisited at that point
# too, since "small"/"int8" is specifically a CPU-friendly choice.
STT_DEVICE = os.environ.get("STT_DEVICE", "cpu")
COMPUTE_TYPE = "int8"

# Placeholder used when diarization isn't configured (architecture.md
# §9's documented MVP fallback) — never an error, just one speaker.
UNDIARIZED_SPEAKER_LABEL = "Speaker 1"

logger = logging.getLogger(__name__)


class WhisperXProvider(SttProvider):
    def __init__(self) -> None:
        self._model = whisperx.load_model(
            WHISPER_MODEL_SIZE, device=STT_DEVICE, compute_type=COMPUTE_TYPE
        )
        self._align_cache: dict[str, tuple] = {}
        self._diarize_pipeline = load_diarization_pipeline()

    def transcribe(self, audio_path: str, language: str | None = None) -> SttResult:
        audio = whisperx.load_audio(audio_path)
        result = self._model.transcribe(audio, language=language)

        detected_language = result.get("language", "en")
        try:
            if detected_language not in self._align_cache:
                self._align_cache[detected_language] = whisperx.load_align_model(
                    language_code=detected_language, device=STT_DEVICE
                )
            align_model, metadata = self._align_cache[detected_language]
            result = whisperx.align(result["segments"], align_model, metadata, audio, STT_DEVICE)
        except Exception:
            # Alignment is a nice-to-have (word-level timestamp
            # precision) — fall back to Whisper's own segment-level
            # timestamps rather than failing the whole transcription.
            pass

        speaker_turns: list[SpeakerTurn] = []
        diarized = False
        if self._diarize_pipeline is not None:
            try:
                diarize_result = self._diarize_pipeline(audio)
                result = whisperx.assign_word_speakers(diarize_result, result)
                diarized = True
                # whisperx's DiarizationPipeline returns a pandas
                # DataFrame (columns: segment, label, speaker, start,
                # end), not a pyannote Annotation — matches how
                # assign_word_speakers itself iterates it.
                speaker_turns = [
                    SpeakerTurn(speaker=row["speaker"], start=round(row["start"], 3), end=round(row["end"], 3))
                    for _, row in diarize_result.iterrows()
                ]
            except Exception:
                # Diarization is best-effort — fall back to the
                # single-speaker placeholder rather than failing the
                # whole transcription over a diarization hiccup. Still
                # logged (not silently swallowed) so a persistently
                # broken diarization setup is actually observable.
                logger.exception("Diarization failed; falling back to single-speaker placeholder")
                diarized = False

        def resolve_speaker(segment: dict) -> str:
            if diarized:
                return segment.get("speaker") or UNDIARIZED_SPEAKER_LABEL
            return UNDIARIZED_SPEAKER_LABEL

        segments = [
            TranscriptSegment(
                speaker=resolve_speaker(segment),
                text=segment["text"].strip(),
                start=round(segment["start"], 3),
                end=round(segment["end"], 3),
                word_confidence=None,
            )
            for segment in result["segments"]
        ]

        return SttResult(
            segments=segments,
            speaker_turns=speaker_turns,
            language_detected=detected_language,
        )
