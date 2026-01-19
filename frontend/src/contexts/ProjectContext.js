import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { audioEngine } from '../audio/AudioEngine';
import { pickAudioFile, decodeAudioFile, generateWaveform, audioDurationToBeats } from '../utils/audioImport';
import * as Tone from 'tone';

const ProjectContext = createContext();

export const useProject = () => {
    const context = useContext(ProjectContext);
    if (!context) {
        throw new Error('useProject must be used within a ProjectProvider');
    }
    return context;
};

const INITIAL_CHANNELS = [
    { id: 0, name: 'Grand Piano', vol: 78, pan: 50, effects: [] },
    { id: 1, name: '808 Kick', vol: 78, pan: 50, effects: [] },
    { id: 2, name: '808 Clap', vol: 78, pan: 50, effects: [] },
    { id: 3, name: '808 HiHat', vol: 78, pan: 50, effects: [] },
    { id: 4, name: '808 Snare', vol: 78, pan: 50, effects: [] },
    { id: 5, name: 'FLEX Bass', vol: 78, pan: 50, effects: [] },
];

const createEmptySteps = (length = 16) => {
    const steps = {};
    INITIAL_CHANNELS.forEach(ch => {
        steps[ch.id] = Array(length).fill(false);
    });
    return steps;
};

export const ProjectProvider = ({ children }) => {
    // --- State ---

    // 1. Patterns
    const [patterns, setPatterns] = useState([
        {
            id: 1,
            name: 'Pattern 1',
            color: '#4C8DB0',
            length: 16,
            data: {
                steps: createEmptySteps(16),
                notes: []
            }
        }
    ]);

    const [activePatternId, setActivePatternId] = useState(1);

    // 2. Channels (Instruments)
    const [channels, setChannels] = useState(INITIAL_CHANNELS);

    // 3. Playlist / Arrangement
    const [playlistTracks, setPlaylistTracks] = useState(
        Array(10).fill(null).map((_, i) => ({ id: i + 1, name: `Track ${i + 1}`, clips: [], muted: false, solo: false }))
    );

    // 4. Audio Clips (imported audio files)
    const [audioClips, setAudioClips] = useState([]);

    // 7. Automation Data
    const [automations, setAutomations] = useState([]); // Array of automation objects
    const [activeClipType, setActiveClipType] = useState('pattern'); // 'pattern' | 'audio' | 'automation'
    const [activeAudioClipId, setActiveAudioClipId] = useState(null);
    const [activeAutomationId, setActiveAutomationId] = useState(null);

    // 5. Picker Tab State (PAT/AUDIO/AUTO)
    const [pickerTab, setPickerTab] = useState('PAT');

    // 6. Loading State
    const [isImportingAudio, setIsImportingAudio] = useState(false);

    const [activeTool, setActiveTool] = useState('pencil');
    const [isPlaying, setIsPlaying] = useState(false);
    const [bpm, setBpm] = useState(120);
    const [playbackMode, setPlaybackMode] = useState('PAT'); // 'PAT' | 'SONG'
    const [isRecording, setIsRecording] = useState(false);
    const [playheadPosition, setPlayheadPosition] = useState(0); // Position in beats
    const playheadIntervalRef = useRef(null);
    const [currentProjectPath, setCurrentProjectPath] = useState(null);
    const needsScheduling = useRef(true);

    // Audio Recording Refs
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const recordingStartTimeRef = useRef(0);



    const loadProject = useCallback((data) => {
        if (!data) return;
        try {
            if (data.patterns) setPatterns(data.patterns);
            if (data.channels) setChannels(data.channels);
            if (data.playlistTracks) setPlaylistTracks(data.playlistTracks);
            if (data.bpm) {
                setBpm(data.bpm);
                audioEngine.setBpm(data.bpm);
            }
            if (data.activePatternId) setActivePatternId(data.activePatternId);
            console.log('Project loaded successfully');
        } catch (error) {
            console.error('Error loading project data:', error);
        }
    }, []);


    // --- Actions ---

    const createPattern = useCallback(() => {
        setPatterns(prev => {
            const nextId = Math.max(...prev.map(p => p.id)) + 1;
            const newPattern = {
                id: nextId,
                name: `Pattern ${nextId}`,
                color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
                length: 16,
                data: {
                    steps: createEmptySteps(16),
                    notes: []
                }
            };
            setActivePatternId(nextId);
            return [...prev, newPattern];
        });
    }, []);

    const updatePattern = useCallback((patternId, updates) => {
        setPatterns(prev => prev.map(p =>
            p.id === patternId ? { ...p, ...updates } : p
        ));
    }, []);

    const toggleStepInActivePattern = useCallback((channelId, stepIndex) => {
        setPatterns(prev => prev.map(p => {
            if (p.id === activePatternId) {
                const currentSteps = p.data.steps[channelId] || Array(p.length).fill(false);
                const newSteps = [...currentSteps];
                newSteps[stepIndex] = !newSteps[stepIndex];

                return {
                    ...p,
                    data: {
                        ...p.data,
                        steps: {
                            ...p.data.steps,
                            [channelId]: newSteps
                        }
                    }
                };
            }
            return p;
        }));
    }, [activePatternId]);

    const resizeActivePattern = useCallback((newLength) => {
        setPatterns(prev => prev.map(p => {
            if (p.id === activePatternId) {
                if (p.length === newLength) return p;

                // Create new step arrays for each channel
                const newSteps = {};
                INITIAL_CHANNELS.forEach(ch => {
                    const currentChannelSteps = p.data.steps[ch.id] || [];
                    const newChannelSteps = Array(newLength).fill(false);

                    // Copy existing steps
                    for (let i = 0; i < Math.min(currentChannelSteps.length, newLength); i++) {
                        newChannelSteps[i] = currentChannelSteps[i];
                    }
                    newSteps[ch.id] = newChannelSteps;
                });

                return {
                    ...p,
                    length: newLength,
                    data: {
                        ...p.data,
                        steps: newSteps
                    }
                };
            }
            return p;
        }));
    }, [activePatternId]);

    const addNoteToActivePattern = useCallback((note) => {
        setPatterns(prev => prev.map(p => {
            if (p.id === activePatternId) {
                // Check if we need to extend pattern
                const noteEnd = note.startStep + note.length;
                let newLength = p.length;

                if (noteEnd > p.length) {
                    // Expand to next full bar (multiple of 16)
                    newLength = Math.ceil(noteEnd / 16) * 16;
                }

                return {
                    ...p,
                    length: newLength,
                    data: {
                        ...p.data,
                        notes: [...p.data.notes, note]
                    }
                };
            }
            return p;
        }));
    }, [activePatternId]);

    const removeNoteFromActivePattern = useCallback((noteId) => {
        setPatterns(prev => prev.map(p => {
            if (p.id === activePatternId) {
                return {
                    ...p,
                    data: {
                        ...p.data,
                        notes: p.data.notes.filter(n => n.id !== noteId)
                    }
                };
            }
            return p;
        }));
    }, [activePatternId]);

    // Initialize Audio Engine
    React.useEffect(() => {
        const initAudio = async () => {
            // Initialize engine (user interaction might be needed for full start, 
            // but we can prepare channels)
            INITIAL_CHANNELS.forEach(ch => {
                audioEngine.createChannel(ch.id, ch.name);
                // Sync initial values
                audioEngine.updateChannelVolume(ch.id, ch.vol);
                audioEngine.updateChannelPan(ch.id, ch.pan);
            });
        };
        initAudio();
    }, []);

    // --- Actions ---

    // Note Actions
    const updateNote = useCallback((noteId, changes) => {
        setPatterns(prev => prev.map(p => {
            if (p.id === activePatternId) {
                // Calculate potential new length requirement
                // We need to find the specific note being updated to know its new position
                const note = p.data.notes.find(n => n.id === noteId);
                if (!note) return p;

                const updatedNote = { ...note, ...changes };
                const noteEnd = updatedNote.startStep + updatedNote.length;

                let newLength = p.length;
                if (noteEnd > p.length) {
                    newLength = Math.ceil(noteEnd / 16) * 16;
                }

                return {
                    ...p,
                    length: newLength,
                    data: {
                        ...p.data,
                        notes: p.data.notes.map(n =>
                            n.id === noteId ? updatedNote : n
                        )
                    }
                };
            }
            return p;
        }));
    }, [activePatternId]);

    const deleteNotes = useCallback((noteIds) => {
        setPatterns(prev => prev.map(p => {
            if (p.id === activePatternId) {
                return {
                    ...p,
                    data: {
                        ...p.data,
                        notes: p.data.notes.filter(n => !noteIds.includes(n.id))
                    }
                };
            }
            return p;
        }));
    }, [activePatternId]);

    // Track Actions
    const toggleTrackMute = useCallback((trackId) => {
        setPlaylistTracks(prev => prev.map(t =>
            t.id === trackId ? { ...t, muted: !t.muted } : t
        ));
    }, []);

    const toggleTrackSolo = useCallback((trackId) => {
        setPlaylistTracks(prev => prev.map(t =>
            t.id === trackId ? { ...t, solo: !t.solo } : t
        ));
    }, []);

    // Optimization: Track if scheduling is needed
    // (needsScheduling ref moved to top)

    // Mark scheduling needed when data changes
    useEffect(() => {
        needsScheduling.current = true;
    }, [playlistTracks, patterns, audioClips, bpm, activePatternId, playbackMode]);

    // Transport Actions
    const togglePlayback = useCallback(async () => {
        await audioEngine.init();
        if (isPlaying) {
            // Pause playback
            audioEngine.pause();
            setIsPlaying(false);
        } else {
            // Start or resume playback from current playhead position
            const transportState = Tone.Transport.state;
            const isPaused = transportState === 'paused';

            // Seek Transport to current playhead position (in seconds)
            const beatsPerSecond = bpm / 60;
            const currentTimeSeconds = playheadPosition / beatsPerSecond;
            Tone.Transport.seconds = currentTimeSeconds;

            // Always reschedule to ensure audio (which is un-synced) restarts correctly
            // even after a Pause. 
            if (playbackMode === 'SONG') {
                audioEngine.schedulePlaylist(playlistTracks, patterns, audioClips, automations, currentTimeSeconds);
            } else if (playbackMode === 'PAT') {
                const activePattern = patterns.find(p => p.id === activePatternId);
                if (activePattern) {
                    audioEngine.schedulePattern(activePattern);
                }
            }
            needsScheduling.current = false;

            audioEngine.start();
            setIsPlaying(true);
        }
    }, [isPlaying, playbackMode, playlistTracks, patterns, audioClips, activePatternId, playheadPosition, bpm]);

    const seek = useCallback((beats) => {
        const safeBeats = Math.max(0, beats);
        setPlayheadPosition(safeBeats);

        const seconds = safeBeats * (60 / bpm);


        if (isPlaying) {
            // Robust Scrubbing: Pause -> Move -> Schedule -> Resume
            // This prevents Tone.js from getting confused with immediate scheduling events during playback
            const wasPlaying = Tone.Transport.state === 'started';

            if (wasPlaying) {
                Tone.Transport.pause();
            }

            Tone.Transport.seconds = seconds;
            if (playbackMode === 'SONG') {
                audioEngine.schedulePlaylist(playlistTracks, patterns, audioClips, automations, seconds);
            } else if (playbackMode === 'PAT') {
                // In Pattern mode, we just ensure the pattern is scheduled and loop is active
                // We don't need manual audio clip handling, but we should ensure synth scheduling
                const activePattern = patterns.find(p => p.id === activePatternId);
                if (activePattern) {
                    audioEngine.schedulePattern(activePattern);
                }
            }

            if (wasPlaying) {
                Tone.Transport.start();
            }
        } else {
            // If paused, ensure we reschedule on next Play
            needsScheduling.current = true;
            // Stop engine first (which resets Transport to 0)
            audioEngine.stop();
            // THEN set the correct position
            Tone.Transport.seconds = seconds;
        }
    }, [bpm, isPlaying, playlistTracks, patterns, audioClips, playbackMode, activePatternId]);

    const stopPlayback = useCallback(() => {
        audioEngine.stop();
        setIsPlaying(false);
        setPlayheadPosition(0);
        Tone.Transport.seconds = 0; // Ensure transport resets
    }, []);

    // Track playhead position during playback
    // (Removed high-frequency setInterval to prevent global re-renders. 
    // Consumers should use local rAF loops or read Tone.Transport.seconds directly for animation)
    useEffect(() => {
        // Sync playhead state when transport state changes (e.g. Stop/Pause)
        const syncInterval = setInterval(() => {
            if (!isPlaying) {
                // Ensure we capture final position after stop/pause
                const positionSeconds = Tone.Transport.seconds;
                const beatsPerSecond = bpm / 60;
                const positionBeats = positionSeconds * beatsPerSecond;
                // Only update if significantly different to avoid loops
                if (Math.abs(positionBeats - playheadPosition) > 0.01) {
                    setPlayheadPosition(positionBeats);
                }
            }
        }, 200); // Low frequency check for idle state

        return () => clearInterval(syncInterval);
    }, [isPlaying, bpm, playheadPosition]);

    // --- Audio Recording Logic ---
    useEffect(() => {
        const startRecording = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const mediaRecorder = new MediaRecorder(stream);
                mediaRecorderRef.current = mediaRecorder;
                audioChunksRef.current = [];
                recordingStartTimeRef.current = playheadPosition;

                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        audioChunksRef.current.push(event.data);
                    }
                };

                mediaRecorder.onstop = async () => {
                    const mimeType = mediaRecorder.mimeType || 'audio/webm';
                    const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
                    const extension = mimeType.includes('wav') ? 'wav' : (mimeType.includes('mp4') ? 'm4a' : 'webm');
                    const file = new File([audioBlob], `Recording_${Date.now()}.${extension}`, { type: mimeType });

                    try {
                        const audioBuffer = await decodeAudioFile(file);
                        const waveform = generateWaveform(audioBuffer, 2000);
                        const durationBeats = audioDurationToBeats(audioBuffer, bpm);

                        const audioClip = {
                            id: Date.now(),
                            fileName: file.name,
                            name: `Rec ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
                            file: file,
                            audioBuffer: audioBuffer,
                            waveform: waveform,
                            duration: audioBuffer.duration,
                            durationBeats: durationBeats,
                            sampleRate: audioBuffer.sampleRate,
                            url: URL.createObjectURL(file)
                        };

                        setAudioClips(prev => [...prev, audioClip]);

                        // Add to playlist
                        const startPos = recordingStartTimeRef.current;
                        const targetTrack = playlistTracks.find(t => t.clips.length === 0) || playlistTracks[0];

                        if (targetTrack) {
                            const newClip = {
                                id: Date.now() + 1,
                                type: 'audio',
                                audioClipId: audioClip.id,
                                offset: startPos,
                                length: durationBeats,
                                name: audioClip.name
                            };

                            setPlaylistTracks(prev => prev.map(t =>
                                t.id === targetTrack.id
                                    ? { ...t, clips: [...t.clips, newClip] }
                                    : t
                            ));
                        }
                    } catch (err) {
                        console.error("Error processing recorded audio:", err);
                    }

                    // Stop all tracks in the stream
                    stream.getTracks().forEach(track => track.stop());
                };

                mediaRecorder.start();
                console.log("Recording started...");
            } catch (err) {
                console.error("Failed to start recording:", err);
                setIsRecording(false);
                alert("Microphone access denied or error occurred.");
            }
        };

        if (isRecording) {
            startRecording();
        } else if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            console.log("Recording stopped.");
        }
    }, [isRecording]);

    const updateBpm = useCallback((newBpm) => {
        setBpm(newBpm);
        audioEngine.setBpm(newBpm);
    }, []);



    // ... (patterns logic)

    // Mixer Actions
    const updateChannelVolume = useCallback((channelId, volume) => {
        // Update Audio Engine
        audioEngine.updateChannelVolume(channelId, volume);

        // Update UI State
        setChannels(prev => prev.map(ch =>
            ch.id === channelId ? { ...ch, vol: volume } : ch
        ));
    }, []);

    const updateChannelPan = useCallback((channelId, pan) => {
        // Update Audio Engine
        audioEngine.updateChannelPan(channelId, pan);

        // Update UI State
        setChannels(prev => prev.map(ch =>
            ch.id === channelId ? { ...ch, pan: pan } : ch
        ));
    }, []);

    const addChannel = useCallback((plugin) => {
        setChannels(prev => {
            const nextId = Math.max(...prev.map(c => c.id), -1) + 1;
            const newChannel = {
                id: nextId,
                name: plugin.name,
                vol: 80,
                pan: 50,
                effects: [], // Initialize with empty effects
                pluginId: plugin.id // Store reference to plugin type
            };

            // Also need to initialize steps for this new channel in all patterns
            setPatterns(prevPatterns => prevPatterns.map(pat => {
                const newSteps = { ...pat.data.steps };
                newSteps[nextId] = Array(pat.length).fill(false);
                return {
                    ...pat,
                    data: {
                        ...pat.data,
                        steps: newSteps
                    }
                };
            }));

            // Register with audio engine
            audioEngine.createChannel(nextId, newChannel.name);

            return [...prev, newChannel];
        });
    }, []);

    const addEffect = useCallback((channelId, plugin) => {
        setChannels(prev => prev.map(ch => {
            if (ch.id === channelId) {
                const newEffect = {
                    id: Date.now(),
                    name: plugin.name,
                    pluginId: plugin.id,
                    type: plugin.type,
                    active: true
                };
                return { ...ch, effects: [...(ch.effects || []), newEffect] };
            }
            return ch;
        }));
        // Audio Engine TODO: audioEngine.addEffect(channelId, plugin);
        console.log(`Added effect ${plugin.name} to channel ${channelId}`);
    }, []);

    // Preview Note Action
    const previewChannelSound = useCallback(async (channelId) => {
        await audioEngine.init(); // Ensure context is started
        audioEngine.previewSound(channelId);
    }, []);

    const previewPianoNote = useCallback(async (noteName, channelId) => {
        await audioEngine.init();
        if (channelId !== null && channelId !== undefined) {
            audioEngine.previewChannelNote(channelId, noteName);
        } else {
            audioEngine.previewNote(noteName);
        }
    }, []);

    // Audio Import Action
    const importAudioFile = useCallback(async () => {
        try {
            setIsImportingAudio(true);
            const file = await pickAudioFile();
            if (!file) {
                setIsImportingAudio(false);
                return;
            }

            // Show loading indicator
            console.log('Importing audio file:', file.name);

            // Decode audio
            const audioBuffer = await decodeAudioFile(file);

            // Generate waveform - use more samples for better accuracy
            // Calculate samples based on duration: ~100 samples per second, min 2000
            const samplesPerSecond = 100;
            const targetSamples = Math.max(2000, Math.floor(audioBuffer.duration * samplesPerSecond));
            const waveform = generateWaveform(audioBuffer, targetSamples);

            // Calculate duration in beats
            const durationBeats = audioDurationToBeats(audioBuffer, bpm);

            // Create audio clip object
            const audioClip = {
                id: Date.now(),
                fileName: file.name,
                name: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
                file: file,
                audioBuffer: audioBuffer,
                waveform: waveform,
                duration: audioBuffer.duration,
                durationBeats: durationBeats,
                sampleRate: audioBuffer.sampleRate,
                // Create blob URL for playback
                url: URL.createObjectURL(file)
            };

            // Add to audio clips list
            setAudioClips(prev => [...prev, audioClip]);

            // Switch to AUDIO tab
            setPickerTab('AUDIO');

            // Add to timeline at current playhead position (or first empty track)
            // Find first track or selected track
            const targetTrack = playlistTracks.find(t => t.clips.length === 0) || playlistTracks[0];
            if (targetTrack) {
                // Use current playhead position in beats
                const newClip = {
                    id: Date.now(), // Unique ID for the clip instance
                    type: 'audio',
                    audioClipId: audioClip.id,
                    offset: playheadPosition,
                    length: durationBeats,
                    name: audioClip.name
                };

                setPlaylistTracks(prev => prev.map(t =>
                    t.id === targetTrack.id
                        ? { ...t, clips: [...t.clips, newClip] }
                        : t
                ));
            }

            // Auto-adjust zoom to fit waveform (could be implemented in Timeline component)
            console.log('Audio imported successfully:', audioClip.name);
            setIsImportingAudio(false);
        } catch (error) {
            console.error('Error importing audio file:', error);
            alert('Failed to import audio file: ' + error.message);
            setIsImportingAudio(false);
        }
    }, [bpm, playlistTracks]);


    // --- Automation Actions ---
    const createAutomation = useCallback((targetClipId, type = 'volume') => {
        let newId = Date.now();
        setAutomations(prev => {
            // Check if exists
            const existing = prev.find(a => a.targetClipId === targetClipId && a.type === type);
            if (existing) {
                newId = existing.id;
                return prev;
            }

            const newAuto = {
                id: newId,
                name: `${type === 'volume' ? 'Vol' : 'Pan'} Auto`,
                type,
                targetClipId,
                points: [
                    { id: 1, x: 0, y: 0.8 },
                    { id: 2, x: 1, y: 0.8 }
                ]
            };
            return [...prev, newAuto];
        });

        // select for painting
        setPickerTab('AUTO');
        setActiveClipType('automation');
        setActiveAutomationId(newId);
    }, []);

    const updateAutomationPoints = useCallback((automationId, points) => {
        setAutomations(prev => prev.map(a =>
            a.id === automationId ? { ...a, points } : a
        ));
    }, []);

    const deleteAutomation = useCallback((automationId) => {
        setAutomations(prev => prev.filter(a => a.id !== automationId));
    }, []);

    // --- Selectors (Derived State) ---
    const activePattern = useMemo(() =>
        patterns.find(p => p.id === activePatternId) || patterns[0]
        , [patterns, activePatternId]);

    // --- Scheduling Logic ---
    React.useEffect(() => {
        if (playbackMode === 'PAT') {
            if (activePattern) {
                audioEngine.schedulePattern(activePattern);
            }
        } else {
            // SONG mode
            audioEngine.schedulePlaylist(playlistTracks, patterns, audioClips, automations);
        }
    }, [activePattern, playbackMode, patterns, playlistTracks, audioClips]);

    // Template Creation
    const createTemplateProject = useCallback((templateType) => {
        if (templateType === 'chord') {
            // Target: 8 seconds at 120 BPM
            // 120 BPM = 2 beats per second. 
            // 8 seconds * 2 = 16 beats.
            // 16 beats * 4 steps/beat = 64 steps.
            const PATTERN_LENGTH = 64;

            // 1. Create Patterns
            const newPatterns = [
                { id: 1, name: 'Chords', color: '#4C8DB0', length: PATTERN_LENGTH, data: { steps: createEmptySteps(PATTERN_LENGTH), notes: [] } },
                { id: 2, name: 'Leads', color: '#B04C4C', length: PATTERN_LENGTH, data: { steps: createEmptySteps(PATTERN_LENGTH), notes: [] } },
                { id: 3, name: 'Bass', color: '#4CB080', length: PATTERN_LENGTH, data: { steps: createEmptySteps(PATTERN_LENGTH), notes: [] } },
                {
                    id: 4, name: 'Drums', color: '#B0AA4C', length: PATTERN_LENGTH, data: {
                        steps: createEmptySteps(PATTERN_LENGTH),
                        notes: []
                    }
                }
            ];

            // 2. Add Sample Notes to Drums (Pattern 4)
            const drumSteps = createEmptySteps(PATTERN_LENGTH);
            const drumNotes = [];

            // Use a base time + counter to ensure unique IDs even in tight loops
            let noteIdBase = Date.now();
            let noteCounter = 0;

            const addDrumNote = (channelId, step) => {
                drumNotes.push({
                    id: noteIdBase + (noteCounter++) + Math.random(), // Guaranteed unique
                    noteName: 'C5',
                    channelId: channelId,
                    startStep: step,
                    length: 1
                });
            };

            // Define Rhythm Presets (Single Bar - 16 steps)
            const DRUM_PRESETS = [
                {
                    name: 'Basic 4-on-Floor',
                    kick: [0, 4, 8, 12],
                    clap: [4, 12],
                    hat: [0, 2, 4, 6, 8, 10, 12, 14]
                },
                {
                    name: 'House',
                    kick: [0, 4, 8, 12],
                    clap: [4, 12],
                    hat: [2, 6, 10, 14] // Off-beat open hats
                },
                {
                    name: 'Trap Pulse',
                    kick: [0, 8],
                    clap: [8], // Half-time feel implies snare on 3 (step 8)
                    hat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] // 16th notes
                },
                {
                    name: 'Hip Hop Bounce',
                    kick: [0, 3, 7, 10],
                    clap: [4, 12],
                    hat: [0, 2, 4, 6, 8, 10, 12, 14]
                },
                {
                    name: 'Classic Break',
                    kick: [0, 7, 8],
                    clap: [4, 12],
                    hat: [0, 2, 4, 6, 8, 10, 12, 13, 14] // Swing-ish
                }
            ];

            // Randomly select a preset
            const randomPreset = DRUM_PRESETS[Math.floor(Math.random() * DRUM_PRESETS.length)];
            console.log("Selected Drum Preset:", randomPreset.name);

            // Repeat the 1-bar pattern 4 times
            for (let bar = 0; bar < 4; bar++) {
                const offset = bar * 16;
                // Apply Preset
                randomPreset.kick.forEach(s => {
                    const step = offset + s;
                    drumSteps[1][step] = true; // Ch 1: Kick
                    addDrumNote(1, step);
                });

                randomPreset.clap.forEach(s => {
                    const step = offset + s;
                    drumSteps[2][step] = true; // Ch 2: Clap
                    addDrumNote(2, step);
                });

                randomPreset.hat.forEach(s => {
                    const step = offset + s;
                    drumSteps[3][step] = true; // Ch 3: Hat
                    addDrumNote(3, step);
                });
            }

            newPatterns[3].data.steps = drumSteps;
            newPatterns[3].data.notes = drumNotes;

            setPatterns(newPatterns);
            setActivePatternId(1); // Start with Chords

            // 3. Setup Playlist Tracks
            const newTracks = Array(10).fill(null).map((_, i) => ({ id: i + 1, name: `Track ${i + 1}`, clips: [], muted: false, solo: false }));

            // Assign Patterns to Tracks 1-4
            newPatterns.forEach((pat, index) => {
                newTracks[index].name = pat.name;
                newTracks[index].clips.push({
                    id: Date.now() + index,
                    type: 'pattern',
                    patternId: pat.id,
                    offset: 0,
                    length: 16 // 16 beats = 4 bars = 64 steps
                });
            });

            setPlaylistTracks(newTracks);

        } else if (templateType === 'empty') {
            // Reset to default
            setPatterns([
                {
                    id: 1,
                    name: 'Pattern 1',
                    color: '#4C8DB0',
                    length: 16,
                    data: {
                        steps: createEmptySteps(16),
                        notes: []
                    }
                }
            ]);
            setActivePatternId(1);
            setPlaylistTracks(
                Array(10).fill(null).map((_, i) => ({ id: i + 1, name: `Track ${i + 1}`, clips: [], muted: false, solo: false }))
            );
        }
    }, []);

    const value = {
        patterns,
        activePatternId, setActivePatternId,
        activeClipType, setActiveClipType,
        activeAudioClipId, setActiveAudioClipId,
        activeAutomationId, setActiveAutomationId,
        activePattern,
        channels, setChannels,
        playlistTracks, setPlaylistTracks,
        automations, setAutomations,

        // Actions
        createPattern,
        createTemplateProject,
        createAutomation,
        updateAutomationPoints,
        deleteAutomation,
        updatePattern,
        toggleStepInActivePattern,
        addNoteToActivePattern,
        removeNoteFromActivePattern,
        setPlaylistTracks,
        updateChannelVolume,
        updateChannelPan,
        toggleTrackMute,
        toggleTrackSolo,
        previewChannelSound,
        previewPianoNote,
        resizeActivePattern,

        // New Actions
        updateNote,
        deleteNotes,
        addChannel,
        addEffect,
        isPlaying,
        bpm,
        togglePlayback,
        stopPlayback,
        updateBpm,
        currentProjectPath,
        setCurrentProjectPath,
        playbackMode,
        setPlaybackMode,
        isRecording,
        setIsRecording,
        playheadPosition,
        setPlayheadPosition,
        seek,

        // Audio Clips
        audioClips,
        setAudioClips,
        importAudioFile,

        // Picker Tab
        pickerTab,
        setPickerTab,

        // Loading State
        isImportingAudio,

        // Tools
        activeTool, setActiveTool,

        // Persistence
        loadProject
    };

    return (
        <ProjectContext.Provider value={value}>
            {children}
        </ProjectContext.Provider>
    );
};


