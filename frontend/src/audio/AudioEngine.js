import * as Tone from 'tone';

class AudioEngine {
    constructor() {
        this.channels = new Map(); // id -> Tone.Channel
        this.sources = new Map(); // id -> Tone.Player or Tone.Synth
        this.audioPlayers = new Map(); // audioClipId -> Tone.Player
        this.isInitialized = false;
        this.previewSynth = null; // Dedicated synth for Piano Roll
    }

    async init() {
        if (this.isInitialized) return;
        await Tone.start();
        console.log('Audio Engine Started');

        // Setup Transport
        Tone.Transport.bpm.value = 120;

        // Setup Preview Synth
        this.previewSynth = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: "triangle" },
            envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 1 }
        }).toDestination();
        this.previewSynth.volume.value = -10;

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
            // Skip notes with invalid noteName
            if (!note.noteName) return;
            
            const time = `0:0:${note.startStep}`;
            const duration = `0:0:${note.length}`;

            // Map "C5" to "C5" (direct) or parse if needed
            // Our piano roll uses "C5", "F#4" etc which Tone.js understands

            // Need a melodic source. For now, we don't have per-track instruments in Piano Roll
            // We'll use a default PolySynth for preview, or map to a specific channel if we add that metadata

            Tone.Transport.schedule((t) => {
                // Use dedicated poly synth
                if (this.previewSynth && note.noteName) {
                    this.previewSynth.triggerAttackRelease(note.noteName.replace('#', '#'), duration, t);
                }
            }, time);
        });

        console.log('Scheduled pattern:', pattern.id);
    }

    schedulePlaylist(tracks, patterns, audioClips = []) {
        Tone.Transport.cancel();
        console.log("Scheduling Playlist (Song Mode)...");

        Tone.Transport.loop = false; // Song mode typically doesn't loop the whole arrangement by default in this MVP

        tracks.forEach(track => {
            track.clips.forEach(clip => {
                // Handle audio clips
                if (clip.type === 'audio') {
                    const audioClip = audioClips.find(ac => ac.id === clip.audioClipId);
                    if (!audioClip) {
                        console.warn(`Audio clip ${clip.audioClipId} not found`);
                        return;
                    }

                    // Convert offset from beats to time
                    const startTime = Tone.Time(`${clip.offset}q`).toSeconds();
                    const duration = Tone.Time(`${clip.length}q`).toSeconds();

                    // Get or create audio player
                    let player = this.audioPlayers.get(clip.audioClipId);
                    if (!player && audioClip.url) {
                        player = new Tone.Player({
                            url: audioClip.url,
                            volume: -6
                        }).toDestination();
                        this.audioPlayers.set(clip.audioClipId, player);
                    }

                    if (player) {
                        // Schedule audio playback
                        Tone.Transport.schedule((t) => {
                            player.start(t, 0, duration);
                        }, startTime);
                    }
                    return;
                }

                // Handle pattern clips (existing code)
                const pattern = patterns.find(p => p.id === clip.patternId);
                if (!pattern) {
                    console.warn(`Pattern ${clip.patternId} not found for clip`);
                    return;
                }

                // clip.offset is in BEATS (quarters). Convert to STEPS (sixteenths).
                // Assuming 4 steps per beat.
                const clipStartStep = (clip.offset || 0) * 4;
                console.log(`Scheduling clip Pattern ${pattern.id} at step ${clipStartStep}`);

                // 1. Schedule Steps (Drums)
                Object.entries(pattern.data.steps).forEach(([channelId, steps]) => {
                    const id = parseInt(channelId);
                    steps.forEach((isActive, index) => {
                        if (isActive && index < pattern.length) { // Respect pattern length
                            // Calculate absolute step
                            const absStep = clipStartStep + index;
                            // Convert to Bars:Beats:Sixteenths
                            // Assuming 16 steps per bar
                            const bar = Math.floor(absStep / 16);
                            const beat = Math.floor((absStep % 16) / 4);
                            const sixteen = absStep % 4;
                            const time = `${bar}:${beat}:${sixteen}`;

                            Tone.Transport.schedule((t) => {
                                this.previewSound(id);
                            }, time);
                        }
                    });
                });

                // 2. Schedule Notes (Piano Roll)
                pattern.data.notes.forEach(note => {
                    // Skip notes with invalid noteName
                    if (!note.noteName) return;
                    
                    const absStep = clipStartStep + note.startStep;
                    const bar = Math.floor(absStep / 16);
                    const beat = Math.floor((absStep % 16) / 4);
                    const sixteen = absStep % 4;
                    const time = `${bar}:${beat}:${sixteen}`;

                    const durationStep = note.length;
                    // Duration in notation (e.g. 0:0:2 for 2 steps)
                    const dBar = Math.floor(durationStep / 16);
                    const dBeat = Math.floor((durationStep % 16) / 4);
                    const dSixteen = durationStep % 4;
                    const duration = `${dBar}:${dBeat}:${dSixteen}`;

                    Tone.Transport.schedule((t) => {
                        if (this.previewSynth && note.noteName) {
                            this.previewSynth.triggerAttackRelease(note.noteName.replace('#', '#'), duration, t);
                        }
                    }, time);
                });
            });
        });
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
        // Wrap everything in PolySynth to handle overlapping hits (Song Mode concurrency)
        if (n.includes('kick')) {
            source = new Tone.PolySynth(Tone.MembraneSynth).connect(channel);
        } else if (n.includes('snare') || n.includes('clap')) {
            source = new Tone.PolySynth(Tone.NoiseSynth, {
                noise: { type: 'white' },
                envelope: { attack: 0.001, decay: 0.2, sustain: 0 }
            }).connect(channel);
        } else if (n.includes('hat') || n.includes('cymbal')) {
            source = new Tone.PolySynth(Tone.MetalSynth, {
                frequency: 200, harmonicity: 5.1, modulationIndex: 32,
                envelope: { attack: 0.001, decay: 0.1, release: 0.01 },
                volume: -10
            }).connect(channel);
        } else if (n.includes('bass')) {
            source = new Tone.PolySynth(Tone.MonoSynth, {
                oscillator: { type: "square" },
                envelope: { attack: 0.1 }
            }).connect(channel);
        } else {
            // Default Synth
            source = new Tone.PolySynth(Tone.Synth).connect(channel);
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

    updateChannelPan(id, pan0to100) {
        const channel = this.channels.get(id);
        if (channel) {
            // Map 0-100 (where 50 is center) to -1..1
            // 0 -> -1, 50 -> 0, 100 -> 1
            const panVal = (pan0to100 - 50) / 50;
            // Clamp to valid range [-1, 1]
            const clampedPan = Math.max(-1, Math.min(1, panVal));
            channel.pan.rampTo(clampedPan, 0.1);
        }
    }

    previewSound(id) {
        const source = this.sources.get(id);
        if (source) {
            // PolySynth always expects a note, even for Noise (it just ignores it)
            // We use C2 as default trigger
            source.triggerAttackRelease("C2", "8n");
        }
    }
}

export const audioEngine = new AudioEngine();
