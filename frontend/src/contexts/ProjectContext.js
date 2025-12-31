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
    { id: 1, name: '808 Kick', vol: 78, pan: 50 },
    { id: 2, name: '808 Clap', vol: 78, pan: 50 },
    { id: 3, name: '808 HiHat', vol: 78, pan: 50 },
    { id: 4, name: '808 Snare', vol: 78, pan: 50 },
    { id: 5, name: 'FLEX Bass', vol: 78, pan: 50 },
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
        Array(10).fill(null).map((_, i) => ({ id: i + 1, name: `Track ${i + 1}`, clips: [] }))
    );

    // 4. Audio Clips (imported audio files)
    const [audioClips, setAudioClips] = useState([]);

    // New: Active Clip Selection State for Painting
    const [activeClipType, setActiveClipType] = useState('pattern'); // 'pattern' | 'audio'
    const [activeAudioClipId, setActiveAudioClipId] = useState(null);

    // 5. Picker Tab State (PAT/AUDIO/AUTO)
    const [pickerTab, setPickerTab] = useState('PAT');

    // 6. Loading State
    const [isImportingAudio, setIsImportingAudio] = useState(false);

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

    // --- Project File State ---
    const [currentProjectPath, setCurrentProjectPath] = useState(null);

    // --- Transport State ---
    const [isPlaying, setIsPlaying] = useState(false);
    const [bpm, setBpm] = useState(120);
    const [playbackMode, setPlaybackMode] = useState('PAT'); // 'PAT' | 'SONG'
    const [isRecording, setIsRecording] = useState(false);
    const [playheadPosition, setPlayheadPosition] = useState(0); // Position in beats
    const playheadIntervalRef = useRef(null);

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

    // Transport Actions
    const togglePlayback = useCallback(async () => {
        await audioEngine.init();
        if (isPlaying) {
            // Pause playback
            audioEngine.pause();
            setIsPlaying(false);
        } else {
            // Start or resume playback from current playhead position
            const wasPaused = Tone.Transport.state === 'paused';
            const wasStopped = Tone.Transport.state === 'stopped';

            // Seek Transport to current playhead position (in seconds)
            const beatsPerSecond = bpm / 60;
            const currentTimeSeconds = playheadPosition / beatsPerSecond;
            Tone.Transport.seconds = currentTimeSeconds;

            // Always reschedule from current position (whether paused or stopped)
            if (playbackMode === 'SONG') {
                // Reschedule playlist from current playhead position
                audioEngine.schedulePlaylist(playlistTracks, patterns, audioClips);
            } else if (playbackMode === 'PAT') {
                // Reschedule pattern from current playhead position
                const activePattern = patterns.find(p => p.id === activePatternId);
                if (activePattern) {
                    audioEngine.schedulePattern(activePattern);
                }
            }

            audioEngine.start();
            setIsPlaying(true);
        }
    }, [isPlaying, playbackMode, playlistTracks, patterns, audioClips, activePatternId, playheadPosition, bpm]);

    const stopPlayback = useCallback(() => {
        audioEngine.stop();
        setIsPlaying(false);
        setPlayheadPosition(0);
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

    // Preview Note Action
    const previewChannelSound = useCallback(async (channelId) => {
        await audioEngine.init(); // Ensure context is started
        audioEngine.previewSound(channelId);
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
            audioEngine.schedulePlaylist(playlistTracks, patterns, audioClips);
        }
    }, [activePattern, playbackMode, patterns, playlistTracks, audioClips]);

    const value = {
        patterns,
        activePatternId, setActivePatternId,
        activeClipType, setActiveClipType,
        activeAudioClipId, setActiveAudioClipId,
        activePattern,
        channels, setChannels,
        playlistTracks, setPlaylistTracks,

        // Actions
        createPattern,
        updatePattern,
        toggleStepInActivePattern,
        addNoteToActivePattern,
        removeNoteFromActivePattern,
        setPlaylistTracks,
        updateChannelVolume,
        updateChannelPan,
        previewChannelSound,

        // New Actions
        updateNote,
        deleteNotes,
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

        // Audio Clips
        audioClips,
        setAudioClips,
        importAudioFile,

        // Picker Tab
        pickerTab,
        setPickerTab,

        // Loading State
        isImportingAudio
    };

    return (
        <ProjectContext.Provider value={value}>
            {children}
        </ProjectContext.Provider>
    );
};


