const API_BASE = 'http://localhost:8000';

/**
 * Generate MIDI via the new AI MIDI API.
 */
export async function generateAiMidi(params) {
    const res = await fetch(`${API_BASE}/api/ai-midi/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Server error ${res.status}`);
    }
    return res.json();
}

/**
 * Check the status of the AI model.
 */
export async function getAiStatus() {
    try {
        const res = await fetch(`${API_BASE}/api/ai-midi/status`);
        return await res.json();
    } catch (e) {
        return { ready: false, error: 'Server offline' };
    }
}

/**
 * List recently generated AI MIDI files.
 */
export async function listAiFiles() {
    try {
        const res = await fetch(`${API_BASE}/api/ai-midi/files`);
        return await res.json();
    } catch (e) {
        return { files: [] };
    }
}

/**
 * Get the download URL for a specific file.
 */
export function getAiDownloadUrl(filename) {
    return `${API_BASE}/api/ai-midi/download/${filename}`;
}

/**
 * Legacy support for the old generate music endpoint.
 */
export async function generateMusic({ seed_notes, num_notes, tempo, velocity, duration }) {
    const res = await fetch(`${API_BASE}/api/generate-music`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            seed_notes,
            num_notes,
            tempo,
            velocity,
            duration,
        }),
    });
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
