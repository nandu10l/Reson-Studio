import os
import io
import uuid
import base64
import json
import time
import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional

router = APIRouter(prefix="/api", tags=["ai-composer"])

# ── Singleton model loader ────────────────────────────────────────────────────
_model = None
# Resolve model path: env var → project ai_models/ → D:\Logiv fallback
_MODEL_PATH = os.environ.get(
    'MUSIC_MODEL_PATH',
    os.path.join(os.path.dirname(__file__), '..', '..', 'ai_models', 'music_model.h5')
)
_FALLBACK_MODEL_PATH = r'D:\Logiv\music_model.h5'

def _get_model():
    global _model
    if _model is None:
        try:
            import tensorflow as tf
            model_path = os.path.abspath(_MODEL_PATH)
            if not os.path.exists(model_path):
                model_path = _FALLBACK_MODEL_PATH
            if not os.path.exists(model_path):
                raise FileNotFoundError(
                    f"Model not found. Set MUSIC_MODEL_PATH env var, or place music_model.h5 in ai_models/ or D:\\Logiv\\"
                )
            _model = tf.keras.models.load_model(model_path, compile=False)
        except ImportError:
            raise HTTPException(status_code=500, detail="TensorFlow not installed — run: pip install tensorflow")
        except FileNotFoundError as e:
            raise HTTPException(status_code=500, detail=str(e))
    return _model


# ── Request / Response schemas ────────────────────────────────────────────────
class GenerateMusicRequest(BaseModel):
    seed_notes: List[int] = Field(default=[], description="Up to 50 MIDI note numbers (0–127)")
    num_notes: int = Field(default=200, ge=50, le=500, description="Number of notes to generate")
    tempo: int = Field(default=120, ge=60, le=200, description="Tempo in BPM")
    velocity: int = Field(default=80, ge=1, le=127, description="MIDI velocity")
    duration: float = Field(default=0.3, ge=0.05, le=2.0, description="Duration per note in seconds")
    instrument: int = Field(default=0, ge=0, le=127, description="GM instrument program number")


class GenerateMusicResponse(BaseModel):
    midi_base64: str
    notes: List[int]
    duration_seconds: float


# ── Default C-major seed ──────────────────────────────────────────────────────
_DEFAULT_SEED = [
    60, 62, 64, 65, 67, 69, 71, 72, 71, 69,
    67, 65, 64, 62, 60, 62, 64, 65, 67, 64,
    62, 60, 65, 67, 69, 67, 65, 64, 62, 60,
    60, 64, 67, 64, 60, 62, 65, 67, 65, 62,
    60, 67, 65, 64, 62, 60, 62, 64, 65, 60,
]


# ── Helper: generate note sequence with the LSTM model ───────────────────────
def _generate_notes(model, seed: List[int], num_notes: int) -> List[int]:
    """Autoregressively predict `num_notes` after the seed sequence (50 notes)."""
    SEQ_LEN = 50
    # Pad or trim seed to SEQ_LEN
    seed = list(seed)
    if len(seed) < SEQ_LEN:
        seed = (_DEFAULT_SEED * ((SEQ_LEN // len(_DEFAULT_SEED)) + 1))[:SEQ_LEN - len(seed)] + seed
    seed = seed[-SEQ_LEN:]

    notes_out = list(seed)
    arr = np.array(seed, dtype=np.float32) / 127.0

    for _ in range(num_notes):
        x = arr[-SEQ_LEN:].reshape(1, SEQ_LEN, 1)
        pred = float(model.predict(x, verbose=0)[0][0])
        pred_midi = int(round(pred * 127))
        pred_midi = max(0, min(127, pred_midi))
        notes_out.append(pred_midi)
        arr = np.append(arr, pred_midi / 127.0)

    return notes_out[SEQ_LEN:]  # Return only newly generated notes


# ── Helper: build a minimal MIDI file from note list ─────────────────────────
def _build_midi(notes: List[int], tempo_bpm: int, velocity: int,
                note_dur_sec: float, instrument: int) -> bytes:
    """Build a standard MIDI file (type 0) without external dependencies."""

    def var_len(value: int) -> bytes:
        """Encode variable-length MIDI delta time."""
        result = [value & 0x7F]
        value >>= 7
        while value:
            result.append((value & 0x7F) | 0x80)
            value >>= 7
        return bytes(reversed(result))

    def pack_be(value: int, n_bytes: int) -> bytes:
        return value.to_bytes(n_bytes, 'big')

    microseconds_per_beat = int(60_000_000 / tempo_bpm)
    ticks_per_beat = 480
    note_ticks = int(ticks_per_beat * note_dur_sec * (tempo_bpm / 60))

    track_events = bytearray()

    # Set tempo
    track_events += b'\x00\xff\x51\x03'
    track_events += microseconds_per_beat.to_bytes(3, 'big')

    # Program change (instrument)
    track_events += b'\x00\xc0' + bytes([instrument & 0x7F])

    # Note events
    for pitch in notes:
        pitch = max(0, min(127, pitch))
        # Note On
        track_events += var_len(0) + bytes([0x90, pitch, velocity])
        # Note Off after note_ticks
        track_events += var_len(note_ticks) + bytes([0x80, pitch, 0])

    # End of track
    track_events += b'\x00\xff\x2f\x00'

    track_bytes = bytes(track_events)

    header = (
        b'MThd'
        + pack_be(6, 4)       # header length
        + pack_be(0, 2)       # format 0
        + pack_be(1, 2)       # num tracks
        + pack_be(ticks_per_beat, 2)
    )

    track_chunk = (
        b'MTrk'
        + pack_be(len(track_bytes), 4)
        + track_bytes
    )

    return header + track_chunk


# ── Endpoint ──────────────────────────────────────────────────────────────────
@router.post("/generate-music", response_model=GenerateMusicResponse)
async def generate_music(req: GenerateMusicRequest):
    """
    Generate a MIDI sequence using the trained LSTM music model.

    - If `seed_notes` is empty, uses the default C-major pattern.
    - Returns the MIDI file as a base64 string, the raw note list, and total duration.
    """
    seed = req.seed_notes if len(req.seed_notes) >= 10 else _DEFAULT_SEED

    # Load model and generate
    model = _get_model()
    generated_notes = _generate_notes(model, seed, req.num_notes)

    # Build MIDI
    midi_bytes = _build_midi(
        notes=generated_notes,
        tempo_bpm=req.tempo,
        velocity=req.velocity,
        note_dur_sec=req.duration,
        instrument=req.instrument,
    )

    # Save temp file (optional, for debugging)
    temp_dir = os.path.join(os.path.dirname(__file__), '..', 'temp')
    os.makedirs(temp_dir, exist_ok=True)
    fid = f"generated_{uuid.uuid4().hex[:8]}"
    temp_path = os.path.join(temp_dir, f"{fid}.mid")
    js_path = os.path.join(temp_dir, f"{fid}.json")
    
    with open(temp_path, 'wb') as f:
        f.write(midi_bytes)

    duration_seconds = len(generated_notes) * req.duration

    # Save metadata for history workspace
    with open(js_path, 'w') as f:
        json.dump({
            "notes": generated_notes, 
            "duration_seconds": duration_seconds,
            "params": req.dict(),
            "timestamp": time.time()
        }, f)

    midi_b64 = base64.b64encode(midi_bytes).decode('utf-8')

    return GenerateMusicResponse(
        midi_base64=midi_b64,
        notes=generated_notes,
        duration_seconds=duration_seconds,
    )


# ── History endpoints ─────────────────────────────────────────────────────────
@router.get("/generated-history")
async def get_generated_history():
    temp_dir = os.path.join(os.path.dirname(__file__), '..', 'temp')
    if not os.path.exists(temp_dir):
        return {"files": []}
    files = []
    for fn in os.listdir(temp_dir):
        if fn.endswith(".mid") and fn.startswith("generated_"):
            path = os.path.join(temp_dir, fn)
            files.append({
                "filename": fn,
                "timestamp": os.path.getmtime(path),
                "size": os.path.getsize(path)
            })
    # Sort by recent
    files.sort(key=lambda x: x["timestamp"], reverse=True)
    return {"files": files}


class HistoryItemResponse(BaseModel):
    midi_base64: str
    notes: List[int]
    duration_seconds: float


@router.get("/generated-history/{filename}", response_model=HistoryItemResponse)
async def get_history_item(filename: str):
    if not filename.endswith(".mid") or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    temp_dir = os.path.join(os.path.dirname(__file__), '..', 'temp')
    path = os.path.join(temp_dir, filename)
    js_path = os.path.join(temp_dir, filename.replace(".mid", ".json"))

    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")

    with open(path, 'rb') as f:
        midi_bytes = f.read()

    notes, duration_seconds = [], 0.0
    if os.path.exists(js_path):
        with open(js_path) as f:
            data = json.load(f)
            notes = data.get("notes", [])
            duration_seconds = data.get("duration_seconds", 0.0)

    return HistoryItemResponse(
        midi_base64=base64.b64encode(midi_bytes).decode('utf-8'),
        notes=notes,
        duration_seconds=duration_seconds,
    )
