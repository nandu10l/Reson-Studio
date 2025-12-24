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

        // Setup Transport
        Tone.Transport.bpm.value = 120;
        this.isInitialized = true;
    }

    // --- Transport Controls ---
    start() {
        if (Tone.Transport.state !== 'started') {
            Tone.Transport.start();
        }
    }

    pause() {
        Tone.Transport.pause();
    }

    stop() {
        Tone.Transport.stop();
    }

    setBpm(bpm) {
        Tone.Transport.bpm.value = bpm;
    }

    // --- Scheduler ---
    schedulePattern(pattern) {
        // Clear previous schedule
        Tone.Transport.cancel();

        const loopLength = "1m"; // Assuming 16 steps = 1 measure
        Tone.Transport.loop = true;
        Tone.Transport.loopEnd = loopLength;

        // Schedule Drums (Steps)
        Object.entries(pattern.data.steps).forEach(([channelId, steps]) => {
            const id = parseInt(channelId);
            steps.forEach((isActive, index) => {
                if (isActive) {
                    const time = `0:0:${index}`; // bars:quarters:sixteenths
                    Tone.Transport.schedule((t) => {
                        this.previewSound(id);
                    }, time);
                }
            });
        });

        // Schedule Melody (Piano Roll)
        pattern.data.notes.forEach(note => {
            // note: { id, noteName: "C5", startStep, length }
            const time = `0:0:${note.startStep}`;
            const duration = `0:0:${note.length}`;

            // Map "C5" to "C5" (direct) or parse if needed
            // Our piano roll uses "C5", "F#4" etc which Tone.js understands

            // Need a melodic source. For now, we don't have per-track instruments in Piano Roll
            // We'll use a default PolySynth for preview, or map to a specific channel if we add that metadata

            Tone.Transport.schedule((t) => {
                // Use a default synth for now
                const synth = this.sources.get(5) || this.sources.get(1); // Fallback
                if (synth && synth.triggerAttackRelease) {
                    synth.triggerAttackRelease(note.noteName.replace('#', '#'), duration, t);
                }
            }, time);
        });

        console.log('Scheduled pattern:', pattern.id);
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
            if (source.name === 'NoiseSynth') {
                source.triggerAttackRelease("8n");
            } else {
                source.triggerAttackRelease("C2", "8n");
            }
        }
    }
}

export const audioEngine = new AudioEngine();
