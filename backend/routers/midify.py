"""
Midify router - Audio to MIDI conversion using Spotify's Basic Pitch neural network.
https://github.com/spotify/basic-pitch

Basic Pitch uses a lightweight CNN trained for polyphonic pitch detection:
- Handles multiple notes at once (chords, complex audio)
- Highly accurate onset + pitch detection
- Works with vocals, guitar, piano, synths, and more

Since basic-pitch requires Python <=3.12 and the backend runs on Python 3.14,
we invoke it via Python 3.10 subprocess (same pattern as Demucs).
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from typing import List, Dict, Any
import tempfile
import os
import json
import subprocess

router = APIRouter(prefix="/midify", tags=["midify"])


def midi_note_to_name(note_number):
    """Convert MIDI note number to note name (e.g., C4, F#5)."""
    notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    octave = (note_number // 12) - 1
    note_index = note_number % 12
    return f"{notes[note_index]}{octave}"


# Inline Python 3.10 script that runs basic-pitch and writes JSON to output file
BASIC_PITCH_SCRIPT = '''
import sys
import os
import json
import warnings

# Suppress ALL warnings and TensorFlow noise before any imports
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
warnings.filterwarnings("ignore")

import logging
logging.disable(logging.CRITICAL)

audio_path = sys.argv[1]
bpm = float(sys.argv[2])
onset_threshold = float(sys.argv[3])
frame_threshold = float(sys.argv[4])
min_note_len = float(sys.argv[5])
output_path = sys.argv[6]

from basic_pitch.inference import predict
from basic_pitch import ICASSP_2022_MODEL_PATH, FilenameSuffix, build_icassp_2022_model_path

# basic-pitch 0.4.0 defaults to TF SavedModel when TF is installed, but TF 2.20
# cannot load the model saved with older TF. Force ONNX which works with onnxruntime.
try:
    onnx_model_path = build_icassp_2022_model_path(FilenameSuffix.onnx)
except Exception:
    onnx_model_path = ICASSP_2022_MODEL_PATH

model_output, midi_data, note_events = predict(
    audio_path,
    onnx_model_path,
    onset_threshold=onset_threshold,
    frame_threshold=frame_threshold,
    minimum_note_length=min_note_len,
    midi_tempo=bpm,
    melodia_trick=True
)

# note_events: list of (start_time_s, end_time_s, midi_pitch, velocity, confidence)
results = []
for event in note_events:
    results.append({
        "start_sec": float(event[0]),
        "end_sec": float(event[1]),
        "midi_pitch": int(event[2]),
        "velocity": float(event[3])
    })

duration = midi_data.get_end_time() if midi_data else 0.0

output = {
    "notes": results,
    "duration": float(duration)
}

# Write to file (not stdout) to avoid TF log pollution
with open(output_path, "w") as f:
    json.dump(output, f)
'''


# ── Post-Processing: Clean up basic-pitch output ─────────────────────────────
def _postprocess_notes(notes: List[Dict[str, Any]], bpm: int, quantize_steps: int = 8) -> List[Dict[str, Any]]:
    """
    Filter artifacts, remove harmonics, merge near-duplicates, and optionally
    quantize timing. This dramatically improves accuracy for full-mix audio.

    Args:
        notes: Raw note list from basic-pitch with start (beats), duration (beats), note, velocity.
        bpm: Tempo in BPM.
        quantize_steps: Grid resolution in subdivisions per beat (4=16ths, 8=32nds, 0=off).
    """
    if not notes:
        return notes

    # ── 1. Remove very quiet notes (likely ghost detections) ────────────────
    # Raise the floor to 18% — basic-pitch often produces faint phantom notes
    # at pitches that aren't actually in the audio (harmonics, noise floor).
    min_velocity = 0.18
    notes = [n for n in notes if n["velocity"] >= min_velocity]

    # ── 2. Remove extremely short notes (< 0.1 beats ≈ 50ms at 120bpm) ────
    min_dur_beats = 0.1
    notes = [n for n in notes if n["duration"] >= min_dur_beats]

    # ── 3. Merge near-duplicate notes at same pitch ────────────────────────
    # If two notes of the same pitch start within 0.15 beats of each other,
    # keep only the louder one (the other is likely a detection artifact).
    notes.sort(key=lambda n: (n["note"], n["start"]))
    merged = []
    i = 0
    while i < len(notes):
        current = notes[i]
        j = i + 1
        best = current
        while j < len(notes) and notes[j]["note"] == current["note"] and abs(notes[j]["start"] - current["start"]) < 0.15:
            if notes[j]["velocity"] > best["velocity"]:
                best = notes[j]
            j += 1
        merged.append(best)
        i = j
    notes = merged

    # ── 4. Remove harmonic artifacts ───────────────────────────────────────
    # If a loud note exists and a quieter note at a harmonic interval (octave,
    # fifth, etc.) starts within 0.15 beats, the quieter one is almost certainly
    # a harmonic overtone detected by the neural network — not a real note.
    # Also handle nearby pitches (±1 semitone of harmonic) for slightly
    # detuned harmonics common in real audio.
    notes.sort(key=lambda n: n["start"])
    harmonic_intervals = {7, 12, 19, 24}  # fifth, octave, octave+fifth, 2 octaves
    # Expand to include ±1 semitone tolerance for each harmonic
    harmonic_set = set()
    for h in harmonic_intervals:
        harmonic_set.update([h - 1, h, h + 1])

    to_remove = set()
    for i, n1 in enumerate(notes):
        if i in to_remove:
            continue
        for j, n2 in enumerate(notes):
            if i == j or j in to_remove:
                continue
            if abs(n1["start"] - n2["start"]) > 0.15:
                continue
            interval = abs(n2["note"] - n1["note"])
            if interval in harmonic_set:
                # The quieter note is the harmonic — use 75% threshold
                if n2["velocity"] < n1["velocity"] * 0.75:
                    to_remove.add(j)
                elif n1["velocity"] < n2["velocity"] * 0.75:
                    to_remove.add(i)
    notes = [n for i, n in enumerate(notes) if i not in to_remove]

    # ── 5. Remove statistical outliers ─────────────────────────────────────
    # If a note's velocity is far below the median, it's likely a false detection.
    if len(notes) > 10:
        velocities = sorted(n["velocity"] for n in notes)
        median_vel = velocities[len(velocities) // 2]
        # Remove notes below 25% of the median velocity
        outlier_threshold = median_vel * 0.25
        notes = [n for n in notes if n["velocity"] >= outlier_threshold]

    # ── 6. Quantize to grid ────────────────────────────────────────────────
    if quantize_steps > 0:
        grid = 1.0 / quantize_steps  # size of one grid cell in beats
        for n in notes:
            n["start"] = round(round(n["start"] / grid) * grid, 4)
            # Quantize duration to nearest grid, minimum 1 grid cell
            n["duration"] = round(max(grid, round(n["duration"] / grid) * grid), 4)

    # ── 7. De-duplicate after quantization ─────────────────────────────────
    # Quantization can cause multiple notes to snap to the same start + pitch.
    # Keep only the loudest note at each (start, pitch) position.
    seen = {}
    for n in notes:
        key = (n["start"], n["note"])
        if key not in seen or n["velocity"] > seen[key]["velocity"]:
            seen[key] = n
    notes = list(seen.values())

    # ── 8. Final sort by start time ────────────────────────────────────────
    notes.sort(key=lambda n: (n["start"], n["note"]))
    return notes


# ── MIDI Byte Packing Helper ─────────────────────────────────────────────────
def build_midi_binary(notes: List[Dict[str, Any]], tempo_bpm: int) -> bytes:
    """
    Build a standard MIDI file (type 0) from note data.
    Correctly handles polyphonic (overlapping) notes by interleaving
    note-on and note-off events sorted by absolute tick time.
    """
    def var_len(value: int) -> bytes:
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

    # ── Build a list of ALL events (note-on + note-off) sorted by tick ────
    events = []  # (absolute_tick, event_type, pitch, velocity)
    for n in notes:
        start_tick = int(n["start"] * ticks_per_beat)
        duration_ticks = max(1, int(n["duration"] * ticks_per_beat))
        pitch = max(0, min(127, n["note"]))
        velocity = max(1, min(127, int(n["velocity"] * 127)))  # Proper 0-127 scaling

        events.append((start_tick, 0x90, pitch, velocity))      # Note On
        events.append((start_tick + duration_ticks, 0x80, pitch, 0))  # Note Off

    # Sort: by tick, then note-off before note-on at same tick (avoids stuck notes)
    events.sort(key=lambda e: (e[0], 0 if e[1] == 0x80 else 1))

    track_events = bytearray()
    # Set tempo
    track_events += b'\x00\xff\x51\x03'
    track_events += microseconds_per_beat.to_bytes(3, 'big')
    # Default instrument (Grand Piano)
    track_events += b'\x00\xc0\x00'

    last_tick = 0
    for abs_tick, status, pitch, vel in events:
        delta = max(0, abs_tick - last_tick)
        track_events += var_len(delta) + bytes([status, pitch, vel])
        last_tick = abs_tick

    # End of track
    track_events += b'\x00\xff\x2f\x00'

    track_bytes = bytes(track_events)
    header = b'MThd' + pack_be(6, 4) + pack_be(0, 2) + pack_be(1, 2) + pack_be(ticks_per_beat, 2)
    track_chunk = b'MTrk' + pack_be(len(track_bytes), 4) + track_bytes
    return header + track_chunk


async def _perform_midify_analysis(file: UploadFile, bpm: int, onset_threshold: float, frame_threshold: float, min_note_length_ms: int):
    """Core logic for running basic-pitch analysis."""
    temp_path = None
    script_path = None
    output_path = None
    try:
        content = await file.read()
        suffix = os.path.splitext(file.filename)[1] or '.wav'
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(content)
            temp_path = tmp.name

        with tempfile.NamedTemporaryFile(delete=False, suffix='.py', mode='w') as sf:
            sf.write(BASIC_PITCH_SCRIPT)
            script_path = sf.name

        with tempfile.NamedTemporaryFile(delete=False, suffix='.json', mode='w') as of:
            output_path = of.name

        env = os.environ.copy()
        env["TF_CPP_MIN_LOG_LEVEL"] = "3"
        env["TF_ENABLE_ONEDNN_OPTS"] = "0"
        env["PYTHONWARNINGS"] = "ignore"

        result = subprocess.run(
            ["py", "-3.10", script_path, temp_path, str(bpm), str(onset_threshold), str(frame_threshold), str(min_note_length_ms), output_path],
            capture_output=True, text=True, timeout=300, env=env
        )

        if result.returncode != 0:
            raise Exception(f"Basic Pitch failed: {result.stderr[-300:]}")

        with open(output_path, 'r') as f:
            data = json.load(f)

        beats_per_second = bpm / 60.0
        output_notes = []
        for event in data["notes"]:
            duration_sec = event["end_sec"] - event["start_sec"]
            if duration_sec < (min_note_length_ms / 1000.0): continue
            start_beat = event["start_sec"] * beats_per_second
            duration_beats = duration_sec * beats_per_second
            output_notes.append({
                "note": event["midi_pitch"],
                "noteName": midi_note_to_name(event["midi_pitch"]),
                "start": round(start_beat, 4),
                "duration": round(duration_beats, 4),
                "velocity": round(min(event["velocity"], 1.0), 3)
            })
        output_notes.sort(key=lambda n: n["start"])

        # Post-process: filter artifacts, harmonics, quantize to 16th-note grid
        # (frontend PianoRoll uses 4 steps per beat = 16th notes)
        output_notes = _postprocess_notes(output_notes, bpm, quantize_steps=4)

        return {"notes": output_notes, "duration": data.get("duration", 0)}
    finally:
        for path in [temp_path, script_path, output_path]:
            if path and os.path.exists(path):
                try: os.unlink(path)
                except: pass


@router.post("/convert")
async def convert_audio_to_midi(
    file: UploadFile = File(...),
    bpm: int = Query(120),
    onset_threshold: float = Query(0.5),
    frame_threshold: float = Query(0.3),
    min_note_length_ms: int = Query(58)
):
    try:
        data = await _perform_midify_analysis(file, bpm, onset_threshold, frame_threshold, min_note_length_ms)
        return {
            "success": True,
            "filename": file.filename,
            "duration_seconds": round(data["duration"], 2),
            "notes_detected": len(data["notes"]),
            "notes": data["notes"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/convert-to-midi-file")
async def convert_to_midi_file(
    file: UploadFile = File(...),
    bpm: int = Query(120),
    onset_threshold: float = Query(0.5),
    frame_threshold: float = Query(0.3),
    min_note_length_ms: int = Query(58)
):
    """Transcription to binary .mid file download."""
    try:
        data = await _perform_midify_analysis(file, bpm, onset_threshold, frame_threshold, min_note_length_ms)
        midi_bytes = build_midi_binary(data["notes"], bpm)
        
        from fastapi.responses import Response
        filename = os.path.splitext(file.filename)[0] + ".mid"
        return Response(
            content=midi_bytes,
            media_type="audio/midi",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/health")
async def midify_health():
    """Health check for midify service"""
    try:
        result = subprocess.run(
            ["py", "-3.10", "-c", "from basic_pitch import ICASSP_2022_MODEL_PATH; print('ok')"],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            return {"status": "ok", "service": "midify", "engine": "basic-pitch (Spotify via py-3.10)"}
        return {"status": "degraded", "service": "midify", "error": result.stderr[:200]}
    except Exception as e:
        return {"status": "degraded", "service": "midify", "error": str(e)}
