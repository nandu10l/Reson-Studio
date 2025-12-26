from pydantic import BaseModel

class TrackCreate(BaseModel):
    project_id: int
    name: str = "Track"
    audio_file_id: str
    start_sec: float = 0.0
    gain: float = 1.0
