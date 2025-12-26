def chord_suggestions(key: str | None = None, scale: str | None = None) -> dict:
    k = key or "C"
    s = scale or "major"
    return {
        "key": k,
        "scale": s,
        "progressions": [
            [k, "Am", "F", "G"],
            ["Dm", "G", k, k],
        ],
    }

def melody_generate(key: str | None = None, bars: int = 4, tempo: int = 120) -> dict:
    bars = max(1, min(bars, 64))
    base = [60, 62, 64, 67, 64, 62, 60, 60]
    melody = (base * bars)[: bars * 8]
    return {"key": key or "C", "tempo": tempo, "bars": bars, "melody_midi": melody}
