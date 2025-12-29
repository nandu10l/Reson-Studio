from fastapi import APIRouter, HTTPException
from models.user_model import User

router = APIRouter()

@router.post("/users/")
async def create_user(user: User):
    return {"message": "User created successfully"}

@router.get("/users/{user_id}")
async def get_user(user_id: int):
    return {"user_id": user_id, "message": "User details retrieved"}