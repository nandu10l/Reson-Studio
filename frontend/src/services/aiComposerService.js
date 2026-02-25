const API_BASE = 'http://localhost:8000';

/**
 * Generate music via the backend ML model.
 * @param {{ seedNotes: number[], numNotes: number, tempo: number, velocity: number, noteDuration: number }} params
 * @returns {Promise<{ midi_base64: string, notes: number[], duration_seconds: number }>}
 */
export async function generateMusic({ seedNotes, numNotes, tempo, velocity, noteDuration }) {
    const res = await fetch(`${API_BASE}/api/generate-music`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            seed_notes: seedNotes,
            num_notes: numNotes,
            tempo,
            velocity,
            duration: noteDuration,
        }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Server error ${res.status}`);
    }
    return res.json();
}

/**
 * Trigger a browser download of a MIDI file from a base64 string.
 */
export function downloadMidi(base64, filename = 'ai-generated.mid') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'audio/midi' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * Default C-major seed pattern (50 notes cycling C3–B3).
 */
export const C_MAJOR_SEED = [
    60, 62, 64, 65, 67, 69, 71, 72, 71, 69,
    67, 65, 64, 62, 60, 62, 64, 65, 67, 64,
    62, 60, 65, 67, 69, 67, 65, 64, 62, 60,
    60, 64, 67, 64, 60, 62, 65, 67, 65, 62,
    60, 67, 65, 64, 62, 60, 62, 64, 65, 60,
];

export const A_MINOR_SEED = [
    57, 59, 60, 62, 64, 65, 67, 69, 67, 65,
    64, 62, 60, 59, 57, 59, 60, 62, 64, 62,
    60, 57, 62, 64, 65, 64, 62, 60, 59, 57,
    57, 60, 64, 60, 57, 59, 62, 64, 62, 59,
    57, 64, 62, 60, 59, 57, 59, 60, 62, 57,
];

export const G_PENTATONIC_SEED = [
    55, 57, 59, 62, 64, 67, 69, 71, 67, 64,
    62, 59, 57, 55, 57, 59, 62, 64, 62, 59,
    55, 62, 64, 67, 64, 62, 59, 57, 55, 57,
    55, 59, 62, 59, 55, 57, 62, 64, 62, 57,
    55, 64, 62, 59, 57, 55, 57, 59, 62, 55,
];

export const GM_INSTRUMENTS = [
    { value: 0, label: 'Acoustic Grand Piano' },
    { value: 24, label: 'Acoustic Guitar (nylon)' },
    { value: 25, label: 'Acoustic Guitar (steel)' },
    { value: 30, label: 'Distortion Guitar' },
    { value: 32, label: 'Acoustic Bass' },
    { value: 40, label: 'Violin' },
    { value: 48, label: 'String Ensemble 1' },
    { value: 56, label: 'Trumpet' },
    { value: 60, label: 'French Horn' },
    { value: 68, label: 'Oboe' },
    { value: 73, label: 'Flute' },
    { value: 80, label: 'Square Lead' },
    { value: 88, label: 'New Age Pad' },
    { value: 118, label: 'Synth Drum' },
];
