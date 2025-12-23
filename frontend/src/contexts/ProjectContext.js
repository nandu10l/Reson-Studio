import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { audioEngine } from '../audio/AudioEngine';

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

    // --- Selectors (Derived State) ---
    const activePattern = useMemo(() =>
        patterns.find(p => p.id === activePatternId) || patterns[0]
        , [patterns, activePatternId]);

    const value = {
        patterns,
        activePatternId,
        setActivePatternId,
        activePattern,
        channels,
        playlistTracks,

        // Actions
        createPattern,
        toggleStepInActivePattern,
        addNoteToActivePattern,
        removeNoteFromActivePattern,
        setPlaylistTracks,
        updateChannelVolume,
        updateChannelPan,
        previewChannelSound
    };

    return (
        <ProjectContext.Provider value={value}>
            {children}
        </ProjectContext.Provider>
    );
};
