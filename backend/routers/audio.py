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
import numpy as np

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
    start_ms: int = -1,
    end_ms: int = -1
):
    """
    Apply FL Studio (Edison) style fade in or fade out.

    Uses a logarithmic/exponential curve like FL Studio:
    - Fade In:  exponential ramp (slow start → fast finish) — natural volume build
    - Fade Out: logarithmic ramp (fast start → slow tail) — natural volume decay

    The fade is applied only within the [start_ms, end_ms] region.
    Audio outside that region is left untouched.

    Args:
        file: Audio file (WAV/MP3)
        fade_type: "in" for fade in, "out" for fade out
        start_ms: Start of fade region in ms (-1 = beginning of audio)
        end_ms: End of fade region in ms (-1 = end of audio)

    Returns:
        Audio with fade applied as WAV
    """
    try:
        audio_data = await file.read()
        audio = load_audio_flexible(audio_data, file.filename)

        total_ms = len(audio)
        # Resolve defaults
        if start_ms < 0:
            start_ms = 0
        if end_ms < 0:
            end_ms = total_ms
        start_ms = max(0, min(start_ms, total_ms))
        end_ms   = max(start_ms, min(end_ms, total_ms))
        fade_len_ms = end_ms - start_ms
        if fade_len_ms <= 0:
            fade_len_ms = min(500, total_ms)
            if fade_type == "in":
                start_ms, end_ms = 0, fade_len_ms
            else:
                start_ms, end_ms = total_ms - fade_len_ms, total_ms

        # --- Build the gain envelope via numpy for speed ---
        sample_rate = audio.frame_rate
        channels    = audio.channels
        sample_width = audio.sample_width

        samples = np.array(audio.get_array_of_samples(), dtype=np.float64)
        # Reshape to (num_frames, channels) for multi-channel
        if channels > 1:
            samples = samples.reshape(-1, channels)
        total_frames = samples.shape[0] if channels > 1 else len(samples)

        fade_start_frame = int(start_ms * sample_rate / 1000)
        fade_end_frame   = int(end_ms   * sample_rate / 1000)
        fade_start_frame = max(0, min(fade_start_frame, total_frames))
        fade_end_frame   = max(fade_start_frame, min(fade_end_frame, total_frames))
        fade_frames = fade_end_frame - fade_start_frame

        if fade_frames > 0:
            # t goes from 0.0 → 1.0 across the fade region
            t = np.linspace(0.0, 1.0, fade_frames)

            # FL Studio curve shape factor (controls how steep the curve is)
            # Higher = more pronounced log/exp shape.  ~4 matches FL Studio closely.
            curve = 4.0

            if fade_type == "in":
                # Exponential ramp: slow start, fast finish (FL Studio fade-in)
                gain = (np.exp(curve * t) - 1.0) / (np.exp(curve) - 1.0)
            else:
                # Logarithmic ramp: fast drop, slow tail (FL Studio fade-out)
                gain = (np.exp(curve * (1.0 - t)) - 1.0) / (np.exp(curve) - 1.0)

            if channels > 1:
                gain_2d = gain[:, np.newaxis]  # broadcast to all channels
                samples[fade_start_frame:fade_end_frame] *= gain_2d
            else:
                samples[fade_start_frame:fade_end_frame] *= gain

            # Silence the region before fade-in or after fade-out
            if fade_type == "in" and fade_start_frame > 0:
                if channels > 1:
                    samples[:fade_start_frame] = 0
                else:
                    samples[:fade_start_frame] = 0
            elif fade_type == "out" and fade_end_frame < total_frames:
                if channels > 1:
                    samples[fade_end_frame:] = 0
                else:
                    samples[fade_end_frame:] = 0

        # Clip and convert back
        max_val = (2 ** (sample_width * 8 - 1)) - 1
        min_val = -(2 ** (sample_width * 8 - 1))
        samples = np.clip(samples, min_val, max_val)

        if channels > 1:
            samples = samples.flatten()

        if sample_width == 2:
            raw = samples.astype(np.int16).tobytes()
        elif sample_width == 4:
            raw = samples.astype(np.int32).tobytes()
        else:
            raw = samples.astype(np.int8).tobytes()

        result = AudioSegment(
            data=raw,
            sample_width=sample_width,
            frame_rate=sample_rate,
            channels=channels
        )

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


# ─── Instrument Synthesis ──────────────────────────────────────────────────────

NOTE_FREQS = {
    "C0": 16.35, "C#0": 17.32, "D0": 18.35, "D#0": 19.45, "E0": 20.60, "F0": 21.83,
    "F#0": 23.12, "G0": 24.50, "G#0": 25.96, "A0": 27.50, "A#0": 29.14, "B0": 30.87,
    "C1": 32.70, "C#1": 34.65, "D1": 36.71, "D#1": 38.89, "E1": 41.20, "F1": 43.65,
    "F#1": 46.25, "G1": 49.00, "G#1": 51.91, "A1": 55.00, "A#1": 58.27, "B1": 61.74,
    "C2": 65.41, "C#2": 69.30, "D2": 73.42, "D#2": 77.78, "E2": 82.41, "F2": 87.31,
    "F#2": 92.50, "G2": 98.00, "G#2": 103.83, "A2": 110.00, "A#2": 116.54, "B2": 123.47,
    "C3": 130.81, "C#3": 138.59, "D3": 146.83, "D#3": 155.56, "E3": 164.81, "F3": 174.61,
    "F#3": 185.00, "G3": 196.00, "G#3": 207.65, "A3": 220.00, "A#3": 233.08, "B3": 246.94,
    "C4": 261.63, "C#4": 277.18, "D4": 293.66, "D#4": 311.13, "E4": 329.63, "F4": 349.23,
    "F#4": 369.99, "G4": 392.00, "G#4": 415.30, "A4": 440.00, "A#4": 466.16, "B4": 493.88,
    "C5": 523.25, "C#5": 554.37, "D5": 587.33, "D#5": 622.25, "E5": 659.25, "F5": 698.46,
    "F#5": 739.99, "G5": 783.99, "G#5": 830.61, "A5": 880.00, "A#5": 932.33, "B5": 987.77,
    "C6": 1046.50, "C#6": 1108.73, "D6": 1174.66, "D#6": 1244.51, "E6": 1318.51,
    "F6": 1396.91, "F#6": 1479.98, "G6": 1567.98, "A6": 1760.00, "B6": 1975.53,
    "C7": 2093.00, "A7": 3520.00, "C8": 4186.01,
}


def _adsr_envelope(samples, sr, attack, decay, sustain, release, total_dur):
    """Generate an ADSR envelope array matching len(samples)."""
    import numpy as np
    n = len(samples)
    env = np.ones(n, dtype=np.float32)
    a_end = int(attack * sr)
    d_end = int((attack + decay) * sr)
    r_start = int((total_dur - release) * sr)

    for i in range(min(a_end, n)):
        env[i] = i / max(a_end, 1)
    for i in range(a_end, min(d_end, n)):
        env[i] = 1.0 - (1.0 - sustain) * (i - a_end) / max(d_end - a_end, 1)
    for i in range(d_end, min(r_start, n)):
        env[i] = sustain
    for i in range(max(r_start, 0), n):
        env[i] = sustain * max(0.0, 1.0 - (i - r_start) / max(n - r_start, 1))
    return env


def _synth_piano(freq, duration, sr, velocity):
    import numpy as np
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    # Rich harmonic series (piano-like)
    harmonics = [1, 2, 3, 4, 5, 6, 7, 8]
    weights   = [1.0, 0.5, 0.25, 0.15, 0.08, 0.05, 0.03, 0.02]
    wave = sum(w * np.sin(2 * np.pi * h * freq * t) for h, w in zip(harmonics, weights))
    wave /= sum(weights)
    env = _adsr_envelope(wave, sr, 0.005, 0.6, 0.3, 1.2, duration)
    return wave * env * velocity


def _synth_guitar(freq, duration, sr, velocity):
    import numpy as np
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    # AM synthesis: carrier + modulation (sawtooth-like via harmonics)
    carrier = np.sin(2 * np.pi * freq * t)
    mod = np.sin(2 * np.pi * 2 * freq * t)  # harmonicity=2
    wave = carrier * (1 + 0.5 * mod)
    # Add slight odd harmonics for electric edge
    wave += 0.3 * np.sign(np.sin(2 * np.pi * freq * t))  # light clipping
    wave = np.clip(wave, -1, 1)
    env = _adsr_envelope(wave, sr, 0.002, 0.25, 0.25, 1.0, duration)
    return wave * env * velocity * 0.7


def _synth_bass(freq, duration, sr, velocity):
    import numpy as np
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    wave = 0.6 * np.sin(2 * np.pi * freq * t)
    wave += 0.3 * np.sign(np.sin(2 * np.pi * freq * t))   # square sub
    wave += 0.1 * np.sin(2 * np.pi * 2 * freq * t)
    env = _adsr_envelope(wave, sr, 0.05, 0.2, 0.6, 0.3, duration)
    return wave * env * velocity * 0.8


def _synth_strings(freq, duration, sr, velocity):
    import numpy as np
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    wave = sum((1 / h) * np.sin(2 * np.pi * h * freq * t + (h * 0.1)) for h in range(1, 6))
    # Vibrato
    vibrato = 1.0 + 0.003 * np.sin(2 * np.pi * 5 * t)
    wave *= vibrato
    env = _adsr_envelope(wave, sr, 0.3, 0.1, 0.8, 0.5, duration)
    return wave * env * velocity * 0.45


def _synth_flute(freq, duration, sr, velocity):
    import numpy as np
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    wave = np.sin(2 * np.pi * freq * t) + 0.3 * np.sin(2 * np.pi * 2 * freq * t)
    noise = np.random.randn(len(t)) * 0.04
    env = _adsr_envelope(wave, sr, 0.08, 0.05, 0.9, 0.2, duration)
    return (wave + noise) * env * velocity * 0.6


def _synth_kick(duration, sr, velocity):
    import numpy as np
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    freq_sweep = 150 * np.exp(-30 * t)
    wave = np.sin(2 * np.pi * freq_sweep * t)
    env = np.exp(-12 * t)
    return wave * env * velocity


def _synth_snare(duration, sr, velocity):
    import numpy as np
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    noise = np.random.randn(len(t))
    tone = np.sin(2 * np.pi * 200 * t)
    wave = 0.6 * noise + 0.4 * tone
    env = np.exp(-15 * t)
    return wave * env * velocity * 0.8


SYNTH_FUNCTIONS = {
    "piano": _synth_piano,
    "guitar": _synth_guitar,
    "bass": _synth_bass,
    "strings": _synth_strings,
    "flute": _synth_flute,
}

DRUM_FUNCTIONS = {
    "kick": _synth_kick,
    "snare": _synth_snare,
}


@router.post("/synthesize")
async def synthesize_instrument(
    instrument: str = "piano",
    note: str = "C4",
    duration: float = 1.0,
    velocity: float = 0.8,
    bpm: float = 120.0,
    sample_rate: int = 44100,
):
    """
    Synthesize a single instrument note server-side using numpy.

    Args:
        instrument: Instrument name — piano | guitar | bass | strings | flute | kick | snare
        note: Note name (e.g. C4, A3, F#2). Ignored for drums.
        duration: Duration in seconds (default 1.0)
        velocity: Amplitude 0.0\u20131.0 (default 0.8)
        bpm: BPM for duration calculation (optional context)
        sample_rate: Sample rate in Hz (default 44100)

    Returns:
        WAV audio file (mono, 44100 Hz, 16-bit)
    """
    try:
        import numpy as np

        instrument = instrument.lower().strip()
        duration = max(0.05, min(duration, 30.0))
        velocity = max(0.0, min(velocity, 1.0))

        # Resolve note frequency
        note_upper = note.upper().replace("B", "A#").replace("\u266f", "#").replace("\u266d", "b")
        # Handle flats: Bb -> A#, Eb -> D#, etc.
        flat_map = {"BB": "A#", "EB": "D#", "AB": "G#", "DB": "C#", "GB": "F#"}
        for flat, sharp in flat_map.items():
            if note_upper.replace("#", "").startswith(flat):
                note_upper = sharp + note_upper[-1]

        if instrument in DRUM_FUNCTIONS:
            fn = DRUM_FUNCTIONS[instrument]
            samples = fn(duration, sample_rate, velocity)
        else:
            freq = NOTE_FREQS.get(note.upper(), NOTE_FREQS.get("C4", 261.63))
            fn = SYNTH_FUNCTIONS.get(instrument, SYNTH_FUNCTIONS["piano"])
            samples = fn(freq, duration, sample_rate, velocity)

        # Normalize and convert to 16-bit PCM
        max_val = np.max(np.abs(samples))
        if max_val > 0:
            samples = samples / max_val * 0.92
        samples_int = (samples * 32767).astype(np.int16)

        # Write to WAV buffer
        wav_buffer = io.BytesIO()
        import wave as wave_module
        with wave_module.open(wav_buffer, 'w') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)  # 16-bit
            wf.setframerate(sample_rate)
            wf.writeframes(samples_int.tobytes())
        wav_buffer.seek(0)

        return Response(
            content=wav_buffer.read(),
            media_type="audio/wav",
            headers={
                "Content-Disposition": f"attachment; filename={instrument}_{note}_{duration:.2f}s.wav",
                "X-Instrument": instrument,
                "X-Note": note,
                "X-Duration": str(duration),
            }
        )

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Synthesis failed: {str(e)}")


@router.get("/synthesize/instruments")
async def list_synth_instruments():
    """List all available instruments for synthesis"""
    return {
        "melodic": list(SYNTH_FUNCTIONS.keys()),
        "drums": list(DRUM_FUNCTIONS.keys()),
        "notes": list(NOTE_FREQS.keys()),
        "example": "/audio/synthesize?instrument=guitar&note=E2&duration=0.5&velocity=0.8"
    }

