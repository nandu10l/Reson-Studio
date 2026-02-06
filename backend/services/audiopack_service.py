"""
AudioPack Service - Generates and caches synthesized audio samples
Uses scipy/numpy for consistent, high-quality audio generation
"""

import os
import hashlib
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, lfilter, sawtooth, square
from typing import Optional, Tuple, Any
import json

# Cache directory for generated samples
CACHE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "generated_audio", "audiopack_cache")

# Ensure cache directory exists
os.makedirs(CACHE_DIR, exist_ok=True)

# Standard sample rate
SAMPLE_RATE = 44100


def get_cache_key(sample_id: str, pack_type: str, duration: float, bpm: int) -> str:
    """Generate a unique cache key for a sample configuration"""
    key_str = f"{sample_id}_{pack_type}_{duration:.3f}_{bpm}"
    return hashlib.md5(key_str.encode()).hexdigest()


def get_cached_sample(sample_id: str, pack_type: str, duration: float, bpm: int) -> Optional[str]:
    """Check if a sample is cached and return the file path if it exists"""
    cache_key = get_cache_key(sample_id, pack_type, duration, bpm)
    cache_path = os.path.join(CACHE_DIR, f"{cache_key}.wav")
    
    if os.path.exists(cache_path):
        return cache_path
    return None


def generate_and_cache_sample(sample_id: str, pack_type: str, duration: float, bpm: int = 120) -> str:
    """Generate a sample and cache it, returning the file path"""
    
    # Check cache first
    cached = get_cached_sample(sample_id, pack_type, duration, bpm)
    if cached:
        return cached
    
    # Generate the sample
    audio_data = generate_sample(sample_id, pack_type, duration, bpm)
    
    # Normalize and convert to 16-bit
    audio_data = np.clip(audio_data, -1.0, 1.0)
    audio_int16 = (audio_data * 32767).astype(np.int16)
    
    # Save to cache
    cache_key = get_cache_key(sample_id, pack_type, duration, bpm)
    cache_path = os.path.join(CACHE_DIR, f"{cache_key}.wav")
    wavfile.write(cache_path, SAMPLE_RATE, audio_int16)
    
    return cache_path


def generate_sample(sample_id: str, pack_type: str, duration: float, bpm: int) -> np.ndarray:
    """Generate audio data for a specific sample"""
    
    num_samples = int(SAMPLE_RATE * duration)
    t = np.linspace(0, duration, num_samples, dtype=np.float32)
    
    if pack_type == 'risers':
        return generate_riser(sample_id, t, duration)
    elif pack_type == 'swooshes':
        return generate_swoosh(sample_id, t, duration)
    elif pack_type == 'clicks':
        return generate_click(sample_id, t, duration)
    elif pack_type == 'bassNotes':
        return generate_bass(sample_id, t, duration)
    elif pack_type == 'beeps':
        return generate_beep(sample_id, t, duration)
    elif pack_type == 'fx':
        return generate_fx(sample_id, t, duration)
    else:
        # Default: simple sine beep
        return np.sin(2 * np.pi * 440 * t) * envelope_adsr(t, 0.01, 0.1, 0.5, 0.2, duration)


# === Helper Functions ===

def envelope_adsr(t: np.ndarray, attack: float, decay: float, sustain: float, release: float, duration: float) -> np.ndarray:
    """Generate ADSR envelope"""
    env = np.zeros_like(t)
    
    for i, time in enumerate(t):
        if time < attack:
            env[i] = time / attack
        elif time < attack + decay:
            env[i] = 1.0 - (1.0 - sustain) * (time - attack) / decay
        elif time < duration - release:
            env[i] = sustain
        else:
            remaining = duration - time
            env[i] = sustain * (remaining / release) if release > 0 else 0
    
    return env


def lowpass_filter(data: np.ndarray, cutoff: float, order: int = 4) -> np.ndarray:
    """Apply a lowpass filter"""
    nyquist = SAMPLE_RATE / 2
    normalized_cutoff = min(cutoff / nyquist, 0.99)
    coeffs: Any = butter(order, normalized_cutoff, btype='low', output='ba')
    b, a = coeffs[0], coeffs[1]
    result: Any = lfilter(b, a, data)
    return np.asarray(result)


def highpass_filter(data: np.ndarray, cutoff: float, order: int = 4) -> np.ndarray:
    """Apply a highpass filter"""
    nyquist = SAMPLE_RATE / 2
    normalized_cutoff = min(cutoff / nyquist, 0.99)
    coeffs: Any = butter(order, normalized_cutoff, btype='high', output='ba')
    b, a = coeffs[0], coeffs[1]
    result: Any = lfilter(b, a, data)
    return np.asarray(result)


def bandpass_filter(data: np.ndarray, low: float, high: float, order: int = 4) -> np.ndarray:
    """Apply a bandpass filter"""
    nyquist = SAMPLE_RATE / 2
    low_norm = min(low / nyquist, 0.99)
    high_norm = min(high / nyquist, 0.99)
    if low_norm >= high_norm:
        high_norm = low_norm + 0.01
    coeffs: Any = butter(order, [low_norm, high_norm], btype='band', output='ba')
    b, a = coeffs[0], coeffs[1]
    result: Any = lfilter(b, a, data)
    return np.asarray(result)


def generate_noise(num_samples: int, noise_type: str = 'white') -> np.ndarray:
    """Generate different types of noise"""
    if noise_type == 'white':
        return np.random.randn(num_samples).astype(np.float32)
    elif noise_type == 'pink':
        # Pink noise approximation using multiple filtered white noise
        white = np.random.randn(num_samples).astype(np.float32)
        # Simple pink noise approximation
        pink = lowpass_filter(white, 1000)
        pink += lowpass_filter(white, 500) * 0.5
        pink += lowpass_filter(white, 250) * 0.25
        return pink / np.max(np.abs(pink) + 1e-6)
    elif noise_type == 'brown':
        # Brown noise (random walk)
        white = np.random.randn(num_samples).astype(np.float32)
        brown = np.cumsum(white)
        brown = brown - np.mean(brown)
        return brown / (np.max(np.abs(brown)) + 1e-6)
    return np.random.randn(num_samples).astype(np.float32)


def freq_sweep(t: np.ndarray, start_freq: float, end_freq: float) -> np.ndarray:
    """Generate a frequency sweep (chirp)"""
    # Exponential sweep
    freq_ratio = end_freq / start_freq
    phase = 2 * np.pi * start_freq * t[-1] / np.log(freq_ratio) * (np.power(freq_ratio, t / t[-1]) - 1)
    return np.sin(phase)


# === Riser Generators ===

def generate_riser(sample_id: str, t: np.ndarray, duration: float) -> np.ndarray:
    num_samples = len(t)
    
    if sample_id == 'riser-white':
        # White noise riser with sweeping filter
        noise = generate_noise(num_samples, 'white')
        # Sweep cutoff from 100Hz to 12kHz
        cutoffs = np.linspace(100, 12000, num_samples)
        output = np.zeros(num_samples, dtype=np.float32)
        chunk_size = num_samples // 50
        for i in range(0, num_samples, chunk_size):
            end_idx = min(i + chunk_size, num_samples)
            cutoff = cutoffs[i + chunk_size // 2] if i + chunk_size // 2 < num_samples else cutoffs[-1]
            output[i:end_idx] = lowpass_filter(noise[i:end_idx], cutoff)
        # Volume envelope
        envelope = np.linspace(0.3, 1.0, num_samples) * envelope_adsr(t, 0.01, 0.1, 0.9, duration * 0.05, duration)
        return output * envelope * 0.7
    
    elif sample_id == 'riser-sweep':
        # Sawtooth frequency sweep
        sweep = freq_sweep(t, 80, 800)
        saw = sawtooth(2 * np.pi * 200 * t + sweep * 10)
        envelope = envelope_adsr(t, duration * 0.9, 0.05, 0.8, duration * 0.05, duration)
        return lowpass_filter(saw * envelope, 4000) * 0.5
    
    elif sample_id == 'riser-cinematic':
        # Layered cinematic riser
        noise = generate_noise(num_samples, 'pink')
        sine_sweep = freq_sweep(t, 100, 600)
        # Layer noise and tone
        output = noise * 0.4 + np.sin(2 * np.pi * 150 * t + sine_sweep * 5) * 0.6
        # Sweeping filter
        cutoffs = np.linspace(200, 6000, num_samples)
        filtered = np.zeros(num_samples, dtype=np.float32)
        chunk_size = num_samples // 30
        for i in range(0, num_samples, chunk_size):
            end_idx = min(i + chunk_size, num_samples)
            cutoff = cutoffs[min(i + chunk_size // 2, num_samples - 1)]
            filtered[i:end_idx] = lowpass_filter(output[i:end_idx], cutoff)
        envelope = envelope_adsr(t, duration * 0.9, 0.05, 0.7, duration * 0.05, duration)
        return filtered * envelope * 0.6
    
    elif sample_id == 'riser-reverse':
        # Reverse crash simulation
        noise = generate_noise(num_samples, 'white')
        filtered = highpass_filter(noise, 2000)
        # Volume swell (reverse envelope)
        envelope = np.power(t / duration, 2)  # Quadratic rise
        envelope *= envelope_adsr(t, duration * 0.95, 0.01, 0.9, duration * 0.05, duration)
        return filtered * envelope * 0.5
    
    elif sample_id == 'riser-tension':
        # Dissonant tension builder
        saw1 = sawtooth(2 * np.pi * 80 * t)  # C2
        saw2 = sawtooth(2 * np.pi * 84.9 * t)  # Db2 (semitone up for dissonance)
        combined = saw1 * 0.6 + saw2 * 0.4
        # Sweeping bandpass
        filtered = bandpass_filter(combined, 300, 3000)
        envelope = envelope_adsr(t, duration * 0.9, 0.05, 0.7, duration * 0.05, duration)
        return filtered * envelope * 0.5
    
    elif sample_id == 'riser-sub':
        # Deep sub riser
        noise = generate_noise(num_samples, 'brown')
        sine = np.sin(2 * np.pi * 40 * t)
        combined = noise * 0.3 + sine * 0.7
        # Keep it very low
        filtered = lowpass_filter(combined, 200)
        envelope = envelope_adsr(t, duration * 0.9, 0.05, 0.8, duration * 0.05, duration)
        return filtered * envelope * 0.8
    
    else:
        # Default riser
        noise = generate_noise(num_samples, 'pink')
        envelope = np.linspace(0.2, 1.0, num_samples)
        return lowpass_filter(noise, 8000) * envelope * 0.5


# === Swoosh Generators ===

def generate_swoosh(sample_id: str, t: np.ndarray, duration: float) -> np.ndarray:
    num_samples = len(t)
    
    if sample_id == 'swoosh-fast':
        noise = generate_noise(num_samples, 'white')
        # Fast high-to-low sweep
        cutoffs = np.linspace(10000, 100, num_samples)
        output = np.zeros(num_samples, dtype=np.float32)
        chunk_size = max(num_samples // 20, 1)
        for i in range(0, num_samples, chunk_size):
            end_idx = min(i + chunk_size, num_samples)
            cutoff = cutoffs[min(i + chunk_size // 2, num_samples - 1)]
            output[i:end_idx] = bandpass_filter(noise[i:end_idx], max(cutoff * 0.5, 50), cutoff)
        envelope = envelope_adsr(t, 0.001, duration * 0.3, 0.5, duration * 0.6, duration)
        return output * envelope * 0.7
    
    elif sample_id == 'swoosh-slow':
        noise = generate_noise(num_samples, 'pink')
        cutoffs = np.linspace(6000, 200, num_samples)
        output = np.zeros(num_samples, dtype=np.float32)
        chunk_size = num_samples // 30
        for i in range(0, num_samples, chunk_size):
            end_idx = min(i + chunk_size, num_samples)
            cutoff = cutoffs[min(i + chunk_size // 2, num_samples - 1)]
            output[i:end_idx] = bandpass_filter(noise[i:end_idx], max(cutoff * 0.3, 50), cutoff)
        envelope = envelope_adsr(t, 0.01, duration * 0.5, 0.4, duration * 0.4, duration)
        return output * envelope * 0.6
    
    elif sample_id == 'swoosh-vinyl':
        noise = generate_noise(num_samples, 'brown')
        # Add some crackle
        crackle = np.random.randn(num_samples) * 0.1
        crackle[np.random.rand(num_samples) > 0.01] = 0
        combined = noise + crackle
        filtered = bandpass_filter(combined, 500, 3000)
        envelope = envelope_adsr(t, 0.01, duration * 0.4, 0.5, duration * 0.5, duration)
        return filtered * envelope * 0.5
    
    elif sample_id == 'swoosh-air':
        noise = generate_noise(num_samples, 'pink')
        cutoffs = np.linspace(8000, 1000, num_samples)
        output = lowpass_filter(noise, 5000)
        envelope = envelope_adsr(t, 0.01, duration * 0.3, 0.4, duration * 0.6, duration)
        return output * envelope * 0.4
    
    elif sample_id == 'swoosh-transition':
        noise = generate_noise(num_samples, 'white')
        # Bi-directional sweep: up then down
        mid = num_samples // 2
        cutoffs = np.concatenate([
            np.linspace(200, 8000, mid),
            np.linspace(8000, 200, num_samples - mid)
        ])
        output = np.zeros(num_samples, dtype=np.float32)
        chunk_size = num_samples // 40
        for i in range(0, num_samples, chunk_size):
            end_idx = min(i + chunk_size, num_samples)
            cutoff = cutoffs[min(i + chunk_size // 2, num_samples - 1)]
            output[i:end_idx] = bandpass_filter(noise[i:end_idx], max(cutoff * 0.3, 50), cutoff)
        envelope = envelope_adsr(t, 0.01, 0.1, 0.8, duration * 0.1, duration)
        return output * envelope * 0.6
    
    else:
        noise = generate_noise(num_samples, 'white')
        filtered = bandpass_filter(noise, 200, 8000)
        envelope = np.linspace(1.0, 0.0, num_samples)
        return filtered * envelope * 0.5


# === Click Generators ===

def generate_click(sample_id: str, t: np.ndarray, duration: float) -> np.ndarray:
    num_samples = len(t)
    
    if sample_id == 'click-vintage':
        # Warm analog click
        freq = 350
        click = np.sin(2 * np.pi * freq * t) * np.exp(-t * 80)
        return click * 0.8
    
    elif sample_id == 'click-finger-snap':
        noise = generate_noise(num_samples, 'white')
        filtered = highpass_filter(noise, 3000)
        envelope = np.exp(-t * 50)
        return filtered * envelope * 0.6
    
    elif sample_id == 'click-wood':
        # Woody tonal click
        freq = 800
        width_val: Any = 0.5
        tri = sawtooth(2 * np.pi * freq * t, width=width_val)  # Triangle wave
        envelope = np.exp(-t * 100)
        return tri * envelope * 0.7
    
    elif sample_id == 'click-digital':
        # Sharp electronic click
        freq = 1760  # A6
        sq = square(2 * np.pi * freq * t)
        envelope = np.exp(-t * 150)
        return sq * envelope * 0.4
    
    elif sample_id == 'click-metronome':
        # Classic tick
        freq = 1047  # C6
        sine = np.sin(2 * np.pi * freq * t)
        envelope = np.exp(-t * 80)
        return sine * envelope * 0.6
    
    elif sample_id == 'click-mouth':
        noise = generate_noise(num_samples, 'pink')
        filtered = bandpass_filter(noise, 1500, 3500)
        envelope = np.exp(-t * 60)
        return filtered * envelope * 0.5
    
    else:
        freq = 660
        sine = np.sin(2 * np.pi * freq * t)
        envelope = np.exp(-t * 70)
        return sine * envelope * 0.6


# === Bass Generators ===

def generate_bass(sample_id: str, t: np.ndarray, duration: float) -> np.ndarray:
    num_samples = len(t)
    
    if sample_id == 'bass-808':
        # Classic 808 sub
        freq_start = 150
        freq_end = 40
        freq = freq_start * np.power(freq_end / freq_start, t / duration)
        phase = 2 * np.pi * np.cumsum(freq) / SAMPLE_RATE
        sine = np.sin(phase)
        envelope = envelope_adsr(t, 0.001, duration * 0.5, 0.2, duration * 0.4, duration)
        return sine * envelope * 0.9
    
    elif sample_id == 'bass-deep':
        # Deep sustained bass
        freq = 41.2  # E1
        sine = np.sin(2 * np.pi * freq * t)
        envelope = envelope_adsr(t, 0.01, duration * 0.3, 0.4, duration * 0.5, duration)
        return sine * envelope * 0.8
    
    elif sample_id == 'bass-punch':
        # Punchy percussive bass
        freq = 49  # G1
        width_val: Any = 0.5
        tri = sawtooth(2 * np.pi * freq * t, width=width_val)
        envelope = envelope_adsr(t, 0.005, 0.1, 0.2, 0.15, duration)
        filtered = lowpass_filter(tri, 400)
        return filtered * envelope * 0.8
    
    elif sample_id == 'bass-reese':
        # Detuned reese bass
        freq = 36.7  # D1
        saw1 = sawtooth(2 * np.pi * freq * t)
        saw2 = sawtooth(2 * np.pi * freq * 1.01 * t)  # Slight detune
        combined = (saw1 + saw2) * 0.5
        envelope = envelope_adsr(t, 0.01, duration * 0.3, 0.5, duration * 0.3, duration)
        filtered = lowpass_filter(combined, 600)
        return filtered * envelope * 0.6
    
    elif sample_id == 'bass-wobble':
        # LFO modulated wobble bass
        freq = 41.2  # E1
        lfo_rate = 4  # Hz
        lfo = np.sin(2 * np.pi * lfo_rate * t)
        cutoff_mod = 400 + lfo * 300  # 100-700 Hz
        saw = sawtooth(2 * np.pi * freq * t)
        # Approximate time-varying filter
        output = np.zeros(num_samples, dtype=np.float32)
        chunk_size = num_samples // 50
        for i in range(0, num_samples, chunk_size):
            end_idx = min(i + chunk_size, num_samples)
            cutoff = cutoff_mod[min(i + chunk_size // 2, num_samples - 1)]
            output[i:end_idx] = lowpass_filter(saw[i:end_idx], max(cutoff, 50))
        envelope = envelope_adsr(t, 0.01, 0.1, 0.8, 0.2, duration)
        return output * envelope * 0.6
    
    elif sample_id == 'bass-slide':
        # Sliding bass
        freq_start = 32.7  # C1
        freq_end = 49  # G1
        freq = freq_start * np.power(freq_end / freq_start, np.clip(t / (duration * 0.4), 0, 1))
        phase = 2 * np.pi * np.cumsum(freq) / SAMPLE_RATE
        sine = np.sin(phase)
        envelope = envelope_adsr(t, 0.01, duration * 0.4, 0.4, duration * 0.4, duration)
        return sine * envelope * 0.8
    
    else:
        freq = 32.7  # C1
        sine = np.sin(2 * np.pi * freq * t)
        envelope = envelope_adsr(t, 0.005, duration * 0.4, 0.3, duration * 0.5, duration)
        return sine * envelope * 0.7


# === Beep Generators ===

def generate_beep(sample_id: str, t: np.ndarray, duration: float) -> np.ndarray:
    num_samples = len(t)
    
    if sample_id == 'beep-alert':
        # Double alert beep
        freq = 880  # A5
        beep1 = np.sin(2 * np.pi * freq * t) * (t < 0.1)
        beep2 = np.sin(2 * np.pi * freq * t) * ((t > 0.15) & (t < 0.25))
        envelope = envelope_adsr(t, 0.01, 0.05, 0.5, 0.05, duration)
        return (beep1 + beep2) * 0.5
    
    elif sample_id == 'beep-scan':
        # Sci-fi scanning tone
        sweep = freq_sweep(t, 523, 2093)  # C5 to C7
        envelope = envelope_adsr(t, 0.02, duration * 0.3, 0.3, duration * 0.5, duration)
        return sweep * envelope * 0.4
    
    elif sample_id == 'beep-notification':
        # Pleasant two-tone chime
        freq1 = 659  # E5
        freq2 = 784  # G5
        tone1 = np.sin(2 * np.pi * freq1 * t) * (t < duration * 0.4)
        tone2 = np.sin(2 * np.pi * freq2 * t) * (t > duration * 0.2)
        envelope = envelope_adsr(t, 0.01, duration * 0.3, 0.3, duration * 0.4, duration)
        return (tone1 * 0.5 + tone2 * 0.5) * envelope * 0.5
    
    elif sample_id == 'beep-retro':
        # 8-bit style arpeggiated beep
        freqs = [523, 659, 784]  # C5, E5, G5
        output = np.zeros(num_samples, dtype=np.float32)
        note_len = num_samples // 3
        for i, freq in enumerate(freqs):
            start = i * note_len
            end = min(start + note_len, num_samples)
            t_note = t[start:end] - t[start]
            output[start:end] = square(2 * np.pi * freq * t_note) * np.exp(-t_note * 15)
        return output * 0.3
    
    elif sample_id == 'beep-robot':
        # Mechanical processing sound
        freqs = [262, 330, 392, 523]  # C4, E4, G4, C5
        output = np.zeros(num_samples, dtype=np.float32)
        note_len = num_samples // 4
        for i, freq in enumerate(freqs):
            start = i * note_len
            end = min(start + note_len, num_samples)
            t_note = t[start:end] - t[start]
            output[start:end] = sawtooth(2 * np.pi * freq * t_note) * np.exp(-t_note * 20)
        return output * 0.3
    
    elif sample_id == 'beep-countdown':
        # Rhythmic countdown
        freq_low = 392  # G4
        freq_high = 523  # C5
        output = np.zeros(num_samples, dtype=np.float32)
        beat_len = num_samples // 4
        for i in range(4):
            start = i * beat_len
            end = min(start + beat_len // 3, num_samples)
            t_note = t[start:end] - t[start]
            freq = freq_high if i == 3 else freq_low
            output[start:end] = np.sin(2 * np.pi * freq * t_note) * np.exp(-t_note * 30)
        return output * 0.6
    
    else:
        freq = 523  # C5
        sine = np.sin(2 * np.pi * freq * t)
        envelope = envelope_adsr(t, 0.01, 0.1, 0.3, 0.1, duration)
        return sine * envelope * 0.5


# === FX Generators ===

def generate_fx(sample_id: str, t: np.ndarray, duration: float) -> np.ndarray:
    num_samples = len(t)
    
    if sample_id == 'fx-impact':
        # Cinematic impact hit
        freq_start = 200
        freq_end = 30
        freq = freq_start * np.power(freq_end / freq_start, t / duration)
        phase = 2 * np.pi * np.cumsum(freq) / SAMPLE_RATE
        sine = np.sin(phase)
        # Add noise burst
        noise = generate_noise(num_samples, 'white') * np.exp(-t * 10)
        combined = sine * 0.7 + noise * 0.3
        envelope = envelope_adsr(t, 0.001, duration * 0.5, 0.1, duration * 0.4, duration)
        return combined * envelope * 0.9
    
    elif sample_id == 'fx-atmosphere':
        # Dark ambient pad
        freqs = [130.8, 155.6, 196]  # C3, Eb3, G3 (Cm chord)
        output = np.zeros(num_samples, dtype=np.float32)
        for freq in freqs:
            output += np.sin(2 * np.pi * freq * t)
        output /= len(freqs)
        envelope = envelope_adsr(t, duration * 0.3, duration * 0.2, 0.6, duration * 0.3, duration)
        return output * envelope * 0.4
    
    elif sample_id == 'fx-glitch':
        # Digital glitch artifacts
        noise = generate_noise(num_samples, 'white')
        # Bitcrush simulation
        bit_depth = 4
        noise = np.round(noise * bit_depth) / bit_depth
        # Stuttery gating
        gate = np.zeros(num_samples)
        chunk_size = num_samples // 20
        for i in range(0, num_samples, chunk_size * 2):
            end = min(i + chunk_size, num_samples)
            gate[i:end] = 1
        return noise * gate * 0.5
    
    elif sample_id == 'fx-vinyl-crackle':
        # Lo-fi vinyl texture
        noise = generate_noise(num_samples, 'brown')
        filtered = lowpass_filter(noise, 3000)
        # Add random pops
        pops = np.zeros(num_samples)
        pop_indices = np.random.choice(num_samples, size=int(num_samples * 0.001), replace=False)
        pops[pop_indices] = np.random.randn(len(pop_indices)) * 0.3
        return (filtered * 0.2 + pops) * 0.5
    
    elif sample_id == 'fx-downlifter':
        # Reverse riser (high to low sweep)
        noise = generate_noise(num_samples, 'pink')
        cutoffs = np.linspace(10000, 50, num_samples)
        output = np.zeros(num_samples, dtype=np.float32)
        chunk_size = num_samples // 30
        for i in range(0, num_samples, chunk_size):
            end_idx = min(i + chunk_size, num_samples)
            cutoff = cutoffs[min(i + chunk_size // 2, num_samples - 1)]
            output[i:end_idx] = lowpass_filter(noise[i:end_idx], max(cutoff, 50))
        envelope = envelope_adsr(t, 0.01, 0.1, 0.8, duration * 0.1, duration)
        return output * envelope * 0.6
    
    elif sample_id == 'fx-stutter':
        # Rhythmic stutter effect
        freq = 262  # C4
        saw = sawtooth(2 * np.pi * freq * t)
        # Rapid gating
        gate_freq = 20  # Hz
        gate = (np.sin(2 * np.pi * gate_freq * t) > 0).astype(np.float32)
        return saw * gate * 0.4
    
    else:
        # Default atmospheric pad
        freq = 130.8  # C3
        sine = np.sin(2 * np.pi * freq * t)
        envelope = envelope_adsr(t, 0.3, 0.2, 0.5, 0.8, duration)
        return sine * envelope * 0.5


def parse_duration(duration_str: str, bpm: int = 120) -> float:
    """Parse duration string to seconds"""
    beats_per_second = bpm / 60
    
    if 'bar' in duration_str:
        bars = float(duration_str.replace('bars', '').replace('bar', '').strip())
        return (bars * 4) / beats_per_second
    elif 'beat' in duration_str:
        beats = float(duration_str.replace('beats', '').replace('beat', '').strip())
        return beats / beats_per_second
    elif 's' in duration_str:
        return float(duration_str.replace('s', '').strip())
    elif duration_str == 'loop':
        return 4.0
    else:
        try:
            return float(duration_str)
        except:
            return 1.0


def list_cached_samples() -> list:
    """List all cached samples"""
    samples = []
    for filename in os.listdir(CACHE_DIR):
        if filename.endswith('.wav'):
            filepath = os.path.join(CACHE_DIR, filename)
            samples.append({
                'filename': filename,
                'path': filepath,
                'size': os.path.getsize(filepath)
            })
    return samples


def clear_cache() -> int:
    """Clear all cached samples, return count of deleted files"""
    count = 0
    for filename in os.listdir(CACHE_DIR):
        if filename.endswith('.wav'):
            os.remove(os.path.join(CACHE_DIR, filename))
            count += 1
    return count
