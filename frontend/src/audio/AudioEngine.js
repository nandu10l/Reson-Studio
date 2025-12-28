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
            // Pause Transport - this pauses scheduled events
            Tone.Transport.pause();
            
            // Stop all currently playing audio players
            // Transport.pause() doesn't stop players that are already playing
            this.audioPlayers.forEach((player) => {
                try {
                    // Check if player is actually playing
                    if (player && (player.state === 'started' || player.loaded)) {
                        player.stop();
                    }
                } catch (error) {
                    // Ignore errors if player can't be stopped
                    console.warn('Error stopping audio player on pause:', error);
                }
            });
            
            // Release all active synth notes (these should stop immediately)
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
                            this.previewSound(id);
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
                    const clipStartTime = Tone.Time(`${clip.offset}q`).toSeconds();
                    const clipEndTime = clipStartTime + Tone.Time(`${clip.length}q`).toSeconds();
                    const currentTime = Tone.Transport.seconds;
                    
                    // Only schedule if clip hasn't finished playing yet
                    if (clipEndTime > currentTime) {
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

                        if (player) {
                            // Calculate when to start playback
                            let playStartTime = clipStartTime;
                            let playOffset = 0; // Offset into the audio file
                            
                            // If clip has already started, calculate offset
                            if (currentTime > clipStartTime && currentTime < clipEndTime) {
                                playStartTime = currentTime; // Start now
                                playOffset = currentTime - clipStartTime; // Offset into audio
                            }
                            
                            const remainingDuration = clipEndTime - playStartTime;
                            
                            // Schedule audio playback
                            Tone.Transport.schedule((t) => {
                                try {
                                    // Tone.js Player.start() internally calls restart() which requires the player to be started first
                                    // To avoid the 'start must be called before stop' error, we need to handle the state carefully
                                    const playerState = player.state;
                                    
                                    // If player is started, stop it first before restarting
                                    if (playerState === 'started') {
                                        player.stop();
                                    }
                                    
                                    // Use a small delay if we stopped the player to ensure state is clean
                                    const startAudio = () => {
                                        try {
                                            if (playOffset > 0) {
                                                // Resume from offset - use start() with offset parameter
                                                player.start(t, playOffset, remainingDuration);
                                            } else {
                                                // Start from beginning
                                                player.start(t, 0, remainingDuration);
                                            }
                                        } catch (startError) {
                                            // If start fails (e.g., player in invalid state), try to reset and start
                                            console.warn('Error starting player, attempting reset:', startError);
                                            try {
                                                // Try starting with minimal parameters
                                                player.start(t);
                                            } catch (finalError) {
                                                console.error('Failed to start audio player after all attempts:', finalError);
                                            }
                                        }
                                    };
                                    
                                    if (playerState === 'started') {
                                        // Small delay to ensure stop completes before restart
                                        setTimeout(startAudio, 5);
                                    } else {
                                        // Player is not started, safe to start directly
                                        startAudio();
                                    }
                                } catch (error) {
                                    console.error('Error in audio playback schedule:', error);
                                }
                            }, playStartTime);
                        }
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
