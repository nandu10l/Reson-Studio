from pydantic import BaseModel, Field

class ProjectSave(BaseModel):
    owner_id: int
    title: str = Field(min_length=1, max_length=255)
    data: dict

class ProjectOut(BaseModel):
    project_id: int
    owner_id: int
    title: str
    data: dict
    created_at: str | None = None
