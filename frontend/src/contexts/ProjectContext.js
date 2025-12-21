import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

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
    // Each pattern has a name, color, and its own data (steps, notes)
    // Structure: 
    // { 
    //   id: 1, name: 'Pattern 1', color: '#B04C4C', length: 16, 
    //   data: { 
    //      steps: { [channelId]: [bool, bool...] },
    //      notes: [{ id, noteName, startStep, length }] 
    //   } 
    // }
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

    // 2. Channels (Instruments) - Global for now, but patterns reference them
    const [channels, setChannels] = useState(INITIAL_CHANNELS);

    // 3. Playlist / Arrangement
    // Tracks contain clips.
    // Clip: { id, type: 'pattern', patternId, startStep, length }
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
            // Select the new pattern immediately
            setActivePatternId(nextId);
            return [...prev, newPattern];
        });
    }, []);

    const updateActivePattern = useCallback((newDataPartial) => {
        setPatterns(prev => prev.map(p => {
            if (p.id === activePatternId) {
                // deep merge data if needed, or just replace keys
                return {
                    ...p,
                    data: {
                        ...p.data,
                        ...newDataPartial
                    }
                };
            }
            return p;
        }));
    }, [activePatternId]);

    // Helper to update specific channel steps in active pattern
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
        setPlaylistTracks // For dragging later
    };

    return (
        <ProjectContext.Provider value={value}>
            {children}
        </ProjectContext.Provider>
    );
};
