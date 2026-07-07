"""FastAPI entrypoint (architecture.md §3.2, §8). The only internal
HTTP contract the rest of the repo talks to: POST /v1/process-audio ->
{ transcript_segments, speaker_turns }. Never call a vendor SDK
directly from outside app/stt/ — go through SttProvider.
"""

import os
import tempfile

from dotenv import load_dotenv
from fastapi import FastAPI, Form, HTTPException, UploadFile

# Must run before any os.environ.get() below (STT_PROVIDER here;
# whisperx_provider.py / pyannote_provider.py read their own vars at
# import/init time, which happens after this module is imported).
load_dotenv()

from app.schemas.process_audio import ProcessAudioResponse
from app.stt.base import SttProvider

STT_PROVIDER = os.environ.get("STT_PROVIDER", "whisperx")

app = FastAPI(title="clinical-ai asr-service")
state: dict[str, SttProvider] = {}


def _load_provider(name: str) -> SttProvider:
    if name == "whisperx":
        # Imported lazily so `STT_PROVIDER=whisperx` is the only path
        # that pays whisperx/torch's import cost.
        from app.stt.whisperx_provider import WhisperXProvider

        return WhisperXProvider()
    raise ValueError(f'Unknown STT_PROVIDER "{name}" — only "whisperx" exists today.')


@app.on_event("startup")
def load_model() -> None:
    state["provider"] = _load_provider(STT_PROVIDER)


@app.get("/")
def health() -> dict:
    return {"status": "ok", "stt_provider": STT_PROVIDER}


# Public API vocabulary ("cpu"/"gpu", matching the frontend toggle and
# docs/adr/0012) mapped to whisperx/torch's own device strings — kept
# here, not in whisperx_provider.py, so that module never has to know
# about the public naming.
DEVICE_ALIASES = {"cpu": "cpu", "gpu": "cuda"}


@app.post("/v1/process-audio", response_model=ProcessAudioResponse)
async def process_audio(
    file: UploadFile,
    language: str | None = None,
    device: str | None = Form(None),
) -> ProcessAudioResponse:
    provider = state.get("provider")
    if provider is None:
        raise HTTPException(status_code=503, detail="STT provider not loaded yet.")

    torch_device = None
    if device is not None:
        torch_device = DEVICE_ALIASES.get(device)
        if torch_device is None:
            raise HTTPException(
                status_code=422,
                detail=f'Unknown device "{device}" — expected "cpu" or "gpu".',
            )

    suffix = os.path.splitext(file.filename or "")[1] or ".webm"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        result = provider.transcribe(tmp_path, language=language, device=torch_device)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {exc}") from exc
    finally:
        os.unlink(tmp_path)

    # speaker_turns is empty when diarization isn't configured (no
    # HF_TOKEN) — see app/diarization/pyannote_provider.py.
    return ProcessAudioResponse(
        transcript_segments=result.segments,
        speaker_turns=result.speaker_turns,
        language_detected=[result.language_detected],
    )
