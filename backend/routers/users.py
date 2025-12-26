from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from core.database import get_db
from models.user_model import UserCreate
from models.orm import UserORM

router = APIRouter()

@router.post("/users")
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    if db.query(UserORM).filter(UserORM.username == payload.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    if db.query(UserORM).filter(UserORM.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already exists")

    u = UserORM(username=payload.username, email=payload.email, full_name=payload.full_name)
    db.add(u)
    db.commit()
    db.refresh(u)
    return {"user_id": u.id}

@router.get("/users/{user_id}")
def get_user(user_id: int, db: Session = Depends(get_db)):
    u = db.query(UserORM).filter(UserORM.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    return {"id": u.id, "username": u.username, "email": u.email, "full_name": u.full_name}

@router.get("/users")
def list_users(db: Session = Depends(get_db)):
    users = db.query(UserORM).order_by(UserORM.id.desc()).all()
    return {"users": [{"id": u.id, "username": u.username, "email": u.email, "full_name": u.full_name} for u in users]}
