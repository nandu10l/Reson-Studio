import React, { useState, useRef, useCallback } from 'react';
import { C_MAJOR_SEED, A_MINOR_SEED, G_PENTATONIC_SEED } from '../../services/aiComposerService';

// MIDI note names inside model range C#2(37) → A4(69)
const MIDI_MIN = 37;
const MIDI_MAX = 69;

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const BLACK_NOTES = new Set([1, 3, 6, 8, 10]); // C#,D#,F#,G#,A# semitones

function midiToName(midi) {
    const note = NOTE_NAMES[midi % 12];
    const octave = Math.floor(midi / 12) - 1;
    return `${note}${octave}`;
}

// Colour ramp: low pitch = blue, high pitch = purple
function pitchColor(midi) {
    const t = (midi - MIDI_MIN) / (MIDI_MAX - MIDI_MIN);
    const r = Math.round(70 + t * 120);
    const g = Math.round(20 + t * 20);
    const b = Math.round(200 - t * 40);
    return `rgb(${r},${g},${b})`;
}

const PRESETS = [
    { id: 'cmaj', label: 'C Maj', notes: C_MAJOR_SEED },
    { id: 'amin', label: 'A Min', notes: A_MINOR_SEED },
    { id: 'gpent', label: 'G Pent', notes: G_PENTATONIC_SEED },
    { id: 'random', label: '⚄ Rand', notes: null },
    { id: 'clear', label: '✕ Clear', notes: null },
];

// Build note list for picker
const PICKER_NOTES = [];
for (let midi = MIDI_MIN; midi <= MIDI_MAX; midi++) {
    PICKER_NOTES.push(midi);
}

export default function SeedEditor({ seedNotes, onChange }) {
    const [pickerState, setPickerState] = useState(null); // { index, x, y }
    const [activePreset, setActivePreset] = useState('cmaj');
    const gridRef = useRef(null);

    const handlePreset = useCallback((preset) => {
        setActivePreset(preset.id);
        if (preset.notes) {
            onChange([...preset.notes]);
        } else if (preset.id === 'random') {
            const range = MIDI_MAX - MIDI_MIN;
            onChange(Array.from({ length: 50 }, () => MIDI_MIN + Math.floor(Math.random() * range)));
        } else if (preset.id === 'clear') {
            // clear → all C3 (midi 48)
            onChange(Array(50).fill(48));
        }
    }, [onChange]);

    const openPicker = (index, e) => {
        e.stopPropagation();
        const rect = e.currentTarget.getBoundingClientRect();
        setPickerState({ index, x: rect.left, y: rect.bottom + 4 });
    };

    const selectNote = (midi) => {
        const updated = [...seedNotes];
        updated[pickerState.index] = midi;
        onChange(updated);
        setPickerState(null);
    };

    const clearNote = () => {
        const updated = [...seedNotes];
        updated[pickerState.index] = 48; // reset to C3
        onChange(updated);
        setPickerState(null);
    };

    return (
        <div className="seed-editor">
            {/* Preset buttons */}
            <div className="seed-presets">
                {PRESETS.map(p => (
                    <button
                        key={p.id}
                        className={`seed-preset-btn ${activePreset === p.id ? 'active' : ''}`}
                        onClick={() => handlePreset(p)}
                        title={p.label}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            {/* 50-slot grid */}
            <div className="seed-grid-scroll" ref={gridRef}>
                <div className="seed-grid">
                    {seedNotes.map((midi, i) => {
                        const hasNote = midi !== null && midi !== undefined;
                        const fill = hasNote ? pitchColor(midi) : 'transparent';
                        const heightPct = hasNote ? Math.round(((midi - MIDI_MIN) / (MIDI_MAX - MIDI_MIN)) * 80 + 10) : 0;
                        return (
                            <div
                                key={i}
                                className={`seed-slot ${hasNote ? 'has-note' : ''}`}
                                title={`Slot ${i + 1}: ${hasNote ? midiToName(midi) : 'empty'}`}
                                onClick={(e) => openPicker(i, e)}
                            >
                                <div
                                    className="seed-slot-fill"
                                    style={{ height: `${heightPct}%`, background: fill }}
                                />
                                <span className="seed-slot-label">
                                    {hasNote ? midiToName(midi) : '·'}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Note picker popup */}
            {pickerState && (
                <>
                    <div className="note-picker-overlay" onClick={() => setPickerState(null)} />
                    <div
                        className="note-picker"
                        style={{
                            left: Math.min(pickerState.x, window.innerWidth - 230),
                            top: Math.min(pickerState.y, window.innerHeight - 260),
                        }}
                    >
                        <div className="note-picker-title">
                            Pick note for slot {pickerState.index + 1}
                        </div>
                        <div className="note-picker-grid">
                            {PICKER_NOTES.map(midi => (
                                <button
                                    key={midi}
                                    className={`note-picker-key ${BLACK_NOTES.has(midi % 12) ? 'black-key' : ''}`}
                                    title={midiToName(midi)}
                                    onClick={() => selectNote(midi)}
                                >
                                    {midiToName(midi)}
                                </button>
                            ))}
                        </div>
                        <div className="note-picker-actions">
                            <button className="note-picker-clear" onClick={clearNote}>
                                Reset to C3
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
