"""
Audio conversion router - handles WAV to MP3 conversion and stem separation
"""
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import Response, JSONResponse
from pydub import AudioSegment
import io
import os
import tempfile
import base64
import subprocess
import shutil

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


@router.post("/separate-stems")
async def separate_stems(file: UploadFile = File(...)):
    """
    Separate audio into stems using Spleeter AI model.
    
    Args:
        file: Audio file (WAV or MP3)
    
    Returns:
        JSON with base64-encoded stem audio files:
        - vocals: Isolated vocal track
        - drums: Isolated drums track
        - bass: Isolated bass track
        - other: Other instruments (guitars, synths, etc.)
    """
    temp_dir = None
    try:
        # Create temporary directory for processing
        temp_dir = tempfile.mkdtemp(prefix="spleeter_")
        input_path = os.path.join(temp_dir, file.filename)
        output_dir = os.path.join(temp_dir, "output")
        os.makedirs(output_dir, exist_ok=True)
        
        # Save uploaded file
        file_content = await file.read()
        with open(input_path, 'wb') as f:
            f.write(file_content)
        
        # Run Demucs separation using Python 3.10 (where demucs is installed)
        # Using htdemucs model for 4 stems: vocals, drums, bass, other
        # Using --mp3 for better audio backend compatibility
        try:
            result = subprocess.run(
                [
                    "py", "-3.10", "-m", "demucs",
                    "-n", "htdemucs",
                    "--mp3",  # Use MP3 output for better compatibility
                    "-o", output_dir,
                    input_path
                ],
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )
            
            if result.returncode != 0:
                # Log full error for debugging
                print(f"Demucs stderr: {result.stderr}")
                print(f"Demucs stdout: {result.stdout}")
                raise Exception(f"Demucs failed: {result.stderr}")
        
        except FileNotFoundError:
            raise HTTPException(
                status_code=500, 
                detail="Python 3.10 or Demucs not found. Please install with: py -3.10 -m pip install demucs"
            )
        except subprocess.TimeoutExpired:
            raise HTTPException(
                status_code=500,
                detail="Stem separation timed out. Try with a shorter audio file."
            )
        
        # Find output files (Demucs outputs to: output_dir/htdemucs/filename/)
        base_name = os.path.splitext(file.filename)[0]
        model_output = os.path.join(output_dir, "htdemucs", base_name)
        
        stems = {}
        stem_names = ["vocals", "drums", "bass", "other"]
        
        for stem_name in stem_names:
            # Try MP3 first (when using --mp3 flag), then WAV as fallback
            stem_path = os.path.join(model_output, f"{stem_name}.mp3")
            if not os.path.exists(stem_path):
                stem_path = os.path.join(model_output, f"{stem_name}.wav")
            
            if os.path.exists(stem_path):
                with open(stem_path, 'rb') as f:
                    audio_data = f.read()
                    stems[stem_name] = base64.b64encode(audio_data).decode('utf-8')
        
        if not stems:
            raise HTTPException(
                status_code=500,
                detail="No stems were generated. Check if Demucs is properly installed with: py -3.10 -m pip install demucs"
            )
        
        return JSONResponse(content={
            "success": True,
            "original_filename": file.filename,
            "stems": stems
        })
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Stem separation failed: {str(e)}")
    finally:
        # Cleanup temporary files
        if temp_dir and os.path.exists(temp_dir):
            try:
                shutil.rmtree(temp_dir)
            except:
                pass


@router.get("/health")
async def audio_health():
    """Health check for audio service"""
    return {"status": "ok", "service": "audio-conversion"}

