import React, { useState, useCallback } from 'react';
import SeedEditor from './SeedEditor';
import GenerationControls from './GenerationControls';
import ResultPreview from './ResultPreview';
import { generateMusic, getGeneratedHistory, getHistoryItem, C_MAJOR_SEED } from '../../services/aiComposerService';
import { audioEngine } from '../../audio/AudioEngine';
import * as Tone from 'tone';
import './AIComposer.css';

const DEFAULT_PARAMS = {
    numNotes: 200,
    tempo: 120,
    velocity: 80,
    noteDuration: 0.3,
    instrument: 0,
};

export default function AIComposer({ onImport }) {
    const [seedNotes, setSeedNotes] = useState([...C_MAJOR_SEED]);
    const [params, setParams] = useState(DEFAULT_PARAMS);
    const [isGenerating, setIsGenerating] = useState(false);
    const [result, setResult] = useState(null); // { notes, midiBase64, duration_seconds }
    const [history, setHistory] = useState([]);
    const [error, setError] = useState(null);

    const loadHistory = useCallback(async () => {
        try {
            const data = await getGeneratedHistory();
            setHistory(data.files || []);
        } catch (err) {
            console.error('Failed to load history:', err);
        }
    }, []);

    React.useEffect(() => {
        loadHistory();
    }, [loadHistory]);

    const handleSelectHistoryItem = async (item) => {
        try {
            const data = await getHistoryItem(item.filename);
            setResult({ ...data, filename: item.filename });
        } catch (err) {
            setError('Failed to load history item');
        }
    };

    const handleGenerate = useCallback(async () => {
        setIsGenerating(true);
        setError(null);
        try {
            const data = await generateMusic({
                seedNotes,
                numNotes: params.numNotes,
                tempo: params.tempo,
                velocity: params.velocity,
                noteDuration: params.noteDuration,
            });
            setResult(data);
            loadHistory(); // Refresh list
        } catch (err) {
            setError(err.message || 'Generation failed — is the backend running?');
        } finally {
            setIsGenerating(false);
        }
    }, [seedNotes, params]);

    // Play preview using Web Audio (simple tone scheduling)
    const handlePlay = useCallback(async () => {
        if (!result?.notes?.length) return;
        try {
            // Use the global Tone.js context to avoid conflicts/crashes on multiple generations
            await audioEngine.init();
            const toneCtx = Tone.getContext();
            const ctx = toneCtx.rawContext;

            if (toneCtx.state === 'suspended') await toneCtx.resume();

            const startTime = ctx.currentTime + 0.05;
            const stepDuration = 15 / params.tempo;

            const masterGain = audioEngine.getMasterGain();

            result.notes.forEach((midi, i) => {
                const time = startTime + i * stepDuration;
                const dur = Math.max(0.05, stepDuration * 0.9);

                const freq = 440 * Math.pow(2, (midi - 69) / 12);
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.value = freq;

                const velocity = params.velocity || 80;
                gain.gain.setValueAtTime(velocity / 127 * 0.3, time);
                gain.gain.exponentialRampToValueAtTime(0.0001, time + dur * 0.9);

                osc.connect(gain);
                // Connect to audioEngine's master gain so it respects global volume
                if (masterGain && masterGain.input) {
                    gain.connect(masterGain.input);
                } else {
                    gain.connect(ctx.destination);
                }

                osc.start(time);
                osc.stop(time + dur);
            });
        } catch (e) {
            console.error('Preview playback failed:', e);
        }
    }, [result, params]);

    // Import notes into Piano Roll as MIDI notes
    const handleImport = useCallback((notes) => {
        if (onImport) {
            const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

            const midiNotes = notes.map((pitch, i) => {
                const octave = Math.floor(pitch / 12) - 1;
                const noteName = `${NOTES[pitch % 12]}${octave}`;

                // Convert to steps (16th notes)
                // Each note in this simplified version is 1 step long by default
                const startStep = i;
                const length = 1;

                return {
                    id: `ai-${Date.now()}-${i}`,
                    pitch,
                    noteName,
                    startStep,
                    length,
                    velocity: params.velocity || 80,
                };
            });
            onImport(midiNotes);
        } else {
            alert('Open the Piano Roll first, then import.');
        }
    }, [onImport, params]);

    return (
        <div className="ai-composer-panel">
            {/* Header */}
            <div className="ai-composer-header">
                <div className="ai-composer-title">
                    <span className="ai-composer-title-icon">✨</span>
                    AI Composer
                </div>
            </div>

            {/* Body */}
            <div className="ai-composer-body">
                {/* Left column: History Workspace */}
                <div className="ai-composer-workspace">
                    <div className="ai-section-label">History Workspace</div>
                    <div className="ai-history-list">
                        {history.length === 0 ? (
                            <div className="ai-history-empty">No history yet</div>
                        ) : (
                            history.map((item, idx) => (
                                <div
                                    key={item.filename}
                                    className={`ai-history-item ${result?.filename === item.filename ? 'active' : ''}`}
                                    onClick={() => handleSelectHistoryItem(item)}
                                >
                                    <div className="ai-history-item-icon">🎵</div>
                                    <div className="ai-history-item-info">
                                        <div className="ai-history-item-name">Generation {history.length - idx}</div>
                                        <div className="ai-history-item-date">
                                            {new Date(item.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Middle column: Seed Editor */}
                <div className="ai-composer-left">
                    <div className="ai-section-label">Seed Notes (50)</div>
                    <SeedEditor seedNotes={seedNotes} onChange={setSeedNotes} />
                </div>

                {/* Right column: Controls + Generate */}
                <div className="ai-composer-right">
                    <div className="ai-section-label" style={{ padding: 0, border: 'none', background: 'transparent' }}>
                        Generation Settings
                    </div>

                    <GenerationControls params={params} onChange={setParams} />

                    {error && (
                        <div className="ai-error-banner">⚠ {error}</div>
                    )}

                    <div className="generate-btn-wrapper">
                        <button
                            className="generate-btn"
                            onClick={handleGenerate}
                            disabled={isGenerating}
                        >
                            {isGenerating ? (
                                <>
                                    <span className="ai-spinner" />
                                    Generating…
                                </>
                            ) : (
                                <>
                                    <span className="generate-btn-icon">✨</span>
                                    Generate
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Result Preview (bottom strip) */}
            <ResultPreview
                notes={result?.notes}
                midiBase64={result?.midi_base64}
                duration={result?.duration_seconds}
                onPlay={result ? handlePlay : null}
                onImport={result ? handleImport : null}
            />
        </div>
    );
}
