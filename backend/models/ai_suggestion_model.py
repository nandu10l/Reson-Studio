from pydantic import BaseModel

class ChordsReq(BaseModel):
    project_id: int
    key: str | None = None
    scale: str | None = None

class MelodyReq(BaseModel):
    project_id: int
    key: str | None = None
    bars: int = 4
    tempo: int = 120
