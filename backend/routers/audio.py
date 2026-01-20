"""
Audio conversion router - handles WAV to MP3 conversion
"""
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import Response
from pydub import AudioSegment
import io

router = APIRouter(prefix="/audio", tags=["audio"])


@router.post("/convert-to-mp3")
async def convert_wav_to_mp3(
    file: UploadFile = File(...),
    bitrate: str = "128k"
):
    """
    Convert a WAV file to MP3 format.
    
    Args:
        file: WAV audio file
        bitrate: MP3 bitrate (default: 128k)
    
    Returns:
        MP3 audio file as binary response
    """
    # Validate file type
    if not file.filename.lower().endswith('.wav'):
        # Still try to process it - pydub can handle various formats
        pass
    
    try:
        # Read the uploaded WAV file
        wav_data = await file.read()
        
        # Load audio using pydub
        audio = AudioSegment.from_file(io.BytesIO(wav_data), format="wav")
        
        # Export as MP3
        mp3_buffer = io.BytesIO()
        audio.export(mp3_buffer, format="mp3", bitrate=bitrate)
        mp3_buffer.seek(0)
        
        # Return MP3 as response
        return Response(
            content=mp3_buffer.read(),
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": f"attachment; filename={file.filename.rsplit('.', 1)[0]}.mp3"
            }
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audio conversion failed: {str(e)}")


@router.get("/health")
async def audio_health():
    """Health check for audio service"""
    return {"status": "ok", "service": "audio-conversion"}
