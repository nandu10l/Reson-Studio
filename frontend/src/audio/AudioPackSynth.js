import * as Tone from 'tone';

/**
 * AudioPackSynth - Synthesizes audio samples for the Audio Packs feature
 * Uses Tone.js to generate sounds on-demand without requiring external audio files
 */
class AudioPackSynth {
    constructor() {
        this.isInitialized = false;
        this.previewSynth = null;
        this.previewFilter = null;
        this.previewNoise = null;
    }

    async init() {
        if (this.isInitialized) return;
        await Tone.start();
        this.isInitialized = true;
    }

    /**
     * Preview a sample by playing a short sound
     * @param {string} sampleId - The sample ID (e.g., 'riser-white', 'swoosh-fast')
     * @param {string} packType - The pack type (e.g., 'risers', 'swooshes')
     */
    async previewSample(sampleId, packType) {
        await this.init();

        // Dispose previous synths to prevent memory leaks
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
        if (this.previewSynth) {
            try { this.previewSynth.dispose(); } catch (e) { }
            this.previewSynth = null;
        }
        if (this.previewFilter) {
            try { this.previewFilter.dispose(); } catch (e) { }
            this.previewFilter = null;
        }
        if (this.previewNoise) {
            try { this.previewNoise.dispose(); } catch (e) { }
            this.previewNoise = null;
        }
    }

    // === RISERS ===
    playRiserPreview(sampleId, now) {
        const duration = 0.8;

        // Create a filtered noise riser
        this.previewFilter = new Tone.Filter({
            frequency: 200,
            type: 'lowpass',
            rolloff: -24
        }).toDestination();

        this.previewNoise = new Tone.Noise({
            type: sampleId.includes('white') ? 'white' :
                sampleId.includes('sub') ? 'brown' : 'pink',
            volume: -12
        }).connect(this.previewFilter);

        // Frequency sweep up
        this.previewFilter.frequency.setValueAtTime(200, now);
        this.previewFilter.frequency.exponentialRampToValueAtTime(8000, now + duration);

        this.previewNoise.start(now);
        this.previewNoise.stop(now + duration);
    }

    // === SWOOSHES ===
    playSwooshPreview(sampleId, now) {
        const duration = 0.4;
        const isFast = sampleId.includes('fast');

        this.previewFilter = new Tone.Filter({
            frequency: 8000,
            type: 'bandpass',
            Q: 2
        }).toDestination();

        this.previewNoise = new Tone.Noise({
            type: 'white',
            volume: -8
        }).connect(this.previewFilter);

        // Frequency sweep
        const sweepDuration = isFast ? 0.2 : 0.4;
        this.previewFilter.frequency.setValueAtTime(8000, now);
        this.previewFilter.frequency.exponentialRampToValueAtTime(200, now + sweepDuration);

        this.previewNoise.start(now);
        this.previewNoise.stop(now + duration);
    }

    // === CLICKS ===
    playClickPreview(sampleId, now) {
        this.previewSynth = new Tone.MembraneSynth({
            pitchDecay: 0.01,
            octaves: 4,
            oscillator: { type: 'sine' },
            envelope: {
                attack: 0.001,
                decay: 0.05,
                sustain: 0,
                release: 0.02
            }
        }).toDestination();

        const pitch = sampleId.includes('wood') ? 'G5' :
            sampleId.includes('snap') ? 'C5' :
                sampleId.includes('digital') ? 'A6' : 'E5';

        this.previewSynth.triggerAttackRelease(pitch, '32n', now);
    }

    // === BASS NOTES ===
    playBassPreview(sampleId, now) {
        const is808 = sampleId.includes('808');

        this.previewSynth = new Tone.MonoSynth({
            oscillator: {
                type: is808 ? 'sine' : 'triangle'
            },
            envelope: {
                attack: 0.005,
                decay: is808 ? 0.8 : 0.3,
                sustain: 0.1,
                release: is808 ? 1.2 : 0.5
            },
            filterEnvelope: {
                attack: 0.001,
                decay: 0.2,
                sustain: 0.1,
                release: 0.3,
                baseFrequency: 100,
                octaves: 2
            }
        }).toDestination();

        const pitch = sampleId.includes('sub') ? 'C1' :
            sampleId.includes('punch') ? 'E1' : 'G1';

        this.previewSynth.triggerAttackRelease(pitch, '4n', now);
    }

    // === BEEPS ===
    playBeepPreview(sampleId, now) {
        const isRetro = sampleId.includes('retro');

        this.previewSynth = new Tone.Synth({
            oscillator: {
                type: isRetro ? 'square' : 'sine'
            },
            envelope: {
                attack: 0.01,
                decay: 0.1,
                sustain: 0.3,
                release: 0.1
            }
        }).toDestination();

        const pitch = sampleId.includes('alert') ? 'A5' :
            sampleId.includes('scan') ? 'E6' :
                sampleId.includes('robot') ? ['C5', 'E5'] :
                    sampleId.includes('notification') ? 'G5' : 'C5';

        if (Array.isArray(pitch)) {
            this.previewSynth.triggerAttackRelease(pitch[0], '16n', now);
            this.previewSynth.triggerAttackRelease(pitch[1], '16n', now + 0.1);
        } else {
            this.previewSynth.triggerAttackRelease(pitch, '8n', now);
        }
    }

    // === FX & TEXTURES ===
    playFxPreview(sampleId, now) {
        if (sampleId.includes('impact')) {
            // Low impact hit
            this.previewSynth = new Tone.MembraneSynth({
                pitchDecay: 0.3,
                octaves: 6,
                oscillator: { type: 'sine' },
                envelope: {
                    attack: 0.001,
                    decay: 0.5,
                    sustain: 0,
                    release: 0.5
                }
            }).toDestination();
            this.previewSynth.triggerAttackRelease('C1', '2n', now);
        } else if (sampleId.includes('glitch')) {
            // Glitchy noise burst
            this.previewNoise = new Tone.Noise({ type: 'white', volume: -6 }).toDestination();
            this.previewNoise.start(now);
            this.previewNoise.stop(now + 0.05);
            setTimeout(() => {
                if (this.previewNoise) {
                    this.previewNoise.start(now + 0.1);
                    this.previewNoise.stop(now + 0.12);
                }
            }, 100);
        } else if (sampleId.includes('downlifter')) {
            // Downward sweep
            this.previewFilter = new Tone.Filter({
                frequency: 8000,
                type: 'lowpass'
            }).toDestination();
            this.previewNoise = new Tone.Noise({ type: 'pink', volume: -10 }).connect(this.previewFilter);

            this.previewFilter.frequency.setValueAtTime(8000, now);
            this.previewFilter.frequency.exponentialRampToValueAtTime(100, now + 0.6);

            this.previewNoise.start(now);
            this.previewNoise.stop(now + 0.6);
        } else {
            // Default atmospheric pad
            this.previewSynth = new Tone.Synth({
                oscillator: { type: 'sine' },
                envelope: {
                    attack: 0.3,
                    decay: 0.2,
                    sustain: 0.5,
                    release: 0.8
                }
            }).toDestination();
            this.previewSynth.triggerAttackRelease('C3', '2n', now);
        }
    }

    /**
     * Generate an AudioBuffer for a sample (for adding to playlist)
     * @param {string} sampleId - The sample ID
     * @param {string} packType - The pack type
     * @param {number} durationSeconds - Duration in seconds
     * @returns {Promise<AudioBuffer>}
     */
    async generateSampleBuffer(sampleId, packType, durationSeconds = 2) {
        await this.init();

        // Use Tone.Offline to render the sample to a buffer
        const buffer = await Tone.Offline(({ transport }) => {
            const now = 0;

            switch (packType) {
                case 'risers':
                    this.renderRiser(sampleId, now, durationSeconds);
                    break;
                case 'swooshes':
                    this.renderSwoosh(sampleId, now, durationSeconds);
                    break;
                case 'clicks':
                    this.renderClick(sampleId, now);
                    break;
                case 'bassNotes':
                    this.renderBass(sampleId, now, durationSeconds);
                    break;
                case 'beeps':
                    this.renderBeep(sampleId, now);
                    break;
                case 'fx':
                    this.renderFx(sampleId, now, durationSeconds);
                    break;
                default:
                    this.renderBeep('beep-alert', now);
            }
        }, durationSeconds);

        return buffer;
    }

    // Offline render methods (similar to preview but for buffer generation)
    renderRiser(sampleId, now, duration) {
        const filter = new Tone.Filter({
            frequency: 200,
            type: 'lowpass',
            rolloff: -24
        }).toDestination();

        const noise = new Tone.Noise({
            type: sampleId.includes('white') ? 'white' :
                sampleId.includes('sub') ? 'brown' : 'pink',
            volume: -6
        }).connect(filter);

        filter.frequency.setValueAtTime(200, now);
        filter.frequency.exponentialRampToValueAtTime(12000, now + duration * 0.9);

        const gain = new Tone.Gain(0).connect(filter);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(1, now + duration * 0.8);
        gain.gain.linearRampToValueAtTime(0, now + duration);

        noise.connect(gain);
        noise.start(now);
        noise.stop(now + duration);
    }

    renderSwoosh(sampleId, now, duration) {
        const filter = new Tone.Filter({
            frequency: 8000,
            type: 'bandpass',
            Q: 2
        }).toDestination();

        const noise = new Tone.Noise({
            type: 'white',
            volume: -4
        }).connect(filter);

        filter.frequency.setValueAtTime(8000, now);
        filter.frequency.exponentialRampToValueAtTime(200, now + duration);

        noise.start(now);
        noise.stop(now + duration);
    }

    renderClick(sampleId, now) {
        const synth = new Tone.MembraneSynth({
            pitchDecay: 0.01,
            octaves: 4,
            oscillator: { type: 'sine' },
            envelope: {
                attack: 0.001,
                decay: 0.05,
                sustain: 0,
                release: 0.02
            }
        }).toDestination();

        const pitch = sampleId.includes('wood') ? 'G5' :
            sampleId.includes('snap') ? 'C5' :
                sampleId.includes('digital') ? 'A6' : 'E5';

        synth.triggerAttackRelease(pitch, '32n', now);
    }

    renderBass(sampleId, now, duration) {
        const is808 = sampleId.includes('808');

        const synth = new Tone.MonoSynth({
            oscillator: {
                type: is808 ? 'sine' : 'triangle'
            },
            envelope: {
                attack: 0.005,
                decay: duration * 0.6,
                sustain: 0.1,
                release: duration * 0.4
            },
            filterEnvelope: {
                attack: 0.001,
                decay: 0.2,
                sustain: 0.1,
                release: 0.3,
                baseFrequency: 100,
                octaves: 2
            }
        }).toDestination();

        const pitch = sampleId.includes('sub') ? 'C1' :
            sampleId.includes('punch') ? 'E1' : 'G1';

        synth.triggerAttackRelease(pitch, duration * 0.8, now);
    }

    renderBeep(sampleId, now) {
        const isRetro = sampleId.includes('retro');

        const synth = new Tone.Synth({
            oscillator: {
                type: isRetro ? 'square' : 'sine'
            },
            envelope: {
                attack: 0.01,
                decay: 0.1,
                sustain: 0.3,
                release: 0.1
            }
        }).toDestination();

        const pitch = sampleId.includes('alert') ? 'A5' :
            sampleId.includes('scan') ? 'E6' :
                sampleId.includes('notification') ? 'G5' : 'C5';

        synth.triggerAttackRelease(pitch, '8n', now);
    }

    renderFx(sampleId, now, duration) {
        if (sampleId.includes('impact')) {
            const synth = new Tone.MembraneSynth({
                pitchDecay: 0.3,
                octaves: 6,
                oscillator: { type: 'sine' },
                envelope: {
                    attack: 0.001,
                    decay: duration * 0.5,
                    sustain: 0,
                    release: duration * 0.5
                }
            }).toDestination();
            synth.triggerAttackRelease('C1', duration, now);
        } else if (sampleId.includes('downlifter')) {
            const filter = new Tone.Filter({
                frequency: 8000,
                type: 'lowpass'
            }).toDestination();
            const noise = new Tone.Noise({ type: 'pink', volume: -6 }).connect(filter);

            filter.frequency.setValueAtTime(8000, now);
            filter.frequency.exponentialRampToValueAtTime(100, now + duration);

            noise.start(now);
            noise.stop(now + duration);
        } else {
            const synth = new Tone.Synth({
                oscillator: { type: 'sine' },
                envelope: {
                    attack: 0.3,
                    decay: 0.2,
                    sustain: 0.5,
                    release: 0.8
                }
            }).toDestination();
            synth.triggerAttackRelease('C3', duration * 0.8, now);
        }
    }

    /**
     * Parse duration string to seconds
     * @param {string} durationStr - Duration like "2 bars", "0.5s", "1 beat"
     * @param {number} bpm - Beats per minute
     * @returns {number} Duration in seconds
     */
    parseDuration(durationStr, bpm = 120) {
        const beatsPerSecond = bpm / 60;

        if (durationStr.includes('bar')) {
            const bars = parseFloat(durationStr);
            return (bars * 4) / beatsPerSecond; // 4 beats per bar
        } else if (durationStr.includes('beat')) {
            const beats = parseFloat(durationStr);
            return beats / beatsPerSecond;
        } else if (durationStr.includes('s')) {
            return parseFloat(durationStr);
        } else if (durationStr === 'loop') {
            return 4; // Default loop length
        }
        return 1; // Default 1 second
    }
}

// Export singleton instance
const audioPackSynth = new AudioPackSynth();
export default audioPackSynth;
