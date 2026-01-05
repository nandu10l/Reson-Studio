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

            // Release all active synth notes
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

            // Stop all audio players so they don't ring out (Unsynced players need explicit stop)
            this.audioPlayers.forEach(player => {
                try { player.stop(); } catch (e) { }
            });
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

        // Stop any active audio players (from Song mode)
        this.audioPlayers.forEach(player => {
            try { player.stop(); } catch (e) { }
        });

        // Calculate loop length based on pattern length (in steps)
        // Default to 16 if not defined (1 bar)
        const patternSteps = pattern.length || 16;
        const stepsPerBar = 16;
        const bars = Math.ceil(patternSteps / stepsPerBar);
        const loopLength = `${bars}m`;

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

    schedulePlaylist(tracks, patterns, audioClips = [], startTime = 0) {
        Tone.Transport.cancel(0);
        console.log(`Scheduling Playlist (Song Mode) from ${startTime}s...`);

        Tone.Transport.loop = false;

        // Cleanup: Stop all existing players to prevent overlap/duplication
        this.audioPlayers.forEach(player => {
            try {
                player.stop();
            } catch (e) { }
        });

        const isAnySolo = tracks.some(t => t.solo);

        tracks.forEach(track => {
            if (track.muted) return; // Skip muted tracks
            if (isAnySolo && !track.solo) return; // Skip non-solo tracks if any track is soloed

            track.clips.forEach(clip => {
                // Handle audio clips with Sync
                if (clip.type === 'audio') {
                    const audioClip = audioClips.find(ac => ac.id === clip.audioClipId);
                    if (!audioClip) {
                        console.warn(`Audio clip ${clip.audioClipId} not found`);
                        return;
                    }

                    // Convert offset from beats to time
                    // clipStartTime: when in the playlist it starts
                    const clipStartTime = Tone.Time(`${clip.offset}q`).toSeconds();
                    const clipDuration = Tone.Time(`${clip.length}q`).toSeconds();
                    const clipEndTime = clipStartTime + clipDuration;
                    const startOffset = clip.startOffset ? Tone.Time(`${clip.startOffset}q`).toSeconds() : 0;

                    // Get or create audio player
                    // Key by audioClipId (Source File ID) to reuse the same player instance for multiple slices
                    let player = this.audioPlayers.get(clip.audioClipId);

                    if (!player) {
                        // Create new player using the pre-decoded buffer if available
                        if (audioClip.audioBuffer) {
                            player = new Tone.Player(audioClip.audioBuffer);
                        } else if (audioClip.url) {
                            player = new Tone.Player(audioClip.url);
                        }

                        if (player) {
                            player.volume.value = -6;

                            if (this.masterGain) {
                                player.connect(this.masterGain);
                            } else {
                                player.toDestination();
                            }
                            // Store by Source ID
                            this.audioPlayers.set(clip.audioClipId, player);
                        }
                    }

                    if (player && player.loaded) {
                        try {
                            // Logic for Resume/Seek behavior with unsynced players:

                            // 1. Overlap Check: Are we starting IN THE MIDDLE of this clip?
                            if (startTime >= clipStartTime && startTime < clipEndTime) {
                                // Calculate where in the file we should be
                                const timeSinceStart = startTime - clipStartTime;
                                const currentOffset = startOffset + timeSinceStart;
                                const remainingDuration = clipDuration - timeSinceStart;

                                // Schedule to play immediately at the transport's start time
                                Tone.Transport.scheduleOnce((t) => {
                                    player.start(t, currentOffset, remainingDuration);
                                }, startTime);
                            }

                            // 2. Future Check: Is this clip in the future?
                            if (clipStartTime > startTime) {
                                Tone.Transport.schedule((time) => {
                                    player.start(time, startOffset, clipDuration);
                                }, clipStartTime);
                            }

                        } catch (err) {
                            console.error(`Failed to schedule player for clips ${clip.name}: `, err);
                        }
                    } else if (player) {
                        console.warn(`Player for ${clip.name} not loaded / ready.`);
                    }
                    return;
                }

                // Handle pattern clips
                const pattern = patterns.find(p => p.id === clip.patternId);
                if (!pattern) return;

                // Pattern Offset Support
                // clip.offset: Start position in Playlist (in Beats)
                // clip.length: Duration in Playlist (in Beats)
                // clip.startOffset: Start position within the Pattern (in Beats)

                const clipPlaylistStartStep = (clip.offset || 0) * 4; // Playlist start in 16ths
                const clipInnerStartStep = (clip.startOffset || 0) * 4; // Pattern start offset in 16ths
                const clipLengthSteps = (clip.length || 0) * 4; // Duration in 16ths

                // 1. Schedule Steps (Drums)
                Object.entries(pattern.data.steps).forEach(([channelId, steps]) => {
                    const id = parseInt(channelId);
                    steps.forEach((isActive, index) => {
                        // 'index' is the step position in the pattern (0, 1, 2...)

                        // Check if this step is within the visible slice of the pattern
                        if (isActive && index >= clipInnerStartStep && index < (clipInnerStartStep + clipLengthSteps)) {
                            // Calculate where this step falls in the playlist
                            // (Playlist Start) + (Step Position - Pattern Offset)
                            const relativeStepIndex = index - clipInnerStartStep;
                            const playlistStepIndex = clipPlaylistStartStep + relativeStepIndex;

                            const bar = Math.floor(playlistStepIndex / 16);
                            const beat = Math.floor((playlistStepIndex % 16) / 4);
                            const sixteen = playlistStepIndex % 4;
                            const time = `${bar}:${beat}:${sixteen} `;

                            Tone.Transport.schedule((t) => {
                                this.previewSound(id, t);
                            }, time);
                        }
                    });
                });

                // 2. Schedule Notes (Piano Roll)
                pattern.data.notes.forEach(note => {
                    if (!note.noteName) return;

                    // note.startStep is in 16ths within the pattern

                    // Check intersection: Does the note start within our slice?
                    // (Simplification: We trigger the note if its start is within the slice. 
                    // Handling long notes that started before the slice but sustain into it is harder with basic scheduling, 
                    // effectively "slicing" the note itself requires synth manipulation. 
                    // For now, we only trigger notes that START in the visible region.)

                    if (note.startStep >= clipInnerStartStep && note.startStep < (clipInnerStartStep + clipLengthSteps)) {
                        const relativeStepIndex = note.startStep - clipInnerStartStep;
                        const playlistStepIndex = clipPlaylistStartStep + relativeStepIndex;

                        const bar = Math.floor(playlistStepIndex / 16);
                        const beat = Math.floor((playlistStepIndex % 16) / 4);
                        const sixteen = playlistStepIndex % 4;
                        const time = `${bar}:${beat}:${sixteen} `;

                        // Clamp duration to the end of the clip
                        // This ensures notes don't play past the cut point if the second half is deleted
                        const stepsUntilClipEnd = (clipInnerStartStep + clipLengthSteps) - note.startStep;
                        const durationStep = Math.min(note.length, stepsUntilClipEnd);

                        const dBar = Math.floor(durationStep / 16);
                        const dBeat = Math.floor((durationStep % 16) / 4);
                        const dSixteen = durationStep % 4;
                        const duration = `${dBar}:${dBeat}:${dSixteen} `;

                        Tone.Transport.schedule((t) => {
                            if (note.noteName) {
                                // If note has a channelId, play on that channel
                                if (note.channelId) {
                                    this.previewChannelNote(note.channelId, note.noteName, duration, t);
                                } else {
                                    // Fallback for legacy notes without channelId
                                    if (this.previewSynth) {
                                        this.previewSynth.triggerAttackRelease(note.noteName.replace('#', '#'), duration, t);
                                    }
                                }
                            }
                        }, time);
                    }
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
        } else if (n.includes('piano')) {
            // Grand Piano - Real Samples (Salamander)
            source = new Tone.Sampler({
                urls: {
                    "A0": "A0.mp3",
                    "C1": "C1.mp3",
                    "D#1": "Ds1.mp3",
                    "F#1": "Fs1.mp3",
                    "A1": "A1.mp3",
                    "C2": "C2.mp3",
                    "D#2": "Ds2.mp3",
                    "F#2": "Fs2.mp3",
                    "A2": "A2.mp3",
                    "C3": "C3.mp3",
                    "D#3": "Ds3.mp3",
                    "F#3": "Fs3.mp3",
                    "A3": "A3.mp3",
                    "C4": "C4.mp3",
                    "D#4": "Ds4.mp3",
                    "F#4": "Fs4.mp3",
                    "A4": "A4.mp3",
                    "C5": "C5.mp3",
                    "D#5": "Ds5.mp3",
                    "F#5": "Fs5.mp3",
                    "A5": "A5.mp3",
                    "C6": "C6.mp3",
                    "D#6": "Ds6.mp3",
                    "F#6": "Fs6.mp3",
                    "A6": "A6.mp3",
                    "C7": "C7.mp3",
                    "D#7": "Ds7.mp3",
                    "F#7": "Fs7.mp3",
                    "A7": "A7.mp3",
                    "C8": "C8.mp3"
                },
                release: 1,
                baseUrl: "https://tonejs.github.io/audio/salamander/",
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

    previewNote(noteName, duration = "8n", time) {
        if (this.previewSynth && noteName) {
            this.previewSynth.triggerAttackRelease(noteName, duration, time || Tone.now());
        }
    }

    previewChannelNote(channelId, noteName, duration = "8n", time) {
        const source = this.sources.get(channelId);
        if (source) {
            if (source instanceof Tone.NoiseSynth) {
                // Noise synths don't use pitch
                source.triggerAttackRelease(duration, time || Tone.now());
            } else {
                source.triggerAttackRelease(noteName, duration, time || Tone.now());
            }
        }
    }
}

export const audioEngine = new AudioEngine();
