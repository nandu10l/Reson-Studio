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
from basic_pitch import ICASSP_2022_MODEL_PATH

model_output, midi_data, note_events = predict(
    audio_path,
    onset_threshold=onset_threshold,
    frame_threshold=frame_threshold,
    minimum_note_length=min_note_len,
    midi_tempo=bpm
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


@router.post("/convert")
async def convert_audio_to_midi(
    file: UploadFile = File(...),
    bpm: int = Query(120, description="Project BPM for beat-based timing"),
    onset_threshold: float = Query(0.5, description="Note onset confidence threshold (0-1)"),
    frame_threshold: float = Query(0.3, description="Frame activation threshold (0-1)"),
    min_note_length_ms: int = Query(58, description="Minimum note duration in milliseconds")
):
    """
    Analyze audio and convert to MIDI note data using Spotify's Basic Pitch.
    Runs via Python 3.10 subprocess for compatibility.
    """
    temp_path = None
    script_path = None
    output_path = None
    try:
        # Save uploaded file to temp location
        content = await file.read()
        suffix = os.path.splitext(file.filename)[1] or '.wav'
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(content)
            temp_path = tmp.name

        # Write the script to a temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.py', mode='w') as sf:
            sf.write(BASIC_PITCH_SCRIPT)
            script_path = sf.name

        # Create temp output file for JSON results
        with tempfile.NamedTemporaryFile(delete=False, suffix='.json', mode='w') as of:
            output_path = of.name

        # Run basic-pitch via Python 3.10 with TF warnings suppressed
        env = os.environ.copy()
        env["TF_CPP_MIN_LOG_LEVEL"] = "3"
        env["TF_ENABLE_ONEDNN_OPTS"] = "0"
        env["PYTHONWARNINGS"] = "ignore"

        result = subprocess.run(
            [
                "py", "-3.10", script_path,
                temp_path,
                str(bpm),
                str(onset_threshold),
                str(frame_threshold),
                str(min_note_length_ms),
                output_path
            ],
            capture_output=True,
            text=True,
            timeout=300,  # 5 min — first run loads the neural network model
            env=env
        )

        if result.returncode != 0:
            print(f"Basic Pitch stderr: {result.stderr}")
            print(f"Basic Pitch stdout: {result.stdout}")
            raise Exception(f"Basic Pitch process exited with code {result.returncode}: {result.stderr[-300:]}")

        # Read JSON from output file (avoids stdout pollution from TF logs)
        with open(output_path, 'r') as f:
            data = json.load(f)

        # Convert to beat-positioned notes
        beats_per_second = bpm / 60.0
        output_notes = []

        for event in data["notes"]:
            start_sec = event["start_sec"]
            end_sec = event["end_sec"]
            midi_pitch = event["midi_pitch"]
            velocity = event["velocity"]

            duration_sec = end_sec - start_sec
            if duration_sec < (min_note_length_ms / 1000.0):
                continue

            start_beat = start_sec * beats_per_second
            duration_beats = duration_sec * beats_per_second

            output_notes.append({
                "note": midi_pitch,
                "noteName": midi_note_to_name(midi_pitch),
                "start": round(start_beat, 4),
                "duration": round(max(duration_beats, 0.25), 4),
                "velocity": round(min(velocity, 1.0), 3)
            })

        # Sort by start time
        output_notes.sort(key=lambda n: n["start"])

        return {
            "success": True,
            "filename": file.filename,
            "duration_seconds": round(data.get("duration", 0), 2),
            "notes_detected": len(output_notes),
            "notes": output_notes,
            "settings": {
                "engine": "basic-pitch (Spotify)",
                "onset_threshold": onset_threshold,
                "frame_threshold": frame_threshold,
                "min_note_length_ms": min_note_length_ms,
                "bpm": bpm
            }
        }

    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="Midify timed out. Try a shorter audio clip.")
    except FileNotFoundError:
        raise HTTPException(
            status_code=500,
            detail="Python 3.10 not found. Install basic-pitch with: py -3.10 -m pip install basic-pitch"
        )
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse Basic Pitch output: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Midify error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Audio to MIDI conversion failed: {str(e)}")
    finally:
        for path in [temp_path, script_path, output_path]:
            if path and os.path.exists(path):
                try:
                    os.unlink(path)
                except:
                    pass


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
