import * as Tone from 'tone';

class AudioEngine {
    constructor() {
        this.channels = new Map(); // id -> Tone.Channel
        this.sources = new Map(); // id -> Tone.Player or Tone.Synth
        this.audioPlayers = new Map(); // audioClipId -> Tone.Player
        this.isInitialized = false;
        this.previewSynth = null; // Dedicated synth for Piano Roll
        this.masterAnalyser = null; // Analyser for visualization
        this.masterGain = null; // Master gain node
    }

    async init() {
        if (this.isInitialized) return;
        await Tone.start();
        console.log('Audio Engine Started');

        // Setup Transport
        Tone.Transport.bpm.value = 120;

        // Setup Master Gain and Analyser for visualization
        // Create a master gain node that all audio routes through
        this.masterGain = new Tone.Gain(1);

        // Create analyser for visualization with larger FFT size for better resolution
        this.masterAnalyser = new Tone.Analyser('fft', 512);

        // Store direct reference to underlying Web Audio API AnalyserNode
        // Tone.js Analyser wraps a Web Audio API AnalyserNode
        // Access it after connection is established
        this.masterAnalyserNode = null;

        // Connect master gain to analyser and destination
        this.masterGain.connect(this.masterAnalyser);
        this.masterAnalyser.toDestination();

        // Get the underlying Web Audio API node after connection
        // Try multiple ways to access it
        if (this.masterAnalyser._analyser) {
            this.masterAnalyserNode = this.masterAnalyser._analyser;
        } else if (this.masterAnalyser.input && this.masterAnalyser.input._analyser) {
            this.masterAnalyserNode = this.masterAnalyser.input._analyser;
        } else {
            // Fallback: access via context
            const context = this.masterAnalyser.context;
            if (context && context.rawContext) {
                // The analyser node should be accessible through the internal structure
                // Try to find it in the node graph
                const internalNode = this.masterAnalyser.input || this.masterAnalyser;
                if (internalNode && internalNode._analyser) {
                    this.masterAnalyserNode = internalNode._analyser;
                }
            }
        }

        // Set analyser properties for better visualization
        if (this.masterAnalyserNode) {
            this.masterAnalyserNode.fftSize = 512;
            this.masterAnalyserNode.smoothingTimeConstant = 0.3;
        }

        // Setup Preview Synth - connect to master gain instead of destination
        this.previewSynth = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: "triangle" },
            envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 1 }
        }).connect(this.masterGain);
        this.previewSynth.volume.value = -10;

        this.isInitialized = true;
    }

    // Get analyser node for visualization
    getAnalyser() {
        return this.masterAnalyser;
    }

    // Get underlying Web Audio API AnalyserNode for direct access
    getAnalyserNode() {
        // Return the stored reference if available
        if (this.masterAnalyserNode) {
            return this.masterAnalyserNode;
        }

        // Fallback: try to access it dynamically
        if (this.masterAnalyser) {
            if (this.masterAnalyser._analyser) {
                return this.masterAnalyser._analyser;
            }
            if (this.masterAnalyser.input && this.masterAnalyser.input._analyser) {
                return this.masterAnalyser.input._analyser;
            }
        }
        return null;
    }

    // Get master gain node (for channels to connect to)
    getMasterGain() {
        return this.masterGain;
    }

    // --- Transport Controls ---
    start() {
        // Check if transport is paused, and resume if so
        if (Tone.Transport.state === 'paused') {
            Tone.Transport.start(); // Resume from paused state
        } else if (Tone.Transport.state !== 'started') {
            Tone.Transport.start(); // Start from stopped state
        }
    }

    pause() {
        // Only pause if currently playing
        if (Tone.Transport.state === 'started') {
            // Pause Transport - this pauses scheduled events and synced players
            Tone.Transport.pause();

            // Release all active synth notes (these should stop immediately as they aren't fully synced in the same way)
            this.sources.forEach((source) => {
                try {
                    if (source && typeof source.releaseAll === 'function') {
                        source.releaseAll();
                    }
                } catch (error) {
                    console.warn('Error releasing synth source:', error);
                }
            });

            // Release preview synth notes
            if (this.previewSynth) {
                try {
                    if (typeof this.previewSynth.releaseAll === 'function') {
                        this.previewSynth.releaseAll();
                    }
                } catch (error) {
                    console.warn('Error releasing preview synth:', error);
                }
            }
        }
    }

    stop() {
        // Stop Transport
        Tone.Transport.stop();

        // Unsync and stop all audio players to ensure they reset
        this.audioPlayers.forEach(player => {
            try {
                if (player) {
                    player.unsync();
                    player.stop();
                }
            } catch (e) {
                console.warn("Error stopping player:", e);
            }
        });
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

        // Get current position in the pattern loop
        const currentTime = Tone.Transport.seconds;
        const loopLengthSeconds = Tone.Time(loopLength).toSeconds();
        const positionInLoop = currentTime % loopLengthSeconds;

        // Schedule Drums (Steps)
        Object.entries(pattern.data.steps).forEach(([channelId, steps]) => {
            const id = parseInt(channelId);
            steps.forEach((isActive, index) => {
                if (isActive) {
                    const stepTime = Tone.Time(`0:0:${index}`).toSeconds();
                    const stepTimeInLoop = stepTime % loopLengthSeconds;

                    // Schedule if step hasn't passed in current loop iteration
                    if (stepTimeInLoop >= positionInLoop) {
                        const time = `0:0:${index}`; // bars:quarters:sixteenths
                        Tone.Transport.schedule((t) => {
                            this.previewSound(id, t);
                        }, time);
                    }
                }
            });
        });

        // Schedule Melody (Piano Roll)
        pattern.data.notes.forEach(note => {
            // note: { id, noteName: "C5", startStep, length }
            // Skip notes with invalid noteName
            if (!note.noteName) return;

            const noteStartTime = Tone.Time(`0:0:${note.startStep}`).toSeconds();
            const noteStartInLoop = noteStartTime % loopLengthSeconds;
            const duration = `0:0:${note.length}`;

            // Schedule if note hasn't passed in current loop iteration
            if (noteStartInLoop >= positionInLoop) {
                const time = `0:0:${note.startStep}`;

                Tone.Transport.schedule((t) => {
                    // Use dedicated poly synth
                    if (this.previewSynth && note.noteName) {
                        this.previewSynth.triggerAttackRelease(note.noteName.replace('#', '#'), duration, t);
                    }
                }, time);
            }
        });

        console.log('Scheduled pattern:', pattern.id);
    }

    schedulePlaylist(tracks, patterns, audioClips = []) {
        Tone.Transport.cancel();
        console.log("Scheduling Playlist (Song Mode) with Sync...");

        Tone.Transport.loop = false;

        // Cleanup: Unsync all existing players before rescheduling
        this.audioPlayers.forEach(player => {
            try {
                player.unsync();
                player.stop();
            } catch (e) { }
        });

        tracks.forEach(track => {
            track.clips.forEach(clip => {
                // Handle audio clips with Sync
                if (clip.type === 'audio') {
                    const audioClip = audioClips.find(ac => ac.id === clip.audioClipId);
                    if (!audioClip) {
                        console.warn(`Audio clip ${clip.audioClipId} not found`);
                        return;
                    }

                    // Convert offset from beats to time
                    const clipStartTime = Tone.Time(`${clip.offset}q`).toSeconds();
                    const clipDuration = Tone.Time(`${clip.length}q`).toSeconds();

                    // Get or create audio player
                    let player = this.audioPlayers.get(clip.audioClipId);
                    if (!player && audioClip.url) {
                        player = new Tone.Player({
                            url: audioClip.url,
                            volume: -6
                        });
                        // Connect to master gain if available, otherwise to destination
                        if (this.masterGain) {
                            player.connect(this.masterGain);
                        } else {
                            player.toDestination();
                        }
                        this.audioPlayers.set(clip.audioClipId, player);
                    }

                    if (player && player.loaded) {
                        try {
                            // Sync the player to the Transport
                            // start(startTime, offset, duration)
                            // startTime: When in the Transport timeline to start playing
                            // offset: Where in the audio file to start (0 for beginning)
                            // duration: How long to play
                            player.sync().start(clipStartTime, 0, clipDuration);
                            console.log(`Synced Clip ${clip.name} at ${clipStartTime}s, Dur: ${clipDuration}s`);
                        } catch (err) {
                            console.error(`Failed to sync player for clip ${clip.name}:`, err);
                        }
                    } else if (player) {
                        // If not loaded yet, wait for load? optimize later.
                        console.warn(`Player for ${clip.name} not loaded/ready.`);
                    }
                    return;
                }

                // Handle pattern clips (existing code)
                const pattern = patterns.find(p => p.id === clip.patternId);
                if (!pattern) return;

                // clip.offset is in BEATS (quarters). Convert to STEPS (sixteenths).
                const clipStartStep = (clip.offset || 0) * 4;

                // 1. Schedule Steps (Drums)
                Object.entries(pattern.data.steps).forEach(([channelId, steps]) => {
                    const id = parseInt(channelId);
                    steps.forEach((isActive, index) => {
                        if (isActive && index < pattern.length) { // Respect pattern length
                            const absStep = clipStartStep + index;
                            const bar = Math.floor(absStep / 16);
                            const beat = Math.floor((absStep % 16) / 4);
                            const sixteen = absStep % 4;
                            const time = `${bar}:${beat}:${sixteen}`;

                            Tone.Transport.schedule((t) => {
                                this.previewSound(id, t);
                            }, time);
                        }
                    });
                });

                // 2. Schedule Notes (Piano Roll)
                pattern.data.notes.forEach(note => {
                    if (!note.noteName) return;

                    const absStep = clipStartStep + note.startStep;
                    const bar = Math.floor(absStep / 16);
                    const beat = Math.floor((absStep % 16) / 4);
                    const sixteen = absStep % 4;
                    const time = `${bar}:${beat}:${sixteen}`;

                    const durationStep = note.length;
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
        });

        // Connect to master gain instead of destination directly
        if (this.masterGain) {
            channel.connect(this.masterGain);
        } else {
            channel.toDestination(); // Fallback if master gain not initialized
        }

        this.channels.set(id, channel);

        let source;
        const n = name.toLowerCase();

        // Basic Synthesis logic based on name
        // Wrap everything in PolySynth to handle overlapping hits (Song Mode concurrency)
        if (n.includes('kick')) {
            source = new Tone.PolySynth(Tone.MembraneSynth).connect(channel);
        } else if (n.includes('snare') || n.includes('clap')) {
            source = new Tone.NoiseSynth({
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

    previewSound(id, time) {
        const source = this.sources.get(id);
        if (source) {
            // Check if source is NoiseSynth (Monophonic but triggered differently)
            if (source instanceof Tone.NoiseSynth) {
                source.triggerAttackRelease("8n", time);
            } else {
                // PolySynth or other instruments expecting a note
                source.triggerAttackRelease("C2", "8n", time);
            }
        }
    }
}

export const audioEngine = new AudioEngine();
