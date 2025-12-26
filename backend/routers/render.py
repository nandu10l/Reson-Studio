import os
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.database import get_db
from core.config import STORAGE_DIR
from core.storage import find_file_by_id
from engines.audio_engine import read_audio, mix_tracks, write_wav
from models.orm import ProjectORM, TrackORM

router = APIRouter()

class RenderReq(BaseModel):
    project_id: int

@router.post("/render")
def render_project(payload: RenderReq, db: Session = Depends(get_db)):
    if not db.query(ProjectORM).filter(ProjectORM.id == payload.project_id).first():
        raise HTTPException(status_code=404, detail="Project not found")

    tracks = db.query(TrackORM).filter(TrackORM.project_id == payload.project_id).all()
    if not tracks:
        raise HTTPException(status_code=400, detail="No tracks to render")

    clips = []
    sr_used = None

    for t in tracks:
        wav_pref = os.path.join(STORAGE_DIR, f"{t.audio_file_id}.wav")
        path = wav_pref if os.path.exists(wav_pref) else find_file_by_id(t.audio_file_id)
        if not path:
            continue

        y, sr = read_audio(path, mono=True)
        sr_used = sr_used or sr
        if sr_used != sr:
            raise HTTPException(status_code=400, detail="Tracks have different sample rates (resampling not implemented)")

        y = y * float(t.gain)
        offset = int(max(0.0, float(t.start_sec)) * sr)
        clips.append((y, offset))

    if not clips:
        raise HTTPException(status_code=400, detail="No valid audio files found")

    mix = mix_tracks(clips)

    out_name = f"render_{payload.project_id}.wav"
    out_path = os.path.join(STORAGE_DIR, out_name)
    write_wav(out_path, mix, sr_used or 44100)

    return {"render_filename": out_name, "download_url": f"/render/download/{out_name}"}

@router.get("/render/download/{filename}")
def download_render(filename: str):
    path = os.path.join(STORAGE_DIR, filename)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Render file not found")
    return FileResponse(path)
