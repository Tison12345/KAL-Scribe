"""Pyannote speaker diarization (architecture.md §9). Requires
HF_TOKEN with the gated model terms accepted at
huggingface.co/pyannote/speaker-diarization-3.1 (and the -community-1
fallback). Returns None if unavailable — callers must treat that as
"diarization off," not an error: every segment stays under a single
placeholder speaker ("Speaker 1") rather than the pipeline failing,
exactly the MVP fallback architecture.md §9 describes.
"""

import os
import sys


def load_diarization_pipeline():
    hf_token = os.environ.get("HF_TOKEN")
    if not hf_token:
        return None

    from whisperx.diarize import DiarizationPipeline  # type: ignore[import-untyped]

    for model_name in [
        "pyannote/speaker-diarization-3.1",
        "pyannote/speaker-diarization-community-1",
    ]:
        try:
            return DiarizationPipeline(model_name=model_name, token=hf_token, device="cpu")
        except Exception as exc:
            sys.stderr.write(f"Diarization model {model_name} unavailable: {exc}\n")
            continue

    return None
