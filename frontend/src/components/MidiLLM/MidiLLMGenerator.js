import React, { useState, useCallback, useEffect, useRef } from 'react';
import './MidiLLMGenerator.css';
import { useProject } from '../../contexts/ProjectContext';
import { audioEngine } from '../../audio/AudioEngine';

// ── Genre Presets (tuned for MIDI-LLM's training data) ──────────────────
const GENRE_PRESETS = [
    { label: 'Piano Ballad', prompt: 'A slow and emotional piano ballad in C minor, with expressive dynamics and a melancholic mood' },
    { label: 'Rock', prompt: 'An energetic rock song with distortion guitar, bass, and drums, fast tempo in E minor' },
    { label: 'Jazz', prompt: 'Upbeat and playful jazz music with piano, walking bass, saxophone, and brushed drums' },
    { label: 'Classical', prompt: 'A classical orchestral piece with strings, French horn, and woodwinds in A minor, 4/4 time' },
    { label: 'Electronic', prompt: 'A dark electronic track with pulsing synth bass, arpeggiated leads, and drum machine patterns' },
    { label: 'Pop', prompt: 'A catchy pop song with bright synths, piano chords, and upbeat drums in G major' },
];

const API_BASE = `http://${window.location.hostname || 'localhost'}:8000`;

// ── Prompt Validator ──────────────────────────────────────────────────────
function validateMusicPrompt(prompt) {
    const trimmed = (prompt || '').trim();
    if (!trimmed) return 'Prompt cannot be empty. Please describe the music you want to generate.';
    if (trimmed.length < 10)
        return 'Prompt is too short. Please describe the music you want (e.g., "a calm piano melody in C minor with soft dynamics").';
    const words = trimmed.match(/[a-zA-Z]{2,}/g) || [];
    if (words.length < 2)
        return 'Please enter a valid music description with at least two words (e.g., "upbeat jazz piano").';
    const hasVowels = words.some(w => /[aeiouAEIOU]/.test(w));
    if (!hasVowels)
        return 'Your input doesn\'t appear to be a valid music description. Please describe the style, mood, or instruments you want.';
    const unique = new Set(trimmed.toLowerCase().replace(/\s/g, ''));
    if (unique.size < 4)
        return 'Please enter a meaningful music description instead of repeated characters.';
    const alphaCount = [...trimmed].filter(c => /[a-zA-Z]/.test(c)).length;
    if (alphaCount / trimmed.length < 0.4)
        return 'Your prompt contains too many numbers or symbols. Please describe the music you want in words.';
    const consonantRuns = trimmed.match(/[bcdfghjklmnpqrstvwxyz]{5,}/gi) || [];
    if (consonantRuns.length >= 2)
        return 'Your input looks like random text. Please enter a real music description (e.g., "smooth jazz with piano and saxophone").';
    return null;
}

// ── Component ─────────────────────────────────────────────────────────────
export default function MidiLLMGenerator() {
    const {
        setPatterns, setChannels, channels,
        setActivePatternId, setPlaylistTracks,
        bpm: projectBpm,
    } = useProject();

    // State
    const [prompt, setPrompt] = useState('');
    const [temperature, setTemperature] = useState(1.0);
    const [maxTokens, setMaxTokens] = useState(768);
    const [status, setStatus] = useState('checking'); // checking | available | loading | generating | done | error | unavailable
    const [errorMessage, setErrorMessage] = useState('');
    const [lastResult, setLastResult] = useState(null);
    const [isAddingToTrack, setIsAddingToTrack] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    const abortRef = useRef(null);

    // ── Check model health on mount ─────────────────────────────────────
    useEffect(() => {
        const checkHealth = async () => {
            try {
                const res = await fetch(`${API_BASE}/midi-llm/health`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.status === 'available') {
                        setStatus('available');
                    } else if (data.status === 'unavailable') {
                        setStatus('unavailable');
                        setErrorMessage(data.reason || 'Model not available');
                    } else {
                        setStatus('available');
                    }
                } else {
                    setStatus('unavailable');
                    setErrorMessage('Backend not reachable');
                }
            } catch {
                setStatus('unavailable');
                setErrorMessage('Cannot connect to backend. Make sure it is running on port 8000.');
            }
        };
        checkHealth();
    }, []);

    // ── Generate ────────────────────────────────────────────────────────
    const handleGenerate = useCallback(async () => {
        if (!prompt.trim()) return;

        // Validate prompt before sending to backend
        const validationError = validateMusicPrompt(prompt);
        if (validationError) {
            setErrorMessage(validationError);
            setStatus('error');
            return;
        }

        setStatus('generating');
        setErrorMessage('');
        setLastResult(null);

        const controller = new AbortController();
        abortRef.current = controller;

        try {
            const res = await fetch(`${API_BASE}/midi-llm/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: prompt.trim(),
                    temperature,
                    top_p: 0.98,
                    max_tokens: maxTokens,
                }),
                signal: controller.signal,
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({ detail: 'Unknown error' }));
                throw new Error(err.detail || `HTTP ${res.status}`);
            }

            const data = await res.json();

            if (!data.notes || data.notes.length === 0) {
                throw new Error('No notes generated. Try a different prompt or higher temperature.');
            }

            setLastResult(data);
            setStatus('done');
        } catch (err) {
            if (err.name === 'AbortError') {
                setStatus('available');
            } else {
                setErrorMessage(err.message);
                setStatus('error');
            }
        }
    }, [prompt, temperature, maxTokens]);

    // ── Stop generation ─────────────────────────────────────────────────
    const handleStop = useCallback(() => {
        if (abortRef.current) {
            abortRef.current.abort();
            abortRef.current = null;
        }
    }, []);

    // ── Add to Track ────────────────────────────────────────────────────
    const handleAddToTrack = useCallback(async () => {
        if (!lastResult?.notes?.length) return;

        setIsAddingToTrack(true);
        try {
            const notes = lastResult.notes;
            const promptLabel = prompt ? prompt.slice(0, 25).trim() : 'Generated';

            // Create channel
            const channelId = Math.max(...channels.map(c => c.id), -1) + 1;
            const newChannel = {
                id: channelId,
                name: `MIDI: ${promptLabel}`,
                vol: 80,
                pan: 50,
                effects: [],
                pluginId: 'sampler',
            };

            setChannels(prev => {
                audioEngine.createChannel(channelId, newChannel.name);
                audioEngine.updateChannelVolume(channelId, 80);
                return [...prev, newChannel];
            });

            // Build pattern notes
            const startId = Date.now();
            const patternNotes = notes.map((n, idx) => ({
                id: startId + idx,
                noteName: n.noteName,
                channelId: channelId,
                startStep: Math.round(n.start * 4),
                length: Math.max(1, Math.round(n.duration * 4)),
                velocity: n.velocity || 0.8,
            }));

            const maxStep = Math.max(...patternNotes.map(n => n.startStep + n.length), 16);
            const patternLength = Math.ceil(maxStep / 16) * 16;

            // Create steps object
            const steps = {};
            channels.forEach(ch => { steps[ch.id] = Array(patternLength).fill(false); });
            steps[channelId] = Array(patternLength).fill(false);

            // Create pattern + place on timeline
            setPatterns(prev => {
                const nextPatId = Math.max(...prev.map(p => p.id), 0) + 1;
                const newPattern = {
                    id: nextPatId,
                    name: `MIDI-LLM: ${promptLabel}`,
                    color: '#8b5cf6',
                    length: patternLength,
                    data: { steps, notes: patternNotes },
                };

                setActivePatternId(nextPatId);

                setPlaylistTracks(prevTracks => {
                    const targetTrack = prevTracks.find(t => t.clips.length === 0)
                        || prevTracks[prevTracks.length - 1];
                    if (targetTrack) {
                        return prevTracks.map(t =>
                            t.id === targetTrack.id
                                ? { ...t, clips: [...t.clips, { id: Date.now() + nextPatId, type: 'pattern', patternId: nextPatId, offset: 0, length: patternLength }] }
                                : t
                        );
                    }
                    return prevTracks;
                });

                return [...prev, newPattern];
            });

            console.log(`MIDI-LLM: Added ${notes.length} notes to track`);
        } catch (err) {
            console.error('Add to track error:', err);
            alert('Failed to add MIDI to track.');
        } finally {
            setIsAddingToTrack(false);
        }
    }, [lastResult, prompt, channels, setChannels, setPatterns, setActivePatternId, setPlaylistTracks]);

    // ── Download .mid ───────────────────────────────────────────────────
    const handleDownload = useCallback(async () => {
        if (!prompt.trim()) return;

        // Validate prompt before downloading
        const validationError = validateMusicPrompt(prompt);
        if (validationError) {
            setErrorMessage(validationError);
            setStatus('error');
            return;
        }

        setIsDownloading(true);
        try {
            const res = await fetch(`${API_BASE}/midi-llm/generate-file`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: prompt.trim(),
                    temperature,
                    top_p: 0.98,
                    max_tokens: maxTokens,
                }),
            });

            if (!res.ok) throw new Error('Download failed');

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `midi_llm_${Date.now()}.mid`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Download error:', err);
            alert('Failed to download MIDI file.');
        } finally {
            setIsDownloading(false);
        }
    }, [prompt, temperature, maxTokens]);

    // ── Keyboard ────────────────────────────────────────────────────────
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey && status === 'available' && prompt.trim()) {
                e.preventDefault();
                handleGenerate();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [status, prompt, handleGenerate]);

    const isActive = status === 'generating' || status === 'loading';
    const hasResult = lastResult && lastResult.notes && lastResult.notes.length > 0;
    const charCount = prompt.length;
    const charClass = charCount >= 900 ? 'at-limit' : charCount >= 800 ? 'near-limit' : '';

    const statusLabel = {
        checking: 'Checking…',
        available: 'Ready',
        loading: 'Loading Model…',
        generating: 'Generating…',
        done: 'Complete',
        error: 'Error',
        unavailable: 'Unavailable',
    }[status] || status;

    // ── Unavailable state ───────────────────────────────────────────────
    if (status === 'unavailable') {
        return (
            <div className="midi-llm-panel">
                <div className="midi-llm-header">
                    <div className="midi-llm-title">
                        <span className="midi-llm-title-icon">🎹</span>
                        MIDI-LLM Generator
                        <span className="midi-llm-badge">Text → MIDI</span>
                    </div>
                    <div className={`midi-llm-status unavailable`}>
                        <span className="status-dot" />
                        Unavailable
                    </div>
                </div>
                <div className="mll-unavailable">
                    <div className="mll-unavailable-icon">⚠️</div>
                    <div className="mll-unavailable-title">MIDI-LLM Not Available</div>
                    <div className="mll-unavailable-reason">
                        {errorMessage || 'The MIDI-LLM model could not be loaded.'}
                        <br /><br />
                        <strong>Requirements:</strong> CUDA GPU, PyTorch, transformers, bitsandbytes, anticipation
                    </div>
                </div>
            </div>
        );
    }

    // ── Main render ─────────────────────────────────────────────────────
    return (
        <div className="midi-llm-panel">
            {/* Header */}
            <div className="midi-llm-header">
                <div className="midi-llm-title">
                    <span className="midi-llm-title-icon">🎹</span>
                    MIDI-LLM Generator
                    <span className="midi-llm-badge">Text → MIDI</span>
                </div>
                <div className={`midi-llm-status ${status}`}>
                    <span className="status-dot" />
                    {statusLabel}
                </div>
            </div>

            {/* Body */}
            <div className="midi-llm-body" style={{ position: 'relative' }}>
                {/* Loading model overlay */}
                {status === 'loading' && (
                    <div className="mll-loading-overlay">
                        <div className="mll-loading-spinner" />
                        <div className="mll-loading-text">Loading MIDI-LLM Model…</div>
                        <div className="mll-loading-subtext">First load downloads ~2 GB weights</div>
                    </div>
                )}

                {/* Left: Prompt + Presets */}
                <div className="midi-llm-left">
                    <div className="mll-section-label">Prompt</div>
                    <div className="mll-prompt-wrapper">
                        <textarea
                            className="mll-prompt-textarea"
                            value={prompt}
                            onChange={e => setPrompt(e.target.value.slice(0, 1000))}
                            placeholder="A melodic rock song with piano, distortion guitar, and drums in A minor…"
                            maxLength={1000}
                            disabled={isActive}
                            rows={4}
                        />
                        <div className={`mll-char-count ${charClass}`}>
                            {charCount}/1000
                        </div>
                    </div>

                    <div className="mll-section-label">Style Presets</div>
                    <div className="mll-presets">
                        {GENRE_PRESETS.map(g => (
                            <button
                                key={g.label}
                                className="mll-preset-btn"
                                onClick={() => setPrompt(g.prompt)}
                                disabled={isActive}
                                title={g.prompt}
                            >
                                {g.label}
                            </button>
                        ))}
                    </div>

                    {status === 'error' && errorMessage && (
                        <div className="mll-error-banner">
                            ⚠ {errorMessage}
                        </div>
                    )}
                </div>

                {/* Right: Controls */}
                <div className="midi-llm-right">
                    <div className="mll-section-label">Controls</div>
                    <div className="mll-slider-group">
                        <div className="mll-slider-row">
                            <div className="mll-slider-header">
                                <span className="mll-slider-label">Temperature</span>
                                <span className="mll-slider-value">{temperature.toFixed(1)}</span>
                            </div>
                            <input
                                type="range"
                                className="mll-slider"
                                min={0.1} max={2.0} step={0.1}
                                value={temperature}
                                onChange={e => setTemperature(Number(e.target.value))}
                                disabled={isActive}
                            />
                        </div>

                        <div className="mll-slider-row">
                            <div className="mll-slider-header">
                                <span className="mll-slider-label">Max Length</span>
                                <span className="mll-slider-value">{maxTokens}</span>
                            </div>
                            <input
                                type="range"
                                className="mll-slider"
                                min={256} max={2048} step={128}
                                value={maxTokens}
                                onChange={e => setMaxTokens(Number(e.target.value))}
                                disabled={isActive}
                            />
                        </div>
                    </div>

                    <div className="mll-actions">
                        <button
                            className="mll-generate-btn"
                            onClick={handleGenerate}
                            disabled={isActive || !prompt.trim() || status === 'checking'}
                        >
                            {status === 'generating' ? (
                                <><span className="mll-spinner" /> Generating…</>
                            ) : (
                                <>▶ Generate MIDI</>
                            )}
                        </button>
                        <button
                            className="mll-stop-btn"
                            onClick={handleStop}
                            disabled={!isActive}
                        >
                            ⏹
                        </button>
                    </div>
                </div>
            </div>

            {/* Results bar */}
            <div className={`mll-results ${hasResult ? 'visible' : ''}`}>
                <div className="mll-results-info">
                    <div className="mll-results-stat">
                        🎵 <strong>{lastResult?.total_notes || 0}</strong> notes
                    </div>
                    <div className="mll-results-stat">
                        ⏱ <strong>{lastResult?.generation_time_seconds?.toFixed(1) || '0'}s</strong>
                    </div>
                </div>
                <div className="mll-results-actions">
                    <button
                        className={`mll-add-btn ${isAddingToTrack ? 'loading' : ''}`}
                        onClick={handleAddToTrack}
                        disabled={!hasResult || isAddingToTrack}
                    >
                        {isAddingToTrack ? (
                            <><span className="mll-spinner sm" /> Adding…</>
                        ) : (
                            <>➕ Add to Track</>
                        )}
                    </button>
                    <button
                        className={`mll-download-btn ${isDownloading ? 'loading' : ''}`}
                        onClick={handleDownload}
                        disabled={!prompt.trim() || isDownloading}
                    >
                        {isDownloading ? (
                            <><span className="mll-spinner sm" /> …</>
                        ) : (
                            <>💾 .mid</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
