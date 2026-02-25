import os
import time
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from services.midi_generator import generate_midi_file, get_model, MODEL_VERSION, _MODEL_V1_PATH, _MODEL_V2_PATH

router = APIRouter(prefix="/api/ai-midi", tags=["ai-midi"])

OUTPUT_DIR = "generated_midi"
os.makedirs(OUTPUT_DIR, exist_ok=True)

class GenRequest(BaseModel):
    genre:       str   = "lofi"
    bpm:         int   = 85
    notes:       int   = 200
    temperature: float = 1.0
    duration:    float = 0.30
    tracks:      list  = ["melody","bass","chords","piano","kick","claps","hihat","snare"]

@router.post("/generate")
def generate(req: GenRequest):
    try:
        result = generate_midi_file(
            genre=req.genre,
            bpm=req.bpm,
            num_notes=req.notes,
            temperature=req.temperature,
            duration=req.duration,
            tracks_list=req.tracks,
            output_dir=OUTPUT_DIR
        )
        return {
            "success": True,
            "filename": result["filename"],
            "filepath": result["filepath"],
            "tracks": result["tracks"],
            "genre": req.genre,
            "bpm": req.bpm,
        }
    except Exception as e:
        print(f"Error in AI generation: {str(e)}")
        return {"success": False, "error": str(e)}

@router.get("/status")
def status():
    model = get_model()
    return {
        "model": "v2" if MODEL_VERSION == 2 else "v1" if MODEL_VERSION == 1 else "none",
        "version": MODEL_VERSION,
        "ready": model is not None,
        "paths": {
            "v1": _MODEL_V1_PATH,
            "v2": _MODEL_V2_PATH
        }
    }

@router.get("/files")
def list_files():
    if not os.path.exists(OUTPUT_DIR):
        return {"files": []}
    files = sorted(os.listdir(OUTPUT_DIR), reverse=True)
    return {"files": files[:20]}

@router.get("/download/{filename}")
def download(filename: str):
    path = os.path.join(OUTPUT_DIR, filename)
    if os.path.exists(path):
        return FileResponse(path, media_type="audio/midi", filename=filename)
    raise HTTPException(status_code=404, detail="File not found")
