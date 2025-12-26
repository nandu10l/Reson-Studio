import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db
from engines.ai_engine import chord_suggestions, melody_generate
from models.ai_suggestion_model import ChordsReq, MelodyReq
from models.orm import ProjectORM, AISuggestionORM

router = APIRouter()

@router.post("/ai/chords")
def ai_chords(payload: ChordsReq, db: Session = Depends(get_db)):
    if not db.query(ProjectORM).filter(ProjectORM.id == payload.project_id).first():
        raise HTTPException(status_code=404, detail="Project not found")

    out = chord_suggestions(payload.key, payload.scale)
    row = AISuggestionORM(
        project_id=payload.project_id,
        kind="chords",
        input_json=json.dumps(payload.model_dump()),
        output_json=json.dumps(out),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"suggestion_id": row.id, "result": out}

@router.post("/ai/melody")
def ai_melody(payload: MelodyReq, db: Session = Depends(get_db)):
    if not db.query(ProjectORM).filter(ProjectORM.id == payload.project_id).first():
        raise HTTPException(status_code=404, detail="Project not found")

    out = melody_generate(payload.key, payload.bars, payload.tempo)
    row = AISuggestionORM(
        project_id=payload.project_id,
        kind="melody",
        input_json=json.dumps(payload.model_dump()),
        output_json=json.dumps(out),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"suggestion_id": row.id, "result": out}

@router.get("/ai/history")
def ai_history(project_id: int, db: Session = Depends(get_db)):
    rows = db.query(AISuggestionORM).filter(AISuggestionORM.project_id == project_id).order_by(AISuggestionORM.id.desc()).all()
    return {
        "history": [
            {
                "id": r.id,
                "kind": r.kind,
                "input": json.loads(r.input_json),
                "output": json.loads(r.output_json),
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]
    }
