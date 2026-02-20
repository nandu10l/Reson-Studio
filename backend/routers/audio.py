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
import traceback

router = APIRouter(prefix="/audio", tags=["audio"])


def load_audio_flexible(audio_data: bytes, filename: str = "") -> AudioSegment:
    """
    Load audio data with robust format detection.
    Tries multiple strategies to handle files from browser Blobs
    that may not have proper extensions.
    """
    filename = (filename or "").lower()
    
    # Try based on filename extension first
    ext_formats = {
        '.mp3': 'mp3', '.wav': 'wav', '.ogg': 'ogg',
        '.webm': 'webm', '.flac': 'flac', '.m4a': 'mp4'
    }
    for ext, fmt in ext_formats.items():
        if filename.endswith(ext):
            try:
                return AudioSegment.from_file(io.BytesIO(audio_data), format=fmt)
            except Exception:
                break  # Extension matched but failed, try other formats
    
    # Try common formats
    for fmt in ["wav", "mp3", "ogg", "webm", "flac"]:
        try:
            return AudioSegment.from_file(io.BytesIO(audio_data), format=fmt)
        except Exception:
            continue
    
    # Last resort: let ffmpeg auto-detect
    try:
        return AudioSegment.from_file(io.BytesIO(audio_data))
    except Exception as e:
        raise ValueError(f"Could not load audio file. Format not recognized. Filename: {filename}, Error: {str(e)}")


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
    try:
        # Read the uploaded file
        wav_data = await file.read()
        
        # Load audio using flexible format detection
        audio = load_audio_flexible(wav_data, file.filename)
        
        # Export as MP3
        mp3_buffer = io.BytesIO()
        audio.export(mp3_buffer, format="mp3", bitrate=bitrate)
        mp3_buffer.seek(0)
        
        base_name = (file.filename or "audio").rsplit('.', 1)[0]
        
        # Return MP3 as response
        return Response(
            content=mp3_buffer.read(),
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": f"attachment; filename={base_name}.mp3"
            }
        )
    
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Audio conversion failed: {str(e)}")


@router.post("/separate-stems")
async def separate_stems(file: UploadFile = File(...)):
    """
    Separate audio into stems using Demucs AI model.
    
    Args:
        file: Audio file (WAV or MP3)
    
    Returns:
        JSON with base64-encoded stem audio files:
        - vocals: Isolated vocal track
        - drums: Isolated drums track
        - bass: Isolated bass track
        - other: Other instruments (synths, etc.)
        - guitar: Isolated guitar track
        - piano: Isolated piano track
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
        # Using htdemucs_6s model for 6 stems: vocals, drums, bass, guitar, piano, other
        # Using --mp3 for better audio backend compatibility
        try:
            result = subprocess.run(
                [
                    "py", "-3.10", "-m", "demucs",
                    "-n", "htdemucs_6s",
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
        
        # Find output files (Demucs outputs to: output_dir/htdemucs_6s/filename/)
        base_name = os.path.splitext(file.filename)[0]
        model_output = os.path.join(output_dir, "htdemucs_6s", base_name)
        
        stems = {}
        stem_names = ["vocals", "drums", "bass", "other", "guitar", "piano"]
        
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


@router.post("/trim")
async def trim_audio(
    file: UploadFile = File(...),
    start_ms: int = 0,
    end_ms: int = -1
):
    """
    Trim audio to keep only the specified region.
    
    Args:
        file: Audio file (WAV/MP3)
        start_ms: Start time in milliseconds
        end_ms: End time in milliseconds (-1 for end of file)
    
    Returns:
        Trimmed audio as WAV
    """
    try:
        audio_data = await file.read()
        audio = load_audio_flexible(audio_data, file.filename)
        
        # Apply trim
        if end_ms == -1:
            end_ms = len(audio)
        
        trimmed = audio[start_ms:end_ms]
        
        # Export as WAV
        wav_buffer = io.BytesIO()
        trimmed.export(wav_buffer, format="wav")
        wav_buffer.seek(0)
        
        return Response(
            content=wav_buffer.read(),
            media_type="audio/wav",
            headers={"Content-Disposition": f"attachment; filename=trimmed_{file.filename or 'audio.wav'}"}
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Trim failed: {str(e)}")


@router.post("/cut")
async def cut_audio(
    file: UploadFile = File(...),
    start_ms: int = 0,
    end_ms: int = 0
):
    """
    Cut (remove) a region from audio.
    
    Args:
        file: Audio file (WAV/MP3)
        start_ms: Start of region to remove
        end_ms: End of region to remove
    
    Returns:
        Audio with region removed as WAV
    """
    try:
        audio_data = await file.read()
        audio = load_audio_flexible(audio_data, file.filename)
        
        # Cut by combining before and after the cut region
        before = audio[:start_ms]
        after = audio[end_ms:]
        result = before + after
        
        wav_buffer = io.BytesIO()
        result.export(wav_buffer, format="wav")
        wav_buffer.seek(0)
        
        return Response(
            content=wav_buffer.read(),
            media_type="audio/wav",
            headers={"Content-Disposition": f"attachment; filename=cut_{file.filename or 'audio.wav'}"}
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Cut failed: {str(e)}")


@router.post("/fade")
async def fade_audio(
    file: UploadFile = File(...),
    fade_type: str = "in",
    duration_ms: int = 500
):
    """
    Apply fade in or fade out effect.
    
    Args:
        file: Audio file (WAV/MP3)
        fade_type: "in" for fade in, "out" for fade out
        duration_ms: Duration of fade in milliseconds
    
    Returns:
        Audio with fade applied as WAV
    """
    try:
        audio_data = await file.read()
        audio = load_audio_flexible(audio_data, file.filename)
        
        if fade_type == "in":
            result = audio.fade_in(duration_ms)
        else:
            result = audio.fade_out(duration_ms)
        
        wav_buffer = io.BytesIO()
        result.export(wav_buffer, format="wav")
        wav_buffer.seek(0)
        
        return Response(
            content=wav_buffer.read(),
            media_type="audio/wav",
            headers={"Content-Disposition": f"attachment; filename=fade_{file.filename or 'audio.wav'}"}
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Fade failed: {str(e)}")


@router.post("/reverse")
async def reverse_audio(file: UploadFile = File(...)):
    """
    Reverse the audio.
    
    Args:
        file: Audio file (WAV/MP3)
    
    Returns:
        Reversed audio as WAV
    """
    try:
        audio_data = await file.read()
        audio = load_audio_flexible(audio_data, file.filename)
        
        result = audio.reverse()
        
        wav_buffer = io.BytesIO()
        result.export(wav_buffer, format="wav")
        wav_buffer.seek(0)
        
        return Response(
            content=wav_buffer.read(),
            media_type="audio/wav",
            headers={"Content-Disposition": f"attachment; filename=reversed_{file.filename or 'audio.wav'}"}
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Reverse failed: {str(e)}")


@router.post("/time-stretch")
async def time_stretch_audio(
    file: UploadFile = File(...),
    factor: float = 1.0
):
    """
    Time-stretch audio without changing pitch.
    
    Args:
        file: Audio file (WAV/MP3)
        factor: Stretch factor (0.5 = half speed/double length, 2.0 = double speed/half length)
    
    Returns:
        Time-stretched audio as WAV
    """
    if factor <= 0 or factor > 10:
        raise HTTPException(status_code=400, detail="Factor must be between 0.01 and 10.0")
    
    try:
        import numpy as np
        import librosa
        import soundfile as sf
        
        audio_data = await file.read()
        audio = load_audio_flexible(audio_data, file.filename)
        
        # Convert pydub AudioSegment to numpy array for librosa
        samples = np.array(audio.get_array_of_samples(), dtype=np.float32)
        sample_rate = audio.frame_rate
        
        # Handle stereo
        if audio.channels == 2:
            # Deinterleave stereo
            left = samples[::2] / 32768.0
            right = samples[1::2] / 32768.0
            
            # Time stretch each channel
            left_stretched = librosa.effects.time_stretch(left, rate=factor)
            right_stretched = librosa.effects.time_stretch(right, rate=factor)
            
            # Make same length
            min_len = min(len(left_stretched), len(right_stretched))
            left_stretched = left_stretched[:min_len]
            right_stretched = right_stretched[:min_len]
            
            # Interleave back to stereo
            stretched = np.empty(min_len * 2, dtype=np.float32)
            stretched[::2] = left_stretched
            stretched[1::2] = right_stretched
        else:
            samples_float = samples / 32768.0
            stretched_mono = librosa.effects.time_stretch(samples_float, rate=factor)
            stretched = stretched_mono
        
        # Write to WAV using soundfile
        wav_buffer = io.BytesIO()
        if audio.channels == 2:
            # Reshape for stereo
            stereo_data = np.column_stack([
                stretched[::2],
                stretched[1::2]
            ])
            sf.write(wav_buffer, stereo_data, sample_rate, format='WAV')
        else:
            sf.write(wav_buffer, stretched, sample_rate, format='WAV')
        
        wav_buffer.seek(0)
        
        return Response(
            content=wav_buffer.read(),
            media_type="audio/wav",
            headers={"Content-Disposition": f"attachment; filename=stretched_{file.filename or 'audio.wav'}"}
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Time stretch failed: {str(e)}")


@router.post("/pitch-shift")
async def pitch_shift_audio(
    file: UploadFile = File(...),
    semitones: float = 0.0
):
    """
    Pitch-shift audio without changing tempo.
    
    Args:
        file: Audio file (WAV/MP3)
        semitones: Number of semitones to shift (-12 to +12).
                   Positive = higher pitch, negative = lower pitch.
                   Fractional values allowed (e.g. 0.5 for quarter tone).
    
    Returns:
        Pitch-shifted audio as WAV
    """
    if semitones < -24 or semitones > 24:
        raise HTTPException(status_code=400, detail="Semitones must be between -24 and 24")
    
    if semitones == 0.0:
        # No change needed, return original
        audio_data = await file.read()
        return Response(
            content=audio_data,
            media_type="audio/wav",
            headers={"Content-Disposition": f"attachment; filename=pitched_{file.filename or 'audio.wav'}"}
        )
    
    try:
        import numpy as np
        import librosa
        import soundfile as sf
        
        audio_data = await file.read()
        audio = load_audio_flexible(audio_data, file.filename)
        
        samples = np.array(audio.get_array_of_samples(), dtype=np.float32)
        sample_rate = audio.frame_rate
        
        if audio.channels == 2:
            left = samples[::2] / 32768.0
            right = samples[1::2] / 32768.0
            
            left_shifted = librosa.effects.pitch_shift(left, sr=sample_rate, n_steps=semitones)
            right_shifted = librosa.effects.pitch_shift(right, sr=sample_rate, n_steps=semitones)
            
            min_len = min(len(left_shifted), len(right_shifted))
            left_shifted = left_shifted[:min_len]
            right_shifted = right_shifted[:min_len]
            
            wav_buffer = io.BytesIO()
            stereo_data = np.column_stack([left_shifted, right_shifted])
            sf.write(wav_buffer, stereo_data, sample_rate, format='WAV')
        else:
            samples_float = samples / 32768.0
            shifted_mono = librosa.effects.pitch_shift(samples_float, sr=sample_rate, n_steps=semitones)
            
            wav_buffer = io.BytesIO()
            sf.write(wav_buffer, shifted_mono, sample_rate, format='WAV')
        
        wav_buffer.seek(0)
        
        return Response(
            content=wav_buffer.read(),
            media_type="audio/wav",
            headers={"Content-Disposition": f"attachment; filename=pitched_{file.filename or 'audio.wav'}"}
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Pitch shift failed: {str(e)}")


@router.post("/denoise")
async def denoise_audio(
    file: UploadFile = File(...),
    strength: float = 1.0
):
    """
    Reduce noise from audio using spectral gating.
    
    Args:
        file: Audio file (WAV/MP3)
        strength: Noise reduction strength (0.5 = subtle, 1.0 = normal, 2.0 = aggressive)
    
    Returns:
        Denoised audio as WAV
    """
    try:
        import numpy as np
        from scipy import signal as scipy_signal
        
        audio_data = await file.read()
        audio = load_audio_flexible(audio_data, file.filename)
        
        samples = np.array(audio.get_array_of_samples(), dtype=np.float32)
        sample_rate = audio.frame_rate
        
        def spectral_gate(signal_data, sr, threshold_factor=1.0):
            """Apply spectral gating noise reduction."""
            # STFT parameters
            n_fft = 2048
            hop_length = 512
            
            # Compute STFT
            f, t, Zxx = scipy_signal.stft(signal_data, fs=sr, nperseg=n_fft, noverlap=n_fft - hop_length)
            magnitude = np.abs(Zxx)
            phase = np.angle(Zxx)
            
            # Estimate noise floor from the quietest 10% of frames
            frame_power = np.mean(magnitude ** 2, axis=0)
            noise_frame_count = max(1, int(len(frame_power) * 0.1))
            noise_frames = np.argsort(frame_power)[:noise_frame_count]
            noise_profile = np.mean(magnitude[:, noise_frames], axis=1, keepdims=True)
            
            # Apply spectral gate
            threshold = noise_profile * (1.0 + threshold_factor)
            mask = np.maximum(0, 1 - (threshold / (magnitude + 1e-10)))
            
            # Smooth mask to avoid artifacts
            for i in range(mask.shape[1]):
                mask[:, i] = np.convolve(mask[:, i], np.ones(3)/3, mode='same')
            
            # Apply mask and reconstruct
            cleaned_magnitude = magnitude * mask
            cleaned_Zxx = cleaned_magnitude * np.exp(1j * phase)
            
            _, cleaned = scipy_signal.istft(cleaned_Zxx, fs=sr, nperseg=n_fft, noverlap=n_fft - hop_length)
            
            # Match original length
            if len(cleaned) > len(signal_data):
                cleaned = cleaned[:len(signal_data)]
            elif len(cleaned) < len(signal_data):
                cleaned = np.pad(cleaned, (0, len(signal_data) - len(cleaned)))
            
            return cleaned
        
        # Process each channel
        if audio.channels == 2:
            left = samples[::2]
            right = samples[1::2]
            
            left_clean = spectral_gate(left, sample_rate, strength)
            right_clean = spectral_gate(right, sample_rate, strength)
            
            output = np.empty(len(samples), dtype=np.float32)
            output[::2] = left_clean
            output[1::2] = right_clean
        else:
            output = spectral_gate(samples, sample_rate, strength)
        
        # Normalize to prevent clipping
        max_val = np.max(np.abs(output))
        if max_val > 0:
            output = output / max_val * 0.95
        output = np.clip(output * 32767, -32768, 32767).astype(np.int16)
        
        result = audio._spawn(output.tobytes())
        
        wav_buffer = io.BytesIO()
        result.export(wav_buffer, format="wav")
        wav_buffer.seek(0)
        
        return Response(
            content=wav_buffer.read(),
            media_type="audio/wav",
            headers={"Content-Disposition": f"attachment; filename=denoised_{file.filename or 'audio.wav'}"}
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Denoise failed: {str(e)}")


@router.get("/health")
async def audio_health():
    """Health check for audio service"""
    return {"status": "ok", "service": "audio-conversion"}

