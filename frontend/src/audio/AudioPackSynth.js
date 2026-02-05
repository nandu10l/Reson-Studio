import * as Tone from 'tone';

/**
 * AudioPackSynth - Hybrid audio pack system
 * 
 * FRONTEND (Tone.js): Instant previews for responsive UX
 * BACKEND (Python/scipy): High-quality buffer generation with caching
 * 
 * This file handles ONLY the preview functionality.
 * Buffer generation is delegated to the backend API.
 */

const API_BASE = 'http://localhost:8000';

class AudioPackSynth {
    constructor() {
        this.isInitialized = false;
        this.previewSynths = [];
        this.previewFilters = [];
        this.previewNoises = [];
        this.previewEffects = [];
        this.bufferCache = new Map(); // Local cache for fetched buffers
    }

    async init() {
        if (this.isInitialized) return;
        await Tone.start();
        this.isInitialized = true;
    }

    /**
     * Preview a sample by playing a short sound (FRONTEND - instant)
     */
    async previewSample(sampleId, packType) {
        await this.init();
        this.disposePreviewSynths();

        const now = Tone.now();

        switch (packType) {
            case 'risers':
                this.playRiserPreview(sampleId, now);
                break;
            case 'swooshes':
                this.playSwooshPreview(sampleId, now);
                break;
            case 'clicks':
                this.playClickPreview(sampleId, now);
                break;
            case 'bassNotes':
                this.playBassPreview(sampleId, now);
                break;
            case 'beeps':
                this.playBeepPreview(sampleId, now);
                break;
            case 'fx':
                this.playFxPreview(sampleId, now);
                break;
            default:
                this.playBeepPreview('beep-alert', now);
        }
    }

    disposePreviewSynths() {
        this.previewSynths.forEach(s => { try { s.dispose(); } catch (e) { } });
        this.previewFilters.forEach(f => { try { f.dispose(); } catch (e) { } });
        this.previewNoises.forEach(n => { try { n.dispose(); } catch (e) { } });
        this.previewEffects.forEach(e => { try { e.dispose(); } catch (e) { } });
        this.previewSynths = [];
        this.previewFilters = [];
        this.previewNoises = [];
        this.previewEffects = [];
    }

    // === PREVIEW METHODS (distinct sounds for each sample) ===

    playRiserPreview(sampleId, now) {
        switch (sampleId) {
            case 'riser-white': {
                const filter = new Tone.Filter({ frequency: 100, type: 'lowpass', rolloff: -24 }).toDestination();
                const noise = new Tone.Noise({ type: 'white', volume: -10 }).connect(filter);
                this.previewFilters.push(filter);
                this.previewNoises.push(noise);
                filter.frequency.setValueAtTime(100, now);
                filter.frequency.exponentialRampToValueAtTime(12000, now + 1.0);
                noise.start(now);
                noise.stop(now + 1.0);
                break;
            }
            case 'riser-sweep': {
                const synth = new Tone.Synth({
                    oscillator: { type: 'sawtooth' },
                    envelope: { attack: 0.8, decay: 0.1, sustain: 0.8, release: 0.2 }
                }).toDestination();
                this.previewSynths.push(synth);
                synth.frequency.setValueAtTime(80, now);
                synth.frequency.exponentialRampToValueAtTime(800, now + 0.8);
                synth.triggerAttackRelease('C2', 0.8, now);
                break;
            }
            case 'riser-cinematic': {
                const filter = new Tone.Filter({ frequency: 200, type: 'lowpass', rolloff: -12 }).toDestination();
                const reverb = new Tone.Reverb({ decay: 2, wet: 0.5 }).connect(filter);
                const noise = new Tone.Noise({ type: 'pink', volume: -8 }).connect(reverb);
                const synth = new Tone.Synth({
                    oscillator: { type: 'sine' },
                    envelope: { attack: 1.2, decay: 0.1, sustain: 0.5, release: 0.3 }
                }).connect(reverb);
                this.previewFilters.push(filter);
                this.previewEffects.push(reverb);
                this.previewNoises.push(noise);
                this.previewSynths.push(synth);
                filter.frequency.setValueAtTime(200, now);
                filter.frequency.exponentialRampToValueAtTime(6000, now + 1.2);
                noise.start(now);
                noise.stop(now + 1.2);
                synth.triggerAttackRelease('C3', 1.2, now);
                break;
            }
            case 'riser-reverse': {
                const filter = new Tone.Filter({ frequency: 2000, type: 'highpass', rolloff: -24 }).toDestination();
                const gain = new Tone.Gain(0).connect(filter);
                const noise = new Tone.Noise({ type: 'white', volume: -15 }).connect(gain);
                this.previewFilters.push(filter);
                this.previewNoises.push(noise);
                this.previewEffects.push(gain);
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(1, now + 0.7);
                filter.frequency.setValueAtTime(8000, now);
                filter.frequency.linearRampToValueAtTime(2000, now + 0.7);
                noise.start(now);
                noise.stop(now + 0.8);
                break;
            }
            case 'riser-tension': {
                const filter = new Tone.Filter({ frequency: 300, type: 'bandpass', Q: 5 }).toDestination();
                const synth1 = new Tone.Synth({
                    oscillator: { type: 'sawtooth' },
                    envelope: { attack: 1.0, decay: 0.1, sustain: 0.7, release: 0.2 }
                }).connect(filter);
                const synth2 = new Tone.Synth({
                    oscillator: { type: 'square' },
                    envelope: { attack: 1.0, decay: 0.1, sustain: 0.5, release: 0.2 }
                }).connect(filter);
                synth2.volume.value = -6;
                this.previewFilters.push(filter);
                this.previewSynths.push(synth1, synth2);
                filter.frequency.setValueAtTime(300, now);
                filter.frequency.exponentialRampToValueAtTime(3000, now + 1.0);
                synth1.triggerAttackRelease('C2', 1.0, now);
                synth2.triggerAttackRelease('Db2', 1.0, now);
                break;
            }
            case 'riser-sub': {
                const filter = new Tone.Filter({ frequency: 60, type: 'lowpass', rolloff: -48 }).toDestination();
                const noise = new Tone.Noise({ type: 'brown', volume: -6 }).connect(filter);
                const synth = new Tone.MonoSynth({
                    oscillator: { type: 'sine' },
                    envelope: { attack: 1.0, decay: 0.1, sustain: 0.8, release: 0.3 }
                }).connect(filter);
                this.previewFilters.push(filter);
                this.previewNoises.push(noise);
                this.previewSynths.push(synth);
                filter.frequency.setValueAtTime(40, now);
                filter.frequency.exponentialRampToValueAtTime(200, now + 1.0);
                noise.start(now);
                noise.stop(now + 1.0);
                synth.triggerAttackRelease('C1', 1.0, now);
                break;
            }
            default: {
                const filter = new Tone.Filter({ frequency: 200, type: 'lowpass' }).toDestination();
                const noise = new Tone.Noise({ type: 'white', volume: -12 }).connect(filter);
                this.previewFilters.push(filter);
                this.previewNoises.push(noise);
                filter.frequency.exponentialRampToValueAtTime(8000, now + 0.8);
                noise.start(now);
                noise.stop(now + 0.8);
            }
        }
    }

    playSwooshPreview(sampleId, now) {
        switch (sampleId) {
            case 'swoosh-fast': {
                const filter = new Tone.Filter({ frequency: 10000, type: 'bandpass', Q: 3 }).toDestination();
                const noise = new Tone.Noise({ type: 'white', volume: -6 }).connect(filter);
                this.previewFilters.push(filter);
                this.previewNoises.push(noise);
                filter.frequency.setValueAtTime(10000, now);
                filter.frequency.exponentialRampToValueAtTime(100, now + 0.15);
                noise.start(now);
                noise.stop(now + 0.2);
                break;
            }
            case 'swoosh-slow': {
                const filter = new Tone.Filter({ frequency: 6000, type: 'bandpass', Q: 1.5 }).toDestination();
                const reverb = new Tone.Reverb({ decay: 1.5, wet: 0.4 }).connect(filter);
                const noise = new Tone.Noise({ type: 'pink', volume: -8 }).connect(reverb);
                this.previewFilters.push(filter);
                this.previewEffects.push(reverb);
                this.previewNoises.push(noise);
                filter.frequency.setValueAtTime(6000, now);
                filter.frequency.exponentialRampToValueAtTime(200, now + 0.8);
                noise.start(now);
                noise.stop(now + 0.9);
                break;
            }
            case 'swoosh-vinyl': {
                const filter = new Tone.Filter({ frequency: 3000, type: 'bandpass', Q: 2 }).toDestination();
                const distortion = new Tone.Distortion(0.3).connect(filter);
                const noise = new Tone.Noise({ type: 'brown', volume: -8 }).connect(distortion);
                this.previewFilters.push(filter);
                this.previewEffects.push(distortion);
                this.previewNoises.push(noise);
                filter.frequency.setValueAtTime(4000, now);
                filter.frequency.exponentialRampToValueAtTime(500, now + 0.5);
                noise.start(now);
                noise.stop(now + 0.6);
                break;
            }
            case 'swoosh-air': {
                const filter = new Tone.Filter({ frequency: 5000, type: 'lowpass', rolloff: -12 }).toDestination();
                const noise = new Tone.Noise({ type: 'pink', volume: -10 }).connect(filter);
                this.previewFilters.push(filter);
                this.previewNoises.push(noise);
                filter.frequency.setValueAtTime(8000, now);
                filter.frequency.exponentialRampToValueAtTime(1000, now + 0.4);
                noise.start(now);
                noise.stop(now + 0.5);
                break;
            }
            case 'swoosh-transition': {
                const filter = new Tone.Filter({ frequency: 1000, type: 'bandpass', Q: 2 }).toDestination();
                const noise = new Tone.Noise({ type: 'white', volume: -8 }).connect(filter);
                this.previewFilters.push(filter);
                this.previewNoises.push(noise);
                filter.frequency.setValueAtTime(200, now);
                filter.frequency.exponentialRampToValueAtTime(8000, now + 0.3);
                filter.frequency.exponentialRampToValueAtTime(200, now + 0.6);
                noise.start(now);
                noise.stop(now + 0.7);
                break;
            }
            default: {
                const filter = new Tone.Filter({ frequency: 8000, type: 'bandpass', Q: 2 }).toDestination();
                const noise = new Tone.Noise({ type: 'white', volume: -8 }).connect(filter);
                this.previewFilters.push(filter);
                this.previewNoises.push(noise);
                filter.frequency.exponentialRampToValueAtTime(200, now + 0.4);
                noise.start(now);
                noise.stop(now + 0.4);
            }
        }
    }

    playClickPreview(sampleId, now) {
        switch (sampleId) {
            case 'click-vintage': {
                const synth = new Tone.MembraneSynth({
                    pitchDecay: 0.008, octaves: 3,
                    oscillator: { type: 'sine' },
                    envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.03 }
                }).toDestination();
                synth.volume.value = -4;
                this.previewSynths.push(synth);
                synth.triggerAttackRelease('F4', '64n', now);
                break;
            }
            case 'click-finger-snap': {
                const filter = new Tone.Filter({ frequency: 3000, type: 'highpass' }).toDestination();
                const synth = new Tone.NoiseSynth({
                    noise: { type: 'white' },
                    envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 }
                }).connect(filter);
                synth.volume.value = -8;
                this.previewSynths.push(synth);
                this.previewFilters.push(filter);
                synth.triggerAttackRelease('32n', now);
                break;
            }
            case 'click-wood': {
                const synth = new Tone.MembraneSynth({
                    pitchDecay: 0.005, octaves: 6,
                    oscillator: { type: 'triangle' },
                    envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.02 }
                }).toDestination();
                synth.volume.value = -2;
                this.previewSynths.push(synth);
                synth.triggerAttackRelease('G5', '64n', now);
                break;
            }
            case 'click-digital': {
                const synth = new Tone.Synth({
                    oscillator: { type: 'square' },
                    envelope: { attack: 0.001, decay: 0.015, sustain: 0, release: 0.01 }
                }).toDestination();
                synth.volume.value = -8;
                this.previewSynths.push(synth);
                synth.triggerAttackRelease('A6', '128n', now);
                break;
            }
            case 'click-metronome': {
                const synth = new Tone.Synth({
                    oscillator: { type: 'sine' },
                    envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 }
                }).toDestination();
                synth.volume.value = -6;
                this.previewSynths.push(synth);
                synth.triggerAttackRelease('C6', '64n', now);
                break;
            }
            case 'click-mouth': {
                const filter = new Tone.Filter({ frequency: 2500, type: 'bandpass', Q: 3 }).toDestination();
                const synth = new Tone.NoiseSynth({
                    noise: { type: 'pink' },
                    envelope: { attack: 0.002, decay: 0.06, sustain: 0, release: 0.04 }
                }).connect(filter);
                synth.volume.value = -6;
                this.previewSynths.push(synth);
                this.previewFilters.push(filter);
                synth.triggerAttackRelease('32n', now);
                break;
            }
            default: {
                const synth = new Tone.MembraneSynth({
                    pitchDecay: 0.01, octaves: 4,
                    envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 }
                }).toDestination();
                this.previewSynths.push(synth);
                synth.triggerAttackRelease('E5', '32n', now);
            }
        }
    }

    playBassPreview(sampleId, now) {
        switch (sampleId) {
            case 'bass-808': {
                const synth = new Tone.MembraneSynth({
                    pitchDecay: 0.08, octaves: 5,
                    oscillator: { type: 'sine' },
                    envelope: { attack: 0.001, decay: 0.6, sustain: 0.1, release: 0.8 }
                }).toDestination();
                synth.volume.value = -4;
                this.previewSynths.push(synth);
                synth.triggerAttackRelease('C1', '2n', now);
                break;
            }
            case 'bass-deep': {
                const synth = new Tone.MonoSynth({
                    oscillator: { type: 'sine' },
                    envelope: { attack: 0.01, decay: 1.0, sustain: 0.2, release: 1.0 },
                    filterEnvelope: { attack: 0.01, decay: 0.3, sustain: 0.2, release: 0.5, baseFrequency: 60, octaves: 1.5 }
                }).toDestination();
                synth.volume.value = -2;
                this.previewSynths.push(synth);
                synth.triggerAttackRelease('E1', '2n', now);
                break;
            }
            case 'bass-punch': {
                const synth = new Tone.MonoSynth({
                    oscillator: { type: 'triangle' },
                    envelope: { attack: 0.005, decay: 0.15, sustain: 0.1, release: 0.2 },
                    filterEnvelope: { attack: 0.001, decay: 0.1, sustain: 0.1, release: 0.1, baseFrequency: 200, octaves: 3 }
                }).toDestination();
                synth.volume.value = -4;
                this.previewSynths.push(synth);
                synth.triggerAttackRelease('G1', '8n', now);
                break;
            }
            case 'bass-reese': {
                const synth1 = new Tone.MonoSynth({
                    oscillator: { type: 'sawtooth' },
                    envelope: { attack: 0.01, decay: 0.3, sustain: 0.5, release: 0.3 },
                    filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.2, baseFrequency: 150, octaves: 2 }
                }).toDestination();
                const synth2 = new Tone.MonoSynth({
                    oscillator: { type: 'sawtooth' },
                    envelope: { attack: 0.01, decay: 0.3, sustain: 0.5, release: 0.3 },
                    filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.2, baseFrequency: 150, octaves: 2 }
                }).toDestination();
                synth1.volume.value = -8;
                synth2.volume.value = -8;
                synth2.detune.value = 15;
                this.previewSynths.push(synth1, synth2);
                synth1.triggerAttackRelease('D1', '4n', now);
                synth2.triggerAttackRelease('D1', '4n', now);
                break;
            }
            case 'bass-wobble': {
                const filter = new Tone.Filter({ frequency: 400, type: 'lowpass', Q: 8 }).toDestination();
                const lfo = new Tone.LFO({ frequency: 4, min: 100, max: 1200 }).start();
                lfo.connect(filter.frequency);
                const synth = new Tone.MonoSynth({
                    oscillator: { type: 'sawtooth' },
                    envelope: { attack: 0.01, decay: 0.1, sustain: 0.8, release: 0.2 }
                }).connect(filter);
                synth.volume.value = -6;
                this.previewSynths.push(synth);
                this.previewFilters.push(filter);
                this.previewEffects.push(lfo);
                synth.triggerAttackRelease('E1', '4n', now);
                break;
            }
            case 'bass-slide': {
                const synth = new Tone.MonoSynth({
                    oscillator: { type: 'sine' },
                    envelope: { attack: 0.01, decay: 0.4, sustain: 0.3, release: 0.3 },
                    filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.2, baseFrequency: 100, octaves: 2 }
                }).toDestination();
                synth.volume.value = -4;
                this.previewSynths.push(synth);
                synth.triggerAttack('C1', now);
                synth.frequency.exponentialRampToValueAtTime(Tone.Frequency('G1').toFrequency(), now + 0.3);
                synth.triggerRelease(now + 0.5);
                break;
            }
            default: {
                const synth = new Tone.MonoSynth({
                    oscillator: { type: 'sine' },
                    envelope: { attack: 0.005, decay: 0.3, sustain: 0.1, release: 0.5 }
                }).toDestination();
                this.previewSynths.push(synth);
                synth.triggerAttackRelease('C1', '4n', now);
            }
        }
    }

    playBeepPreview(sampleId, now) {
        switch (sampleId) {
            case 'beep-alert': {
                const synth = new Tone.Synth({
                    oscillator: { type: 'sine' },
                    envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.1 }
                }).toDestination();
                synth.volume.value = -8;
                this.previewSynths.push(synth);
                synth.triggerAttackRelease('A5', '16n', now);
                synth.triggerAttackRelease('A5', '16n', now + 0.15);
                break;
            }
            case 'beep-scan': {
                const synth = new Tone.Synth({
                    oscillator: { type: 'sine' },
                    envelope: { attack: 0.02, decay: 0.2, sustain: 0.1, release: 0.1 }
                }).toDestination();
                synth.volume.value = -10;
                this.previewSynths.push(synth);
                synth.frequency.setValueAtTime(Tone.Frequency('C5').toFrequency(), now);
                synth.frequency.exponentialRampToValueAtTime(Tone.Frequency('C7').toFrequency(), now + 0.3);
                synth.triggerAttackRelease('C5', 0.35, now);
                break;
            }
            case 'beep-notification': {
                const synth = new Tone.PolySynth(Tone.Synth, {
                    oscillator: { type: 'sine' },
                    envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.3 }
                }).toDestination();
                synth.volume.value = -10;
                this.previewSynths.push(synth);
                synth.triggerAttackRelease('E5', '8n', now);
                synth.triggerAttackRelease('G5', '8n', now + 0.1);
                break;
            }
            case 'beep-retro': {
                const synth = new Tone.Synth({
                    oscillator: { type: 'square' },
                    envelope: { attack: 0.001, decay: 0.08, sustain: 0.2, release: 0.05 }
                }).toDestination();
                synth.volume.value = -12;
                this.previewSynths.push(synth);
                synth.triggerAttackRelease('C5', '16n', now);
                synth.triggerAttackRelease('E5', '16n', now + 0.08);
                synth.triggerAttackRelease('G5', '16n', now + 0.16);
                break;
            }
            case 'beep-robot': {
                const synth = new Tone.Synth({
                    oscillator: { type: 'sawtooth' },
                    envelope: { attack: 0.005, decay: 0.05, sustain: 0.3, release: 0.05 }
                }).toDestination();
                synth.volume.value = -12;
                this.previewSynths.push(synth);
                synth.triggerAttackRelease('C4', '32n', now);
                synth.triggerAttackRelease('E4', '32n', now + 0.06);
                synth.triggerAttackRelease('G4', '32n', now + 0.12);
                synth.triggerAttackRelease('C5', '32n', now + 0.18);
                break;
            }
            case 'beep-countdown': {
                const synth = new Tone.Synth({
                    oscillator: { type: 'sine' },
                    envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 }
                }).toDestination();
                synth.volume.value = -8;
                this.previewSynths.push(synth);
                synth.triggerAttackRelease('G4', '32n', now);
                synth.triggerAttackRelease('G4', '32n', now + 0.15);
                synth.triggerAttackRelease('G4', '32n', now + 0.30);
                synth.triggerAttackRelease('C5', '16n', now + 0.45);
                break;
            }
            default: {
                const synth = new Tone.Synth({
                    oscillator: { type: 'sine' },
                    envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.1 }
                }).toDestination();
                this.previewSynths.push(synth);
                synth.triggerAttackRelease('C5', '8n', now);
            }
        }
    }

    playFxPreview(sampleId, now) {
        switch (sampleId) {
            case 'fx-impact': {
                const synth = new Tone.MembraneSynth({
                    pitchDecay: 0.4, octaves: 8,
                    oscillator: { type: 'sine' },
                    envelope: { attack: 0.001, decay: 0.8, sustain: 0, release: 0.6 }
                }).toDestination();
                const reverb = new Tone.Reverb({ decay: 1.5, wet: 0.3 }).toDestination();
                synth.connect(reverb);
                synth.volume.value = -4;
                this.previewSynths.push(synth);
                this.previewEffects.push(reverb);
                synth.triggerAttackRelease('C1', '2n', now);
                break;
            }
            case 'fx-atmosphere': {
                const reverb = new Tone.Reverb({ decay: 3, wet: 0.7 }).toDestination();
                const synth = new Tone.PolySynth(Tone.Synth, {
                    oscillator: { type: 'sine' },
                    envelope: { attack: 0.5, decay: 0.3, sustain: 0.6, release: 1.0 }
                }).connect(reverb);
                synth.volume.value = -12;
                this.previewSynths.push(synth);
                this.previewEffects.push(reverb);
                synth.triggerAttackRelease(['C3', 'Eb3', 'G3'], 1.2, now);
                break;
            }
            case 'fx-glitch': {
                const bitCrusher = new Tone.BitCrusher(4).toDestination();
                const noise = new Tone.Noise({ type: 'white', volume: -8 }).connect(bitCrusher);
                this.previewNoises.push(noise);
                this.previewEffects.push(bitCrusher);
                noise.start(now);
                noise.stop(now + 0.03);
                noise.start(now + 0.05);
                noise.stop(now + 0.08);
                noise.start(now + 0.12);
                noise.stop(now + 0.18);
                noise.start(now + 0.22);
                noise.stop(now + 0.25);
                break;
            }
            case 'fx-vinyl-crackle': {
                const filter = new Tone.Filter({ frequency: 3000, type: 'lowpass' }).toDestination();
                const noise = new Tone.Noise({ type: 'brown', volume: -18 }).connect(filter);
                this.previewFilters.push(filter);
                this.previewNoises.push(noise);
                noise.start(now);
                noise.stop(now + 1.0);
                break;
            }
            case 'fx-downlifter': {
                const filter = new Tone.Filter({ frequency: 10000, type: 'lowpass', rolloff: -24 }).toDestination();
                const noise = new Tone.Noise({ type: 'pink', volume: -8 }).connect(filter);
                this.previewFilters.push(filter);
                this.previewNoises.push(noise);
                filter.frequency.setValueAtTime(10000, now);
                filter.frequency.exponentialRampToValueAtTime(50, now + 0.8);
                noise.start(now);
                noise.stop(now + 0.9);
                break;
            }
            case 'fx-stutter': {
                const synth = new Tone.Synth({
                    oscillator: { type: 'sawtooth' },
                    envelope: { attack: 0.001, decay: 0.03, sustain: 0.5, release: 0.02 }
                }).toDestination();
                synth.volume.value = -10;
                this.previewSynths.push(synth);
                for (let i = 0; i < 8; i++) {
                    synth.triggerAttackRelease('C4', '64n', now + i * 0.05);
                }
                break;
            }
            default: {
                const synth = new Tone.Synth({
                    oscillator: { type: 'sine' },
                    envelope: { attack: 0.3, decay: 0.2, sustain: 0.5, release: 0.8 }
                }).toDestination();
                this.previewSynths.push(synth);
                synth.triggerAttackRelease('C3', '2n', now);
            }
        }
    }

    // === BUFFER GENERATION (uses BACKEND) ===

    /**
     * Generate an AudioBuffer for a sample (for adding to playlist)
     * Uses backend API with caching for consistent, high-quality output
     */
    async generateSampleBuffer(sampleId, packType, durationSeconds = 2, bpm = 120) {
        await this.init();

        // Check local cache first
        const cacheKey = `${sampleId}_${packType}_${durationSeconds}_${bpm}`;
        if (this.bufferCache.has(cacheKey)) {
            return this.bufferCache.get(cacheKey);
        }

        try {
            // Try backend first
            const buffer = await this.fetchFromBackend(sampleId, packType, durationSeconds, bpm);
            this.bufferCache.set(cacheKey, buffer);
            return buffer;
        } catch (error) {
            console.warn('Backend unavailable, falling back to frontend synthesis:', error.message);
            // Fallback to frontend synthesis if backend is unavailable
            return this.generateLocalBuffer(sampleId, packType, durationSeconds);
        }
    }

    /**
     * Fetch sample from backend API
     */
    async fetchFromBackend(sampleId, packType, durationSeconds, bpm) {
        const params = new URLSearchParams({
            sample_id: sampleId,
            pack_type: packType,
            duration: `${durationSeconds}s`,
            bpm: bpm.toString()
        });

        const response = await fetch(`${API_BASE}/audiopack/fetch?${params}`);
        
        if (!response.ok) {
            throw new Error(`Backend returned ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const audioContext = Tone.getContext().rawContext;
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        return new Tone.ToneAudioBuffer().fromArray(audioBuffer);
    }

    /**
     * Fallback: Generate buffer locally using Tone.Offline
     * Only used when backend is unavailable
     */
    async generateLocalBuffer(sampleId, packType, durationSeconds) {
        const self = this;
        const buffer = await Tone.Offline(({ transport }) => {
            const now = 0;
            switch (packType) {
                case 'risers':
                    self.renderRiserOffline(sampleId, now, durationSeconds);
                    break;
                case 'swooshes':
                    self.renderSwooshOffline(sampleId, now, durationSeconds);
                    break;
                case 'clicks':
                    self.renderClickOffline(sampleId, now, durationSeconds);
                    break;
                case 'bassNotes':
                    self.renderBassOffline(sampleId, now, durationSeconds);
                    break;
                case 'beeps':
                    self.renderBeepOffline(sampleId, now, durationSeconds);
                    break;
                case 'fx':
                    self.renderFxOffline(sampleId, now, durationSeconds);
                    break;
                default:
                    self.renderBeepOffline('beep-alert', now, durationSeconds);
            }
        }, durationSeconds);

        return buffer;
    }

    // === OFFLINE RENDER METHODS (for buffer generation) ===

    renderRiserOffline(sampleId, now, duration) {
        switch (sampleId) {
            case 'riser-white': {
                const filter = new Tone.Filter({ frequency: 100, type: 'lowpass', rolloff: -24 }).toDestination();
                const gain = new Tone.Gain(0).connect(filter);
                const noise = new Tone.Noise({ type: 'white', volume: -6 }).connect(gain);
                filter.frequency.setValueAtTime(100, now);
                filter.frequency.exponentialRampToValueAtTime(12000, now + duration * 0.95);
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(1, now + duration * 0.8);
                gain.gain.linearRampToValueAtTime(0, now + duration);
                noise.start(now);
                noise.stop(now + duration);
                break;
            }
            case 'riser-sweep': {
                const synth = new Tone.Synth({
                    oscillator: { type: 'sawtooth' },
                    envelope: { attack: duration * 0.9, decay: 0.1, sustain: 0.8, release: duration * 0.1 }
                }).toDestination();
                synth.frequency.setValueAtTime(60, now);
                synth.frequency.exponentialRampToValueAtTime(800, now + duration * 0.9);
                synth.triggerAttackRelease('C2', duration * 0.95, now);
                break;
            }
            case 'riser-cinematic': {
                const filter = new Tone.Filter({ frequency: 200, type: 'lowpass' }).toDestination();
                const noise = new Tone.Noise({ type: 'pink', volume: -8 }).connect(filter);
                const synth = new Tone.Synth({
                    oscillator: { type: 'sine' },
                    envelope: { attack: duration * 0.9, decay: 0.1, sustain: 0.5, release: duration * 0.1 }
                }).connect(filter);
                filter.frequency.setValueAtTime(200, now);
                filter.frequency.exponentialRampToValueAtTime(6000, now + duration * 0.9);
                noise.start(now);
                noise.stop(now + duration);
                synth.triggerAttackRelease('C3', duration * 0.95, now);
                break;
            }
            case 'riser-tension': {
                const filter = new Tone.Filter({ frequency: 300, type: 'bandpass', Q: 5 }).toDestination();
                const synth1 = new Tone.Synth({
                    oscillator: { type: 'sawtooth' },
                    envelope: { attack: duration * 0.9, decay: 0.1, sustain: 0.7, release: duration * 0.1 }
                }).connect(filter);
                const synth2 = new Tone.Synth({
                    oscillator: { type: 'square' },
                    envelope: { attack: duration * 0.9, decay: 0.1, sustain: 0.5, release: duration * 0.1 }
                }).connect(filter);
                synth2.volume.value = -6;
                filter.frequency.setValueAtTime(300, now);
                filter.frequency.exponentialRampToValueAtTime(3000, now + duration * 0.9);
                synth1.triggerAttackRelease('C2', duration * 0.95, now);
                synth2.triggerAttackRelease('Db2', duration * 0.95, now);
                break;
            }
            case 'riser-sub': {
                const filter = new Tone.Filter({ frequency: 40, type: 'lowpass', rolloff: -48 }).toDestination();
                const noise = new Tone.Noise({ type: 'brown', volume: -6 }).connect(filter);
                const synth = new Tone.MonoSynth({
                    oscillator: { type: 'sine' },
                    envelope: { attack: duration * 0.9, decay: 0.1, sustain: 0.8, release: duration * 0.1 }
                }).connect(filter);
                filter.frequency.setValueAtTime(40, now);
                filter.frequency.exponentialRampToValueAtTime(200, now + duration * 0.9);
                noise.start(now);
                noise.stop(now + duration);
                synth.triggerAttackRelease('C1', duration * 0.95, now);
                break;
            }
            default: {
                const filter = new Tone.Filter({ frequency: 200, type: 'lowpass', rolloff: -24 }).toDestination();
                const gain = new Tone.Gain(0).connect(filter);
                const noise = new Tone.Noise({ type: 'pink', volume: -6 }).connect(gain);
                filter.frequency.setValueAtTime(200, now);
                filter.frequency.exponentialRampToValueAtTime(12000, now + duration * 0.9);
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(1, now + duration * 0.8);
                gain.gain.linearRampToValueAtTime(0, now + duration);
                noise.start(now);
                noise.stop(now + duration);
            }
        }
    }

    renderSwooshOffline(sampleId, now, duration) {
        switch (sampleId) {
            case 'swoosh-fast': {
                const filter = new Tone.Filter({ frequency: 10000, type: 'bandpass', Q: 3 }).toDestination();
                const noise = new Tone.Noise({ type: 'white', volume: -4 }).connect(filter);
                filter.frequency.setValueAtTime(10000, now);
                filter.frequency.exponentialRampToValueAtTime(100, now + duration * 0.8);
                noise.start(now);
                noise.stop(now + duration);
                break;
            }
            case 'swoosh-slow': {
                const filter = new Tone.Filter({ frequency: 6000, type: 'bandpass', Q: 1.5 }).toDestination();
                const noise = new Tone.Noise({ type: 'pink', volume: -6 }).connect(filter);
                filter.frequency.setValueAtTime(6000, now);
                filter.frequency.exponentialRampToValueAtTime(200, now + duration * 0.9);
                noise.start(now);
                noise.stop(now + duration);
                break;
            }
            case 'swoosh-vinyl': {
                const filter = new Tone.Filter({ frequency: 3000, type: 'bandpass', Q: 2 }).toDestination();
                const distortion = new Tone.Distortion(0.3).connect(filter);
                const noise = new Tone.Noise({ type: 'brown', volume: -6 }).connect(distortion);
                filter.frequency.setValueAtTime(4000, now);
                filter.frequency.exponentialRampToValueAtTime(500, now + duration * 0.8);
                noise.start(now);
                noise.stop(now + duration);
                break;
            }
            case 'swoosh-air': {
                const filter = new Tone.Filter({ frequency: 5000, type: 'lowpass', rolloff: -12 }).toDestination();
                const noise = new Tone.Noise({ type: 'pink', volume: -8 }).connect(filter);
                filter.frequency.setValueAtTime(8000, now);
                filter.frequency.exponentialRampToValueAtTime(1000, now + duration * 0.8);
                noise.start(now);
                noise.stop(now + duration);
                break;
            }
            case 'swoosh-transition': {
                const filter = new Tone.Filter({ frequency: 1000, type: 'bandpass', Q: 2 }).toDestination();
                const noise = new Tone.Noise({ type: 'white', volume: -6 }).connect(filter);
                filter.frequency.setValueAtTime(200, now);
                filter.frequency.exponentialRampToValueAtTime(8000, now + duration * 0.45);
                filter.frequency.exponentialRampToValueAtTime(200, now + duration * 0.9);
                noise.start(now);
                noise.stop(now + duration);
                break;
            }
            default: {
                const filter = new Tone.Filter({ frequency: 8000, type: 'bandpass', Q: 2 }).toDestination();
                const noise = new Tone.Noise({ type: 'white', volume: -4 }).connect(filter);
                filter.frequency.setValueAtTime(8000, now);
                filter.frequency.exponentialRampToValueAtTime(200, now + duration);
                noise.start(now);
                noise.stop(now + duration);
            }
        }
    }

    renderClickOffline(sampleId, now, duration) {
        switch (sampleId) {
            case 'click-vintage': {
                const synth = new Tone.MembraneSynth({
                    pitchDecay: 0.008, octaves: 3,
                    envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.03 }
                }).toDestination();
                synth.volume.value = -4;
                synth.triggerAttackRelease('F4', '64n', now);
                break;
            }
            case 'click-finger-snap': {
                const filter = new Tone.Filter({ frequency: 3000, type: 'highpass' }).toDestination();
                const synth = new Tone.NoiseSynth({
                    noise: { type: 'white' },
                    envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 }
                }).connect(filter);
                synth.volume.value = -8;
                synth.triggerAttackRelease('32n', now);
                break;
            }
            case 'click-wood': {
                const synth = new Tone.MembraneSynth({
                    pitchDecay: 0.005, octaves: 6,
                    oscillator: { type: 'triangle' },
                    envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.02 }
                }).toDestination();
                synth.volume.value = -2;
                synth.triggerAttackRelease('G5', '64n', now);
                break;
            }
            case 'click-digital': {
                const synth = new Tone.Synth({
                    oscillator: { type: 'square' },
                    envelope: { attack: 0.001, decay: 0.015, sustain: 0, release: 0.01 }
                }).toDestination();
                synth.volume.value = -8;
                synth.triggerAttackRelease('A6', '128n', now);
                break;
            }
            case 'click-metronome': {
                const synth = new Tone.Synth({
                    oscillator: { type: 'sine' },
                    envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 }
                }).toDestination();
                synth.volume.value = -6;
                synth.triggerAttackRelease('C6', '64n', now);
                break;
            }
            case 'click-mouth': {
                const filter = new Tone.Filter({ frequency: 2500, type: 'bandpass', Q: 3 }).toDestination();
                const synth = new Tone.NoiseSynth({
                    noise: { type: 'pink' },
                    envelope: { attack: 0.002, decay: 0.06, sustain: 0, release: 0.04 }
                }).connect(filter);
                synth.volume.value = -6;
                synth.triggerAttackRelease('32n', now);
                break;
            }
            default: {
                const synth = new Tone.MembraneSynth({
                    pitchDecay: 0.01, octaves: 4,
                    envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 }
                }).toDestination();
                synth.triggerAttackRelease('E5', '32n', now);
            }
        }
    }

    renderBassOffline(sampleId, now, duration) {
        switch (sampleId) {
            case 'bass-808': {
                const synth = new Tone.MembraneSynth({
                    pitchDecay: 0.08, octaves: 5,
                    envelope: { attack: 0.001, decay: duration * 0.5, sustain: 0.1, release: duration * 0.4 }
                }).toDestination();
                synth.volume.value = -4;
                synth.triggerAttackRelease('C1', duration * 0.9, now);
                break;
            }
            case 'bass-deep': {
                const synth = new Tone.MonoSynth({
                    oscillator: { type: 'sine' },
                    envelope: { attack: 0.01, decay: duration * 0.6, sustain: 0.2, release: duration * 0.3 }
                }).toDestination();
                synth.volume.value = -2;
                synth.triggerAttackRelease('E1', duration * 0.8, now);
                break;
            }
            case 'bass-punch': {
                const synth = new Tone.MonoSynth({
                    oscillator: { type: 'triangle' },
                    envelope: { attack: 0.005, decay: 0.15, sustain: 0.1, release: 0.2 },
                    filterEnvelope: { attack: 0.001, decay: 0.1, sustain: 0.1, release: 0.1, baseFrequency: 200, octaves: 3 }
                }).toDestination();
                synth.volume.value = -4;
                synth.triggerAttackRelease('G1', duration * 0.6, now);
                break;
            }
            case 'bass-reese': {
                const synth1 = new Tone.MonoSynth({
                    oscillator: { type: 'sawtooth' },
                    envelope: { attack: 0.01, decay: duration * 0.4, sustain: 0.5, release: duration * 0.3 }
                }).toDestination();
                const synth2 = new Tone.MonoSynth({
                    oscillator: { type: 'sawtooth' },
                    envelope: { attack: 0.01, decay: duration * 0.4, sustain: 0.5, release: duration * 0.3 }
                }).toDestination();
                synth1.volume.value = -8;
                synth2.volume.value = -8;
                synth2.detune.value = 15;
                synth1.triggerAttackRelease('D1', duration * 0.8, now);
                synth2.triggerAttackRelease('D1', duration * 0.8, now);
                break;
            }
            case 'bass-wobble': {
                const filter = new Tone.Filter({ frequency: 400, type: 'lowpass', Q: 8 }).toDestination();
                const lfo = new Tone.LFO({ frequency: 4, min: 100, max: 1200 }).start();
                lfo.connect(filter.frequency);
                const synth = new Tone.MonoSynth({
                    oscillator: { type: 'sawtooth' },
                    envelope: { attack: 0.01, decay: 0.1, sustain: 0.8, release: 0.2 }
                }).connect(filter);
                synth.volume.value = -6;
                synth.triggerAttackRelease('E1', duration * 0.8, now);
                break;
            }
            case 'bass-slide': {
                const synth = new Tone.MonoSynth({
                    oscillator: { type: 'sine' },
                    envelope: { attack: 0.01, decay: duration * 0.5, sustain: 0.3, release: duration * 0.3 }
                }).toDestination();
                synth.volume.value = -4;
                synth.triggerAttack('C1', now);
                synth.frequency.exponentialRampToValueAtTime(Tone.Frequency('G1').toFrequency(), now + duration * 0.4);
                synth.triggerRelease(now + duration * 0.8);
                break;
            }
            default: {
                const synth = new Tone.MonoSynth({
                    oscillator: { type: 'sine' },
                    envelope: { attack: 0.005, decay: duration * 0.5, sustain: 0.1, release: duration * 0.4 }
                }).toDestination();
                synth.triggerAttackRelease('C1', duration * 0.8, now);
            }
        }
    }

    renderBeepOffline(sampleId, now, duration) {
        switch (sampleId) {
            case 'beep-alert': {
                const synth = new Tone.Synth({
                    oscillator: { type: 'sine' },
                    envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.1 }
                }).toDestination();
                synth.volume.value = -8;
                synth.triggerAttackRelease('A5', '16n', now);
                synth.triggerAttackRelease('A5', '16n', now + 0.15);
                break;
            }
            case 'beep-scan': {
                const synth = new Tone.Synth({
                    oscillator: { type: 'sine' },
                    envelope: { attack: 0.02, decay: 0.2, sustain: 0.1, release: 0.1 }
                }).toDestination();
                synth.volume.value = -10;
                synth.frequency.setValueAtTime(Tone.Frequency('C5').toFrequency(), now);
                synth.frequency.exponentialRampToValueAtTime(Tone.Frequency('C7').toFrequency(), now + 0.3);
                synth.triggerAttackRelease('C5', 0.35, now);
                break;
            }
            case 'beep-notification': {
                const synth = new Tone.PolySynth(Tone.Synth, {
                    oscillator: { type: 'sine' },
                    envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.3 }
                }).toDestination();
                synth.volume.value = -10;
                synth.triggerAttackRelease('E5', '8n', now);
                synth.triggerAttackRelease('G5', '8n', now + 0.1);
                break;
            }
            case 'beep-retro': {
                const synth = new Tone.Synth({
                    oscillator: { type: 'square' },
                    envelope: { attack: 0.001, decay: 0.08, sustain: 0.2, release: 0.05 }
                }).toDestination();
                synth.volume.value = -12;
                synth.triggerAttackRelease('C5', '16n', now);
                synth.triggerAttackRelease('E5', '16n', now + 0.08);
                synth.triggerAttackRelease('G5', '16n', now + 0.16);
                break;
            }
            case 'beep-robot': {
                const synth = new Tone.Synth({
                    oscillator: { type: 'sawtooth' },
                    envelope: { attack: 0.005, decay: 0.05, sustain: 0.3, release: 0.05 }
                }).toDestination();
                synth.volume.value = -12;
                synth.triggerAttackRelease('C4', '32n', now);
                synth.triggerAttackRelease('E4', '32n', now + 0.06);
                synth.triggerAttackRelease('G4', '32n', now + 0.12);
                synth.triggerAttackRelease('C5', '32n', now + 0.18);
                break;
            }
            case 'beep-countdown': {
                const synth = new Tone.Synth({
                    oscillator: { type: 'sine' },
                    envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 }
                }).toDestination();
                synth.volume.value = -8;
                synth.triggerAttackRelease('G4', '32n', now);
                synth.triggerAttackRelease('G4', '32n', now + 0.15);
                synth.triggerAttackRelease('G4', '32n', now + 0.30);
                synth.triggerAttackRelease('C5', '16n', now + 0.45);
                break;
            }
            default: {
                const synth = new Tone.Synth({
                    oscillator: { type: 'sine' },
                    envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.1 }
                }).toDestination();
                synth.triggerAttackRelease('C5', '8n', now);
            }
        }
    }

    renderFxOffline(sampleId, now, duration) {
        switch (sampleId) {
            case 'fx-impact': {
                const synth = new Tone.MembraneSynth({
                    pitchDecay: 0.4, octaves: 8,
                    envelope: { attack: 0.001, decay: duration * 0.6, sustain: 0, release: duration * 0.4 }
                }).toDestination();
                synth.volume.value = -4;
                synth.triggerAttackRelease('C1', duration, now);
                break;
            }
            case 'fx-atmosphere': {
                const synth = new Tone.PolySynth(Tone.Synth, {
                    oscillator: { type: 'sine' },
                    envelope: { attack: duration * 0.3, decay: duration * 0.2, sustain: 0.6, release: duration * 0.3 }
                }).toDestination();
                synth.volume.value = -12;
                synth.triggerAttackRelease(['C3', 'Eb3', 'G3'], duration * 0.8, now);
                break;
            }
            case 'fx-glitch': {
                const bitCrusher = new Tone.BitCrusher(4).toDestination();
                const noise = new Tone.Noise({ type: 'white', volume: -8 }).connect(bitCrusher);
                // Stuttered playback
                const stutterTimes = [0, 0.05, 0.12, 0.22];
                const stutterDurations = [0.03, 0.03, 0.06, duration - 0.22];
                stutterTimes.forEach((t, i) => {
                    if (t + stutterDurations[i] <= duration) {
                        noise.start(now + t);
                        noise.stop(now + t + stutterDurations[i]);
                    }
                });
                break;
            }
            case 'fx-vinyl-crackle': {
                const filter = new Tone.Filter({ frequency: 3000, type: 'lowpass' }).toDestination();
                const noise = new Tone.Noise({ type: 'brown', volume: -18 }).connect(filter);
                noise.start(now);
                noise.stop(now + duration);
                break;
            }
            case 'fx-downlifter': {
                const filter = new Tone.Filter({ frequency: 10000, type: 'lowpass', rolloff: -24 }).toDestination();
                const noise = new Tone.Noise({ type: 'pink', volume: -6 }).connect(filter);
                filter.frequency.setValueAtTime(10000, now);
                filter.frequency.exponentialRampToValueAtTime(50, now + duration * 0.9);
                noise.start(now);
                noise.stop(now + duration);
                break;
            }
            case 'fx-stutter': {
                const synth = new Tone.Synth({
                    oscillator: { type: 'sawtooth' },
                    envelope: { attack: 0.001, decay: 0.03, sustain: 0.5, release: 0.02 }
                }).toDestination();
                synth.volume.value = -10;
                const numNotes = Math.floor(duration / 0.05);
                for (let i = 0; i < numNotes; i++) {
                    synth.triggerAttackRelease('C4', '64n', now + i * 0.05);
                }
                break;
            }
            default: {
                const synth = new Tone.Synth({
                    oscillator: { type: 'sine' },
                    envelope: { attack: 0.3, decay: 0.2, sustain: 0.5, release: 0.8 }
                }).toDestination();
                synth.triggerAttackRelease('C3', duration * 0.8, now);
            }
        }
    }

    /**
     * Pre-warm cache by fetching common samples from backend
     */
    async prewarmCache(samples, bpm = 120) {
        try {
            const response = await fetch(`${API_BASE}/audiopack/batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ samples, bpm })
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log(`Pre-warmed ${result.generated} samples on backend`);
                return result;
            }
        } catch (error) {
            console.warn('Could not pre-warm cache:', error.message);
        }
        return null;
    }

    /**
     * Parse duration string to seconds
     */
    parseDuration(durationStr, bpm = 120) {
        const beatsPerSecond = bpm / 60;

        if (durationStr.includes('bar')) {
            const bars = parseFloat(durationStr);
            return (bars * 4) / beatsPerSecond;
        } else if (durationStr.includes('beat')) {
            const beats = parseFloat(durationStr);
            return beats / beatsPerSecond;
        } else if (durationStr.includes('s')) {
            return parseFloat(durationStr);
        } else if (durationStr === 'loop') {
            return 4;
        }
        return 1;
    }
}

// Export singleton instance
const audioPackSynth = new AudioPackSynth();
export default audioPackSynth;
