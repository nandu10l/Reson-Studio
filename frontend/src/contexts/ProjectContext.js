import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { audioEngine } from '../audio/AudioEngine';
import { pickAudioFile, decodeAudioFile, generateWaveform, audioDurationToBeats } from '../utils/audioImport';

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

    // 5. Picker Tab State (PAT/AUDIO/AUTO)
    const [pickerTab, setPickerTab] = useState('PAT');

    // 6. Loading State
    const [isImportingAudio, setIsImportingAudio] = useState(false);

    // 7. Global Tool State
    const [activeTool, setActiveTool] = useState('draw'); // 'draw', 'paint', 'delete', 'mute', 'slice', 'select', 'zoom', 'playback'

    // --- Selectors (Derived State) ---
    const activePattern = useMemo(() =>
        patterns.find(p => p.id === activePatternId) || patterns[0]
        , [patterns, activePatternId]);


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
                return {
                    ...p,
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

    // --- Actions ---

    // Note Actions
    const updateNote = useCallback((noteId, changes) => {
        setPatterns(prev => prev.map(p => {
            if (p.id === activePatternId) {
                return {
                    ...p,
                    data: {
                        ...p.data,
                        notes: p.data.notes.map(n =>
                            n.id === noteId ? { ...n, ...changes } : n
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

        // Check for empty content before starting
        if (!isPlaying) {
            if (playbackMode === 'SONG') {
                const hasContent = playlistTracks.some(track => track.clips.length > 0);
                if (!hasContent) return;
            } else {
                // PAT Mode
                const hasNotes = activePattern.data.notes.length > 0;
                const hasSteps = Object.values(activePattern.data.steps).some(steps => steps.some(s => s));
                if (!hasNotes && !hasSteps) return;
            }
        }

        if (isPlaying) {
            audioEngine.pause();
            setIsPlaying(false);
        } else {
            audioEngine.start();
            setIsPlaying(true);
        }
    }, [isPlaying, playbackMode, playlistTracks, activePattern]);

    const stopPlayback = useCallback(() => {
        audioEngine.stop();
        setIsPlaying(false);
    }, []);

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

            // Generate waveform
            const waveform = generateWaveform(audioBuffer, 1000); // 1000 samples for waveform

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
                const currentPlayhead = 0; // TODO: Get actual playhead position
                const newClip = {
                    id: Date.now(), // Unique ID for the clip instance
                    type: 'audio',
                    audioClipId: audioClip.id,
                    offset: currentPlayhead,
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
        activePatternId,
        setActivePatternId,
        activePattern,
        channels,
        playlistTracks,

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
        activeTool,
        setActiveTool
    };

    return (
        <ProjectContext.Provider value={value}>
            {children}
        </ProjectContext.Provider>
    );
};
