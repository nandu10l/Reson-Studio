import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db
from models.project_model import ProjectSave
from models.track_model import TrackCreate
from models.orm import UserORM, ProjectORM, TrackORM

router = APIRouter()

@router.post("/projects/save")
def save_project(payload: ProjectSave, db: Session = Depends(get_db)):
    if not db.query(UserORM).filter(UserORM.id == payload.owner_id).first():
        raise HTTPException(status_code=404, detail="Owner user not found")

    p = ProjectORM(owner_id=payload.owner_id, title=payload.title, data_json=json.dumps(payload.data))
    db.add(p)
    db.commit()
    db.refresh(p)
    return {"project_id": p.id}

@router.get("/projects/load")
def load_project(project_id: int, db: Session = Depends(get_db)):
    p = db.query(ProjectORM).filter(ProjectORM.id == project_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Project not found")

    return {
        "project_id": p.id,
        "owner_id": p.owner_id,
        "title": p.title,
        "data": json.loads(p.data_json),
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }

@router.get("/projects/list")
def list_projects(owner_id: int, db: Session = Depends(get_db)):
    items = db.query(ProjectORM).filter(ProjectORM.owner_id == owner_id).order_by(ProjectORM.id.desc()).all()
    return {
        "projects": [
            {"project_id": p.id, "title": p.title, "created_at": p.created_at.isoformat() if p.created_at else None}
            for p in items
        ]
    }

# Tracks CRUD
@router.post("/projects/tracks")
def create_track(payload: TrackCreate, db: Session = Depends(get_db)):
    if not db.query(ProjectORM).filter(ProjectORM.id == payload.project_id).first():
        raise HTTPException(status_code=404, detail="Project not found")

    t = TrackORM(
        project_id=payload.project_id,
        name=payload.name,
        audio_file_id=payload.audio_file_id,
        start_sec=payload.start_sec,
        gain=payload.gain,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return {"track_id": t.id}

@router.get("/projects/tracks")
def list_tracks(project_id: int, db: Session = Depends(get_db)):
    tracks = db.query(TrackORM).filter(TrackORM.project_id == project_id).order_by(TrackORM.id.asc()).all()
    return {
        "tracks": [
            {"id": t.id, "name": t.name, "audio_file_id": t.audio_file_id, "start_sec": t.start_sec, "gain": t.gain}
            for t in tracks
        ]
    }

@router.delete("/projects/tracks/{track_id}")
def delete_track(track_id: int, db: Session = Depends(get_db)):
    t = db.query(TrackORM).filter(TrackORM.id == track_id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Track not found")
    db.delete(t)
    db.commit()
    return {"ok": True}
