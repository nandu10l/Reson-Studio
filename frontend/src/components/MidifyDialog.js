import React, { useState } from 'react';
import { useProject } from '../contexts/ProjectContext';
import './MidifyDialog.css';

/**
 * MidifyDialog - Audio to MIDI conversion modal
 * Shows all audio clips in the project and allows converting them to MIDI patterns.
 */
export default function MidifyDialog({ isOpen, onClose }) {
    const {
        audioClips,
        midifyAudioClip
    } = useProject();

    // Track conversion state per clip: 'idle' | 'converting' | 'success' | 'error'
    const [clipStates, setClipStates] = useState({});

    if (!isOpen) return null;

    const formatDuration = (seconds) => {
        if (!seconds || isNaN(seconds)) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const handleConvert = async (clipId) => {
        setClipStates(prev => ({ ...prev, [clipId]: 'converting' }));

        try {
            await midifyAudioClip(clipId);
            setClipStates(prev => ({ ...prev, [clipId]: 'success' }));
        } catch (err) {
            console.error('Midify conversion failed:', err);
            setClipStates(prev => ({ ...prev, [clipId]: 'error' }));
        }
    };

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div className="midify-overlay" onClick={handleOverlayClick}>
            <div className="midify-dialog">
                {/* Header */}
                <div className="midify-header">
                    <div className="midify-header-left">
                        <div className="midify-header-icon">🎵</div>
                        <div>
                            <div className="midify-title">Midify — Audio to MIDI</div>
                            <div className="midify-subtitle">Convert audio clips to editable MIDI patterns</div>
                        </div>
                    </div>
                    <button className="midify-close-btn" onClick={onClose} title="Close">
                        ✕
                    </button>
                </div>

                {/* Info banner */}
                <div className="midify-info">
                    <span className="midify-info-icon">💡</span>
                    <span className="midify-info-text">
                        Works best with <strong>single-note melodies</strong> (vocals, guitar, flute).
                        Complex audio with chords or drums may produce inaccurate results.
                    </span>
                </div>

                {/* Clips list */}
                <div className="midify-clips-list">
                    {audioClips.length === 0 ? (
                        <div className="midify-empty">
                            <div className="midify-empty-icon">🎧</div>
                            <div className="midify-empty-text">No audio clips in project</div>
                            <div className="midify-empty-hint">Import audio files first, then come back to convert them</div>
                        </div>
                    ) : (
                        audioClips.map(clip => {
                            const state = clipStates[clip.id] || 'idle';

                            return (
                                <div
                                    key={clip.id}
                                    className={`midify-clip-row ${state === 'converting' ? 'converting' : ''}`}
                                >
                                    <div className="midify-clip-icon">🎤</div>
                                    <div className="midify-clip-info">
                                        <div className="midify-clip-name">{clip.name || clip.fileName}</div>
                                        <div className="midify-clip-meta">
                                            {formatDuration(clip.duration)} • {clip.sampleRate ? `${(clip.sampleRate / 1000).toFixed(1)}kHz` : 'Unknown'}
                                        </div>
                                    </div>

                                    {state === 'idle' && (
                                        <button
                                            className="midify-convert-btn"
                                            onClick={() => handleConvert(clip.id)}
                                        >
                                            Convert to MIDI
                                        </button>
                                    )}

                                    {state === 'converting' && (
                                        <div className="midify-converting-indicator">
                                            <div className="midify-spinner" />
                                            Analyzing...
                                        </div>
                                    )}

                                    {state === 'success' && (
                                        <div className="midify-success-badge">
                                            ✓ Pattern created
                                        </div>
                                    )}

                                    {state === 'error' && (
                                        <div className="midify-error-badge">
                                            <span>✗</span>
                                            <span className="midify-error-text">Conversion failed</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}
