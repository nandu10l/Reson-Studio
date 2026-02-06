from fastapi import APIRouter, UploadFile, File, HTTPException
import mido
import io
from typing import Dict, List, Any

router = APIRouter(
    prefix="/midi",
    tags=["midi"],
    responses={404: {"description": "Not found"}},
)

@router.post("/parse")
async def parse_midi_file(file: UploadFile = File(...)):
    """
    Parse a MIDI file and return a structured JSON representation needed for the frontend.
    """
    if not file.filename.endswith(('.mid', '.midi')):
        raise HTTPException(status_code=400, detail="Invalid file format. Only .mid files supported.")

    try:
        # Read file content
        content = await file.read()
        
        # Parse MIDI
        mid = mido.MidiFile(file=io.BytesIO(content))
        
        # Structure to return
        result = {
            "bpm": 120, # Default
            "time_signature": "4/4",
            "tracks": []
        }
        
        # Extract BPM and Time Signature from metadata track (usually track 0 or first track with events)
        for track in mid.tracks:
            for msg in track:
                if msg.type == 'set_tempo':
                    result["bpm"] = round(mido.tempo2bpm(msg.tempo))
                elif msg.type == 'time_signature':
                    result["time_signature"] = f"{msg.numerator}/{msg.denominator}"

        # Parse Tracks
        for i, track in enumerate(mid.tracks):
            track_data = {
                "id": i,
                "name": track.name if track.name else f"Track {i+1}",
                "notes": []
            }
            
            # Mido stores delta times (ticks since last event). We need absolute beats.
            current_ticks = 0
            active_notes = {} # Keep track of note_on events {note_number: start_tick}
            
            for msg in track:
                current_ticks += msg.time
                
                if msg.type == 'note_on' and msg.velocity > 0:
                    # Note Start
                    if msg.note not in active_notes:
                        active_notes[msg.note] = current_ticks
                
                elif msg.type == 'note_off' or (msg.type == 'note_on' and msg.velocity == 0):
                    # Note End
                    if msg.note in active_notes:
                        start_tick = active_notes.pop(msg.note)
                        duration_ticks = current_ticks - start_tick
                        
                        # Convert to beats
                        # Ticks per quarter note (beat) is defined in mid.ticks_per_beat
                        start_beat = start_tick / mid.ticks_per_beat
                        duration_beat = duration_ticks / mid.ticks_per_beat
                        
                        track_data["notes"].append({
                            "note": msg.note,
                            "noteName": note_number_to_name(msg.note),
                            "start": start_beat,
                            "duration": duration_beat,
                            "velocity": msg.velocity / 127.0 # Normalize 0-1
                        })
            
            if track_data["notes"]:
                result["tracks"].append(track_data)
                
        return result

    except Exception as e:
        print(f"Error parsing MIDI: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to parse MIDI file: {str(e)}")

def note_number_to_name(note_number):
    """
    Convert MIDI note number (0-127) to note name (e.g., C4, F#5).
    """
    notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    octave = (note_number // 12) - 1
    note_index = note_number % 12
    return f"{notes[note_index]}{octave}"
