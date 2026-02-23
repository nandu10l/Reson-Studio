import React, { useState, useCallback } from 'react';
import SeedEditor from './SeedEditor';
import GenerationControls from './GenerationControls';
import ResultPreview from './ResultPreview';
import { generateMusic, C_MAJOR_SEED } from '../../services/aiComposerService';
import { audioEngine } from '../../audio/AudioEngine';
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
    const [error, setError] = useState(null);

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
            const ctx = audioEngine.context || new (window.AudioContext || window.webkitAudioContext)();
            if (ctx.state === 'suspended') await ctx.resume();

            let time = ctx.currentTime + 0.05;
            const dur = params.noteDuration;

            result.notes.forEach((midi) => {
                const freq = 440 * Math.pow(2, (midi - 69) / 12);
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'triangle';
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(params.velocity / 127 * 0.3, time);
                gain.gain.exponentialRampToValueAtTime(0.0001, time + dur * 0.9);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(time);
                osc.stop(time + dur);
                time += dur;
            });
        } catch (e) {
            console.error('Preview playback failed:', e);
        }
    }, [result, params]);

    // Import notes into Piano Roll as MIDI notes
    const handleImport = useCallback((notes) => {
        if (onImport) {
            const dur = params.noteDuration;
            const midiNotes = notes.map((pitch, i) => ({
                pitch,
                startBeat: i * dur * (params.tempo / 60),
                duration: dur * (params.tempo / 60) * 0.9,
                velocity: params.velocity,
            }));
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
                {/* Left column: Seed Editor */}
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
