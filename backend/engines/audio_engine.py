import numpy as np
import soundfile as sf

def read_audio(path: str, mono: bool = True) -> tuple[np.ndarray, int]:
    y, sr = sf.read(path, always_2d=True)
    if mono:
        y = y.mean(axis=1)
    return y.astype(np.float32), sr

def write_wav(path: str, y: np.ndarray, sr: int) -> None:
    sf.write(path, y, sr)

def normalize(y: np.ndarray, peak: float = 0.95) -> np.ndarray:
    if y.size == 0:
        return y
    m = float(np.max(np.abs(y)))
    if m < 1e-9:
        return y
    return (y / m) * peak

def trim(y: np.ndarray, sr: int, start_sec: float | None, end_sec: float | None) -> np.ndarray:
    if start_sec is None and end_sec is None:
        return y
    s = int(max(0.0, (start_sec or 0.0)) * sr)
    e = int(min(len(y), (end_sec * sr) if end_sec is not None else len(y)))
    return y[s:e] if e > s else y[0:0]

def waveform_peaks(y: np.ndarray, points: int = 1200) -> list[float]:
    if y.size == 0:
        return []
    points = max(50, min(points, 5000))
    chunk = int(np.ceil(len(y) / points))
    peaks = []
    for i in range(0, len(y), chunk):
        seg = y[i:i+chunk]
        peaks.append(float(np.max(np.abs(seg))) if seg.size else 0.0)
    return peaks

def overlay(mix: np.ndarray, clip: np.ndarray, offset_samples: int) -> np.ndarray:
    need = max(len(mix), offset_samples + len(clip))
    out = np.zeros(need, dtype=np.float32)
    out[:len(mix)] += mix
    out[offset_samples:offset_samples+len(clip)] += clip
    return out

def mix_tracks(clips: list[tuple[np.ndarray, int]]) -> np.ndarray:
    mix = np.array([], dtype=np.float32)
    for y, off in clips:
        mix = overlay(mix, y, off)
    return normalize(mix)
