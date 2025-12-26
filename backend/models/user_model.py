from pydantic import BaseModel, EmailStr

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    full_name: str | None = None

class UserOut(BaseModel):
    id: int
    username: str
    email: EmailStr
    full_name: str | None = None
