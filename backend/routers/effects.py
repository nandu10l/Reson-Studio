"""
Effects router - Server-side audio effects processing
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import Response
from pydub import AudioSegment
from pydub.effects import normalize, compress_dynamic_range
import io
import numpy as np
from scipy import signal
from typing import Optional

router = APIRouter(prefix="/effects", tags=["effects"])

# Available effects and their parameters
AVAILABLE_EFFECTS = {
    "reverb": {
        "name": "Reverb",
        "type": "spatial",
        "description": "Adds spatial depth and room ambience",
        "parameters": {
            "decay": {"type": "float", "min": 0.1, "max": 5.0, "default": 1.5},
            "mix": {"type": "float", "min": 0, "max": 100, "default": 50}
        }
    },
    "delay": {
        "name": "Delay",
        "type": "temporal",
        "description": "Echo effect with feedback",
        "parameters": {
            "time_ms": {"type": "int", "min": 50, "max": 2000, "default": 300},
            "feedback": {"type": "float", "min": 0, "max": 0.9, "default": 0.4},
            "mix": {"type": "float", "min": 0, "max": 100, "default": 50}
        }
    },
    "compressor": {
        "name": "Compressor",
        "type": "dynamics",
        "description": "Dynamic range compression",
        "parameters": {
            "threshold": {"type": "float", "min": -60, "max": 0, "default": -20},
            "ratio": {"type": "float", "min": 1, "max": 20, "default": 4},
            "attack_ms": {"type": "float", "min": 0.1, "max": 100, "default": 5}
        }
    },
    "eq": {
        "name": "Parametric EQ",
        "type": "filter",
        "description": "3-band equalizer",
        "parameters": {
            "low_gain": {"type": "float", "min": -12, "max": 12, "default": 0},
            "mid_gain": {"type": "float", "min": -12, "max": 12, "default": 0},
            "high_gain": {"type": "float", "min": -12, "max": 12, "default": 0}
        }
    },
    "normalize": {
        "name": "Normalize",
        "type": "utility",
        "description": "Normalize audio levels",
        "parameters": {
            "headroom_db": {"type": "float", "min": 0, "max": 6, "default": 0.1}
        }
    }
}


@router.get("/list")
async def list_effects():
    """Get list of available server-side effects"""
    return {
        "effects": AVAILABLE_EFFECTS,
        "count": len(AVAILABLE_EFFECTS)
    }


@router.get("/health")
async def effects_health():
    """Health check for effects service"""
    return {"status": "ok", "service": "effects-processing"}


def apply_reverb(audio: AudioSegment, decay: float = 1.5, mix: float = 50) -> AudioSegment:
    """Apply simple reverb effect using convolution"""
    samples = np.array(audio.get_array_of_samples(), dtype=np.float32)
    sample_rate = audio.frame_rate
    
    # Create impulse response (exponential decay)
    ir_length = int(decay * sample_rate)
    ir = np.exp(-np.linspace(0, decay * 3, ir_length))
    ir = ir / np.sum(ir)  # Normalize
    
    # Convolve (apply reverb)
    if audio.channels == 2:
        # Stereo
        left = samples[::2]
        right = samples[1::2]
        left_reverb = signal.fftconvolve(left, ir, mode='full')[:len(left)]
        right_reverb = signal.fftconvolve(right, ir, mode='full')[:len(right)]
        
        # Mix wet/dry
        wet = mix / 100
        left_out = left * (1 - wet) + left_reverb * wet
        right_out = right * (1 - wet) + right_reverb * wet
        
        # Interleave
        output = np.empty(len(samples), dtype=np.float32)
        output[::2] = left_out
        output[1::2] = right_out
    else:
        # Mono
        reverb = signal.fftconvolve(samples, ir, mode='full')[:len(samples)]
        wet = mix / 100
        output = samples * (1 - wet) + reverb * wet
    
    # Normalize to prevent clipping
    max_val = np.max(np.abs(output))
    if max_val > 0:
        output = output / max_val * 0.95
    output = np.clip(output * 32767, -32768, 32767).astype(np.int16)
    
    return audio._spawn(output.tobytes())


def apply_delay(audio: AudioSegment, time_ms: int = 300, feedback: float = 0.4, mix: float = 50) -> AudioSegment:
    """Apply delay/echo effect"""
    samples = np.array(audio.get_array_of_samples(), dtype=np.float32)
    sample_rate = audio.frame_rate
    
    delay_samples = int(time_ms * sample_rate / 1000)
    output = samples.copy()
    
    # Apply delay with feedback
    for i in range(delay_samples, len(samples)):
        output[i] += output[i - delay_samples] * feedback
    
    # Mix wet/dry
    wet = mix / 100
    output = samples * (1 - wet) + output * wet
    
    # Normalize
    max_val = np.max(np.abs(output))
    if max_val > 0:
        output = output / max_val * 0.95
    output = np.clip(output * 32767, -32768, 32767).astype(np.int16)
    
    return audio._spawn(output.tobytes())


def apply_eq(audio: AudioSegment, low_gain: float = 0, mid_gain: float = 0, high_gain: float = 0) -> AudioSegment:
    """Apply 3-band EQ using butterworth filters"""
    samples = np.array(audio.get_array_of_samples(), dtype=np.float32)
    sample_rate = audio.frame_rate
    
    # Design filters
    low_freq = 200  # Low band cutoff
    high_freq = 4000  # High band cutoff
    
    # Low shelf (low pass for low band)
    b_low, a_low = signal.butter(2, low_freq / (sample_rate / 2), btype='low')
    # High shelf (high pass for high band)
    b_high, a_high = signal.butter(2, high_freq / (sample_rate / 2), btype='high')
    # Mid band (bandpass)
    b_mid, a_mid = signal.butter(2, [low_freq / (sample_rate / 2), high_freq / (sample_rate / 2)], btype='band')
    
    # Apply filters
    low_band = signal.filtfilt(b_low, a_low, samples) * (10 ** (low_gain / 20))
    mid_band = signal.filtfilt(b_mid, a_mid, samples) * (10 ** (mid_gain / 20))
    high_band = signal.filtfilt(b_high, a_high, samples) * (10 ** (high_gain / 20))
    
    # Combine bands
    output = low_band + mid_band + high_band
    
    # Normalize
    max_val = np.max(np.abs(output))
    if max_val > 0:
        output = output / max_val * 0.95
    output = np.clip(output * 32767, -32768, 32767).astype(np.int16)
    
    return audio._spawn(output.tobytes())


@router.post("/apply")
async def apply_effect(
    file: UploadFile = File(...),
    effect_type: str = Form(...),
    params: Optional[str] = Form(None)
):
    """
    Apply an effect to an audio file.
    
    Args:
        file: Audio file (WAV/MP3)
        effect_type: Type of effect to apply
        params: JSON string of effect parameters
    
    Returns:
        Processed audio file as WAV
    """
    import json
    import traceback
    
    if effect_type not in AVAILABLE_EFFECTS:
        raise HTTPException(status_code=400, detail=f"Unknown effect type: {effect_type}")
    
    try:
        effect_params = json.loads(params) if params else {}
    except json.JSONDecodeError:
        effect_params = {}
    
    try:
        # Read audio file
        audio_data = await file.read()
        
        if not audio_data or len(audio_data) == 0:
            raise HTTPException(status_code=400, detail="Empty audio file received")
        
        print(f"[Effects] Received file: {file.filename}, size: {len(audio_data)} bytes, content_type: {file.content_type}")
        print(f"[Effects] Effect: {effect_type}, params: {effect_params}")
        
        # Detect format and load - try multiple strategies
        audio = None
        filename = (file.filename or "").lower()
        
        # Try based on filename extension first
        if filename.endswith('.mp3'):
            try:
                audio = AudioSegment.from_file(io.BytesIO(audio_data), format="mp3")
            except Exception:
                pass
        elif filename.endswith('.wav'):
            try:
                audio = AudioSegment.from_file(io.BytesIO(audio_data), format="wav")
            except Exception:
                pass
        elif filename.endswith('.ogg'):
            try:
                audio = AudioSegment.from_file(io.BytesIO(audio_data), format="ogg")
            except Exception:
                pass
        elif filename.endswith('.webm'):
            try:
                audio = AudioSegment.from_file(io.BytesIO(audio_data), format="webm")
            except Exception:
                pass
        
        # If format detection by extension failed, try auto-detect
        if audio is None:
            for fmt in ["wav", "mp3", "ogg", "webm", "raw"]:
                try:
                    audio = AudioSegment.from_file(io.BytesIO(audio_data), format=fmt)
                    print(f"[Effects] Successfully loaded as {fmt}")
                    break
                except Exception:
                    continue
        
        # Last resort: let pydub auto-detect via ffmpeg
        if audio is None:
            try:
                audio = AudioSegment.from_file(io.BytesIO(audio_data))
                print(f"[Effects] Loaded via ffmpeg auto-detect")
            except Exception as e:
                raise HTTPException(
                    status_code=400, 
                    detail=f"Could not load audio file. Format not recognized. Filename: {file.filename}, Error: {str(e)}"
                )
        
        print(f"[Effects] Audio loaded: {audio.frame_rate}Hz, {audio.channels}ch, {len(audio)}ms")
        
        # Apply effect
        if effect_type == "reverb":
            processed = apply_reverb(
                audio,
                decay=effect_params.get("decay", 1.5),
                mix=effect_params.get("mix", 50)
            )
        elif effect_type == "delay":
            processed = apply_delay(
                audio,
                time_ms=effect_params.get("time_ms", 300),
                feedback=effect_params.get("feedback", 0.4),
                mix=effect_params.get("mix", 50)
            )
        elif effect_type == "compressor":
            processed = compress_dynamic_range(
                audio,
                threshold=effect_params.get("threshold", -20),
                ratio=effect_params.get("ratio", 4.0),
                attack=effect_params.get("attack_ms", 5.0)
            )
        elif effect_type == "eq":
            processed = apply_eq(
                audio,
                low_gain=effect_params.get("low_gain", 0),
                mid_gain=effect_params.get("mid_gain", 0),
                high_gain=effect_params.get("high_gain", 0)
            )
        elif effect_type == "normalize":
            headroom = effect_params.get("headroom_db", 0.1)
            processed = normalize(audio, headroom=headroom)
        else:
            processed = audio
        
        # Export as WAV
        wav_buffer = io.BytesIO()
        processed.export(wav_buffer, format="wav")
        wav_buffer.seek(0)
        
        output_filename = f"processed_{file.filename}" if file.filename else "processed_audio.wav"
        
        return Response(
            content=wav_buffer.read(),
            media_type="audio/wav",
            headers={
                "Content-Disposition": f"attachment; filename={output_filename}"
            }
        )
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"[Effects] ERROR processing effect '{effect_type}': {str(e)}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Effect processing failed: {str(e)}")
