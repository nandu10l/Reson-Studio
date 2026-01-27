/**
 * EffectsService - Frontend service for audio effects
 * Communicates with Python backend for server-side effects
 * and provides Tone.js integration for real-time effects
 */

const BACKEND_URL = 'http://localhost:8000';

// Available Tone.js effects for real-time processing
export const REALTIME_EFFECTS = {
    reverb: { name: 'Reverb', type: 'spatial', toneClass: 'Reverb' },
    delay: { name: 'Delay', type: 'temporal', toneClass: 'FeedbackDelay' },
    chorus: { name: 'Chorus', type: 'modulation', toneClass: 'Chorus' },
    phaser: { name: 'Phaser', type: 'modulation', toneClass: 'Phaser' },
    distortion: { name: 'Distortion', type: 'saturation', toneClass: 'Distortion' },
    compressor: { name: 'Compressor', type: 'dynamics', toneClass: 'Compressor' },
    eq: { name: 'Parametric EQ', type: 'filter', toneClass: 'EQ3' }
};

/**
 * Check if backend effects service is available
 */
export async function isBackendAvailable() {
    try {
        const response = await fetch(`${BACKEND_URL}/effects/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(2000)
        });
        return response.ok;
    } catch (e) {
        return false;
    }
}

/**
 * Get list of available server-side effects from backend
 */
export async function getServerEffects() {
    try {
        const response = await fetch(`${BACKEND_URL}/effects/list`);
        if (!response.ok) throw new Error('Failed to fetch effects');
        return await response.json();
    } catch (e) {
        console.warn('Backend effects not available:', e.message);
        return { effects: {}, count: 0 };
    }
}

/**
 * Get combined list of all available effects (realtime + server)
 */
export async function getAllAvailableEffects() {
    const serverEffects = await getServerEffects();

    // Merge realtime and server effects, preferring realtime for duplicates
    const allEffects = { ...REALTIME_EFFECTS };

    // Add server-only effects
    Object.entries(serverEffects.effects || {}).forEach(([key, effect]) => {
        if (!allEffects[key]) {
            allEffects[key] = {
                ...effect,
                serverOnly: true
            };
        }
    });

    return allEffects;
}

/**
 * Apply effect to audio blob using backend
 * @param {Blob} audioBlob - Audio file blob
 * @param {string} effectType - Effect type to apply
 * @param {object} params - Effect parameters
 * @returns {Promise<Blob>} Processed audio blob
 */
export async function applyServerEffect(audioBlob, effectType, params = {}) {
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.wav');
    formData.append('effect_type', effectType);
    formData.append('params', JSON.stringify(params));

    const response = await fetch(`${BACKEND_URL}/effects/apply`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Effect processing failed: ${errorText}`);
    }

    return await response.blob();
}

/**
 * Create effect data structure for a channel
 * @param {string} effectId - Unique effect ID
 * @param {string} name - Effect display name
 * @param {string} type - Effect type (reverb, delay, etc.)
 * @param {number} slotIndex - Slot position (0-9)
 */
export function createEffectData(effectId, name, type, slotIndex) {
    return {
        id: effectId,
        name: name,
        type: type,
        enabled: true,
        mix: 50, // 0-100 (dry/wet)
        order: slotIndex,
        params: getDefaultParams(type)
    };
}

/**
 * Get default parameters for effect type
 */
export function getDefaultParams(type) {
    switch (type) {
        case 'reverb':
            return { decay: 1.5, preDelay: 0.01 };
        case 'delay':
            return { delayTime: 0.3, feedback: 0.4 };
        case 'chorus':
            return { frequency: 1.5, delayTime: 3.5, depth: 0.7 };
        case 'phaser':
            return { frequency: 0.5, octaves: 3, baseFrequency: 350 };
        case 'distortion':
            return { distortion: 0.4 };
        case 'compressor':
            return { threshold: -24, ratio: 4, attack: 0.003, release: 0.25 };
        case 'eq':
            return { low: 0, mid: 0, high: 0 };
        default:
            return {};
    }
}
