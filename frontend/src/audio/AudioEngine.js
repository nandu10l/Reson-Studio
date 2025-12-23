import * as Tone from 'tone';

class AudioEngine {
    constructor() {
        this.channels = new Map(); // id -> Tone.Channel
        this.sources = new Map(); // id -> Tone.Player or Tone.Synth
        this.isInitialized = false;
    }

    async init() {
        if (this.isInitialized) return;
        await Tone.start();
        console.log('Audio Engine Started');
        this.isInitialized = true;
    }

    // Create a channel strip (Volume + Pan)
    createChannel(id, name = '') {
        if (this.channels.has(id)) return this.channels.get(id);

        const channel = new Tone.Channel({
            volume: -6, // Default -6dB
            pan: 0,
        }).toDestination();

        this.channels.set(id, channel);

        let source;
        const n = name.toLowerCase();

        // Basic Synthesis logic based on name
        if (n.includes('kick')) {
            source = new Tone.MembraneSynth().connect(channel);
        } else if (n.includes('snare') || n.includes('clap')) {
            source = new Tone.NoiseSynth({
                noise: { type: 'white' },
                envelope: { attack: 0.001, decay: 0.2, sustain: 0 }
            }).connect(channel);
        } else if (n.includes('hat') || n.includes('cymbal')) {
            source = new Tone.MetalSynth({
                frequency: 200, isEnvelope: true, harmonicity: 5.1, modulationIndex: 32,
                envelope: { attack: 0.001, decay: 0.1, release: 0.01 },
                volume: -10
            }).connect(channel);
        } else if (n.includes('bass')) {
            source = new Tone.MonoSynth({
                oscillator: { type: "square" },
                envelope: { attack: 0.1 }
            }).connect(channel);
        } else {
            // Default Synth
            source = new Tone.PolySynth().connect(channel);
        }

        this.sources.set(id, source);
        return channel;
    }

    updateChannelVolume(id, volume0to100) {
        const channel = this.channels.get(id);
        if (channel) {
            // Map 0-100 to -60dB to +6dB (approx)
            // 80 is nominal (0dB logic in our UI, but let's say 0 is mute)
            // Simple mapping: Volume in dB = 20 * log10(amplitude)
            // Let's use Tone's gain conversion or just simple logic
            // If vol is 0, mute
            if (volume0to100 === 0) {
                channel.mute = true;
            } else {
                channel.mute = false;
                // aggressive curve
                const db = Tone.gainToDb(volume0to100 / 100 * 1.2);
                channel.volume.rampTo(db, 0.1);
            }
        }
    }

    updateChannelPan(id, panMinus50to50) {
        const channel = this.channels.get(id);
        if (channel) {
            // Map -50..50 to -1..1
            const panVal = panMinus50to50 / 50;
            channel.pan.rampTo(panVal, 0.1);
        }
    }

    previewSound(id) {
        const source = this.sources.get(id);
        if (source) {
            // NoiseSynth does not accept a pitch argument
            if (source.name === 'NoiseSynth') {
                source.triggerAttackRelease("8n");
            } else {
                // Play a test note for melodic/tuned instruments
                source.triggerAttackRelease("C2", "8n");
            }
        }
    }
}

export const audioEngine = new AudioEngine();
