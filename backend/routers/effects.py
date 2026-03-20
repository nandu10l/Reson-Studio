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
    },
    "denoise": {
        "name": "Noise Removal",
        "type": "restoration",
        "description": "Reduces steady noise and background hiss",
        "parameters": {
            "strength": {"type": "float", "min": 0.0, "max": 1.0, "default": 0.7},
            "reduction_db": {"type": "float", "min": 6, "max": 30, "default": 18}
        }
    },
    "vocal_enhance": {
        "name": "Vocal Enhance",
        "type": "mastering",
        "description": "Voice-focused clarity chain (EQ, de-esser, compression)",
        "parameters": {
            "presence_db": {"type": "float", "min": 0, "max": 8, "default": 4},
            "air_db": {"type": "float", "min": 0, "max": 6, "default": 2},
            "de_ess_strength": {"type": "float", "min": 0.0, "max": 1.0, "default": 0.4},
            "compression_amount": {"type": "float", "min": 0.0, "max": 1.0, "default": 0.6}
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


def _build_reverb_ir(sample_rate: int, decay: float, seed: int = 42) -> np.ndarray:
    """
    Build a synthetic room impulse response with early reflections + late
    diffuse tail.  This produces an audible, realistic reverb.

    Args:
        sample_rate: Audio sample rate (e.g. 44100)
        decay: Reverb tail length in seconds
        seed: RNG seed for reproducible noise

    Returns:
        1-D float64 impulse response array
    """
    rng = np.random.default_rng(seed)

    # --- 1. Early reflections (sparse taps) ---
    er_times_ms = [12, 19, 26, 33, 41, 53, 67, 82, 97]  # typical small-room pattern
    er_gains    = [0.75, 0.68, 0.55, 0.48, 0.40, 0.32, 0.25, 0.18, 0.12]
    er_end_ms   = 100  # early reflections span
    er_length   = int(er_end_ms / 1000 * sample_rate)

    er = np.zeros(er_length, dtype=np.float64)
    er[0] = 1.0  # direct impulse
    for t_ms, g in zip(er_times_ms, er_gains):
        idx = int(t_ms / 1000 * sample_rate)
        if idx < er_length:
            er[idx] += g * (1 if rng.random() > 0.5 else -1)  # random polarity

    # --- 2. Late diffuse tail (shaped noise) ---
    tail_length = int(decay * sample_rate)
    t = np.arange(tail_length, dtype=np.float64)

    # RT60 envelope: amplitude that decays to -60 dB over `decay` seconds
    envelope = np.power(10.0, -3.0 * t / (decay * sample_rate))
    # Gaussian noise shaped by envelope
    noise = rng.standard_normal(tail_length) * envelope
    # Scale so the tail start amplitude is below the early reflections
    noise *= 0.35

    # --- 3. Combine early + late ---
    total_length = er_length + tail_length
    ir = np.zeros(total_length, dtype=np.float64)
    ir[:er_length] = er
    ir[er_length:] = noise

    # Normalize peak to 1.0
    peak = np.max(np.abs(ir))
    if peak > 0:
        ir /= peak

    return ir


def apply_reverb(audio: AudioSegment, decay: float = 1.5, mix: float = 50) -> AudioSegment:
    """
    Apply convolution reverb with a synthetic impulse response
    (early reflections + diffuse noise tail).
    """
    sample_rate = audio.frame_rate
    channels = audio.channels
    sample_width = audio.sample_width
    samples = np.array(audio.get_array_of_samples(), dtype=np.float64)

    # Build impulse response(s)
    ir_left  = _build_reverb_ir(sample_rate, decay, seed=42)
    ir_right = _build_reverb_ir(sample_rate, decay, seed=137)  # different noise for stereo width

    wet = np.clip(mix / 100.0, 0.0, 1.0)

    if channels == 2:
        left  = samples[::2].copy()
        right = samples[1::2].copy()
        n = len(left)

        left_wet  = signal.fftconvolve(left,  ir_left,  mode='full')[:n]
        right_wet = signal.fftconvolve(right, ir_right, mode='full')[:n]

        left_out  = left  * (1.0 - wet) + left_wet  * wet
        right_out = right * (1.0 - wet) + right_wet * wet

        output = np.empty(len(samples), dtype=np.float64)
        output[::2]  = left_out
        output[1::2] = right_out
    else:
        n = len(samples)
        reverbed = signal.fftconvolve(samples, ir_left, mode='full')[:n]
        output = samples * (1.0 - wet) + reverbed * wet

    # Soft-clip to prevent harsh distortion
    max_sample = 2 ** (sample_width * 8 - 1) - 1
    min_sample = -(2 ** (sample_width * 8 - 1))
    peak = np.max(np.abs(output))
    if peak > max_sample:
        output = output * (max_sample / peak) * 0.95

    output = np.clip(output, min_sample, max_sample)

    if sample_width == 2:
        raw = output.astype(np.int16).tobytes()
    elif sample_width == 4:
        raw = output.astype(np.int32).tobytes()
    else:
        raw = output.astype(np.int8).tobytes()

    return AudioSegment(
        data=raw,
        sample_width=sample_width,
        frame_rate=sample_rate,
        channels=channels
    )


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


def _audio_to_float_matrix(audio: AudioSegment) -> np.ndarray:
    """Convert AudioSegment samples to float32 matrix in range [-1, 1]."""
    samples = np.array(audio.get_array_of_samples(), dtype=np.float32)
    channels = max(1, int(audio.channels))
    if channels > 1:
        samples = samples.reshape((-1, channels))
    else:
        samples = samples.reshape((-1, 1))

    max_int = float(2 ** (audio.sample_width * 8 - 1))
    return samples / max_int


def _float_matrix_to_audio(audio: AudioSegment, matrix: np.ndarray) -> AudioSegment:
    """Convert float32 matrix in range [-1, 1] back to AudioSegment format."""
    matrix = np.asarray(matrix, dtype=np.float32)
    matrix = np.clip(matrix, -1.0, 1.0)
    channels = max(1, int(audio.channels))

    if channels == 1:
        raw_float = matrix[:, 0]
    else:
        raw_float = matrix.reshape(-1)

    if audio.sample_width == 1:
        pcm = (raw_float * 127.0).astype(np.int8)
    elif audio.sample_width == 2:
        pcm = (raw_float * 32767.0).astype(np.int16)
    else:
        pcm = (raw_float * 2147483647.0).astype(np.int32)

    return AudioSegment(
        data=pcm.tobytes(),
        sample_width=audio.sample_width,
        frame_rate=audio.frame_rate,
        channels=channels,
    )


def apply_denoise(audio: AudioSegment, strength: float = 0.7, reduction_db: float = 18.0) -> AudioSegment:
    """Apply spectral-gate denoise tuned for voice recordings."""
    strength = float(np.clip(strength, 0.0, 1.0))
    reduction_db = float(np.clip(reduction_db, 6.0, 30.0))

    audio = audio.high_pass_filter(70).low_pass_filter(14000)
    x = _audio_to_float_matrix(audio)
    mono = np.mean(x, axis=1)

    nperseg = 1024
    noverlap = 768

    _, _, z_mono = signal.stft(mono, fs=audio.frame_rate, nperseg=nperseg, noverlap=noverlap, boundary=None)
    mag_mono = np.abs(z_mono)

    frame_energy = np.mean(mag_mono, axis=0)
    if frame_energy.size == 0:
        return audio

    lowest_count = max(4, int(frame_energy.size * 0.2))
    low_idx = np.argsort(frame_energy)[:lowest_count]
    noise_profile = np.mean(mag_mono[:, low_idx], axis=1, keepdims=True)

    threshold = noise_profile * (1.0 + 2.5 * strength)
    attenuation_floor = 10 ** (-reduction_db / 20.0)

    out = np.zeros_like(x)
    for ch in range(x.shape[1]):
        _, _, z = signal.stft(x[:, ch], fs=audio.frame_rate, nperseg=nperseg, noverlap=noverlap, boundary=None)
        mag = np.abs(z)
        phase = np.angle(z)

        ratio = mag / (threshold + 1e-9)
        gate = np.clip((ratio - 1.0) / 2.0, 0.0, 1.0)
        soft_mask = attenuation_floor + (1.0 - attenuation_floor) * gate

        kernel = np.ones((3, 3), dtype=np.float32) / 9.0
        soft_mask = signal.convolve2d(soft_mask, kernel, mode='same', boundary='symm')

        z_clean = mag * soft_mask * np.exp(1j * phase)
        _, cleaned = signal.istft(z_clean, fs=audio.frame_rate, nperseg=nperseg, noverlap=noverlap, input_onesided=True)
        if len(cleaned) < x.shape[0]:
            cleaned = np.pad(cleaned, (0, x.shape[0] - len(cleaned)))
        out[:, ch] = cleaned[:x.shape[0]]

    peak = np.max(np.abs(out))
    if peak > 0.98:
        out *= (0.98 / peak)

    return _float_matrix_to_audio(audio, out)


def apply_vocal_enhance(
    audio: AudioSegment,
    presence_db: float = 4.0,
    air_db: float = 2.0,
    de_ess_strength: float = 0.4,
    compression_amount: float = 0.6,
) -> AudioSegment:
    """Apply a vocal-focused enhancement chain for improved intelligibility."""
    presence_db = float(np.clip(presence_db, 0.0, 8.0))
    air_db = float(np.clip(air_db, 0.0, 6.0))
    de_ess_strength = float(np.clip(de_ess_strength, 0.0, 1.0))
    compression_amount = float(np.clip(compression_amount, 0.0, 1.0))

    stage = audio.high_pass_filter(80).low_pass_filter(17000)
    x = _audio_to_float_matrix(stage)
    sr = stage.frame_rate

    # Broad vocal shaping: cut mud, add presence and air.
    b_low, a_low = signal.butter(2, 180 / (sr / 2), btype='low')
    b_mid, a_mid = signal.butter(2, [180 / (sr / 2), 4200 / (sr / 2)], btype='band')
    b_high, a_high = signal.butter(2, 4200 / (sr / 2), btype='high')

    low_g = 10 ** (-2.0 / 20)
    mid_g = 10 ** (presence_db / 20)
    high_g = 10 ** (air_db / 20)

    y = np.zeros_like(x)
    for ch in range(x.shape[1]):
        s = x[:, ch]
        low = signal.filtfilt(b_low, a_low, s) * low_g
        mid = signal.filtfilt(b_mid, a_mid, s) * mid_g
        high = signal.filtfilt(b_high, a_high, s) * high_g
        shaped = low + mid + high

        # Simple adaptive de-esser for sharp sibilance.
        b_ess, a_ess = signal.butter(2, 5500 / (sr / 2), btype='high')
        ess = signal.filtfilt(b_ess, a_ess, shaped)
        env = np.abs(ess)
        threshold = max(1e-5, float(np.percentile(env, 75)))
        reduce = np.clip((env - threshold) / (threshold + 1e-8), 0.0, 1.0) * de_ess_strength
        shaped = shaped - (ess * reduce)

        # Transparent soft saturation for perceived loudness.
        y[:, ch] = np.tanh(shaped * 1.1) / 1.1

    staged = _float_matrix_to_audio(stage, y)
    ratio = 2.0 + compression_amount * 4.0
    threshold = -24 + (1.0 - compression_amount) * 8.0
    compressed = compress_dynamic_range(staged, threshold=threshold, ratio=ratio, attack=3.0, release=90.0)
    return normalize(compressed, headroom=0.8)


@router.post("/apply")
async def apply_effect(
    file: UploadFile = File(...),
    effect_type: str = Form(...),
    params: Optional[str] = Form(None),
    start_ms: Optional[int] = Form(None),
    end_ms: Optional[int] = Form(None)
):
    """
    Apply an effect to an audio file.
    
    Args:
        file: Audio file (WAV/MP3)
        effect_type: Type of effect to apply
        params: JSON string of effect parameters
        start_ms: Start of selection region in ms (None = apply to whole audio)
        end_ms: End of selection region in ms (None = apply to whole audio)
    
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
        
        # Determine if we need to apply to a selection only
        has_selection = (start_ms is not None and end_ms is not None
                         and start_ms >= 0 and end_ms > start_ms)
        
        if has_selection:
            total_ms = len(audio)
            sel_start = max(0, min(start_ms, total_ms))
            sel_end   = max(sel_start, min(end_ms, total_ms))
            # Split into before / selected / after
            before   = audio[:sel_start] if sel_start > 0 else AudioSegment.empty()
            selected = audio[sel_start:sel_end]
            after    = audio[sel_end:] if sel_end < total_ms else AudioSegment.empty()
            target_audio = selected
            print(f"[Effects] Selection: {sel_start}ms - {sel_end}ms ({sel_end - sel_start}ms)")
        else:
            target_audio = audio

        # Apply effect to target audio
        if effect_type == "reverb":
            processed = apply_reverb(
                target_audio,
                decay=effect_params.get("decay", 1.5),
                mix=effect_params.get("mix", 50)
            )
        elif effect_type == "delay":
            processed = apply_delay(
                target_audio,
                time_ms=effect_params.get("time_ms", 300),
                feedback=effect_params.get("feedback", 0.4),
                mix=effect_params.get("mix", 50)
            )
        elif effect_type == "compressor":
            processed = compress_dynamic_range(
                target_audio,
                threshold=effect_params.get("threshold", -20),
                ratio=effect_params.get("ratio", 4.0),
                attack=effect_params.get("attack_ms", 5.0)
            )
        elif effect_type == "eq":
            processed = apply_eq(
                target_audio,
                low_gain=effect_params.get("low_gain", 0),
                mid_gain=effect_params.get("mid_gain", 0),
                high_gain=effect_params.get("high_gain", 0)
            )
        elif effect_type == "normalize":
            headroom = effect_params.get("headroom_db", 0.1)
            processed = normalize(target_audio, headroom=headroom)
        elif effect_type == "denoise":
            processed = apply_denoise(
                target_audio,
                strength=effect_params.get("strength", 0.7),
                reduction_db=effect_params.get("reduction_db", 18),
            )
        elif effect_type == "vocal_enhance":
            processed = apply_vocal_enhance(
                target_audio,
                presence_db=effect_params.get("presence_db", 4),
                air_db=effect_params.get("air_db", 2),
                de_ess_strength=effect_params.get("de_ess_strength", 0.4),
                compression_amount=effect_params.get("compression_amount", 0.6),
            )
        else:
            processed = target_audio
        
        # If selection, splice processed region back into full audio
        if has_selection:
            final = AudioSegment.empty()
            if len(before) > 0:
                final = before
            final = final + processed
            if len(after) > 0:
                final = final + after
            processed = final
        
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
