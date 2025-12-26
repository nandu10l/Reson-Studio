import os
from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from fastapi.responses import FileResponse
from core.storage import save_upload, find_file_by_id
from core.config import STORAGE_DIR
from engines.audio_engine import read_audio, trim, normalize, write_wav, waveform_peaks

router = APIRouter()

@router.post("/audio/upload")
async def upload_audio(
    file: UploadFile = File(...),
    do_normalize: bool = Query(True),
    start_sec: float | None = Query(None, ge=0.0),
    end_sec: float | None = Query(None, ge=0.0),
    include_waveform: bool = Query(True),
):
    data = await file.read()
    saved = save_upload(file.filename, data)

    try:
        y, sr = read_audio(saved["path"], mono=True)
        y = trim(y, sr, start_sec, end_sec)
        if do_normalize:
            y = normalize(y)

        wav_path = os.path.join(STORAGE_DIR, f"{saved['file_id']}.wav")
        write_wav(wav_path, y, sr)

        return {
            "file_id": saved["file_id"],
            "stored_filename": os.path.basename(wav_path),
            "sample_rate": sr,
            "duration_sec": float(len(y) / sr) if sr > 0 else None,
            "waveform": waveform_peaks(y, 1200) if include_waveform else None,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Audio processing failed: {str(e)}")

@router.get("/audio/download/{file_id}")
def download_audio(file_id: str):
    wav_path = os.path.join(STORAGE_DIR, f"{file_id}.wav")
    if os.path.exists(wav_path):
        return FileResponse(wav_path)

    p = find_file_by_id(file_id)
    if not p:
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(p)
