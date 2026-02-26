import React, { useState, useRef, useCallback, useEffect } from 'react';
import './AIMusicGenerator.css';
import { useProject } from '../../contexts/ProjectContext';
import { generateWaveform, audioDurationToBeats, decodeAudioFile } from '../../utils/audioImport';
import { audioEngine } from '../../audio/AudioEngine';

// ── Genre Presets ─────────────────────────────────────────────
const GENRE_PRESETS = [
    { label: 'Lo-fi', prompt: 'Lo-fi hip hop with warm vinyl crackle, mellow piano chords, and soft jazzy drums' },
    { label: 'Cinematic', prompt: 'Epic cinematic orchestral score with soaring strings, brass, and percussion' },
    { label: 'Afrobeat', prompt: 'Afrobeat groove with deep bass, rhythmic guitar, and airy synth pads' },
    { label: 'Ambient', prompt: 'Ambient atmospheric textures with soft pads, reverb, and gentle evolving tones' },
    { label: 'Electronic', prompt: 'Electronic dance music with punchy kicks, synthesizer leads, and arpeggiated bass' },
];

const STATUS_LABELS = {
    idle: 'Idle',
    connecting: 'Connecting…',
    generating: 'Generating…',
    playing: 'Playing',
    paused: 'Paused',
    stopped: 'Stopped',
    error: 'Error',
};

// Backend WebSocket URL
const WS_URL = `ws://${window.location.hostname || 'localhost'}:8000/ws/music`;
const API_BASE = `http://${window.location.hostname || 'localhost'}:8000`;

// ── Instrument Classification (Acoustic Heuristic) ─────────
// Basic-pitch detects ACTUAL frequencies, not GM drum map pitches.
// A real hi-hat vibrates at 3000-5000+ Hz (MIDI ~95+), snare body
// resonates at 150-250 Hz (MIDI ~50-59). We classify by acoustic
// pitch + note duration instead of the GM channel-10 convention.

const PERC_HARD_THRESHOLD = 1.5;  // beats — shorter than this = almost certainly percussive
const PERC_SOFT_THRESHOLD = 3.0;  // beats — below this AND low pitch = still likely a drum hit

/**
 * Classify a note into an instrument group using pitch + duration.
 * Basic-pitch reports full note decay, so drum hits can easily reach
 * 0.5-1.5 beats. True melodic notes sustain much longer (> 2-3 beats).
 */
function classifyNote(pitch, duration) {
    const isShort = duration <= PERC_HARD_THRESHOLD;
    const isMedium = duration <= PERC_SOFT_THRESHOLD;

    // ── Clearly percussive (short notes) ─────────────────
    if (isShort) {
        if (pitch < 50) return 'Kick';
        if (pitch < 65) return 'Snare';
        if (pitch < 80) return 'Tom';
        return 'HiHat';
    }

    // ── Moderately short + low pitch = still likely a drum ──
    // Real bass notes sustain well beyond 3 beats; drum hits
    // with resonance tail sit in the 1.5-3.0 range.
    if (isMedium && pitch < 50) return 'Kick';
    if (isMedium && pitch < 65) return 'Snare';

    // ── Sustained / melodic notes ─────────────────────────
    if (pitch < 48) return 'Bass';
    if (pitch < 72) return 'Piano';
    if (pitch < 96) return 'Lead';
    return 'High';
}

// Channel name patterns for matching instrument groups to existing channels
const INSTRUMENT_CHANNEL_PATTERNS = {
    'Kick': { terms: ['kick', '808 kick'], isDrum: true, newPlugin: '808 Kick', color: '#f97316' },
    'Snare': { terms: ['snare', '808 snare', 'clap', '808 clap'], isDrum: true, newPlugin: '808 Snare', color: '#f97316' },
    'Tom': { terms: ['tom'], isDrum: true, newPlugin: '808 Tom', color: '#f97316' },
    'HiHat': { terms: ['hihat', 'hi hat', 'hi-hat', '808 hihat', 'cymbal'], isDrum: true, newPlugin: '808 HiHat', color: '#eab308' },
    'Bass': { terms: ['flex bass', 'electric bass', 'bass', 'contrabass'], isDrum: false, newPlugin: 'Electric Bass', color: '#8b5cf6' },
    'Piano': { terms: ['grand piano', 'piano', 'organ', 'harmonium'], isDrum: false, newPlugin: 'Grand Piano', color: '#22c55e' },
    'Lead': { terms: ['analog synth', 'violin', 'flute', 'saxophone', 'trumpet'], isDrum: false, newPlugin: 'Analog Synth', color: '#06b6d4' },
    'High': { terms: ['xylophone', 'flute'], isDrum: false, newPlugin: 'Xylophone', color: '#06b6d4' },
};

// ── Helper: PCM → WAV for decodeAudioData ─────────────────────
function pcmToWav(pcmBytes, sampleRate = 48000, numChannels = 2, bitsPerSample = 16) {
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = pcmBytes.byteLength;
    const headerSize = 44;
    const buffer = new ArrayBuffer(headerSize + dataSize);
    const view = new DataView(buffer);

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    const pcmView = new Uint8Array(pcmBytes);
    const wavView = new Uint8Array(buffer);
    wavView.set(pcmView, headerSize);
    return buffer;
}

function writeString(view, offset, str) {
    for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
    }
}

function formatElapsed(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

// ── Component ─────────────────────────────────────────────────
export default function AIMusicGenerator() {
    // Project context
    const {
        setAudioClips, setPlaylistTracks, playlistTracks,
        bpm: projectBpm, setPatterns, setChannels, channels,
        patterns, setActivePatternId,
    } = useProject();

    // State
    const [prompt, setPrompt] = useState('');
    const [bpm, setBpm] = useState(90);
    const [temperature, setTemperature] = useState(1.0);
    const [status, setStatus] = useState('idle');
    const [errorMessage, setErrorMessage] = useState('');
    const [volume, setVolume] = useState(0.8);
    const [isPaused, setIsPaused] = useState(false);
    const [elapsed, setElapsed] = useState(0);
    const [isDownloadingMidi, setIsDownloadingMidi] = useState(false);
    const [isAddingToTrack, setIsAddingToTrack] = useState(false);

    // Refs
    const wsRef = useRef(null);
    const audioCtxRef = useRef(null);
    const gainNodeRef = useRef(null);
    const nextPlayTimeRef = useRef(0);
    const sourceNodesRef = useRef([]);
    const isGeneratingRef = useRef(false);
    const playStartTimeRef = useRef(null);
    const pausedAtRef = useRef(0);
    const elapsedTimerRef = useRef(null);
    const accumulatedChunksRef = useRef([]);

    const isActive = status === 'connecting' || status === 'generating' || status === 'playing' || status === 'paused';
    const isStreaming = status === 'playing' || status === 'paused';
    const hasAudio = accumulatedChunksRef.current.length > 0;

    // ── Audio Context + GainNode ─────────────────────────────
    const getAudioContext = useCallback(() => {
        if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
            audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 48000,
            });
            gainNodeRef.current = audioCtxRef.current.createGain();
            gainNodeRef.current.gain.value = volume;
            gainNodeRef.current.connect(audioCtxRef.current.destination);
        }
        return audioCtxRef.current;
    }, [volume]);

    useEffect(() => {
        if (gainNodeRef.current) {
            gainNodeRef.current.gain.setValueAtTime(volume, audioCtxRef.current?.currentTime || 0);
        }
    }, [volume]);

    // ── Elapsed timer ────────────────────────────────────────
    useEffect(() => {
        if (status === 'playing') {
            if (!playStartTimeRef.current) {
                playStartTimeRef.current = Date.now() - pausedAtRef.current * 1000;
            }
            elapsedTimerRef.current = setInterval(() => {
                setElapsed((Date.now() - playStartTimeRef.current) / 1000);
            }, 250);
        } else if (status === 'paused') {
            clearInterval(elapsedTimerRef.current);
            pausedAtRef.current = elapsed;
        } else {
            clearInterval(elapsedTimerRef.current);
        }
        return () => clearInterval(elapsedTimerRef.current);
    }, [status, elapsed]);

    // ── Cleanup ──────────────────────────────────────────────
    const stopAndCleanup = useCallback(() => {
        isGeneratingRef.current = false;
        if (wsRef.current) {
            try {
                if (wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({ type: 'stop' }));
                }
                wsRef.current.close();
            } catch (e) { }
            wsRef.current = null;
        }
        sourceNodesRef.current.forEach(node => {
            try { node.stop(); } catch (e) { }
        });
        sourceNodesRef.current = [];
        nextPlayTimeRef.current = 0;
        playStartTimeRef.current = null;
        pausedAtRef.current = 0;
        setElapsed(0);
        setIsPaused(false);
        setStatus('stopped');
    }, []);

    useEffect(() => {
        return () => {
            stopAndCleanup();
            if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
                audioCtxRef.current.close().catch(() => { });
            }
        };
    }, [stopAndCleanup]);

    // ── Handle audio chunk ───────────────────────────────────
    const handleAudioChunk = useCallback(async (base64Data) => {
        try {
            const ctx = getAudioContext();
            if (ctx.state === 'suspended' && !isPaused) await ctx.resume();

            const binaryStr = atob(base64Data);
            const pcmBytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
                pcmBytes[i] = binaryStr.charCodeAt(i);
            }

            // Accumulate for download
            accumulatedChunksRef.current.push(pcmBytes);

            const wavBuffer = pcmToWav(pcmBytes.buffer, 48000, 2, 16);
            const audioBuffer = await ctx.decodeAudioData(wavBuffer.slice(0));

            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(gainNodeRef.current);

            const now = ctx.currentTime;
            const startTime = Math.max(now + 0.02, nextPlayTimeRef.current);
            source.start(startTime);
            nextPlayTimeRef.current = startTime + audioBuffer.duration;

            sourceNodesRef.current.push(source);
            source.onended = () => {
                sourceNodesRef.current = sourceNodesRef.current.filter(n => n !== source);
            };
        } catch (e) {
            console.error('Audio chunk processing error:', e);
        }
    }, [getAudioContext, isPaused]);

    // ── Pause / Resume (via GainNode mute) ────────────────────
    const volumeBeforePauseRef = useRef(volume);

    const handlePause = useCallback(() => {
        if (!gainNodeRef.current) return;
        volumeBeforePauseRef.current = gainNodeRef.current.gain.value;
        gainNodeRef.current.gain.setValueAtTime(0, audioCtxRef.current?.currentTime || 0);
        setIsPaused(true);
        setStatus('paused');
    }, []);

    const handleResume = useCallback(() => {
        if (!gainNodeRef.current) return;
        gainNodeRef.current.gain.setValueAtTime(volumeBeforePauseRef.current, audioCtxRef.current?.currentTime || 0);
        setIsPaused(false);
        playStartTimeRef.current = Date.now() - pausedAtRef.current * 1000;
        setStatus('playing');
    }, []);

    // ── Downloads ────────────────────────────────────────────
    const generateFullWavBlob = useCallback(() => {
        if (accumulatedChunksRef.current.length === 0) return null;

        // Merge all Uint8Arrays
        const totalLength = accumulatedChunksRef.current.reduce((acc, curr) => acc + curr.length, 0);
        const merged = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of accumulatedChunksRef.current) {
            merged.set(chunk, offset);
            offset += chunk.length;
        }

        const wavBuffer = pcmToWav(merged.buffer, 48000, 2, 16);
        return new Blob([wavBuffer], { type: 'audio/wav' });
    }, []);

    const handleDownloadWav = useCallback(() => {
        const blob = generateFullWavBlob();
        if (!blob) return;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ai_music_${Date.now()}.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, [generateFullWavBlob]);

    const handleDownloadMidi = useCallback(async () => {
        const blob = generateFullWavBlob();
        if (!blob) return;

        setIsDownloadingMidi(true);
        try {
            const formData = new FormData();
            formData.append('file', blob, 'audio.wav');

            const response = await fetch(`${API_BASE}/midify/convert-to-midi-file?bpm=${bpm}`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) throw new Error('MIDI conversion failed');

            const midiBlob = await response.blob();
            const url = URL.createObjectURL(midiBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ai_music_${Date.now()}.mid`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('MIDI download error:', err);
            alert('Failed to convert to MIDI. Make sure the backend is running with basic-pitch installed.');
        } finally {
            setIsDownloadingMidi(false);
        }
    }, [generateFullWavBlob, bpm]);

    // ── Add to Track (WAV) ───────────────────────────────────
    const handleAddWavToTrack = useCallback(async () => {
        const blob = generateFullWavBlob();
        if (!blob) return;

        setIsAddingToTrack(true);
        try {
            const file = new File([blob], `ai_music_${Date.now()}.wav`, { type: 'audio/wav' });
            const audioBuffer = await decodeAudioFile(file);
            const waveform = generateWaveform(audioBuffer, 2000);
            const durationBeats = audioDurationToBeats(audioBuffer, projectBpm);

            const clipId = Date.now();
            const audioClip = {
                id: clipId,
                fileName: file.name,
                name: `AI Music - ${prompt.slice(0, 30).trim() || 'Generated'}`,
                file,
                audioBuffer,
                waveform,
                duration: audioBuffer.duration,
                durationBeats,
                sampleRate: audioBuffer.sampleRate,
                url: URL.createObjectURL(blob),
            };

            setAudioClips(prev => [...prev, audioClip]);

            const targetTrack = playlistTracks.find(t => t.clips.length === 0) || playlistTracks[0];
            if (targetTrack) {
                setPlaylistTracks(prev => prev.map(t =>
                    t.id === targetTrack.id
                        ? { ...t, clips: [...t.clips, { id: Date.now() + 1, type: 'audio', audioClipId: clipId, offset: 0, length: durationBeats, name: audioClip.name }] }
                        : t
                ));
            }
            console.log('AI audio added to track as WAV:', audioClip.name);
        } catch (err) {
            console.error('Add WAV to track error:', err);
            alert('Failed to add WAV to track.');
        } finally {
            setIsAddingToTrack(false);
        }
    }, [generateFullWavBlob, projectBpm, prompt, playlistTracks, setAudioClips, setPlaylistTracks]);

    // ── Add to Track (MIDI) — Instrument-Aware ──────────────
    const findMatchingChannel = useCallback((searchTerms) => {
        for (const term of searchTerms) {
            const match = channels.find(ch => ch.name.toLowerCase().includes(term.toLowerCase()));
            if (match) return match;
        }
        return null;
    }, [channels]);

    const handleAddMidiToTrack = useCallback(async () => {
        const blob = generateFullWavBlob();
        if (!blob) return;

        setIsAddingToTrack(true);
        try {
            const formData = new FormData();
            formData.append('file', blob, 'audio.wav');

            // Use aggressive thresholds for AI-generated audio (cleaner signal than real recordings)
            const params = new URLSearchParams({
                bpm: bpm,
                onset_threshold: 0.25,
                frame_threshold: 0.12,
                min_note_length_ms: 25
            });

            const response = await fetch(`${API_BASE}/midify/convert?${params}`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) throw new Error('MIDI conversion failed');
            const data = await response.json();

            if (!data.notes || data.notes.length === 0) {
                alert('No notes detected in audio.');
                return;
            }

            // ── Classify notes into instrument groups ──────
            const instrumentGroups = {};

            for (const note of data.notes) {
                const pitch = note.note;
                const duration = note.duration;
                const groupName = classifyNote(pitch, duration);

                if (!instrumentGroups[groupName]) {
                    instrumentGroups[groupName] = [];
                }
                instrumentGroups[groupName].push(note);
            }

            console.log(`🎵 Classifying ${data.notes.length} notes (hard: ${PERC_HARD_THRESHOLD}b, soft: ${PERC_SOFT_THRESHOLD}b)`);
            console.table(data.notes.slice(0, 20).map(n => ({
                pitch: n.note, noteName: n.noteName, duration: n.duration?.toFixed(2),
                classified: classifyNote(n.note, n.duration)
            })));
            console.log('Instrument groups detected:', Object.keys(instrumentGroups).map(k => `${k} (${instrumentGroups[k].length} notes)`));

            // ── Create channels & patterns for each group ──
            const startId = Date.now();
            let groupIndex = 0;
            const createEmptySteps = (length) => {
                const steps = {};
                channels.forEach(ch => { steps[ch.id] = Array(length).fill(false); });
                return steps;
            };

            for (const [groupName, notes] of Object.entries(instrumentGroups)) {
                // Lookup the instrument channel pattern for this group
                const groupInfo = INSTRUMENT_CHANNEL_PATTERNS[groupName] || { terms: [], isDrum: false, newPlugin: groupName, color: '#22c55e' };

                // Find or create channel
                let channelId;
                const existingCh = findMatchingChannel(groupInfo.terms);
                if (existingCh) {
                    channelId = existingCh.id;
                }

                // No existing channel found → create new one
                if (channelId === undefined) {
                    const newChannelName = groupInfo.isDrum ? `808 ${groupName}` : groupInfo.newPlugin;
                    // Convert generator volume (0-1) to channel rack scale (0-100)
                    const channelVol = Math.round(volume * 100);

                    setChannels(prev => {
                        channelId = Math.max(...prev.map(c => c.id), -1) + 1;
                        const newChannel = {
                            id: channelId,
                            name: newChannelName,
                            vol: channelVol,
                            pan: 50,
                            effects: [],
                            pluginId: groupInfo.isDrum ? 'drums' : 'sampler'
                        };
                        audioEngine.createChannel(channelId, newChannel.name);
                        audioEngine.updateChannelVolume(channelId, channelVol);
                        return [...prev, newChannel];
                    });
                }

                // Build pattern notes
                const patternNotes = notes.map((n, idx) => ({
                    id: startId + (groupIndex * 10000) + idx,
                    noteName: n.noteName,
                    channelId: channelId,
                    startStep: Math.round(n.start * 4),
                    length: Math.max(1, Math.round(n.duration * 4)),
                    velocity: n.velocity || 0.8,
                }));

                const maxStep = Math.max(...patternNotes.map(n => n.startStep + n.length), 16);
                const patternLength = Math.ceil(maxStep / 16) * 16;

                // Create pattern
                setPatterns(prev => {
                    const nextPatId = Math.max(...prev.map(p => p.id), 0) + 1;
                    const newSteps = createEmptySteps(patternLength);
                    if (!newSteps[channelId]) newSteps[channelId] = Array(patternLength).fill(false);

                    const groupColor = groupInfo.color;

                    const newPattern = {
                        id: nextPatId,
                        name: `AI Gen - ${groupName}`,
                        color: groupColor,
                        length: patternLength,
                        data: { steps: newSteps, notes: patternNotes },
                    };

                    setActivePatternId(nextPatId);

                    // Place on timeline
                    setPlaylistTracks(prevTracks => {
                        const targetTrack = prevTracks.find(t => t.clips.length === 0)
                            || prevTracks[prevTracks.length - 1];
                        if (targetTrack) {
                            return prevTracks.map(t =>
                                t.id === targetTrack.id
                                    ? { ...t, clips: [...t.clips, { id: Date.now() + groupIndex + nextPatId, type: 'pattern', patternId: nextPatId, offset: 0, length: patternLength }] }
                                    : t
                            );
                        }
                        return prevTracks;
                    });

                    return [...prev, newPattern];
                });

                groupIndex++;
            }

            console.log(`AI MIDI added to track: ${Object.keys(instrumentGroups).length} instrument groups`);
        } catch (err) {
            console.error('Add MIDI to track error:', err);
            alert('Failed to add MIDI to track. Make sure the backend is running with basic-pitch installed.');
        } finally {
            setIsAddingToTrack(false);
        }
    }, [generateFullWavBlob, bpm, volume, channels, patterns, findMatchingChannel, setChannels, setPatterns, setActivePatternId, setPlaylistTracks]);

    // ── Generate ─────────────────────────────────────────────
    const handleGenerate = useCallback(() => {
        if (!prompt.trim()) return;
        if (isGeneratingRef.current) return;

        setErrorMessage('');
        setStatus('connecting');
        setElapsed(0);
        setIsPaused(false);
        isGeneratingRef.current = true;
        playStartTimeRef.current = null;
        pausedAtRef.current = 0;
        accumulatedChunksRef.current = []; // Reset chunks for new generation

        nextPlayTimeRef.current = 0;
        sourceNodesRef.current = [];

        const ctx = getAudioContext();
        if (ctx.state === 'suspended') ctx.resume();

        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
            ws.send(JSON.stringify({
                prompt: prompt.trim(),
                bpm,
                temperature,
            }));
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'audio') {
                    handleAudioChunk(msg.data);
                } else if (msg.type === 'status') {
                    setStatus(msg.status);
                } else if (msg.type === 'error') {
                    setErrorMessage(msg.message);
                    setStatus('error');
                    isGeneratingRef.current = false;
                }
            } catch (e) {
                console.error('WS message parse error:', e);
            }
        };

        ws.onerror = () => {
            setErrorMessage('WebSocket connection failed — is the backend running?');
            setStatus('error');
            isGeneratingRef.current = false;
        };

        ws.onclose = () => {
            if (isGeneratingRef.current) {
                isGeneratingRef.current = false;
                setStatus(prev => (prev === 'error' ? prev : 'stopped'));
            }
        };
    }, [prompt, bpm, temperature, getAudioContext, handleAudioChunk]);

    const handleStop = useCallback(() => {
        stopAndCleanup();
    }, [stopAndCleanup]);

    // ── Keyboard shortcuts ───────────────────────────────────
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey && !isActive && prompt.trim()) {
                e.preventDefault();
                handleGenerate();
            }
            if (e.key === ' ' && isStreaming && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'INPUT') {
                e.preventDefault();
                isPaused ? handleResume() : handlePause();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isActive, isStreaming, prompt, isPaused, handleGenerate, handlePause, handleResume]);

    const vizBars = Array.from({ length: 32 }, (_, i) => ({
        minH: 2 + Math.random() * 4,
        maxH: 8 + Math.random() * 16,
        delay: (i * 0.05).toFixed(2),
    }));

    const charCount = prompt.length;
    const charClass = charCount >= 500 ? 'at-limit' : charCount >= 450 ? 'near-limit' : '';

    return (
        <div className="music-gen-panel">
            {/* Header */}
            <div className="music-gen-header">
                <div className="music-gen-title">
                    <span className="music-gen-title-icon">🎵</span>
                    AI Music Generator
                </div>
                <div className={`music-gen-status ${status}`}>
                    <span className="status-dot" />
                    {STATUS_LABELS[status]}
                </div>
            </div>

            {/* Body */}
            <div className="music-gen-body">
                <div className="music-gen-left">
                    <div className="mg-section-label">Prompt</div>
                    <div className="mg-prompt-wrapper">
                        <textarea
                            className="mg-prompt-textarea"
                            value={prompt}
                            onChange={e => setPrompt(e.target.value.slice(0, 500))}
                            placeholder="Afrobeat groove with deep bass and airy synth pads…"
                            maxLength={500}
                            disabled={isActive}
                            rows={4}
                        />
                        <div className={`mg-char-count ${charClass}`}>
                            {charCount}/500
                        </div>
                    </div>

                    <div className="mg-section-label">Genre Presets</div>
                    <div className="mg-presets">
                        {GENRE_PRESETS.map(g => (
                            <button
                                key={g.label}
                                className="mg-preset-btn"
                                onClick={() => setPrompt(g.prompt)}
                                disabled={isActive}
                                title={g.prompt}
                            >
                                {g.label}
                            </button>
                        ))}
                    </div>

                    {status === 'error' && errorMessage && (
                        <div className="mg-error-banner">
                            ⚠ {errorMessage}
                        </div>
                    )}
                </div>

                <div className="music-gen-right">
                    <div className="mg-section-label">Controls</div>
                    <div className="mg-slider-group">
                        <div className="mg-slider-row">
                            <div className="mg-slider-header">
                                <span className="mg-slider-label">BPM</span>
                                <span className="mg-slider-value">{bpm}</span>
                            </div>
                            <input
                                type="range"
                                className="mg-slider"
                                min={60} max={160} step={1}
                                value={bpm}
                                onChange={e => setBpm(Number(e.target.value))}
                                disabled={isActive}
                            />
                        </div>

                        <div className="mg-slider-row">
                            <div className="mg-slider-header">
                                <span className="mg-slider-label">Creativity</span>
                                <span className="mg-slider-value">{temperature.toFixed(1)}</span>
                            </div>
                            <input
                                type="range"
                                className="mg-slider"
                                min={0.5} max={2.0} step={0.1}
                                value={temperature}
                                onChange={e => setTemperature(Number(e.target.value))}
                                disabled={isActive}
                            />
                        </div>
                    </div>

                    <div className="mg-actions">
                        <button
                            className="mg-generate-btn"
                            onClick={handleGenerate}
                            disabled={isActive || !prompt.trim()}
                        >
                            {status === 'connecting' ? (
                                <><span className="mg-spinner" /> Connecting…</>
                            ) : (
                                <>▶ Generate</>
                            )}
                        </button>
                        <button
                            className="mg-stop-btn"
                            onClick={handleStop}
                            disabled={!isActive}
                        >
                            ⏹ Stop
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Player Controls ──────────────────────────────── */}
            <div className={`mg-player ${isStreaming || status === 'stopped' ? 'visible' : ''}`}>
                <button
                    className="mg-player-btn"
                    onClick={isPaused ? handleResume : handlePause}
                    disabled={!isStreaming}
                    title={isPaused ? 'Resume (Space)' : 'Pause (Space)'}
                >
                    {isPaused ? '▶' : '⏸'}
                </button>

                <button
                    className="mg-player-btn mg-player-stop"
                    onClick={handleStop}
                    disabled={!isStreaming}
                    title="Stop"
                >
                    ⏹
                </button>

                <span className="mg-player-time">
                    {formatElapsed(elapsed)}
                </span>

                {/* Download Buttons */}
                <div className="mg-download-group">
                    <button
                        className="mg-download-btn"
                        onClick={handleDownloadWav}
                        disabled={!hasAudio}
                        title="Download WAV"
                    >
                        <span className="mg-dl-icon">💾</span> WAV
                    </button>
                    <button
                        className={`mg-download-btn ${isDownloadingMidi ? 'loading' : ''}`}
                        onClick={handleDownloadMidi}
                        disabled={!hasAudio || isDownloadingMidi}
                        title="Transcribe to MIDI and Download"
                    >
                        {isDownloadingMidi ? (
                            <><span className="mg-spinner sm" /> MIDI</>
                        ) : (
                            <><span className="mg-dl-icon">🎼</span> MIDI</>
                        )}
                    </button>
                </div>

                {/* Add to Track Buttons */}
                <div className="mg-addtrack-group">
                    <button
                        className={`mg-addtrack-btn ${isAddingToTrack ? 'loading' : ''}`}
                        onClick={handleAddWavToTrack}
                        disabled={!hasAudio || isAddingToTrack}
                        title="Add generated audio to timeline as WAV clip"
                    >
                        {isAddingToTrack ? (
                            <><span className="mg-spinner sm" /> Adding…</>
                        ) : (
                            <>➕ WAV → Track</>
                        )}
                    </button>
                    <button
                        className={`mg-addtrack-btn ${isAddingToTrack ? 'loading' : ''}`}
                        onClick={handleAddMidiToTrack}
                        disabled={!hasAudio || isAddingToTrack}
                        title="Convert to MIDI notes split by instrument and add to timeline"
                    >
                        {isAddingToTrack ? (
                            <><span className="mg-spinner sm" /> Adding…</>
                        ) : (
                            <>➕ MIDI → Track</>
                        )}
                    </button>
                </div>

                <div className="mg-player-volume">
                    <span className="mg-player-vol-icon" title="Volume">
                        {volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
                    </span>
                    <input
                        type="range"
                        className="mg-slider mg-vol-slider"
                        min={0} max={1} step={0.01}
                        value={volume}
                        onChange={e => setVolume(Number(e.target.value))}
                        title={`Volume: ${Math.round(volume * 100)}%`}
                    />
                    <span className="mg-player-vol-val">{Math.round(volume * 100)}%</span>
                </div>
            </div>

            {/* Visualizer */}
            <div className="mg-visualizer">
                {vizBars.map((bar, i) => (
                    <div
                        key={i}
                        className={`mg-viz-bar ${status === 'playing' ? 'active' : ''}`}
                        style={{
                            height: status === 'playing' ? undefined : `${bar.minH}px`,
                            '--min-h': `${bar.minH}px`,
                            '--max-h': `${bar.maxH}px`,
                            animationDelay: `${bar.delay}s`,
                        }}
                    />
                ))}
            </div>
        </div>
    );
}
