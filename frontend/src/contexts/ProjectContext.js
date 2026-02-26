import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { audioEngine } from '../audio/AudioEngine';
import { pickAudioFile, decodeAudioFile, generateWaveform, audioDurationToBeats, pickMidiFile, audioBufferToWav } from '../utils/audioImport';
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
            color: '#8b5cf6',
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

    // 8. Selection State
    const [selectedChannelIds, setSelectedChannelIds] = useState([]);

    // 9. Mixer Inserts (audio clips routed to mixer)
    const [mixerInserts, setMixerInserts] = useState([]);

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

    // Undo/Redo History for Pattern Notes
    const [notesHistory, setNotesHistory] = useState([]);
    const [notesHistoryIndex, setNotesHistoryIndex] = useState(-1);
    const isUndoRedoAction = useRef(false);

    // Audio Recording Refs
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const recordingStartTimeRef = useRef(0);



    const loadProject = useCallback(async (data, projectFilePath) => {
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

            // Restore automations
            if (data.automations) setAutomations(data.automations);

            // Restore mixer inserts
            if (data.mixerInserts) setMixerInserts(data.mixerInserts);

            // Restore audio clips from companion audio folder
            if (data.audioClips && data.audioClips.length > 0 && projectFilePath) {
                const basePath = projectFilePath.replace(/\.[^.]+$/, ''); // strip extension
                const audioDir = `${basePath}_audio`;

                const restoredClips = [];
                for (const serialized of data.audioClips) {
                    try {
                        const audioFileName = serialized.audioFileName;
                        if (!audioFileName) {
                            console.warn('Audio clip missing audioFileName:', serialized.name);
                            continue;
                        }

                        // Build path using pathJoin for proper OS separator
                        let audioFilePath;
                        if (window.electronAPI?.pathJoin) {
                            audioFilePath = await window.electronAPI.pathJoin(audioDir, audioFileName);
                        } else {
                            audioFilePath = `${audioDir}/${audioFileName}`;
                        }

                        // Check if file exists
                        if (window.electronAPI?.fileExists) {
                            const exists = await window.electronAPI.fileExists(audioFilePath);
                            if (!exists) {
                                console.warn('Audio file not found:', audioFilePath);
                                continue;
                            }
                        }

                        // Read the binary WAV file from disk (returns base64)
                        if (!window.electronAPI?.readFileBinary) {
                            console.warn('readFileBinary API not available');
                            continue;
                        }

                        const fileResult = await window.electronAPI.readFileBinary(audioFilePath);
                        if (!fileResult || !fileResult.success) {
                            console.warn('Failed to read audio file:', audioFilePath, fileResult?.error);
                            continue;
                        }

                        // Decode base64 back to ArrayBuffer
                        const binaryString = atob(fileResult.data);
                        const uint8Array = new Uint8Array(binaryString.length);
                        for (let i = 0; i < binaryString.length; i++) {
                            uint8Array[i] = binaryString.charCodeAt(i);
                        }

                        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                        const audioBuffer = await audioContext.decodeAudioData(uint8Array.buffer.slice(0));

                        // Regenerate waveform from the AudioBuffer
                        const samplesPerSecond = 100;
                        const targetSamples = Math.max(2000, Math.floor(audioBuffer.duration * samplesPerSecond));
                        const waveform = generateWaveform(audioBuffer, targetSamples);

                        // Create File and blob URL for playback
                        const blob = new Blob([uint8Array], { type: 'audio/wav' });
                        const file = new File([blob], serialized.fileName || 'audio.wav', { type: 'audio/wav' });
                        const url = URL.createObjectURL(blob);

                        // Recalculate durationBeats with the project's BPM
                        const projectBpm = data.bpm || 120;
                        const durationBeats = audioDurationToBeats(audioBuffer, projectBpm);

                        restoredClips.push({
                            id: serialized.id,
                            fileName: serialized.fileName,
                            name: serialized.name,
                            file,
                            audioBuffer,
                            waveform,
                            duration: audioBuffer.duration,
                            durationBeats,
                            sampleRate: audioBuffer.sampleRate,
                            url,
                            vol: serialized.vol ?? 100,
                            pan: serialized.pan ?? 50,
                            stemType: serialized.stemType || undefined,
                            color: serialized.color || undefined,
                            startOffset: serialized.startOffset ?? 0,
                        });

                        console.log('Restored audio clip:', serialized.name);
                    } catch (clipError) {
                        console.error('Failed to restore audio clip:', serialized.name, clipError);
                    }
                }

                if (restoredClips.length > 0) {
                    setAudioClips(restoredClips);
                    console.log(`Restored ${restoredClips.length} audio clip(s)`);
                }
            }

            console.log('Project loaded successfully');
        } catch (error) {
            console.error('Error loading project data:', error);
        }
    }, []);


    // --- Actions ---

    const createPattern = useCallback(() => {
        // Curated vibrant palette — no whites, no greys, all saturated
        const VIBRANT_COLORS = [
            '#8b5cf6', // violet
            '#ec4899', // pink
            '#f97316', // orange
            '#eab308', // yellow
            '#22c55e', // green
            '#06b6d4', // cyan
            '#3b82f6', // blue
            '#ef4444', // red
            '#a855f7', // purple
            '#14b8a6', // teal
            '#f43f5e', // rose
            '#84cc16', // lime
            '#0ea5e9', // sky
            '#fb923c', // amber-orange
            '#d946ef', // fuchsia
            '#10b981', // emerald
        ];
        setPatterns(prev => {
            const nextId = Math.max(...prev.map(p => p.id)) + 1;
            // Rotate through palette so consecutive patterns differ
            const color = VIBRANT_COLORS[(prev.length) % VIBRANT_COLORS.length];
            const newPattern = {
                id: nextId,
                name: `Pattern ${nextId}`,
                color,
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

    // Initialize Audio Engine channels (mount-only, never resets user changes)
    React.useEffect(() => {
        INITIAL_CHANNELS.forEach(ch => {
            audioEngine.createChannel(ch.id, ch.name);
            // Sync initial values
            audioEngine.updateChannelVolume(ch.id, ch.vol);
            audioEngine.updateChannelPan(ch.id, ch.pan);
        });
    }, []); // eslint-disable-line

    // Sync BPM to audio engine whenever it changes
    React.useEffect(() => {
        audioEngine.setBpm(bpm);
        console.log('BPM synced:', bpm);
    }, [bpm]);

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

    // Batch add notes (for paste operations)
    const addNotesToActivePattern = useCallback((notes) => {
        if (!notes || notes.length === 0) return;

        setPatterns(prev => prev.map(p => {
            if (p.id === activePatternId) {
                // Calculate new pattern length if needed
                const maxNoteEnd = Math.max(...notes.map(n => n.startStep + n.length));
                let newLength = p.length;
                if (maxNoteEnd > p.length) {
                    newLength = Math.ceil(maxNoteEnd / 16) * 16;
                }

                return {
                    ...p,
                    length: newLength,
                    data: {
                        ...p.data,
                        notes: [...p.data.notes, ...notes]
                    }
                };
            }
            return p;
        }));
    }, [activePatternId]);

    // Push current notes state to history (for undo/redo)
    const pushNotesHistory = useCallback(() => {
        const activePattern = patterns.find(p => p.id === activePatternId);
        if (!activePattern || isUndoRedoAction.current) return;

        const currentNotes = JSON.parse(JSON.stringify(activePattern.data.notes));

        setNotesHistory(prev => {
            // Trim any future history if we're not at the end
            const newHistory = prev.slice(0, notesHistoryIndex + 1);
            // Add current state
            newHistory.push({ patternId: activePatternId, notes: currentNotes });
            // Limit history size to 50 entries
            if (newHistory.length > 50) {
                newHistory.shift();
            }
            return newHistory;
        });
        setNotesHistoryIndex(prev => Math.min(prev + 1, 49));
    }, [patterns, activePatternId, notesHistoryIndex]);

    // Undo action
    const undoNotes = useCallback(() => {
        if (notesHistoryIndex < 0) return;

        const historyEntry = notesHistory[notesHistoryIndex];
        if (!historyEntry) return;

        isUndoRedoAction.current = true;

        // First, save current state to enable redo
        const activePattern = patterns.find(p => p.id === activePatternId);
        if (activePattern) {
            const currentNotes = JSON.parse(JSON.stringify(activePattern.data.notes));
            setNotesHistory(prev => {
                const newHistory = [...prev];
                // Store current state at next position for redo
                newHistory[notesHistoryIndex + 1] = { patternId: activePatternId, notes: currentNotes };
                return newHistory;
            });
        }

        // Restore previous state
        setPatterns(prev => prev.map(p => {
            if (p.id === historyEntry.patternId) {
                return {
                    ...p,
                    data: {
                        ...p.data,
                        notes: historyEntry.notes
                    }
                };
            }
            return p;
        }));

        setNotesHistoryIndex(prev => prev - 1);

        setTimeout(() => { isUndoRedoAction.current = false; }, 0);
    }, [notesHistory, notesHistoryIndex, patterns, activePatternId]);

    // Redo action
    const redoNotes = useCallback(() => {
        if (notesHistoryIndex >= notesHistory.length - 1) return;

        const nextEntry = notesHistory[notesHistoryIndex + 1];
        if (!nextEntry) return;

        isUndoRedoAction.current = true;

        setPatterns(prev => prev.map(p => {
            if (p.id === nextEntry.patternId) {
                return {
                    ...p,
                    data: {
                        ...p.data,
                        notes: nextEntry.notes
                    }
                };
            }
            return p;
        }));

        setNotesHistoryIndex(prev => prev + 1);

        setTimeout(() => { isUndoRedoAction.current = false; }, 0);
    }, [notesHistory, notesHistoryIndex]);

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

    const selectChannel = useCallback((channelId, isMultiSelect = false) => {
        setSelectedChannelIds(prev => {
            if (isMultiSelect) {
                // Toggle selection
                if (prev.includes(channelId)) {
                    return prev.filter(id => id !== channelId);
                } else {
                    return [...prev, channelId];
                }
            } else {
                // Single selection
                return [channelId];
            }
        });
    }, []);

    // Add selected audio clips to a single mixer insert as a group
    const addAudioClipsToMixerAsGroup = useCallback((clipIds) => {
        if (!clipIds || clipIds.length === 0) return;
        const clips = clipIds.map(cid => {
            const rawId = typeof cid === 'string' && cid.startsWith('audio-') ? Number(cid.replace('audio-', '')) : cid;
            return audioClips.find(ac => ac.id === rawId);
        }).filter(Boolean);
        if (clips.length === 0) return;

        const groupName = clips.length === 1 ? clips[0].name : `Audio Group`;
        setMixerInserts(prev => {
            const nextNum = prev.length + 1;
            return [...prev, {
                id: `mixer-insert-${Date.now()}`,
                name: clips.length === 1 ? groupName : `${groupName} ${nextNum}`,
                type: 'group',
                clipIds: clips.map(c => c.id),
                clipNames: clips.map(c => c.name),
                vol: 80,
                pan: 0,
                effects: []
            }];
        });
    }, [audioClips]);

    // Add selected audio clips each to their own mixer insert
    const addAudioClipsToMixerSeparately = useCallback((clipIds) => {
        if (!clipIds || clipIds.length === 0) return;
        const clips = clipIds.map(cid => {
            const rawId = typeof cid === 'string' && cid.startsWith('audio-') ? Number(cid.replace('audio-', '')) : cid;
            return audioClips.find(ac => ac.id === rawId);
        }).filter(Boolean);
        if (clips.length === 0) return;

        setMixerInserts(prev => [
            ...prev,
            ...clips.map(clip => ({
                id: `mixer-insert-${clip.id}-${Date.now()}`,
                name: clip.name,
                type: 'audio',
                clipIds: [clip.id],
                clipNames: [clip.name],
                vol: 80,
                pan: 0,
                effects: []
            }))
        ]);
    }, [audioClips]);

    // Optimization: Track if scheduling is needed
    // (needsScheduling ref moved to top)

    // Mark scheduling needed when data changes
    useEffect(() => {
        needsScheduling.current = true;

        // Live Update: If playing, we can try to update automation immediately? 
        // For now, we rely on Stop/Play or Seek to refresh the schedule to avoid playback interruptions.
        // (Rescheduling effectively stops and restarts all audio)
    }, [playlistTracks, patterns, audioClips, bpm, activePatternId, playbackMode, automations]);

    // Transport Actions
    const togglePlayback = useCallback(async () => {
        await audioEngine.init();

        // CRITICAL: Sync BPM after init to ensure correct tempo
        audioEngine.setBpm(bpm);

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
    }, [isPlaying, playbackMode, playlistTracks, patterns, audioClips, activePatternId, playheadPosition, bpm, automations]);

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
    }, [bpm, isPlaying, playlistTracks, patterns, audioClips, playbackMode, activePatternId, automations]);

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
                            url: URL.createObjectURL(file),
                            vol: 100,
                            pan: 50
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

    // Audio Clip Volume/Pan
    const updateAudioClipVolume = useCallback((clipId, volume) => {
        // Update any active audio players for this clip
        audioEngine.updateAudioClipVolume(clipId, volume);

        // Update UI State
        setAudioClips(prev => prev.map(ac =>
            ac.id === clipId ? { ...ac, vol: volume } : ac
        ));
    }, []);

    const updateAudioClipPan = useCallback((clipId, pan) => {
        // Update any active audio players for this clip
        audioEngine.updateAudioClipPan(clipId, pan);

        // Update UI State
        setAudioClips(prev => prev.map(ac =>
            ac.id === clipId ? { ...ac, pan: pan } : ac
        ));
    }, []);

    const addChannel = useCallback((plugin) => {
        // Drum Machine: expand into 4 named drum rows so AudioEngine matchers work correctly
        if (plugin.type === 'drums') {
            const drumRows = [
                { suffix: 'Kick', color: '#f97316' },
                { suffix: 'Snare', color: '#a855f7' },
                { suffix: 'Hi Hat', color: '#06b6d4' },
                { suffix: 'Clap', color: '#ec4899' },
            ];
            setChannels(prev => {
                const baseId = Math.max(...prev.map(c => c.id), -1) + 1;
                const newChannels = drumRows.map((row, i) => ({
                    id: baseId + i,
                    name: row.suffix,
                    vol: 80,
                    pan: 50,
                    color: row.color,
                    effects: [],
                    pluginId: 'drums'
                }));

                setPatterns(prevPats => prevPats.map(pat => {
                    const newSteps = { ...pat.data.steps };
                    newChannels.forEach(ch => { newSteps[ch.id] = Array(pat.length).fill(false); });
                    return { ...pat, data: { ...pat.data, steps: newSteps } };
                }));

                newChannels.forEach(ch => audioEngine.createChannel(ch.id, ch.name));
                return [...prev, ...newChannels];
            });
            return;
        }

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


    const addEffect = useCallback((channelId, plugin, slotIndex = null) => {
        setChannels(prev => prev.map(ch => {
            if (ch.id === channelId) {
                const currentEffects = ch.effects || [];
                const slot = slotIndex !== null ? slotIndex : currentEffects.length;

                // Check if slot already has an effect
                if (currentEffects[slot]) {
                    console.warn(`Slot ${slot} already has an effect`);
                    return ch;
                }

                const newEffect = {
                    id: Date.now(),
                    name: plugin.name,
                    pluginId: plugin.id,
                    type: plugin.type,
                    enabled: true,
                    mix: 50, // 0-100 (dry/wet)
                    order: slot
                };

                // Insert at specific slot or append
                const newEffects = [...currentEffects];
                newEffects[slot] = newEffect;

                // Also add to audio engine
                audioEngine.addChannelEffect(channelId, plugin.type, slot);

                return { ...ch, effects: newEffects };
            }
            return ch;
        }));
        console.log(`Added effect ${plugin.name} to channel ${channelId} at slot ${slotIndex}`);
    }, []);

    const removeEffect = useCallback((channelId, slotIndex) => {
        setChannels(prev => prev.map(ch => {
            if (ch.id === channelId) {
                const newEffects = [...(ch.effects || [])];
                newEffects[slotIndex] = null;

                // Remove from audio engine
                audioEngine.removeChannelEffect(channelId, slotIndex);

                return { ...ch, effects: newEffects };
            }
            return ch;
        }));
        console.log(`Removed effect from channel ${channelId} slot ${slotIndex}`);
    }, []);

    const updateEffectMix = useCallback((channelId, slotIndex, mix) => {
        setChannels(prev => prev.map(ch => {
            if (ch.id === channelId && ch.effects?.[slotIndex]) {
                const newEffects = [...ch.effects];
                newEffects[slotIndex] = { ...newEffects[slotIndex], mix };

                // Update audio engine
                audioEngine.updateEffectMix(channelId, slotIndex, mix / 100);

                return { ...ch, effects: newEffects };
            }
            return ch;
        }));
    }, []);

    const updateEffectEnabled = useCallback((channelId, slotIndex, enabled) => {
        setChannels(prev => prev.map(ch => {
            if (ch.id === channelId && ch.effects?.[slotIndex]) {
                const newEffects = [...ch.effects];
                newEffects[slotIndex] = { ...newEffects[slotIndex], enabled };

                // Update audio engine
                audioEngine.updateEffectEnabled(channelId, slotIndex, enabled);

                return { ...ch, effects: newEffects };
            }
            return ch;
        }));
    }, []);

    const reorderEffect = useCallback((channelId, fromSlot, toSlot) => {
        setChannels(prev => prev.map(ch => {
            if (ch.id === channelId) {
                const newEffects = [...(ch.effects || [])];
                const temp = newEffects[fromSlot];
                newEffects[fromSlot] = newEffects[toSlot];
                newEffects[toSlot] = temp;

                // Update order properties
                if (newEffects[fromSlot]) newEffects[fromSlot].order = fromSlot;
                if (newEffects[toSlot]) newEffects[toSlot].order = toSlot;

                // Rebuild audio engine effect chain
                audioEngine.reorderChannelEffects(channelId, newEffects);

                return { ...ch, effects: newEffects };
            }
            return ch;
        }));
        console.log(`Reordered effects in channel ${channelId}: ${fromSlot} <-> ${toSlot}`);
    }, []);

    // Update effect params (e.g., reverb decay, delay time, etc.)
    const updateEffectParams = useCallback((channelId, slotIndex, params) => {
        setChannels(prev => prev.map(ch => {
            if (ch.id === channelId && ch.effects?.[slotIndex]) {
                const newEffects = [...ch.effects];
                newEffects[slotIndex] = {
                    ...newEffects[slotIndex],
                    params: { ...newEffects[slotIndex].params, ...params }
                };

                // Update audio engine effect parameters
                audioEngine.updateEffectParams(channelId, slotIndex, params);

                return { ...ch, effects: newEffects };
            }
            return ch;
        }));
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
                url: URL.createObjectURL(file),
                vol: 100,
                pan: 50
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

    // Add stems as audio clips (from stem separation API)
    const addStemsAsAudioClips = useCallback(async (stemsData, originalName) => {
        const stemClips = [];

        for (const [stemName, base64Data] of Object.entries(stemsData)) {
            try {
                // Convert base64 to blob
                const binaryString = atob(base64Data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                const blob = new Blob([bytes], { type: 'audio/wav' });
                const file = new File([blob], `${originalName}_${stemName}.wav`, { type: 'audio/wav' });

                // Decode audio
                const arrayBuffer = await blob.arrayBuffer();
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

                // Generate waveform
                const samplesPerSecond = 100;
                const targetSamples = Math.max(2000, Math.floor(audioBuffer.duration * samplesPerSecond));
                const waveform = generateWaveform(audioBuffer, targetSamples);

                // Calculate duration in beats
                const durationBeats = audioDurationToBeats(audioBuffer, bpm);

                // Stem-specific colors for visual distinction
                const stemColors = {
                    vocals: '#ec4899',  // Pink
                    drums: '#f97316',   // Orange
                    bass: '#8b5cf6',    // Purple
                    other: '#14b8a6'    // Teal
                };

                // Create audio clip object
                const audioClip = {
                    id: Date.now() + stemClips.length,
                    fileName: `${originalName}_${stemName}.wav`,
                    name: `${originalName} - ${stemName.charAt(0).toUpperCase() + stemName.slice(1)}`,
                    file: file,
                    audioBuffer: audioBuffer,
                    waveform: waveform,
                    duration: audioBuffer.duration,
                    durationBeats: durationBeats,
                    sampleRate: audioBuffer.sampleRate,
                    url: URL.createObjectURL(blob),
                    stemType: stemName,
                    color: stemColors[stemName] || '#60a5fa',  // Default blue if unknown stem
                    vol: 100,
                    pan: 50
                };

                stemClips.push(audioClip);
            } catch (error) {
                console.error(`Error processing ${stemName} stem:`, error);
            }
        }

        // Add all stem clips to audio clips
        if (stemClips.length > 0) {
            setAudioClips(prev => [...prev, ...stemClips]);
            setPickerTab('AUDIO');
            console.log(`Added ${stemClips.length} stem clips successfully`);
        }

        return stemClips;
    }, [bpm]);


    // MIDI Import Action
    const importMidiFile = useCallback(async () => {
        try {
            const file = await pickMidiFile();
            if (!file) return;

            console.log('Importing MIDI file:', file.name);

            // Create form data
            const formData = new FormData();
            formData.append('file', file);

            // Send to backend
            const response = await fetch('http://localhost:8000/midi/parse', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Failed to parse MIDI file');
            }

            const data = await response.json();
            console.log('Parsed MIDI data:', data);

            // 1. Log BPM (could auto-update)
            if (data.bpm && data.bpm !== bpm) {
                console.log(`MIDI BPM: ${data.bpm}. Current BPM: ${bpm}`);
            }

            // 2. Create Channels & Patterns
            let newChannels = [];
            let newPatternNotes = [];
            // Use time-based ID to avoid collisions
            const startId = Date.now();

            setChannels(prev => {
                const maxId = Math.max(...prev.map(c => c.id), -1);
                let currentId = maxId + 1;

                // Create a map to link track index to channel ID
                // We'll calculate channel IDs relative to the current max

                // For safety, let's map inside the callback
                // But we need to build notes too. 
                // We'll start channel IDs from currentId.

                const tracks = data.tracks || [];

                tracks.forEach((track, index) => {
                    const channelId = currentId + index;

                    // Create Channel
                    newChannels.push({
                        id: channelId,
                        name: track.name || `Midi Track ${index + 1}`,
                        vol: 80,
                        pan: 50,
                        effects: [],
                        pluginId: 'sampler'
                    });

                    // Add Notes to Pattern
                    track.notes.forEach((note, noteIndex) => {
                        newPatternNotes.push({
                            id: startId + (index * 10000) + noteIndex,
                            noteName: note.noteName,
                            channelId: channelId,
                            startStep: Math.round(note.start * 4),
                            length: Math.max(1, Math.round(note.duration * 4))
                        });
                    });
                });

                // Initialize audio engine
                newChannels.forEach(ch => {
                    audioEngine.createChannel(ch.id, ch.name);
                });

                return [...prev, ...newChannels];
            });

            // Update Patterns
            setPatterns(prev => {
                const nextPatId = Math.max(...prev.map(p => p.id)) + 1;

                const maxStep = Math.max(...newPatternNotes.map(n => n.startStep + n.length), 64);
                const length = Math.ceil(maxStep / 16) * 16;

                // Create steps for ALL channels
                // NOTE: We don't have the updated 'channels' here, so we must manually ensure 
                // we rely on what we know about new channels + existing pattern structure or just empty.
                // Ideally createEmptySteps needs dynamic channel info. 
                // For now, we'll manually patch the new channel steps.

                const newSteps = createEmptySteps(length);
                newChannels.forEach(ch => {
                    newSteps[ch.id] = Array(length).fill(false);
                });

                const newPattern = {
                    id: nextPatId,
                    name: `MIDI Import - ${file.name}`,
                    color: '#FFAA00',
                    length: length,
                    data: {
                        steps: newSteps,
                        notes: newPatternNotes
                    }
                };

                setActivePatternId(nextPatId);
                return [...prev, newPattern];
            });

            // Add to Playlist
            setPlaylistTracks(prev => {
                const targetTrack = prev.find(t => t.clips.length === 0) || prev[0];
                if (targetTrack) {
                    // We need to guess the next pattern ID again or use a safer way.
                    // Since we do it in the same event loop tick, it *should* match the calculation above.
                    const patIds = patterns.map(p => p.id); // Closure 'patterns'
                    // This might be slightly risky if 'patterns' is old. 
                    // But 'patterns' is a dependency of useCallback, so it should be fresh.
                    const nextPatId = Math.max(...patIds, 0) + 1;

                    const newClip = {
                        id: Date.now(),
                        type: 'pattern',
                        patternId: nextPatId,
                        offset: playheadPosition,
                        length: 16 // Should match pattern length ideally, but clips can be shorter/looped
                    };

                    return prev.map(t =>
                        t.id === targetTrack.id
                            ? { ...t, clips: [...t.clips, newClip] }
                            : t
                    );
                }
                return prev;
            });

            alert(`Imported MIDI: ${data.tracks.length} tracks.`);

        } catch (error) {
            console.error('Error importing MIDI:', error);
            alert('Failed to import MIDI: ' + error.message);
        }
    }, [bpm, patterns, playheadPosition]);

    // Midify: Convert audio clip to MIDI pattern
    const midifyAudioClip = useCallback(async (audioClipId) => {
        const clip = audioClips.find(c => c.id === audioClipId);
        if (!clip) throw new Error('Audio clip not found');

        // Need the actual audio file/blob to send to backend
        let fileToSend = clip.file;
        if (!fileToSend && clip.url) {
            // Fetch from blob URL if file ref is missing
            const resp = await fetch(clip.url);
            const blob = await resp.blob();
            fileToSend = new File([blob], clip.fileName || 'audio.wav', { type: blob.type });
        }
        if (!fileToSend) throw new Error('No audio data available for this clip');

        // Send to backend
        const formData = new FormData();
        formData.append('file', fileToSend);

        const response = await fetch(`http://localhost:8000/midify/convert?bpm=${bpm}`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || 'Midify conversion failed');
        }

        const data = await response.json();
        console.log('Midify result:', data);

        if (!data.notes || data.notes.length === 0) {
            throw new Error('No notes detected in audio. Try a clearer monophonic melody.');
        }

        const clipName = clip.name || clip.fileName?.replace(/\.[^/.]+$/, '') || 'Audio';
        const startId = Date.now();

        // Create new channel for the midified instrument
        let newChannelId;
        setChannels(prev => {
            newChannelId = Math.max(...prev.map(c => c.id), -1) + 1;
            const newChannel = {
                id: newChannelId,
                name: `Midify: ${clipName}`,
                vol: 80,
                pan: 50,
                effects: [],
                pluginId: 'sampler'
            };

            // Register with audio engine
            audioEngine.createChannel(newChannelId, newChannel.name);

            return [...prev, newChannel];
        });

        // Create pattern notes from detected notes
        const patternNotes = data.notes.map((note, idx) => ({
            id: startId + idx,
            noteName: note.noteName,
            channelId: newChannelId,
            startStep: Math.round(note.start * 4), // beats to steps (4 steps per beat)
            length: Math.max(1, Math.round(note.duration * 4)),
            velocity: note.velocity || 0.8
        }));

        // Calculate pattern length
        const maxStep = Math.max(...patternNotes.map(n => n.startStep + n.length), 16);
        const patternLength = Math.ceil(maxStep / 16) * 16;

        // Create steps
        const newSteps = createEmptySteps(patternLength);
        newSteps[newChannelId] = Array(patternLength).fill(false);

        // Create the pattern
        setPatterns(prev => {
            const nextPatId = Math.max(...prev.map(p => p.id), 0) + 1;

            const newPattern = {
                id: nextPatId,
                name: `Midify - ${clipName}`,
                color: '#8b5cf6', // Purple to match the Midify branding
                length: patternLength,
                data: {
                    steps: newSteps,
                    notes: patternNotes
                }
            };

            setActivePatternId(nextPatId);
            return [...prev, newPattern];
        });

        // Switch to patterns tab
        setPickerTab('PAT');

        console.log(`Midify: Created pattern "Midify - ${clipName}" with ${patternNotes.length} notes`);
    }, [bpm, audioClips]);



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

    const clonePattern = useCallback((patternId) => {
        setPatterns(prev => {
            const patternToClone = prev.find(p => p.id === patternId);
            if (!patternToClone) return prev;

            const nextId = Math.max(...prev.map(p => p.id), 0) + 1;
            const clonedPattern = {
                ...JSON.parse(JSON.stringify(patternToClone)),
                id: nextId,
                name: `${patternToClone.name} (Copy)`
            };

            setActivePatternId(nextId);
            return [...prev, clonedPattern];
        });
    }, []);

    const findFirstEmptyPattern = useCallback(() => {
        const emptyPattern = patterns.find(p => {
            const hasNotes = p.data.notes.length > 0;
            const hasSteps = Object.values(p.data.steps).some(s => s.some(step => step === true));
            return !hasNotes && !hasSteps;
        });

        if (emptyPattern) {
            setActivePatternId(emptyPattern.id);
        } else {
            createPattern();
        }
    }, [patterns, createPattern]);

    const revertToLastBackup = useCallback(() => {
        // Placeholder for backup logic
        console.log("Reverting to last backup...");
        alert("Revert to backup is not implemented yet, but your state is safe.");
    }, []);

    const value = {
        patterns, setPatterns,
        activePatternId, setActivePatternId,
        activeClipType, setActiveClipType,
        activeAudioClipId, setActiveAudioClipId,
        activeAutomationId, setActiveAutomationId,
        activePattern,
        channels, setChannels,
        playlistTracks, setPlaylistTracks,
        automations, setAutomations,

        activePattern,
        clonePattern,
        findFirstEmptyPattern,
        revertToLastBackup,

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
        updateAudioClipVolume,
        updateAudioClipPan,
        toggleTrackMute,
        toggleTrackSolo,
        previewChannelSound,
        previewPianoNote,
        resizeActivePattern,

        // New Actions
        updateNote,
        deleteNotes,
        addNotesToActivePattern,
        pushNotesHistory,
        undoNotes,
        redoNotes,
        addChannel,
        addEffect,
        removeEffect,
        updateEffectMix,
        updateEffectEnabled,
        reorderEffect,
        updateEffectParams,
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

        // Selection
        selectedChannelIds, selectChannel,

        // Mixer Inserts
        mixerInserts, addAudioClipsToMixerAsGroup, addAudioClipsToMixerSeparately,

        // Audio Clips
        audioClips,
        setAudioClips,
        importAudioFile,
        addStemsAsAudioClips,
        importMidiFile,
        midifyAudioClip,

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


