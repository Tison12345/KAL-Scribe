"""WhisperX implementation of SttProvider (docs/adr/0001, 0009, 0012).

Model size is one global choice (`WHISPER_MODEL_SIZE`), but device is
now per-request (docs/adr/0012's GPU/CPU toggle): `STT_DEVICE` is only
the *default* used when a request doesn't specify one. Model/align/
diarization instances are cached per device in dicts rather than one
instance each, so both a CPU and a GPU model can be loaded
simultaneously without reloading between requests. The default
device's model loads eagerly at startup (unchanged latency for the
common case); any other device loads lazily on its first request.
compute_type is fixed per device (`DEVICE_COMPUTE_TYPES`) rather than a
single env var — "int8" only makes sense for CPU, "float16" only for
GPU, so one global override doesn't make sense once both can be active
at once.
"""

import logging
import os

import whisperx

from app.diarization.pyannote_provider import load_diarization_pipeline
from app.schemas.process_audio import SpeakerTurn, TranscriptSegment
from app.stt.base import SttProvider, SttResult

WHISPER_MODEL_SIZE = os.environ.get("WHISPER_MODEL_SIZE", "small")
# Torch-native device strings ("cpu"/"cuda"), not the public "cpu"/
# "gpu" vocabulary — that translation happens once, at the FastAPI
# boundary in main.py, so this module stays in whisperx/torch's own
# terms throughout.
STT_DEVICE = os.environ.get("STT_DEVICE", "cpu")
DEVICE_COMPUTE_TYPES = {"cpu": "int8", "cuda": "float16"}

# Placeholder used when diarization isn't configured (architecture.md
# §9's documented MVP fallback) — never an error, just one speaker.
UNDIARIZED_SPEAKER_LABEL = "Speaker 1"

logger = logging.getLogger(__name__)


class WhisperXProvider(SttProvider):
    def __init__(self) -> None:
        self._models: dict[str, object] = {}
        self._align_cache: dict[tuple[str, str], tuple] = {}
        self._diarize_pipelines: dict[str, object] = {}
        self._get_model(STT_DEVICE)
        self._get_diarize_pipeline(STT_DEVICE)

    def _get_model(self, device: str):
        if device not in self._models:
            compute_type = DEVICE_COMPUTE_TYPES.get(device, "int8")
            self._models[device] = whisperx.load_model(
                WHISPER_MODEL_SIZE, device=device, compute_type=compute_type
            )
        return self._models[device]

    def _get_diarize_pipeline(self, device: str):
        if device not in self._diarize_pipelines:
            self._diarize_pipelines[device] = load_diarization_pipeline(device=device)
        return self._diarize_pipelines[device]

    def transcribe(
        self,
        audio_path: str,
        language: str | None = None,
        device: str | None = None,
    ) -> SttResult:
        device = device or STT_DEVICE
        model = self._get_model(device)
        audio = whisperx.load_audio(audio_path)
        result = model.transcribe(audio, language=language)

        detected_language = result.get("language", "en")
        try:
            cache_key = (device, detected_language)
            if cache_key not in self._align_cache:
                self._align_cache[cache_key] = whisperx.load_align_model(
                    language_code=detected_language, device=device
                )
            align_model, metadata = self._align_cache[cache_key]
            result = whisperx.align(result["segments"], align_model, metadata, audio, device)
        except Exception:
            # Alignment is a nice-to-have (word-level timestamp
            # precision) — fall back to Whisper's own segment-level
            # timestamps rather than failing the whole transcription.
            pass

        speaker_turns: list[SpeakerTurn] = []
        diarized = False
        diarize_pipeline = self._get_diarize_pipeline(device)
        if diarize_pipeline is not None:
            try:
                diarize_result = diarize_pipeline(audio)
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
