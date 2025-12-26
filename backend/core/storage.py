import os
import uuid
from pathlib import Path
from core.config import STORAGE_DIR

def ensure_storage():
    Path(STORAGE_DIR).mkdir(parents=True, exist_ok=True)

def save_upload(original_filename: str, data: bytes) -> dict:
    ensure_storage()
    ext = os.path.splitext(original_filename)[1].lower() or ".bin"
    file_id = str(uuid.uuid4())
    filename = f"{file_id}{ext}"
    path = os.path.join(STORAGE_DIR, filename)
    with open(path, "wb") as f:
        f.write(data)
    return {"file_id": file_id, "filename": filename, "path": path}

def find_file_by_id(file_id: str) -> str | None:
    ensure_storage()
    for name in os.listdir(STORAGE_DIR):
        if name.startswith(file_id):
            return os.path.join(STORAGE_DIR, name)
    return None
