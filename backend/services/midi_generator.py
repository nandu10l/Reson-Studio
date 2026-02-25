import os
import random
import time
import numpy as np
import pretty_midi
import tensorflow as tf
from typing import List, Dict, Any

# ── Singleton model loader ──────────────────────────────────────
_model = None
MODEL_VERSION = 0
SEQ_LENGTH = 50

# Resolve model path: env var → project ai_models/ → D:\Logiv fallback
_MODEL_V2_PATH = os.environ.get('MUSIC_MODEL_V2_PATH', r'D:\Logiv\music_model_v2.h5')
_MODEL_V1_PATH = os.environ.get('MUSIC_MODEL_V1_PATH', r'D:\Logiv\music_model.h5')

def get_model():
    global _model, MODEL_VERSION, SEQ_LENGTH
    if _model is None:
        if os.path.exists(_MODEL_V2_PATH):
            _model = tf.keras.models.load_model(_MODEL_V2_PATH, compile=False)
            MODEL_VERSION = 2
            SEQ_LENGTH = 64
            print(f"✅ Loaded music_model_v2.h5 from {_MODEL_V2_PATH}")
        elif os.path.exists(_MODEL_V1_PATH):
            _model = tf.keras.models.load_model(_MODEL_V1_PATH, compile=False)
            MODEL_VERSION = 1
            SEQ_LENGTH = 50
            print(f"✅ Loaded music_model.h5 from {_MODEL_V1_PATH}")
        else:
            _model = None
            MODEL_VERSION = 0
            SEQ_LENGTH = 50
            print("⚠️  No model found!")
    return _model

# ── Genre presets ────────────────────────────────────────────────────
GENRE_SETTINGS = {
    "lofi": {
        "pitch_range":   (48, 76),
        "velocity_min":  45,
        "velocity_max":  80,
        "note_overlap":  0.85,
        "chord_voicing": [0, 3, 7, 10],
        "kick_pattern":  [0, 6],
        "bass_octave":   -2,
        "melody_prog":   80,
        "bass_prog":     33,
        "chord_prog":    48,
        "hihat_density": 0.5,
        "hihat_step":    0.5,
    },
    "trap": {
        "pitch_range":   (36, 84),
        "velocity_min":  70,
        "velocity_max":  110,
        "note_overlap":  0.6,
        "chord_voicing": [0, 3, 6, 10],
        "kick_pattern":  [0, 3, 8, 14],
        "bass_octave":   -3,
        "melody_prog":   38,
        "bass_prog":     38,
        "chord_prog":    90,
        "hihat_density": 0.9,
        "hihat_step":    0.25,
    },
}

def generate_notes_data(length, temperature, settings):
    model = get_model()
    if model is None:
        return []

    low, high = settings["pitch_range"]
    if MODEL_VERSION == 2:
        seed = [[random.uniform(low/127, high/127),
                 random.uniform(0.1, 0.5),
                 random.uniform(0.4, 0.9)] for _ in range(SEQ_LENGTH)]
        seq = np.array(seed).reshape(1, SEQ_LENGTH, 3)
        out = []
        for _ in range(length):
            preds = model.predict(seq, verbose=0)
            pp, dp, vp = preds[0], preds[1], preds[2]
            p = float(pp[0][0]) + random.uniform(-0.05*temperature, 0.05*temperature)
            d = float(dp[0][0])
            v = float(vp[0][0])
            p = np.clip(p, low/127, high/127)
            out.append([p, d, v])
            seq = np.append(seq[:, 1:, :], [[[p, d, v]]], axis=1)
        return out
    else:
        seed = [random.randint(low, high) for _ in range(SEQ_LENGTH)]
        seq  = (np.array(seed)/127.0).reshape(1, SEQ_LENGTH, 1)
        out  = []
        for _ in range(length):
            pred  = model.predict(seq, verbose=0)[0][0]
            noise = random.uniform(-0.05*temperature, 0.05*temperature)
            note  = int(np.clip((pred+noise)*127, low, high))
            out.append([note/127.0, 0.3, 0.7])
            seq = np.append(seq[:, 1:, :], [[[pred]]], axis=1)
        return out

def to_instrument(notes, program, name, octave_shift, settings, base_dur):
    inst  = pretty_midi.Instrument(program=program, name=name)
    start = 0.0
    for pn, dn, vn in notes:
        pitch = int(np.clip(int(pn*127) + octave_shift*12, 0, 127))
        dur   = max(0.1, dn * base_dur * 3)
        vel   = int(np.clip(vn*127, settings["velocity_min"], settings["velocity_max"]))
        inst.notes.append(pretty_midi.Note(velocity=vel, pitch=pitch,
                                           start=start, end=start+dur))
        start += dur * settings["note_overlap"]
    return inst

def generate_midi_file(genre, bpm, num_notes, temperature, duration, tracks_list, output_dir):
    model = get_model()
    if model is None:
        raise Exception("AI Model not loaded")

    random.seed(time.time())
    s = GENRE_SETTINGS.get(genre, GENRE_SETTINGS["lofi"])
    beat = 60.0 / bpm
    midi = pretty_midi.PrettyMIDI(initial_tempo=bpm)
    total_beats = num_notes

    if "melody" in tracks_list:
        n = generate_notes_data(num_notes, temperature, s)
        midi.instruments.append(to_instrument(n, s["melody_prog"], "Melody", 1, s, duration))

    if "bass" in tracks_list:
        n = generate_notes_data(num_notes//2, temperature*0.7, s)
        midi.instruments.append(to_instrument(n, s["bass_prog"], "Bass", s["bass_octave"], s, duration))

    if "chords" in tracks_list:
        ci = pretty_midi.Instrument(program=s["chord_prog"], name="Chords")
        n  = generate_notes_data(num_notes//4, temperature*0.8, s)
        t  = 0.0
        for pn, dn, vn in n:
            base = int(pn*127)
            dur  = max(0.5, dn*duration*4)
            vel  = max(30, int(vn*80))
            for iv in s["chord_voicing"]:
                p = int(np.clip(base+iv, 0, 127))
                ci.notes.append(pretty_midi.Note(velocity=vel, pitch=p, start=t, end=t+dur))
            t += dur*0.9
        midi.instruments.append(ci)

    if "piano" in tracks_list:
        n = generate_notes_data(int(num_notes*0.75), temperature*0.9, s)
        midi.instruments.append(to_instrument(n, 0, "Piano", 0, s, duration))

    if "kick" in tracks_list:
        ki = pretty_midi.Instrument(program=0, is_drum=True, name="Kick")
        for bar in range(total_beats//16):
            for pos in s["kick_pattern"]:
                t = (bar*16+pos)*beat*0.25
                ki.notes.append(pretty_midi.Note(velocity=110, pitch=36, start=t, end=t+0.1))
                if genre=="trap" and random.random()>0.7:
                    t2=t+beat*0.125
                    ki.notes.append(pretty_midi.Note(velocity=80, pitch=36, start=t2, end=t2+0.1))
        midi.instruments.append(ki)

    if "claps" in tracks_list:
        cl = pretty_midi.Instrument(program=0, is_drum=True, name="Claps")
        for bar in range(total_beats//16):
            for pos in [4, 12]:
                t = (bar*16+pos)*beat*0.25
                cl.notes.append(pretty_midi.Note(velocity=95, pitch=39, start=t, end=t+0.1))
        midi.instruments.append(cl)

    if "hihat" in tracks_list:
        hi = pretty_midi.Instrument(program=0, is_drum=True, name="Hi-Hats")
        t  = 0.0
        while t < total_beats*beat*0.25:
            if random.random() < s["hihat_density"]:
                pitch = 46 if (int(t/beat)%4==0) else 42
                hi.notes.append(pretty_midi.Note(velocity=random.randint(50,80),
                                                  pitch=pitch, start=t, end=t+0.05))
            if genre=="trap" and random.random()>0.85:
                for r in range(3):
                    rt=t+r*0.04
                    hi.notes.append(pretty_midi.Note(velocity=40+r*10, pitch=42,
                                                      start=rt, end=rt+0.03))
            t += beat*s["hihat_step"]
        midi.instruments.append(hi)

    if "snare" in tracks_list:
        sn = pretty_midi.Instrument(program=0, is_drum=True, name="Snare")
        for bar in range(total_beats//16):
            for pos in [4, 12]:
                t=(bar*16+pos)*beat*0.25
                sn.notes.append(pretty_midi.Note(velocity=90, pitch=38, start=t, end=t+0.1))
            for pos in [2,6,10,14]:
                if random.random()>0.6:
                    t=(bar*16+pos)*beat*0.25
                    sn.notes.append(pretty_midi.Note(velocity=random.randint(25,45),
                                                      pitch=38, start=t, end=t+0.08))
        midi.instruments.append(sn)

    # Save
    timestamp = int(time.time())
    filename  = f"generated_{genre}_{bpm}bpm_{timestamp}.mid"
    filepath  = os.path.join(output_dir, filename)
    midi.write(filepath)
    
    return {
        "filename": filename,
        "filepath": os.path.abspath(filepath),
        "tracks": len(midi.instruments)
    }
