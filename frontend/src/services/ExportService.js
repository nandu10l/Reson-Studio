/**
 * ExportService - Handles audio export functionality (WAV, MP3)
 */
import * as Tone from 'tone';
// Note: lamejs is imported dynamically in audioBufferToMp3 for CommonJS compatibility

// Store the last export format used
let lastExportFormat = null;

/**
 * Convert AudioBuffer to WAV format (Blob)
 */
export function audioBufferToWav(audioBuffer) {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    // Interleave channels
    let interleaved;
    if (numChannels === 2) {
        const left = audioBuffer.getChannelData(0);
        const right = audioBuffer.getChannelData(1);
        interleaved = new Float32Array(left.length + right.length);
        for (let i = 0; i < left.length; i++) {
            interleaved[i * 2] = left[i];
            interleaved[i * 2 + 1] = right[i];
        }
    } else {
        interleaved = audioBuffer.getChannelData(0);
    }

    // Convert to 16-bit PCM
    const dataLength = interleaved.length * 2;
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);

    // Write WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // Subchunk1Size
    view.setUint16(20, format, true); // AudioFormat
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true); // ByteRate
    view.setUint16(32, numChannels * (bitDepth / 8), true); // BlockAlign
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);

    // Write audio data
    const offset = 44;
    for (let i = 0; i < interleaved.length; i++) {
        const sample = Math.max(-1, Math.min(1, interleaved[i]));
        view.setInt16(offset + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
    }

    return new Blob([buffer], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

/**
 * Backend API URL for audio conversion
 */
const BACKEND_URL = 'http://localhost:8000';

/**
 * Convert AudioBuffer to MP3 format using Python backend
 * Falls back to WAV if backend is unavailable
 */
export async function audioBufferToMp3(audioBuffer) {
    try {
        // First convert to WAV
        const wavBlob = audioBufferToWav(audioBuffer);

        // Check if backend is available
        try {
            const healthCheck = await fetch(`${BACKEND_URL}/audio/health`, {
                method: 'GET',
                signal: AbortSignal.timeout(2000) // 2 second timeout
            });

            if (!healthCheck.ok) {
                throw new Error('Backend not available');
            }
        } catch (e) {
            console.warn('Backend not available, falling back to WAV:', e.message);
            return { blob: wavBlob, format: 'wav', fallback: true };
        }

        // Create FormData with WAV file
        const formData = new FormData();
        formData.append('file', wavBlob, 'export.wav');

        // Send to Python backend for MP3 conversion
        const response = await fetch(`${BACKEND_URL}/audio/convert-to-mp3`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Backend conversion failed: ${errorText}`);
        }

        // Get MP3 blob from response
        const mp3Blob = await response.blob();

        return { blob: mp3Blob, format: 'mp3' };
    } catch (error) {
        console.warn('MP3 encoding failed, falling back to WAV:', error.message);
        // Fall back to WAV
        return { blob: audioBufferToWav(audioBuffer), format: 'wav', fallback: true };
    }
}

/**
 * Calculate project duration in seconds
 */
export function calculateProjectDuration(playlistTracks, patterns, audioClips = []) {
    let maxEndTime = 0;
    const bpm = Tone.Transport.bpm.value || 120;
    const beatsToSeconds = (beats) => beats * (60 / bpm);

    // Check pattern clips
    playlistTracks.forEach(track => {
        track.clips.forEach(clip => {
            if (clip.type === 'pattern' || !clip.type) {
                const clipEndBeats = (clip.offset || 0) + (clip.length || 16);
                const clipEndTime = beatsToSeconds(clipEndBeats);
                maxEndTime = Math.max(maxEndTime, clipEndTime);
            } else if (clip.type === 'audio') {
                const clipEndBeats = (clip.offset || 0) + (clip.length || 0);
                const clipEndTime = beatsToSeconds(clipEndBeats);
                maxEndTime = Math.max(maxEndTime, clipEndTime);
            }
        });
    });

    // Add a small buffer at the end for reverb tails etc.
    return maxEndTime + 0.5;
}

/**
 * Export project as WAV file
 */
export async function exportWav(audioEngine, playlistTracks, patterns, channels, audioClips = [], automations = [], mixerInserts = []) {
    lastExportFormat = 'wav';

    const duration = calculateProjectDuration(playlistTracks, patterns, audioClips);

    if (duration <= 0.5) {
        throw new Error('Project is empty. Add some clips before exporting.');
    }

    console.log(`Exporting WAV: ${duration.toFixed(2)} seconds...`);

    // Use Tone.Offline to render
    const buffer = await Tone.Offline(async ({ transport }) => {
        // Re-initialize channels and schedule in offline context
        await audioEngine.renderOffline(transport, playlistTracks, patterns, channels, audioClips, automations, duration, mixerInserts);
    }, duration);

    // Convert to WAV blob
    const wavBlob = audioBufferToWav(buffer);

    console.log('WAV export complete!');
    return wavBlob;
}

/**
 * Export project as MP3 file
 */
export async function exportMp3(audioEngine, playlistTracks, patterns, channels, audioClips = [], automations = [], mixerInserts = []) {
    lastExportFormat = 'mp3';

    const duration = calculateProjectDuration(playlistTracks, patterns, audioClips);

    if (duration <= 0.5) {
        throw new Error('Project is empty. Add some clips before exporting.');
    }

    console.log(`Exporting MP3: ${duration.toFixed(2)} seconds...`);

    // Use Tone.Offline to render
    const buffer = await Tone.Offline(async ({ transport }) => {
        await audioEngine.renderOffline(transport, playlistTracks, patterns, channels, audioClips, automations, duration, mixerInserts);
    }, duration);

    // Convert to MP3 blob (may fall back to WAV)
    const result = await audioBufferToMp3(buffer);

    if (result.fallback) {
        console.log('MP3 encoding not available, exported as WAV instead.');
        lastExportFormat = 'wav'; // Update last format to actual format used
    }

    console.log(`${result.format.toUpperCase()} export complete!`);
    return { blob: result.blob, format: result.format, fallback: result.fallback };
}

/**
 * Get last export format
 */
export function getLastExportFormat() {
    return lastExportFormat;
}

/**
 * Set last export format
 */
export function setLastExportFormat(format) {
    lastExportFormat = format;
}

/**
 * Save blob to file using Electron API
 */
export async function saveAudioBlob(blob, format) {
    if (!window.electronAPI?.saveAudioFile) {
        // Fallback: trigger download in browser
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `export.${format}`;
        a.click();
        URL.revokeObjectURL(url);
        return { success: true };
    }

    // Get save path from dialog
    const result = await window.electronAPI.saveAudioFile(format);
    if (result.canceled || !result.filePath) {
        return { canceled: true };
    }

    // Convert blob to array buffer
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Save to file
    const saveResult = await window.electronAPI.saveAudioBuffer(result.filePath, Array.from(uint8Array));
    return saveResult;
}
