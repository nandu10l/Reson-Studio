import * as Tone from 'tone';
import { loadInstrument } from './SampleLibrary';

class AudioEngine {
    constructor() {
        this.channels = new Map(); // id -> Tone.Channel
        this.sources = new Map(); // id -> Tone.Player or Tone.Synth
        this.channelNames = new Map(); // id -> channel name string (for instrument-aware behaviour)
        this.audioPlayers = new Map(); // audioClipId -> Tone.Player
        this.channelEffects = new Map(); // channelId -> [effectNode, ...] (10 slots)
        this.channelMeters = new Map(); // id -> Tone.Meter for level monitoring
        this.masterMeter = null; // Master channel meter
        this.isInitialized = false;
        this.previewSynth = null; // Dedicated synth for Piano Roll
        this.masterAnalyser = null; // Analyser for visualization
        this.masterGain = null; // Master gain node
        this.currentBpm = 120; // Track current BPM
    }

    async init() {
        if (this.isInitialized) return;
        await Tone.start();
        console.log('Audio Engine Started');

        // Setup Transport - use stored BPM value (not hardcoded)
        Tone.Transport.bpm.value = this.currentBpm;
        console.log('BPM set to:', this.currentBpm);

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
            maxPolyphony: 128,
            oscillator: { type: "triangle" },
            envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 1 }
        }).connect(this.masterGain);
        this.previewSynth.volume.value = -10;

        // Create master meter for level monitoring
        this.masterMeter = new Tone.Meter({ smoothing: 0.8 });
        this.masterGain.connect(this.masterMeter);

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

    /**
     * Get the current audio level for a specific channel
     * Returns a value between 0 and 1, where 0 is silence
     * @param {string|number} channelId - The channel ID
     * @returns {number} Normalized level (0-1)
     */
    getChannelLevel(channelId) {
        const meter = this.channelMeters.get(channelId);
        if (!meter) return 0;

        try {
            const dbValue = meter.getValue();
            // Convert dB to linear (0-1 range)
            // -Infinity (silence) -> 0, 0dB -> 1
            if (dbValue === -Infinity || dbValue < -60) return 0;
            // Normalize: -60dB to 0dB mapped to 0 to 1
            const normalized = Math.max(0, Math.min(1, (dbValue + 60) / 60));
            return normalized;
        } catch (e) {
            return 0;
        }
    }

    /**
     * Get the current master output level
     * Returns a value between 0 and 1
     */
    getMasterLevel() {
        if (!this.masterMeter) return 0;

        try {
            const dbValue = this.masterMeter.getValue();
            if (dbValue === -Infinity || dbValue < -60) return 0;
            const normalized = Math.max(0, Math.min(1, (dbValue + 60) / 60));
            return normalized;
        } catch (e) {
            return 0;
        }
    }

    /**
     * Check if the audio transport is currently playing
     */
    isPlaying() {
        return Tone.Transport.state === 'started';
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
        this.currentBpm = bpm;
        Tone.Transport.bpm.value = bpm;
        console.log('BPM updated to:', bpm);
    }

    getBpm() {
        return this.currentBpm;
    }

    /**
     * Convert beats (quarter notes) to seconds using the current BPM.
     * IMPORTANT: Do NOT use Tone.Time(`${beats}q`) — the 'q' suffix is not
     * a valid Tone.js notation and falls back to parseFloat, treating the
     * value as raw seconds instead of beat-relative time.
     */
    _beatsToSeconds(beats) {
        return beats * (60 / this.currentBpm);
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
                    // Use dedicated poly synth or channel instrument
                    // Apply velocity (0-127) as gain multiplier (0-1)
                    const velocity = note.velocity !== undefined ? note.velocity / 127 : 0.78;

                    if (note.channelId !== undefined && note.channelId !== null) {
                        this.previewChannelNote(note.channelId, note.noteName, duration, t, velocity);
                    } else if (this.previewSynth && note.noteName) {
                        this.previewSynth.triggerAttackRelease(note.noteName.replace('#', '#'), duration, t, velocity);
                    }
                }, time);
            }
        });

        console.log('Scheduled pattern:', pattern.id);
    }

    schedulePlaylist(tracks, patterns, audioClips = [], automations = [], startTime = 0) {
        Tone.Transport.cancel(0);
        console.log(`Scheduling Playlist (Song Mode) from ${startTime}s...`);

        Tone.Transport.loop = false;

        // Cleanup: Dispose and clear all existing players to prevent overlap/duplication
        this.audioPlayers.forEach(player => {
            try {
                player.stop();
                player.dispose();
            } catch (e) { }
        });
        this.audioPlayers.clear();

        const isAnySolo = tracks.some(t => t.solo);
        const automationClipsToSchedule = [];
        const instanceToSourceMap = new Map();

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

                    // Register mapping (Instance ID -> Source ID)
                    instanceToSourceMap.set(clip.id, clip.audioClipId);

                    // Convert offset from beats to time using BPM-aware conversion
                    // clipStartTime: when in the playlist it starts (seconds)
                    const clipStartTime = this._beatsToSeconds(clip.offset);
                    const clipDuration = this._beatsToSeconds(clip.length);
                    const clipEndTime = clipStartTime + clipDuration;
                    const startOffset = clip.startOffset ? this._beatsToSeconds(clip.startOffset) : 0;

                    // Create a NEW player for each clip instance to avoid start time conflicts
                    // Use clip.id (instance ID) as the key, not audioClipId (source ID)
                    let player = null;

                    // Create new player using the pre-decoded buffer if available
                    if (audioClip.audioBuffer) {
                        player = new Tone.Player(audioClip.audioBuffer);
                    } else if (audioClip.url) {
                        player = new Tone.Player(audioClip.url);
                    }

                    if (player) {
                        // Tag player with source audio clip ID for volume/pan updates
                        player._audioClipId = audioClip.id;

                        // Apply stored or default volume/pan settings
                        const clipSettings = this.getAudioClipSettings(audioClip.id);
                        const clipVol = audioClip.vol !== undefined ? audioClip.vol : clipSettings.vol;
                        const clipPan = audioClip.pan !== undefined ? audioClip.pan : clipSettings.pan;

                        if (clipVol === 0) {
                            player.mute = true;
                        } else {
                            const db = Tone.gainToDb(clipVol / 100 * 1.2);
                            player.volume.value = db;
                        }

                        // Create a panner for this player to support pan
                        const panVal = (clipPan - 50) / 50;
                        const panner = new Tone.Panner(Math.max(-1, Math.min(1, panVal)));

                        if (this.masterGain) {
                            player.connect(panner);
                            panner.connect(this.masterGain);
                        } else {
                            player.connect(panner);
                            panner.toDestination();
                        }
                        // Store by Instance ID (clip.id) for unique player per clip placement
                        this.audioPlayers.set(clip.id, player);
                    }

                    if (player && player.loaded) {
                        try {
                            // FL Studio-style scheduling: clips play when playhead reaches them
                            // 1. Overlap Check: Are we starting IN THE MIDDLE of this clip?
                            if (startTime >= clipStartTime && startTime < clipEndTime) {
                                // Calculate where in the audio file we should be
                                const timeSinceStart = startTime - clipStartTime;
                                const currentOffset = startOffset + timeSinceStart;
                                const remainingDuration = Math.max(0, clipDuration - timeSinceStart);

                                if (remainingDuration > 0) {
                                    // Use a small look-ahead to schedule reliably at transport start
                                    Tone.Transport.schedule((t) => {
                                        try {
                                            player.start(t, currentOffset, remainingDuration);
                                        } catch (e) {
                                            console.warn('Player start error (overlap):', e.message);
                                        }
                                    }, startTime);
                                }
                            }
                            // 2. Future Check: Is this clip ahead of the playhead?
                            else if (clipStartTime >= startTime) {
                                Tone.Transport.schedule((time) => {
                                    try {
                                        player.start(time, startOffset, clipDuration);
                                    } catch (e) {
                                        console.warn('Player start error (future):', e.message);
                                    }
                                }, clipStartTime);
                            }

                        } catch (err) {
                            console.error(`Failed to schedule player for clip ${clip.name}: `, err);
                        }
                    } else if (player) {
                        // Player not loaded yet (URL-based) — schedule once loaded
                        console.warn(`Player for ${clip.name} not loaded yet, waiting...`);
                        const capturedClip = { ...clip };
                        player.buffer.onload = () => {
                            try {
                                if (clipStartTime >= startTime) {
                                    Tone.Transport.schedule((time) => {
                                        try {
                                            player.start(time, startOffset, clipDuration);
                                        } catch (e) { }
                                    }, clipStartTime);
                                }
                            } catch (err) {
                                console.warn('Late-load scheduling failed:', err);
                            }
                        };
                    }
                    return;
                }

                if (clip.type === 'automation') {
                    // Defer automation scheduling until all audio players are initialized
                    automationClipsToSchedule.push(clip);
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
                                if (note.channelId !== undefined && note.channelId !== null) {
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

        // Pass 2: Schedule Automation (now that all Players are initialized)
        automationClipsToSchedule.forEach(clip => {
            const automation = automations.find(a => a.id === clip.automationId);
            if (automation && automation.points) {
                // Resolve Target Player ID
                // Players are now keyed by clip instance ID (clip.id), not source ID
                // Try to find the player using the targetClipId which should be an instance ID
                let player = this.audioPlayers.get(automation.targetClipId);

                // Fallback: search through instanceToSourceMap for matching source
                if (!player) {
                    for (const [instanceId, sourceId] of instanceToSourceMap.entries()) {
                        if (sourceId === automation.targetClipId) {
                            player = this.audioPlayers.get(instanceId);
                            if (player) break;
                        }
                    }
                }

                if (player) {
                    const clipStartTime = this._beatsToSeconds(clip.offset);
                    const clipDuration = this._beatsToSeconds(clip.length);

                    const points = [...automation.points].sort((a, b) => a.x - b.x);

                    // Filter points within clip range if needed? No, points are relative 0-1.

                    points.forEach((p, idx) => {
                        const pointTime = clipStartTime + (p.x * clipDuration);
                        const gain = Math.max(0.001, p.y);
                        const db = Tone.gainToDb(gain);

                        // Only schedule if point is in future relative to Transport start? 
                        // Tone.js handles scheduling in past (it executes immediately).
                        // But rampTo in past throws?
                        // We are scheduling on the PARAMETER, using transport time.

                        if (idx === 0) {
                            player.volume.setValueAtTime(db, pointTime);
                        } else {
                            player.volume.linearRampToValueAtTime(db, pointTime);
                        }
                    });
                } else {
                    console.warn(`Target Player for Automation ${automation.name} not found. TargetID: ${automation.targetClipId}`);
                }
            }
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

        // Create meter for this channel to monitor audio levels
        const meter = new Tone.Meter({ smoothing: 0.8 });
        channel.connect(meter);
        this.channelMeters.set(id, meter);

        this.channels.set(id, channel);

        let source;
        const n = name.toLowerCase();

        // ── Helper: load a CDN sampler with an immediate synth fallback ──
        // The fallback plays instantly; once CDN samples load we swap to the real thing.
        const loadSampledInstrument = (instrumentKey, fallbackSynth) => {
            let loaded = false;
            fallbackSynth.connect(channel);
            source = fallbackSynth;

            const sampler = loadInstrument(instrumentKey, {
                onload: () => {
                    loaded = true;
                    console.log(`${instrumentKey} (ch ${id}): CDN samples loaded!`);
                    try { fallbackSynth.disconnect(channel); } catch (_) { }
                    sampler.connect(channel);
                    this.sources.set(id, sampler);
                },
                onerror: (err) => {
                    console.warn(`${instrumentKey} CDN failed, using synth fallback:`, err);
                }
            });
            setTimeout(() => {
                if (!loaded) console.warn(`${instrumentKey} CDN timeout — using synth fallback for ch ${id}`);
            }, 6000);
        };

        // ── Drum sounds (synthesized — no CDN samples) ──
        if (n.includes('kick')) {
            source = new Tone.PolySynth(Tone.MembraneSynth, {
                maxPolyphony: 128,
                pitchDecay: 0.05,
                octaves: 6,
                envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.1 }
            }).connect(channel);
        } else if (n.includes('snare')) {
            source = new Tone.NoiseSynth({
                noise: { type: 'white' },
                envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.05 }
            }).connect(channel);
        } else if (n.includes('clap')) {
            source = new Tone.NoiseSynth({
                noise: { type: 'white' },
                envelope: { attack: 0.001, decay: 0.15, sustain: 0 }
            }).connect(channel);
        } else if (n.includes('hat') || n.includes('cymbal')) {
            source = new Tone.PolySynth(Tone.MetalSynth, {
                maxPolyphony: 128,
                frequency: 400,
                harmonicity: 5.1,
                modulationIndex: 32,
                envelope: { attack: 0.001, decay: 0.08, release: 0.01 },
                volume: -8
            }).connect(channel);

            // ── Sampled instruments (CDN + synth fallback) ──
        } else if (n.includes('piano')) {
            loadSampledInstrument('piano', new Tone.PolySynth(Tone.Synth, {
                maxPolyphony: 32,
                oscillator: { type: 'triangle' },
                envelope: { attack: 0.005, decay: 0.8, sustain: 0.2, release: 1.5 },
                volume: -4
            }));
        } else if (n.includes('violin')) {
            loadSampledInstrument('violin', new Tone.PolySynth(Tone.AMSynth, {
                maxPolyphony: 8,
                harmonicity: 2,
                oscillator: { type: 'sawtooth' },
                envelope: { attack: 0.1, decay: 0.3, sustain: 0.8, release: 0.5 },
                modulation: { type: 'sine' },
                modulationEnvelope: { attack: 0.3, decay: 0.2, sustain: 0.8, release: 0.5 }
            }));
        } else if (n.includes('cello')) {
            loadSampledInstrument('cello', new Tone.PolySynth(Tone.AMSynth, {
                maxPolyphony: 8,
                harmonicity: 1.5,
                oscillator: { type: 'sawtooth' },
                envelope: { attack: 0.15, decay: 0.4, sustain: 0.8, release: 0.6 },
                modulation: { type: 'sine' },
                modulationEnvelope: { attack: 0.4, decay: 0.3, sustain: 0.7, release: 0.6 }
            }));
        } else if (n.includes('contrabass')) {
            loadSampledInstrument('contrabass', new Tone.PolySynth(Tone.Synth, {
                maxPolyphony: 8,
                oscillator: { type: 'sawtooth' },
                envelope: { attack: 0.15, decay: 0.5, sustain: 0.7, release: 0.8 },
                volume: -2
            }));
        } else if (n.includes('flute')) {
            loadSampledInstrument('flute', new Tone.PolySynth(Tone.Synth, {
                maxPolyphony: 8,
                oscillator: { type: 'sine' },
                envelope: { attack: 0.05, decay: 0.15, sustain: 0.8, release: 0.3 },
                volume: -2
            }));
        } else if (n.includes('clarinet')) {
            loadSampledInstrument('clarinet', new Tone.PolySynth(Tone.Synth, {
                maxPolyphony: 8,
                oscillator: { type: 'square' },
                envelope: { attack: 0.05, decay: 0.2, sustain: 0.7, release: 0.3 },
                volume: -6
            }));
        } else if (n.includes('bassoon')) {
            loadSampledInstrument('bassoon', new Tone.PolySynth(Tone.Synth, {
                maxPolyphony: 8,
                oscillator: { type: 'sawtooth' },
                envelope: { attack: 0.08, decay: 0.3, sustain: 0.7, release: 0.4 },
                volume: -4
            }));
        } else if (n.includes('saxophone') || n.includes('sax')) {
            loadSampledInstrument('saxophone', new Tone.PolySynth(Tone.MonoSynth, {
                maxPolyphony: 8,
                oscillator: { type: 'square' },
                filter: { Q: 2, type: 'lowpass', rolloff: -12 },
                filterEnvelope: { attack: 0.02, decay: 0.2, sustain: 0.6, release: 0.3, baseFrequency: 400, octaves: 2 },
                envelope: { attack: 0.03, decay: 0.2, sustain: 0.7, release: 0.3 }
            }));
        } else if (n.includes('trumpet')) {
            loadSampledInstrument('trumpet', new Tone.PolySynth(Tone.FMSynth, {
                maxPolyphony: 8,
                harmonicity: 1,
                modulationIndex: 3,
                oscillator: { type: 'sawtooth' },
                envelope: { attack: 0.02, decay: 0.2, sustain: 0.7, release: 0.3 },
                modulation: { type: 'square' },
                modulationEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.3 }
            }));
        } else if (n.includes('trombone')) {
            loadSampledInstrument('trombone', new Tone.PolySynth(Tone.FMSynth, {
                maxPolyphony: 8,
                harmonicity: 0.5,
                modulationIndex: 2,
                oscillator: { type: 'sawtooth' },
                envelope: { attack: 0.04, decay: 0.3, sustain: 0.7, release: 0.4 },
                modulation: { type: 'square' },
                modulationEnvelope: { attack: 0.02, decay: 0.3, sustain: 0.5, release: 0.4 }
            }));
        } else if (n.includes('tuba')) {
            loadSampledInstrument('tuba', new Tone.PolySynth(Tone.FMSynth, {
                maxPolyphony: 8,
                harmonicity: 0.5,
                modulationIndex: 1.5,
                oscillator: { type: 'sawtooth' },
                envelope: { attack: 0.06, decay: 0.4, sustain: 0.7, release: 0.5 },
                modulation: { type: 'sine' },
                modulationEnvelope: { attack: 0.05, decay: 0.4, sustain: 0.5, release: 0.5 },
                volume: -2
            }));
        } else if (n.includes('french') && n.includes('horn')) {
            loadSampledInstrument('french-horn', new Tone.PolySynth(Tone.FMSynth, {
                maxPolyphony: 8,
                harmonicity: 1,
                modulationIndex: 2,
                oscillator: { type: 'sawtooth' },
                envelope: { attack: 0.05, decay: 0.3, sustain: 0.7, release: 0.4 },
                modulation: { type: 'sine' },
                modulationEnvelope: { attack: 0.04, decay: 0.3, sustain: 0.5, release: 0.4 }
            }));
        } else if (n.includes('organ')) {
            loadSampledInstrument('organ', new Tone.PolySynth(Tone.FMSynth, {
                maxPolyphony: 16,
                harmonicity: 2,
                modulationIndex: 1,
                oscillator: { type: 'sine' },
                envelope: { attack: 0.01, decay: 0.1, sustain: 0.9, release: 0.3 },
                modulation: { type: 'sine' },
                modulationEnvelope: { attack: 0.01, decay: 0.1, sustain: 0.9, release: 0.3 }
            }));
        } else if (n.includes('harmonium')) {
            loadSampledInstrument('harmonium', new Tone.PolySynth(Tone.FMSynth, {
                maxPolyphony: 8,
                harmonicity: 2,
                modulationIndex: 1.5,
                oscillator: { type: 'sine' },
                envelope: { attack: 0.05, decay: 0.2, sustain: 0.85, release: 0.4 },
                modulation: { type: 'sine' },
                modulationEnvelope: { attack: 0.05, decay: 0.2, sustain: 0.8, release: 0.4 }
            }));
        } else if (n.includes('harp')) {
            loadSampledInstrument('harp', new Tone.PolySynth(Tone.Synth, {
                maxPolyphony: 16,
                oscillator: { type: 'triangle' },
                envelope: { attack: 0.002, decay: 1.2, sustain: 0, release: 1.5 },
                volume: -2
            }));
        } else if (n.includes('xylophone')) {
            loadSampledInstrument('xylophone', new Tone.PolySynth(Tone.Synth, {
                maxPolyphony: 16,
                oscillator: { type: 'sine' },
                envelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.3 },
                volume: -4
            }));
        } else if (n.includes('acoustic') && n.includes('guitar')) {
            loadSampledInstrument('guitar-acoustic', new Tone.PolySynth(Tone.Synth, {
                maxPolyphony: 8,
                oscillator: { type: 'triangle' },
                envelope: { attack: 0.002, decay: 0.8, sustain: 0.1, release: 1.0 }
            }));
        } else if (n.includes('nylon') && n.includes('guitar')) {
            loadSampledInstrument('guitar-nylon', new Tone.PolySynth(Tone.Synth, {
                maxPolyphony: 8,
                oscillator: { type: 'triangle' },
                envelope: { attack: 0.002, decay: 0.9, sustain: 0.1, release: 1.2 }
            }));
        } else if (n.includes('electric') && n.includes('bass')) {
            loadSampledInstrument('bass-electric', new Tone.PolySynth(Tone.MonoSynth, {
                maxPolyphony: 8,
                oscillator: { type: 'square' },
                filter: { Q: 2, type: 'lowpass', rolloff: -24 },
                filterEnvelope: { attack: 0.01, decay: 0.15, sustain: 0.5, release: 0.5, baseFrequency: 200, octaves: 2.5 },
                envelope: { attack: 0.03, decay: 0.2, sustain: 0.7, release: 0.4 }
            }));
        } else if (n.includes('electric') && n.includes('guitar')) {
            loadSampledInstrument('guitar-electric', new Tone.PolySynth(Tone.Synth, {
                maxPolyphony: 8,
                oscillator: { type: 'sawtooth' },
                envelope: { attack: 0.003, decay: 0.15, sustain: 0.55, release: 1.2 },
                volume: 4
            }));
        } else if (n.includes('bass')) {
            // Generic bass (synth)
            loadSampledInstrument('bass-electric', new Tone.PolySynth(Tone.MonoSynth, {
                maxPolyphony: 8,
                oscillator: { type: 'square' },
                filter: { Q: 2, type: 'lowpass', rolloff: -24 },
                filterEnvelope: { attack: 0.01, decay: 0.15, sustain: 0.5, release: 0.5, baseFrequency: 200, octaves: 2.5 },
                envelope: { attack: 0.03, decay: 0.2, sustain: 0.7, release: 0.4 }
            }));
        } else if (n.includes('guitar')) {
            // Generic guitar fallback
            loadSampledInstrument('guitar-electric', new Tone.PolySynth(Tone.Synth, {
                maxPolyphony: 8,
                oscillator: { type: 'sawtooth' },
                envelope: { attack: 0.003, decay: 0.15, sustain: 0.55, release: 1.2 },
                volume: 4
            }));
        } else if (n.includes('string')) {
            // String Ensemble — use cello samples
            loadSampledInstrument('cello', new Tone.PolySynth(Tone.AMSynth, {
                maxPolyphony: 16,
                harmonicity: 1.5,
                oscillator: { type: 'fatsawtooth', spread: 30, count: 3 },
                envelope: { attack: 0.3, decay: 0.4, sustain: 0.8, release: 1.0 },
                modulation: { type: 'sine' },
                modulationEnvelope: { attack: 0.5, decay: 0.3, sustain: 0.7, release: 0.8 }
            }));
        } else if (n.includes('synth') || n.includes('analog')) {
            // Analog Synth — keep as pure synthesis
            source = new Tone.PolySynth(Tone.Synth, {
                maxPolyphony: 16,
                oscillator: { type: 'sawtooth' },
                envelope: { attack: 0.01, decay: 0.3, sustain: 0.6, release: 0.4 }
            }).connect(channel);
        } else {
            // Default Synth
            source = new Tone.PolySynth(Tone.Synth, { maxPolyphony: 128 }).connect(channel);
        }

        this.sources.set(id, source);
        this.channelNames.set(id, name); // track channel name for instrument-aware preview
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

    // --- Audio Clip Volume/Pan Management ---

    /**
     * Update volume for all active audio players associated with a given audio clip ID.
     * Audio players are keyed by playlist clip instance ID, so we iterate and check
     * all players to find those associated with the given source audio clip.
     */
    updateAudioClipVolume(audioClipId, volume0to100) {
        // Store the volume setting for this audio clip so new players pick it up
        if (!this._audioClipSettings) this._audioClipSettings = new Map();
        const settings = this._audioClipSettings.get(audioClipId) || { vol: 100, pan: 50 };
        settings.vol = volume0to100;
        this._audioClipSettings.set(audioClipId, settings);

        // Update any active players that match this audio clip
        this.audioPlayers.forEach((player) => {
            // Check if this player is linked to the audio clip via instance mapping
            if (player._audioClipId === audioClipId) {
                if (volume0to100 === 0) {
                    player.mute = true;
                } else {
                    player.mute = false;
                    const db = Tone.gainToDb(volume0to100 / 100 * 1.2);
                    player.volume.rampTo(db, 0.1);
                }
            }
        });
    }

    /**
     * Update pan for all active audio players associated with a given audio clip ID.
     */
    updateAudioClipPan(audioClipId, pan0to100) {
        if (!this._audioClipSettings) this._audioClipSettings = new Map();
        const settings = this._audioClipSettings.get(audioClipId) || { vol: 100, pan: 50 };
        settings.pan = pan0to100;
        this._audioClipSettings.set(audioClipId, settings);

        // Note: Tone.Player doesn't have a built-in pan property.
        // For real-time pan on audio clips, we'd need a Tone.Panner node.
        // We store the setting and apply it when players are created in schedulePlaylist.
    }

    /**
     * Get stored volume/pan settings for an audio clip.
     */
    getAudioClipSettings(audioClipId) {
        if (!this._audioClipSettings) return { vol: 100, pan: 50 };
        return this._audioClipSettings.get(audioClipId) || { vol: 100, pan: 50 };
    }

    // --- Effect Chain Management ---

    /**
     * Create a Tone.js effect instance by type
     */
    createEffect(type) {
        switch (type) {
            case 'reverb':
            case 'spatial':
                return this.createReverbEffect();
            case 'delay':
            case 'temporal':
                return this.createDelayEffect();
            case 'chorus':
                return this.createChorusEffect();
            case 'phaser':
            case 'modulation':
                return this.createPhaserEffect();
            case 'distortion':
            case 'saturation':
                return this.createDistortionEffect();
            case 'compressor':
            case 'dynamics':
                return this.createCompressorEffect();
            case 'eq':
            case 'filter':
                return this.createParametricEQEffect();
            case 'gain':
            case 'utility':
                return this.createGainEffect();
            case 'pan':
            case 'panner':
                return this.createPannerEffect();
            default:
                console.warn(`Unknown effect type: ${type}`);
                return null;
        }
    }

    /**
     * Add effect to channel at specific slot
     */
    addChannelEffect(channelId, effectType, slotIndex) {
        const channel = this.channels.get(channelId);
        if (!channel) {
            console.warn(`Channel ${channelId} not found`);
            return;
        }

        // Initialize effects array for this channel if needed
        if (!this.channelEffects.has(channelId)) {
            this.channelEffects.set(channelId, Array(10).fill(null));
        }

        const effects = this.channelEffects.get(channelId);

        // Create the effect
        const effectNode = this.createEffect(effectType);
        if (!effectNode) return;

        // Store in slot
        effects[slotIndex] = { node: effectNode, type: effectType, enabled: true, mix: 1 };

        // Rebuild the effect chain
        this.rebuildEffectChain(channelId);

        console.log(`Added ${effectType} effect to channel ${channelId} slot ${slotIndex}`);
    }

    /**
     * Remove effect from channel slot
     */
    removeChannelEffect(channelId, slotIndex) {
        const effects = this.channelEffects.get(channelId);
        if (!effects || !effects[slotIndex]) return;

        // Dispose the effect node
        if (effects[slotIndex].node) {
            effects[slotIndex].node.dispose();
        }
        effects[slotIndex] = null;

        // Rebuild the effect chain
        this.rebuildEffectChain(channelId);

        console.log(`Removed effect from channel ${channelId} slot ${slotIndex}`);
    }

    /**
     * Update effect wet/dry mix (0-1)
     */
    updateEffectMix(channelId, slotIndex, mix) {
        const effects = this.channelEffects.get(channelId);
        if (!effects || !effects[slotIndex]) return;

        effects[slotIndex].mix = mix; // Store current mix

        const effect = effects[slotIndex].node;
        if (effect && effect.wet && effects[slotIndex].enabled) {
            effect.wet.rampTo(mix, 0.1);
        }
    }

    /**
     * Toggle effect bypass
     */
    updateEffectEnabled(channelId, slotIndex, enabled) {
        const effects = this.channelEffects.get(channelId);
        if (!effects || !effects[slotIndex]) return;

        effects[slotIndex].enabled = enabled;

        const effect = effects[slotIndex].node;
        if (effect && effect.wet) {
            // Set wet to 0 when bypassed, restore to previous mix when enabled
            const targetMix = enabled ? (effects[slotIndex].mix ?? 1) : 0;
            effect.wet.rampTo(targetMix, 0.05);
        }
    }

    /**
     * Reorder effects in channel (after swap)
     */
    reorderChannelEffects(channelId, newEffectsArray) {
        const effects = this.channelEffects.get(channelId);
        if (!effects) return;

        // Update the internal effects array to match UI order
        // (The nodes themselves don't need to be recreated, just the chain rebuilt)
        this.rebuildEffectChain(channelId);
    }

    createDelayEffect() {
        const input = new Tone.Gain(1);
        const output = new Tone.Gain(1);

        // Internal Nodes
        const dry = new Tone.Gain(1).connect(output);
        const wetChain = new Tone.Gain(0.5).connect(output);

        input.connect(dry);

        const inputVol = new Tone.Gain(1);
        const panner = new Tone.Panner(0);
        input.connect(inputVol);
        inputVol.connect(panner);

        const split = new Tone.Split();
        panner.connect(split);

        const delayL = new Tone.Delay(0.3, 1);
        const delayR = new Tone.Delay(0.3, 1);

        const filterL = new Tone.Filter(10000, "lowpass");
        const filterR = new Tone.Filter(10000, "lowpass");

        const fbL = new Tone.Gain(0.4);
        const fbR = new Tone.Gain(0.4);

        const merge = new Tone.Merge();

        // Feedback Matrix Gains
        const fbLtoL = new Tone.Gain(1);
        const fbLtoR = new Tone.Gain(0);
        const fbRtoL = new Tone.Gain(0);
        const fbRtoR = new Tone.Gain(1);

        // Routing
        // Feed inputs to delays
        split.connect(delayL, 0);
        split.connect(delayR, 1);

        // Feedback Loop
        delayL.connect(filterL);
        delayR.connect(filterR);

        filterL.connect(fbL);
        filterR.connect(fbR);

        fbL.connect(fbLtoL); fbL.connect(fbLtoR);
        fbR.connect(fbRtoL); fbR.connect(fbRtoR);

        fbLtoL.connect(delayL); fbLtoR.connect(delayR);
        fbRtoL.connect(delayL); fbRtoR.connect(delayR);

        // Output
        filterL.connect(merge, 0, 0);
        filterR.connect(merge, 0, 1);
        merge.connect(wetChain);

        const state = {
            delayTime: 0.3,
            offset: 0
        };

        const updateDelays = () => {
            const t = state.delayTime;
            const o = state.offset;
            delayL.delayTime.rampTo(t, 0.1);
            // Offset applied to R channel relative to L
            delayR.delayTime.rampTo(Math.max(0, t + (o * 0.5)), 0.1);
        };

        const updateMatrix = (mode) => {
            if (mode === 'Normal') {
                fbLtoL.gain.value = 1; fbRtoR.gain.value = 1;
                fbLtoR.gain.value = 0; fbRtoL.gain.value = 0;
            } else if (mode === 'P.Pong') {
                fbLtoL.gain.value = 0; fbRtoR.gain.value = 0;
                fbLtoR.gain.value = 1; fbRtoL.gain.value = 1;
            } else if (mode === 'Invert') {
                // Swap channels
                fbLtoL.gain.value = 0; fbRtoR.gain.value = 0;
                fbLtoR.gain.value = 1; fbRtoL.gain.value = 1;
            }
        };

        return {
            input, output,
            wet: wetChain.gain, // Expose wet gain

            // Custom Setters
            setInputPan: (v) => panner.pan.rampTo(v / 50, 0.1),
            setInputVol: (v) => inputVol.gain.rampTo(v, 0.1),
            setFeedbackMode: (v) => updateMatrix(v),
            setFeedbackVol: (v) => { fbL.gain.rampTo(v, 0.1); fbR.gain.rampTo(v, 0.1); },
            setCut: (v) => { filterL.frequency.rampTo(v, 0.1); filterR.frequency.rampTo(v, 0.1); },
            setDelayTime: (v) => { state.delayTime = v; updateDelays(); },
            setOffset: (v) => { state.offset = v; updateDelays(); },
            setDryVol: (v) => dry.gain.rampTo(v, 0.1),

            dispose: () => {
                input.dispose(); output.dispose(); dry.dispose(); wetChain.dispose();
                inputVol.dispose(); panner.dispose(); split.dispose();
                delayL.dispose(); delayR.dispose();
                filterL.dispose(); filterR.dispose();
                fbL.dispose(); fbR.dispose();
                fbLtoL.dispose(); fbLtoR.dispose(); fbRtoL.dispose(); fbRtoR.dispose();
                merge.dispose();
            },
            connect: (d) => output.connect(d),
            disconnect: () => output.disconnect()
        };
    }

    createReverbEffect() {
        const input = new Tone.Gain(1);
        const output = new Tone.Gain(1);

        // Signal Paths
        // Dry Path
        const dryGain = new Tone.Gain(0.8);
        input.connect(dryGain);
        dryGain.connect(output);

        // Wet Path Setup
        const wetChainInput = new Tone.Gain(1);
        input.connect(wetChainInput);

        // 1. Input Filters
        const lowCut = new Tone.Filter(100, "highpass");
        const highCut = new Tone.Filter(6000, "lowpass");

        // 2. Pre-Delay
        const preDelay = new Tone.Delay(0.02, 0.5); // max 0.5s

        // 3. Reverb Core
        // Use Tone.Reverb for better quality tails
        const reverb = new Tone.Reverb({ decay: 2.5, preDelay: 0.0 });
        reverb.generate(); // Init impulse

        // 4. Post-Reverb Color/Damping
        const damping = new Tone.Filter(5000, "lowpass"); // Simulate wall absorption

        // 5. Width/Separation
        // Tone.StereoWidener or Mid/Side
        const widener = new Tone.StereoWidener(0.5);

        // 6. Wet Volume
        const wetGain = new Tone.Gain(0.6);

        // Routing
        wetChainInput.connect(lowCut);
        lowCut.connect(highCut);
        highCut.connect(preDelay);
        preDelay.connect(reverb);
        reverb.connect(damping);
        damping.connect(widener);
        widener.connect(wetGain);
        wetGain.connect(output);

        // Early Reflections Simulation (simplified as a parallel short delay/slapback)
        const erGain = new Tone.Gain(0);
        const erDelay = new Tone.Delay(0.01);
        wetChainInput.connect(erDelay);
        erDelay.connect(erGain);
        erGain.connect(output);

        return {
            input, output,
            // Standard wet prop for identification (though we manage dry/wet manually)
            wet: { value: 0, rampTo: () => { } },

            // Custom Setters
            setLowCut: (v) => lowCut.frequency.rampTo(v, 0.1),
            setHighCut: (v) => highCut.frequency.rampTo(v, 0.1),
            setPreDelay: (v) => preDelay.delayTime.rampTo(v, 0.1),
            setDecay: (v) => {
                if (Math.abs(reverb.decay - v) > 0.1) {
                    reverb.decay = v;
                    reverb.generate(); // Regenerate IR
                }
            },
            setDamping: (v) => damping.frequency.rampTo(v, 0.1),
            setDiffusion: (v) => {
                // Map diffusion to high/low cut spread or pre-delay jitter?
                // Visual feedback: ramp preDelay slightly?
                // Actually, let's map diffusion to the highCut filter to darken the tail
                // 0 = Bright (20kHz), 1 = Dark (1kHz)
                const freq = 20000 - (v * 19000);
                damping.frequency.rampTo(freq, 0.1);
            },
            setSize: (v) => {
                // Map size to pre-delay scaling
                // Large room = longer pre-delay (up to 0.1s)
                preDelay.delayTime.rampTo(v * 0.1, 0.1);
            },

            setDryVol: (v) => dryGain.gain.rampTo(v, 0.1),
            setErVol: (v) => erGain.gain.rampTo(v, 0.1),
            setWetVol: (v) => wetGain.gain.rampTo(v, 0.1),
            setSeparation: (v) => widener.width.rampTo(v * 0.5 + 0.5, 0.1), // Map -1..1 to 0..1 (approx)

            dispose: () => {
                input.dispose(); output.dispose();
                dryGain.dispose(); wetChainInput.dispose();
                lowCut.dispose(); highCut.dispose();
                preDelay.dispose(); reverb.dispose();
                damping.dispose(); widener.dispose();
                wetGain.dispose(); erGain.dispose(); erDelay.dispose();
            },
            connect: (d) => output.connect(d),
            disconnect: () => output.disconnect()
        };
    }

    createChorusEffect() {
        // Multi-Voice Chorus (3 Voices)
        const input = new Tone.Gain(1);
        const output = new Tone.Gain(1);

        // Wet/Dry path
        const dryNode = new Tone.Gain(1).connect(output);
        const wetChain = new Tone.Gain(0.5).connect(output);

        input.connect(dryNode);

        // Crossover / Filtering
        // If Type is HF, we filter input HP -> Chorus. LP goes to dry?
        // Ideally: Input -> Filter -> Chorus -> WetMix.
        const inputFilter = new Tone.Filter(320, "highpass"); // Default HF
        input.connect(inputFilter);

        // 3 Parallel Voices
        // Voice 1
        const v1Delay = new Tone.Delay(0.015, 0.1); // min 0, max 0.1
        const v1LFO = new Tone.LFO(0.45, 0, 0.005); // freq, min, max (depth applied later)
        const v1Pan = new Tone.Panner(-0.5);
        v1LFO.connect(v1Delay.delayTime);
        v1LFO.start();

        // Voice 2
        const v2Delay = new Tone.Delay(0.015, 0.1);
        const v2LFO = new Tone.LFO(1.25, 0, 0.005);
        const v2Pan = new Tone.Panner(0.5);
        v2LFO.connect(v2Delay.delayTime);
        v2LFO.start();

        // Voice 3
        const v3Delay = new Tone.Delay(0.015, 0.1);
        const v3LFO = new Tone.LFO(2.45, 0, 0.005);
        const v3Pan = new Tone.Panner(0);
        v3LFO.connect(v3Delay.delayTime);
        v3LFO.start();

        // Routing
        inputFilter.connect(v1Delay);
        inputFilter.connect(v2Delay);
        inputFilter.connect(v3Delay);

        v1Delay.connect(v1Pan); v1Pan.connect(wetChain);
        v2Delay.connect(v2Pan); v2Pan.connect(wetChain);
        v3Delay.connect(v3Pan); v3Pan.connect(wetChain);

        // State for managing complex updates
        const state = {
            delayMs: 15,
            depthMs: 2.25,
            stereo: 59, // deg (0-360, but effectively spread)
            crossType: 'HF'
        };

        const updateLFOs = () => {
            // Depth in seconds
            const depthSec = state.depthMs / 1000;
            const delaySec = state.delayMs / 1000;

            // Update Min/Max of LFOs based on Delay center and Depth
            // LFO oscillates around delaySec +/- depth? 
            // Logic: DelayTime is base. LFO adds 0 to Depth? Or -Depth/2 to +Depth/2?
            // Tone.LFO output connects to delayTime param.
            // We set LFO min = delaySec, max = delaySec + depthSec.

            [v1LFO, v2LFO, v3LFO].forEach(lfo => {
                lfo.min = delaySec;
                lfo.max = delaySec + depthSec;
            });
        };

        const updateStereo = () => {
            // Map 0-100 (ish logic) or 0-360 degrees to pan spread
            // 0 -> Mono (all 0), 360 -> Full Wide (-1, 1)
            // Let's assume 59 is default spread.
            const spread = Math.min(1, state.stereo / 180); // Normalize roughly
            v1Pan.pan.value = -spread;
            v2Pan.pan.value = spread;
            v3Pan.pan.value = 0;
        };

        return {
            input, output,
            wet: wetChain.gain,

            // Setters
            setDelayTime: (v) => { state.delayMs = v; updateLFOs(); },
            setDepth: (v) => { state.depthMs = v; updateLFOs(); },
            setStereo: (v) => { state.stereo = v; updateStereo(); },

            setLfo1Freq: (v) => v1LFO.frequency.rampTo(v, 0.1),
            setLfo1Wave: (v) => v1LFO.type = v === 'sin' ? 'sine' : (v === 'tri' ? 'triangle' : 'square'),

            setLfo2Freq: (v) => v2LFO.frequency.rampTo(v, 0.1),
            setLfo2Wave: (v) => v2LFO.type = v === 'sin' ? 'sine' : (v === 'tri' ? 'triangle' : 'square'),

            setLfo3Freq: (v) => v3LFO.frequency.rampTo(v, 0.1),
            setLfo3Wave: (v) => v3LFO.type = v === 'sin' ? 'sine' : (v === 'tri' ? 'triangle' : 'square'),

            setCrossType: (v) => {
                state.crossType = v;
                if (v === 'HF') {
                    inputFilter.type = "highpass";
                    inputFilter.frequency.value = inputFilter.frequency.value; // Refresh
                } else if (v === 'LF') {
                    inputFilter.type = "lowpass";
                } else {
                    inputFilter.type = "allpass"; // 'Off' or full band
                }
            },
            setCrossCutoff: (v) => inputFilter.frequency.rampTo(v, 0.1),
            setWet: (v) => wetChain.gain.rampTo(v, 0.1),

            dispose: () => {
                input.dispose(); output.dispose(); dryNode.dispose(); wetChain.dispose();
                inputFilter.dispose();
                v1Delay.dispose(); v1LFO.dispose(); v1Pan.dispose();
                v2Delay.dispose(); v2LFO.dispose(); v2Pan.dispose();
                v3Delay.dispose(); v3LFO.dispose(); v3Pan.dispose();
            },
            connect: (d) => output.connect(d),
            disconnect: () => output.disconnect()
        };
    }

    createPhaserEffect() {
        const input = new Tone.Gain(1);
        const output = new Tone.Gain(1);
        const outGain = new Tone.Gain(1); // For output gain param

        // Core Phaser
        // We initialize with defaults matching the Editor
        const phaser = new Tone.Phaser({
            frequency: 0.5,
            octaves: 3,
            stages: 8,
            Q: 0.4,
            baseFrequency: 350,
            wet: 0.5
        });

        // Routing
        input.connect(phaser);
        phaser.connect(outGain);
        outGain.connect(output);

        // State for calculating complex props
        const state = {
            minDepth: 0.1,
            maxDepth: 0.8,
            rangeMode: 'Large', // 'Small' or 'Large'
        };

        const updateDepth = () => {
            // Map 0-1 depth params to BaseFreq and Octaves
            // Fruity Phaser Logic Approx:
            // Min Depth affects lowest frequency.
            // Max Depth affects highest frequency (range).

            // Base Range: 200Hz to 2000Hz?
            // If Range is 'Small', shift up or limit range?
            // Let's approximate:
            // BaseFreq = 200 + (minDepth * 800)
            // TopFreq = BaseFreq + (maxDepth * 2000)
            // Octaves = Math.log2(TopFreq / BaseFreq)

            const baseMin = state.rangeMode === 'Small' ? 500 : 200;
            const rangeScale = state.rangeMode === 'Small' ? 1000 : 5000;

            const baseFreq = baseMin + (state.minDepth * 500);
            const topFreq = baseFreq + Math.max(10, state.maxDepth * rangeScale);

            const octaves = Math.log2(topFreq / baseFreq);

            phaser.baseFrequency = baseFreq;
            phaser.octaves = Math.max(0.1, octaves);
        };

        return {
            input, output,
            wet: phaser.wet,

            // Setters
            setSweepFreq: (v) => phaser.frequency.rampTo(v, 0.1),
            setMinDepth: (v) => { state.minDepth = v; updateDepth(); },
            setMaxDepth: (v) => { state.maxDepth = v; updateDepth(); },
            setFreqRange: (v) => { state.rangeMode = v; updateDepth(); },
            setStereo: (v) => {
                // Tone.Phaser doesn't expose easy stereo phase offset. 
                // We can approximate stereo width by modulating the baseFrequency slightly between channels if possible?
                // Or use a StereoWidener after the phaser?
                // For now, let's just modulation the depth slightly based on stereo param?
                // No, let's leave it as a placeholder or implement a widener node if we want true stereo.
                // Assuming v is 0-1 (or 0-360)
                // Let's implement a simple frequency offset if possible.
                // Since this is a single node, we can't split L/R easily without rebuilding the graph.
                // We'll map stereo to feedback for now as a "color" change? No, that's confusing.
                // Let's just log it for now to acknowledge the param exists.
                // console.log('Phaser Stereo not fully implemented in Tone.Phaser wrapper', v);
            },
            setStages: (v) => {
                // Changing stages may be glitchy, stick to even numbers or just update
                phaser.stages = Math.round(v);
            },
            setFeedback: (v) => {
                // Map Feedback to Q (Resonance)
                phaser.Q.rampTo(v * 10, 0.1);
            },
            setWet: (v) => phaser.wet.rampTo(v, 0.1),
            setOutGain: (v) => {
                // dB to linear gain
                // value is -20 to 20
                const linear = Math.pow(10, v / 20);
                outGain.gain.rampTo(linear, 0.1);
            },

            dispose: () => {
                input.dispose(); output.dispose(); phaser.dispose(); outGain.dispose();
            },
            connect: (d) => output.connect(d),
            disconnect: () => output.disconnect()
        };
    }



    createParametricEQEffect() {
        const input = new Tone.Gain(1);
        const output = new Tone.Gain(1);
        const analyser = new Tone.Analyser('fft', 2048); // For visuals

        // 7 Bands
        // 1: Low Shelf
        // 2-6: Peaking
        // 7: High Shelf
        const bands = [];
        const freqs = [60, 130, 300, 800, 2000, 5000, 12000];

        for (let i = 0; i < 7; i++) {
            let type = 'peaking';
            if (i === 0) type = 'lowshelf';
            if (i === 6) type = 'highshelf';

            const filter = new Tone.Filter({
                frequency: freqs[i],
                type: type,
                rolloff: -12,
                Q: 1,
                gain: 0
            });
            bands.push(filter);
        }

        // Chain input -> b0 -> b1 ... -> b6 -> output
        input.connect(bands[0]);
        for (let i = 0; i < 6; i++) {
            bands[i].connect(bands[i + 1]);
        }
        bands[6].connect(output);
        bands[6].connect(analyser); // Visualization tap

        return {
            input, output, analyser,
            wet: { value: 1, rampTo: () => { } },
            bands, // Expose for internal checks if needed

            setBand: (index, params) => {
                const band = bands[index];
                if (!band) return;

                if (params.freq !== undefined) band.frequency.rampTo(params.freq, 0.1);
                if (params.gain !== undefined) band.gain.rampTo(params.gain, 0.1);
                // Tone.Filter Q is standard Q factor
                if (params.bw !== undefined) band.Q.rampTo(params.bw, 0.1);
                if (params.type !== undefined) {
                    // Map generic types if needed, Tone types:
                    // lowpass, highpass, bandpass, lowshelf, highshelf, notch, allpass, peaking
                    band.type = params.type;
                }
                if (params.slope !== undefined) {
                    // -12, -24, -48, -96
                    // Tone.Filter supports -12, -24, -48, -96 for rolloff
                    // But usually only for lowpass/highpass/bandpass?
                    // Peaking might not support rolloff.
                    // We'll set it anyway, Tone handles it or ignores it.
                    band.rolloff = params.slope;
                }
                if (params.enabled !== undefined) {
                    // If disabled, just set gain to 0 if peaking/shelf or disconnect?
                    // Gain 0 is safest for now.
                }
            },

            dispose: () => {
                input.dispose(); output.dispose(); analyser.dispose();
                bands.forEach(b => b.dispose());
            },
            connect: (d) => output.connect(d),
            disconnect: () => output.disconnect()
        };
    }

    createDistortionEffect() {
        const input = new Tone.Gain(1);
        const output = new Tone.Gain(1);

        // Standard Dry/Wet architecture for Tone.js compatibility
        const dryNode = new Tone.Gain(0);
        const wetNode = new Tone.Gain(1);
        const effectReturn = new Tone.Gain(1);

        input.connect(dryNode);
        dryNode.connect(output);

        input.connect(wetNode);

        // Chain: WetNode -> PreGain -> Gate -> Shaper -> PostGain -> EffectReturn -> Output
        const preGain = new Tone.Gain(1);
        const gate = new Tone.Gate(-60, 0.1);
        const shaper = new Tone.WaveShaper((x) => x, 4096);
        const postGain = new Tone.Gain(1);

        wetNode.connect(preGain);
        preGain.connect(gate);
        gate.connect(shaper);
        shaper.connect(postGain);
        postGain.connect(effectReturn);
        effectReturn.connect(output);

        const state = {
            type: 'A',
            mix: 1
        };

        const updateCurve = () => {
            if (state.type === 'A') {
                shaper.setMap((x) => Math.tanh(x * 2));
            } else {
                shaper.setMap((x) => {
                    const k = 2;
                    const y = x * k;
                    return Math.max(-1, Math.min(1, y));
                });
            }
        };
        updateCurve();

        // Facade object mimicking Tone.Effect interface for generic handling
        return {
            input, output,
            // Expose "wet" for bypass logic (ramping to 0 mutes effect path)
            wet: {
                value: 1,
                rampTo: (v, t) => {
                    // When bypassing/enabling, we want to control the MIX
                    // If v is 0 (bypass), mix should effectively be 0 (dry only)
                    // If v is >0 (enable), we restore the user's mix setting

                    // However, our generic bypass logic calls .wet.rampTo(0) or .wet.rampTo(1)
                    // We need to interpret '1' as "restore state.mix"

                    const targetMix = v > 0.5 ? state.mix : 0;

                    // Crossfade logic
                    dryNode.gain.rampTo(1 - targetMix, t);
                    effectReturn.gain.rampTo(targetMix, t);
                }
            },

            // Setters
            setPreGain: (v) => preGain.gain.rampTo(v, 0.1),
            setThreshold: (v) => {
                const db = -80 + (v * 70);
                gate.threshold = db;
            },
            setDistType: (v) => { state.type = v; updateCurve(); },
            setMix: (v) => {
                state.mix = v;
                dryNode.gain.rampTo(1 - v, 0.1);
                effectReturn.gain.rampTo(v, 0.1);
            },
            setPostGain: (v) => postGain.gain.rampTo(v, 0.1),

            dispose: () => {
                input.dispose(); output.dispose();
                dryNode.dispose(); wetNode.dispose(); effectReturn.dispose();
                preGain.dispose(); gate.dispose(); shaper.dispose(); postGain.dispose();
            },
            connect: (d) => output.connect(d),
            disconnect: () => output.disconnect()
        };
    }

    createCompressorEffect() {
        const input = new Tone.Gain(1);
        const output = new Tone.Gain(1);

        const comp = new Tone.Compressor({
            threshold: -15,
            ratio: 2.4,
            attack: 0.015,
            release: 0.2,
            knee: 30 // Soft-ish default
        });

        const makeupGain = new Tone.Gain(1);

        input.connect(comp);
        comp.connect(makeupGain);
        makeupGain.connect(output);

        const state = {
            gainDb: 0
        };

        return {
            input, output,
            wet: { value: 1, rampTo: () => { } }, // Always wet for insert compressor usually

            // Setters
            setThreshold: (v) => comp.threshold.rampTo(v, 0.1),
            setRatio: (v) => comp.ratio.rampTo(v, 0.1),
            setGain: (v) => {
                state.gainDb = v;
                // dB to linear
                const linear = Math.pow(10, v / 20);
                makeupGain.gain.rampTo(linear, 0.1);
            },
            setAttack: (v) => {
                // v is in ms, Tone wants seconds
                const sec = Math.max(0.001, v / 1000);
                comp.attack.rampTo(sec, 0.1);
            },
            setRelease: (v) => {
                // v is in ms, Tone wants seconds
                const sec = Math.max(0.01, v / 1000);
                comp.release.rampTo(sec, 0.1);
            },
            setType: (v) => {
                // Map Type to Knee
                let k = 30;
                if (v === 'Hard') k = 0;
                else if (v === 'Medium') k = 15;
                else if (v === 'Soft') k = 30;
                else if (v === 'Vintage') k = 40; // Very soft knee
                comp.knee.rampTo(k, 0.2);
            },

            dispose: () => {
                input.dispose(); output.dispose(); comp.dispose(); makeupGain.dispose();
            },
            connect: (d) => output.connect(d),
            disconnect: () => output.disconnect()
        };
    }

    createGainEffect() {
        const gain = new Tone.Gain(1);
        return {
            input: gain,
            output: gain,
            wet: { value: 1, rampTo: () => { } },
            setGain: (v) => gain.gain.rampTo(Tone.dbToGain(v), 0.1),
            dispose: () => gain.dispose(),
            connect: (d) => gain.connect(d),
            disconnect: () => gain.disconnect()
        };
    }

    createPannerEffect() {
        const panner = new Tone.Panner(0);
        return {
            input: panner,
            output: panner,
            wet: { value: 1, rampTo: () => { } },
            setPan: (v) => panner.pan.rampTo(v, 0.1),
            dispose: () => panner.dispose(),
            connect: (d) => panner.connect(d),
            disconnect: () => panner.disconnect()
        };
    }

    /**
     * Update effect parameters (e.g., reverb decay, delay time, etc.)
     */
    updateEffectParams(channelId, slotIndex, params) {
        const effects = this.channelEffects.get(channelId);
        if (!effects || !effects[slotIndex]) return;

        const effect = effects[slotIndex].node;
        const type = effects[slotIndex].type;
        if (!effect) return;

        try {
            switch (type) {
                case 'reverb':
                case 'spatial':
                    if (effect.setDecay) {
                        // Custom Reverb
                        if (params.lowCut !== undefined) effect.setLowCut(params.lowCut);
                        if (params.highCut !== undefined) effect.setHighCut(params.highCut);
                        if (params.preDelay !== undefined) effect.setPreDelay(params.preDelay);
                        if (params.decay !== undefined) effect.setDecay(params.decay);
                        if (params.damping !== undefined) effect.setDamping(params.damping);
                        if (params.dryVol !== undefined) effect.setDryVol(params.dryVol);
                        if (params.erVol !== undefined) effect.setErVol(params.erVol);
                        if (params.wet !== undefined) effect.setWetVol(params.wet);
                        if (params.separation !== undefined) effect.setSeparation(params.separation);
                    } else {
                        // Fallback
                        if (params.decay !== undefined && effect.decay !== undefined) {
                            effect.decay = params.decay;
                        }
                        if (params.preDelay !== undefined && effect.preDelay !== undefined) {
                            effect.preDelay = params.preDelay;
                        }
                    }
                    break;

                case 'delay':
                case 'temporal':
                    // Check for custom setters (Advanced Delay)
                    if (effect.setDelayTime) {
                        if (params.inputPan !== undefined) effect.setInputPan(params.inputPan);
                        if (params.inputVol !== undefined) effect.setInputVol(params.inputVol);
                        if (params.feedbackMode !== undefined) effect.setFeedbackMode(params.feedbackMode);
                        if (params.feedbackVol !== undefined) effect.setFeedbackVol(params.feedbackVol);
                        if (params.cut !== undefined) effect.setCut(params.cut);
                        if (params.delayTime !== undefined) effect.setDelayTime(params.delayTime);
                        if (params.offset !== undefined) effect.setOffset(params.offset);
                        if (params.dryVol !== undefined) effect.setDryVol(params.dryVol);
                    } else {
                        // Fallback for standard nodes if any
                        if (params.delayTime !== undefined && effect.delayTime) {
                            effect.delayTime.rampTo(params.delayTime, 0.1);
                        }
                        if (params.feedback !== undefined && effect.feedback) {
                            effect.feedback.rampTo(params.feedback, 0.1);
                        }
                    }
                    break;

                case 'chorus':
                    if (effect.setDelayTime) {
                        // Custom 3-Voice Chorus
                        if (params.delayTime !== undefined) effect.setDelayTime(params.delayTime);
                        if (params.depth !== undefined) effect.setDepth(params.depth);
                        if (params.stereo !== undefined) effect.setStereo(params.stereo);

                        if (params.lfo1Freq !== undefined) effect.setLfo1Freq(params.lfo1Freq);
                        if (params.lfo1Wave !== undefined) effect.setLfo1Wave(params.lfo1Wave);

                        if (params.lfo2Freq !== undefined) effect.setLfo2Freq(params.lfo2Freq);
                        if (params.lfo2Wave !== undefined) effect.setLfo2Wave(params.lfo2Wave);

                        if (params.lfo3Freq !== undefined) effect.setLfo3Freq(params.lfo3Freq);
                        if (params.lfo3Wave !== undefined) effect.setLfo3Wave(params.lfo3Wave);

                        if (params.crossType !== undefined) effect.setCrossType(params.crossType);
                        if (params.crossCutoff !== undefined) effect.setCrossCutoff(params.crossCutoff);
                        if (params.wet !== undefined) effect.setWet(params.wet);
                    } else {
                        // Fallback
                        if (params.frequency !== undefined && effect.frequency) {
                            effect.frequency.rampTo(params.frequency, 0.1);
                        }
                        if (params.delayTime !== undefined && effect.delayTime !== undefined) {
                            effect.delayTime = params.delayTime;
                        }
                        if (params.depth !== undefined && effect.depth !== undefined) {
                            effect.depth = params.depth;
                        }
                    }
                    break;

                case 'phaser':
                case 'modulation':
                    if (effect.setSweepFreq) {
                        // Custom Phaser
                        if (params.sweepFreq !== undefined) effect.setSweepFreq(params.sweepFreq);
                        if (params.minDepth !== undefined) effect.setMinDepth(params.minDepth);
                        if (params.maxDepth !== undefined) effect.setMaxDepth(params.maxDepth);
                        if (params.freqRange !== undefined) effect.setFreqRange(params.freqRange);
                        if (params.stereo !== undefined) effect.setStereo(params.stereo);
                        if (params.stages !== undefined) effect.setStages(params.stages);
                        if (params.feedback !== undefined) effect.setFeedback(params.feedback);
                        if (params.wet !== undefined) effect.setWet(params.wet);
                        if (params.outGain !== undefined) effect.setOutGain(params.outGain);
                    } else {
                        // Fallback
                        if (params.frequency !== undefined && effect.frequency) {
                            effect.frequency.rampTo(params.frequency, 0.1);
                        }
                        if (params.octaves !== undefined && effect.octaves !== undefined) {
                            effect.octaves = params.octaves;
                        }
                        if (params.baseFrequency !== undefined && effect.baseFrequency !== undefined) {
                            effect.baseFrequency = params.baseFrequency;
                        }
                    }
                    break;

                case 'distortion':
                case 'saturation':
                    if (effect.setPreGain) {
                        // Custom Distortion
                        if (params.preGain !== undefined) effect.setPreGain(params.preGain);
                        if (params.threshold !== undefined) effect.setThreshold(params.threshold);
                        if (params.distType !== undefined) effect.setDistType(params.distType);
                        if (params.mix !== undefined) effect.setMix(params.mix);
                        if (params.postGain !== undefined) effect.setPostGain(params.postGain);
                    } else {
                        // Fallback
                        if (params.distortion !== undefined && effect.distortion !== undefined) {
                            effect.distortion = params.distortion;
                        }
                    }
                    break;

                case 'compressor':
                case 'dynamics':
                    if (effect.setThreshold) {
                        // Custom Compressor
                        if (params.threshold !== undefined) effect.setThreshold(params.threshold);
                        if (params.ratio !== undefined) effect.setRatio(params.ratio);
                        if (params.gain !== undefined) effect.setGain(params.gain);
                        if (params.attack !== undefined) effect.setAttack(params.attack);
                        if (params.release !== undefined) effect.setRelease(params.release);
                        if (params.type !== undefined) effect.setType(params.type);
                    } else {
                        // Fallback
                        if (params.threshold !== undefined && effect.threshold) {
                            effect.threshold.rampTo(params.threshold, 0.1);
                        }
                        if (params.ratio !== undefined && effect.ratio) {
                            effect.ratio.rampTo(params.ratio, 0.1);
                        }
                        if (params.attack !== undefined && effect.attack) {
                            // Convert ms to s if needed, but fallback assumes standard units
                            // We should probably check range. Standard Tone Comp takes seconds.
                            // If params coming from new UI are > 1 (ms), convert.
                            const val = params.attack > 1 ? params.attack / 1000 : params.attack;
                            effect.attack.rampTo(val, 0.1);
                        }
                        if (params.release !== undefined && effect.release) {
                            const val = params.release > 1 ? params.release / 1000 : params.release;
                            effect.release.rampTo(val, 0.1);
                        }
                    }
                    break;

                case 'eq':
                case 'filter':
                    // Expect params like: { bandIndex: 0, freq: 100, gain: 5 }
                    // OR flattened: { b0Freq: 100, ... }
                    // Let's support the flattened style for easier React state mapping

                    // Or check for specific keys
                    if (effect.setBand) {
                        // Custom Parametric EQ
                        for (let i = 0; i < 7; i++) {
                            const prefix = `b${i}`;
                            const update = {};
                            let hasUpdate = false;

                            if (params[`${prefix}Freq`] !== undefined) { update.freq = params[`${prefix}Freq`]; hasUpdate = true; }
                            if (params[`${prefix}Gain`] !== undefined) { update.gain = params[`${prefix}Gain`]; hasUpdate = true; }
                            if (params[`${prefix}BW`] !== undefined) { update.bw = params[`${prefix}BW`]; hasUpdate = true; }
                            if (params[`${prefix}Type`] !== undefined) { update.type = params[`${prefix}Type`]; hasUpdate = true; }
                            if (params[`${prefix}Slope`] !== undefined) { update.slope = params[`${prefix}Slope`]; hasUpdate = true; }

                            if (hasUpdate) {
                                effect.setBand(i, update);
                            }
                        }
                    } else {
                        // Fallback for Tone.EQ3
                        if (params.low !== undefined && effect.low) effect.low.rampTo(params.low, 0.05);
                        if (params.mid !== undefined && effect.mid) effect.mid.rampTo(params.mid, 0.05);
                        if (params.high !== undefined && effect.high) effect.high.rampTo(params.high, 0.05);
                    }
                    break;

                case 'gain':
                case 'utility':
                    if (params.gain !== undefined && effect.setGain) effect.setGain(params.gain);
                    break;

                case 'pan':
                case 'panner':
                    if (params.pan !== undefined && effect.setPan) effect.setPan(params.pan);
                    break;

                default:
                    console.warn(`Unknown effect type for param update: ${type}`);
            }

            // Update wet level if provided
            if (params.wet !== undefined && effect.wet) {
                effect.wet.rampTo(params.wet, 0.1);
            }

            console.log(`Updated effect params for channel ${channelId}, slot ${slotIndex}:`, params);
        } catch (e) {
            console.error('Error updating effect params:', e);
        }
    }

    /**
     * Rebuild the audio routing chain for a channel with effects
     */
    rebuildEffectChain(channelId) {
        const channel = this.channels.get(channelId);
        const source = this.sources.get(channelId);
        const effects = this.channelEffects.get(channelId);

        if (!channel || !source) return;

        // Disconnect source from channel first
        try {
            source.disconnect();
        } catch (e) {
            // May not be connected
        }

        // Get active effects in order
        const activeEffects = effects
            ? effects.filter(e => e && e.node && e.enabled)
            : [];

        if (activeEffects.length === 0) {
            // No effects - connect source directly to channel
            source.connect(channel);
        } else {
            // Chain: source -> effect1 -> effect2 -> ... -> channel
            let prev = source;

            activeEffects.forEach(effectEntry => {
                const node = effectEntry.node;
                try {
                    // Handle disconnect for both standard nodes and wrappers
                    if (node.disconnect) node.disconnect();
                } catch (e) { }

                // Check if the node is a custom wrapper with an input property
                if (node.input) {
                    prev.connect(node.input);
                } else {
                    // Standard Tone.js node
                    prev.connect(node);
                }
                prev = node;
            });

            // Connect last effect to channel
            if (prev.connect) {
                // If wrapper, it has connect method defined
                prev.connect(channel);
            } else {
                // Should not happen if prev is node or wrapper
            }
        }

        console.log(`Rebuilt effect chain for channel ${channelId} with ${activeEffects.length} effects`);
    }

    previewSound(id, time) {
        const source = this.sources.get(id);
        if (source) {
            // Guard: if it's a Sampler and hasn't loaded its buffers yet, skip
            if (source instanceof Tone.Sampler && !source.loaded) {
                console.warn(`Channel ${id} sampler is still loading. Try again in a moment.`);
                return;
            }
            if (source instanceof Tone.NoiseSynth || source.name === 'NoiseSynth') {
                const lastTime = source._lastTriggerTime || 0;
                const scheduleTime = time !== undefined ? Tone.Time(time).toSeconds() : Tone.now();

                let safeTime = scheduleTime;
                if (safeTime <= lastTime) {
                    safeTime = lastTime + 0.001;
                }
                source._lastTriggerTime = safeTime;

                try {
                    source.triggerAttackRelease("8n", safeTime);
                } catch (e) {
                    console.warn("NoiseSynth trigger prevented:", e);
                }
            } else {
                // Pick a suitable preview note for the instrument type
                const channelName = (this.channelNames?.get(id) || '').toLowerCase();
                let previewNote = "C4"; // Default for melodic instruments
                if (channelName.includes('guitar') || channelName.includes('bass')) {
                    previewNote = "E2"; // Open low-E string
                } else if (channelName.includes('kick') || channelName.includes('drum')) {
                    previewNote = "C2";
                }
                try {
                    source.triggerAttackRelease(previewNote, "8n", time || Tone.now(), 0.78);
                } catch (e) {
                    console.warn("previewSound trigger prevented:", e);
                }
            }
        }
    }


    previewNote(noteName, duration = "8n", time) {
        if (this.previewSynth && noteName) {
            this.previewSynth.triggerAttackRelease(noteName, duration, time || Tone.now());
        }
    }

    previewChannelNote(channelId, noteName, duration = "8n", time, velocity = 0.78) {
        const source = this.sources.get(channelId);
        if (source) {
            // Guard: if it's a Sampler and hasn't loaded its buffers yet, skip gracefully
            if (source instanceof Tone.Sampler && !source.loaded) {
                console.warn(`Channel ${channelId} sampler is still loading buffers. Try again in a moment.`);
                return;
            }

            const vel = Math.max(0, Math.min(1, velocity));

            if (source instanceof Tone.NoiseSynth || source.name === 'NoiseSynth') {
                const lastTime = source._lastTriggerTime || 0;
                const scheduleTime = time !== undefined ? Tone.Time(time).toSeconds() : Tone.now();

                let safeTime = scheduleTime;
                if (safeTime <= lastTime) {
                    safeTime = lastTime + 0.001;
                }
                source._lastTriggerTime = safeTime;

                try {
                    source.triggerAttackRelease(duration, safeTime, vel);
                } catch (e) {
                    console.warn("NoiseSynth channel trigger prevented:", e);
                }
            } else {
                try {
                    source.triggerAttackRelease(noteName || "C2", duration, time || Tone.now(), vel);
                } catch (e) {
                    console.warn("previewChannelNote trigger prevented:", e);
                }
            }
        }
    }

    /**
     * Render the project to an offline audio context for export
     * This method is called within Tone.Offline context
     */
    async renderOffline(transport, playlistTracks, patterns, channels, audioClips = [], automations = [], duration) {
        // Create offline versions of channels and sources
        const offlineChannels = new Map();
        const offlineSources = new Map();
        const offlineAudioPlayers = new Map();

        // Create channels for offline context
        for (const channel of channels) {
            const offlineChannel = new Tone.Channel({
                volume: -6,
                pan: 0,
            }).toDestination();
            offlineChannels.set(channel.id, offlineChannel);

            // Create source based on channel name (synth fallbacks for offline — no CDN)
            let source;
            const n = (channel.name || '').toLowerCase();

            if (n.includes('kick')) {
                source = new Tone.PolySynth(Tone.MembraneSynth).connect(offlineChannel);
            } else if (n.includes('snare')) {
                source = new Tone.NoiseSynth({
                    noise: { type: 'white' },
                    envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.05 }
                }).connect(offlineChannel);
            } else if (n.includes('clap')) {
                source = new Tone.NoiseSynth({
                    noise: { type: 'white' },
                    envelope: { attack: 0.001, decay: 0.15, sustain: 0 }
                }).connect(offlineChannel);
            } else if (n.includes('hat') || n.includes('cymbal')) {
                source = new Tone.PolySynth(Tone.MetalSynth, {
                    frequency: 400, harmonicity: 5.1, modulationIndex: 32,
                    envelope: { attack: 0.001, decay: 0.08, release: 0.01 },
                    volume: -8
                }).connect(offlineChannel);
            } else if (n.includes('piano')) {
                source = new Tone.PolySynth(Tone.Synth, {
                    oscillator: { type: 'triangle' },
                    envelope: { attack: 0.005, decay: 0.8, sustain: 0.2, release: 1.5 },
                    volume: -4
                }).connect(offlineChannel);
            } else if (n.includes('violin')) {
                source = new Tone.PolySynth(Tone.AMSynth, {
                    maxPolyphony: 8, harmonicity: 2, oscillator: { type: 'sawtooth' },
                    envelope: { attack: 0.1, decay: 0.3, sustain: 0.8, release: 0.5 },
                    modulation: { type: 'sine' },
                    modulationEnvelope: { attack: 0.3, decay: 0.2, sustain: 0.8, release: 0.5 }
                }).connect(offlineChannel);
            } else if (n.includes('cello') || n.includes('string')) {
                source = new Tone.PolySynth(Tone.AMSynth, {
                    maxPolyphony: 8, harmonicity: 1.5, oscillator: { type: 'sawtooth' },
                    envelope: { attack: 0.15, decay: 0.4, sustain: 0.8, release: 0.6 },
                    modulation: { type: 'sine' },
                    modulationEnvelope: { attack: 0.4, decay: 0.3, sustain: 0.7, release: 0.6 }
                }).connect(offlineChannel);
            } else if (n.includes('contrabass')) {
                source = new Tone.PolySynth(Tone.Synth, {
                    maxPolyphony: 8, oscillator: { type: 'sawtooth' },
                    envelope: { attack: 0.15, decay: 0.5, sustain: 0.7, release: 0.8 }, volume: -2
                }).connect(offlineChannel);
            } else if (n.includes('flute')) {
                source = new Tone.PolySynth(Tone.Synth, {
                    maxPolyphony: 8, oscillator: { type: 'sine' },
                    envelope: { attack: 0.05, decay: 0.15, sustain: 0.8, release: 0.3 }, volume: -2
                }).connect(offlineChannel);
            } else if (n.includes('clarinet')) {
                source = new Tone.PolySynth(Tone.Synth, {
                    maxPolyphony: 8, oscillator: { type: 'square' },
                    envelope: { attack: 0.05, decay: 0.2, sustain: 0.7, release: 0.3 }, volume: -6
                }).connect(offlineChannel);
            } else if (n.includes('bassoon')) {
                source = new Tone.PolySynth(Tone.Synth, {
                    maxPolyphony: 8, oscillator: { type: 'sawtooth' },
                    envelope: { attack: 0.08, decay: 0.3, sustain: 0.7, release: 0.4 }, volume: -4
                }).connect(offlineChannel);
            } else if (n.includes('saxophone') || n.includes('sax')) {
                source = new Tone.PolySynth(Tone.MonoSynth, {
                    maxPolyphony: 8, oscillator: { type: 'square' },
                    filter: { Q: 2, type: 'lowpass', rolloff: -12 },
                    filterEnvelope: { attack: 0.02, decay: 0.2, sustain: 0.6, release: 0.3, baseFrequency: 400, octaves: 2 },
                    envelope: { attack: 0.03, decay: 0.2, sustain: 0.7, release: 0.3 }
                }).connect(offlineChannel);
            } else if (n.includes('trumpet')) {
                source = new Tone.PolySynth(Tone.FMSynth, {
                    maxPolyphony: 8, harmonicity: 1, modulationIndex: 3,
                    oscillator: { type: 'sawtooth' },
                    envelope: { attack: 0.02, decay: 0.2, sustain: 0.7, release: 0.3 },
                    modulation: { type: 'square' },
                    modulationEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.3 }
                }).connect(offlineChannel);
            } else if (n.includes('trombone')) {
                source = new Tone.PolySynth(Tone.FMSynth, {
                    maxPolyphony: 8, harmonicity: 0.5, modulationIndex: 2,
                    oscillator: { type: 'sawtooth' },
                    envelope: { attack: 0.04, decay: 0.3, sustain: 0.7, release: 0.4 },
                    modulation: { type: 'square' },
                    modulationEnvelope: { attack: 0.02, decay: 0.3, sustain: 0.5, release: 0.4 }
                }).connect(offlineChannel);
            } else if (n.includes('tuba')) {
                source = new Tone.PolySynth(Tone.FMSynth, {
                    maxPolyphony: 8, harmonicity: 0.5, modulationIndex: 1.5,
                    oscillator: { type: 'sawtooth' },
                    envelope: { attack: 0.06, decay: 0.4, sustain: 0.7, release: 0.5 },
                    modulation: { type: 'sine' },
                    modulationEnvelope: { attack: 0.05, decay: 0.4, sustain: 0.5, release: 0.5 }, volume: -2
                }).connect(offlineChannel);
            } else if (n.includes('french') && n.includes('horn')) {
                source = new Tone.PolySynth(Tone.FMSynth, {
                    maxPolyphony: 8, harmonicity: 1, modulationIndex: 2,
                    oscillator: { type: 'sawtooth' },
                    envelope: { attack: 0.05, decay: 0.3, sustain: 0.7, release: 0.4 },
                    modulation: { type: 'sine' },
                    modulationEnvelope: { attack: 0.04, decay: 0.3, sustain: 0.5, release: 0.4 }
                }).connect(offlineChannel);
            } else if (n.includes('organ')) {
                source = new Tone.PolySynth(Tone.FMSynth, {
                    maxPolyphony: 16, harmonicity: 2, modulationIndex: 1,
                    oscillator: { type: 'sine' },
                    envelope: { attack: 0.01, decay: 0.1, sustain: 0.9, release: 0.3 },
                    modulation: { type: 'sine' },
                    modulationEnvelope: { attack: 0.01, decay: 0.1, sustain: 0.9, release: 0.3 }
                }).connect(offlineChannel);
            } else if (n.includes('harmonium')) {
                source = new Tone.PolySynth(Tone.FMSynth, {
                    maxPolyphony: 8, harmonicity: 2, modulationIndex: 1.5,
                    oscillator: { type: 'sine' },
                    envelope: { attack: 0.05, decay: 0.2, sustain: 0.85, release: 0.4 },
                    modulation: { type: 'sine' },
                    modulationEnvelope: { attack: 0.05, decay: 0.2, sustain: 0.8, release: 0.4 }
                }).connect(offlineChannel);
            } else if (n.includes('harp')) {
                source = new Tone.PolySynth(Tone.Synth, {
                    maxPolyphony: 16, oscillator: { type: 'triangle' },
                    envelope: { attack: 0.002, decay: 1.2, sustain: 0, release: 1.5 }, volume: -2
                }).connect(offlineChannel);
            } else if (n.includes('xylophone')) {
                source = new Tone.PolySynth(Tone.Synth, {
                    maxPolyphony: 16, oscillator: { type: 'sine' },
                    envelope: { attack: 0.001, decay: 0.5, sustain: 0, release: 0.3 }, volume: -4
                }).connect(offlineChannel);
            } else if (n.includes('bass')) {
                source = new Tone.PolySynth(Tone.MonoSynth, {
                    oscillator: { type: 'square' },
                    filter: { Q: 2, type: 'lowpass', rolloff: -24 },
                    filterEnvelope: { attack: 0.01, decay: 0.15, sustain: 0.5, release: 0.5, baseFrequency: 200, octaves: 2.5 },
                    envelope: { attack: 0.03, decay: 0.2, sustain: 0.7, release: 0.4 }
                }).connect(offlineChannel);
            } else if (n.includes('guitar')) {
                source = new Tone.PolySynth(Tone.Synth, { maxPolyphony: 8 }).connect(offlineChannel);
                source.set({
                    oscillator: { type: 'sawtooth' },
                    envelope: { attack: 0.003, decay: 0.15, sustain: 0.55, release: 1.2 }
                });
                source.volume.value = 4;
                try {
                    const ogSat = new Tone.Chebyshev(3);
                    const ogFilter = new Tone.Filter(4500, 'lowpass');
                    source.connect(ogSat);
                    ogSat.connect(ogFilter);
                    ogFilter.connect(offlineChannel);
                    ogSat.wet.value = 0.5;
                } catch (e) { /* direct already connected */ }
            } else {
                source = new Tone.PolySynth(Tone.Synth).connect(offlineChannel);
            }

            offlineSources.set(channel.id, source);
        }

        // Preload audio clips
        const audioPlayerPromises = [];
        for (const audioClip of audioClips) {
            if (audioClip.url || audioClip.audioBuffer) {
                const loadPromise = new Promise((resolve) => {
                    let player;
                    if (audioClip.audioBuffer) {
                        player = new Tone.Player(audioClip.audioBuffer).toDestination();
                        player.volume.value = -6;
                        offlineAudioPlayers.set(audioClip.id, player);
                        resolve();
                    } else {
                        player = new Tone.Player({
                            url: audioClip.url,
                            onload: () => {
                                player.volume.value = -6;
                                offlineAudioPlayers.set(audioClip.id, player);
                                resolve();
                            },
                            onerror: () => resolve() // Continue even if load fails
                        }).toDestination();
                    }
                });
                audioPlayerPromises.push(loadPromise);
            }
        }

        // Wait for all audio to load
        await Promise.all(audioPlayerPromises);

        // Helper function for triggering sounds
        const triggerSound = (id, time) => {
            const source = offlineSources.get(id);
            if (source) {
                if (source instanceof Tone.NoiseSynth || source.name === 'NoiseSynth') {
                    try {
                        source.triggerAttackRelease("8n", time);
                    } catch (e) { }
                } else {
                    source.triggerAttackRelease("C2", "8n", time);
                }
            }
        };

        const triggerNote = (channelId, noteName, dur, time) => {
            const source = offlineSources.get(channelId);
            if (source) {
                if (source instanceof Tone.NoiseSynth || source.name === 'NoiseSynth') {
                    try {
                        source.triggerAttackRelease(dur, time);
                    } catch (e) { }
                } else {
                    source.triggerAttackRelease(noteName || "C2", dur, time);
                }
            }
        };

        // Schedule all tracks
        playlistTracks.forEach(track => {
            if (track.muted) return;

            track.clips.forEach(clip => {
                // Handle audio clips
                if (clip.type === 'audio') {
                    const player = offlineAudioPlayers.get(clip.audioClipId);
                    if (player && player.loaded) {
                        const clipStartTime = this._beatsToSeconds(clip.offset);
                        const clipDuration = this._beatsToSeconds(clip.length);
                        const startOffset = clip.startOffset ? this._beatsToSeconds(clip.startOffset) : 0;

                        transport.schedule((time) => {
                            player.start(time, startOffset, clipDuration);
                        }, clipStartTime);
                    }
                    return;
                }

                // Handle pattern clips
                const pattern = patterns.find(p => p.id === clip.patternId);
                if (!pattern) return;

                const clipPlaylistStartStep = (clip.offset || 0) * 4;
                const clipInnerStartStep = (clip.startOffset || 0) * 4;
                const clipLengthSteps = (clip.length || 0) * 4;

                // Schedule Steps (Drums)
                Object.entries(pattern.data.steps).forEach(([channelId, steps]) => {
                    const id = parseInt(channelId);
                    steps.forEach((isActive, index) => {
                        if (isActive && index >= clipInnerStartStep && index < (clipInnerStartStep + clipLengthSteps)) {
                            const relativeStepIndex = index - clipInnerStartStep;
                            const playlistStepIndex = clipPlaylistStartStep + relativeStepIndex;

                            const bar = Math.floor(playlistStepIndex / 16);
                            const beat = Math.floor((playlistStepIndex % 16) / 4);
                            const sixteen = playlistStepIndex % 4;
                            const time = `${bar}:${beat}:${sixteen}`;

                            transport.schedule((t) => {
                                triggerSound(id, t);
                            }, time);
                        }
                    });
                });

                // Schedule Notes (Piano Roll)
                pattern.data.notes.forEach(note => {
                    if (!note.noteName) return;

                    if (note.startStep >= clipInnerStartStep && note.startStep < (clipInnerStartStep + clipLengthSteps)) {
                        const relativeStepIndex = note.startStep - clipInnerStartStep;
                        const playlistStepIndex = clipPlaylistStartStep + relativeStepIndex;

                        const bar = Math.floor(playlistStepIndex / 16);
                        const beat = Math.floor((playlistStepIndex % 16) / 4);
                        const sixteen = playlistStepIndex % 4;
                        const time = `${bar}:${beat}:${sixteen}`;

                        const stepsUntilClipEnd = (clipInnerStartStep + clipLengthSteps) - note.startStep;
                        const durationStep = Math.min(note.length, stepsUntilClipEnd);

                        const dBar = Math.floor(durationStep / 16);
                        const dBeat = Math.floor((durationStep % 16) / 4);
                        const dSixteen = durationStep % 4;
                        const dur = `${dBar}:${dBeat}:${dSixteen}`;

                        transport.schedule((t) => {
                            const targetChannelId = note.channelId !== undefined ? note.channelId : undefined;
                            if (targetChannelId !== undefined) {
                                triggerNote(targetChannelId, note.noteName, dur, t);
                            } else {
                                // Use preview synth equivalent
                                const defaultSource = offlineSources.values().next().value;
                                if (defaultSource && defaultSource.triggerAttackRelease) {
                                    defaultSource.triggerAttackRelease(note.noteName, dur, t);
                                }
                            }
                        }, time);
                    }
                });
            });
        });

        // Start transport
        transport.start(0);
    }
}

export const audioEngine = new AudioEngine();

