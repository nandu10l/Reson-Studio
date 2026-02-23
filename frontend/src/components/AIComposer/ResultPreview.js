import React, { useEffect, useRef } from 'react';
import { downloadMidi } from '../../services/aiComposerService';

const MIDI_MIN = 37;
const MIDI_MAX = 69;

function drawNotes(canvas, notes) {
    if (!canvas || !notes || notes.length === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const W = notes.length * 5; // 5px per note
    canvas.width = Math.max(W, 600) * dpr;
    canvas.height = 70 * dpr;
    canvas.style.width = `${Math.max(W, 600)}px`;
    canvas.style.height = '70px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, Math.max(W, 600), 70);
    ctx.fillStyle = '#141414';
    ctx.fillRect(0, 0, Math.max(W, 600), 70);

    const range = MIDI_MAX - MIDI_MIN || 1;
    notes.forEach((midi, i) => {
        const t = Math.max(0, Math.min(1, (midi - MIDI_MIN) / range));
        const r = Math.round(80 + t * 130);
        const g = Math.round(20 + t * 30);
        const b = Math.round(200 - t * 40);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        const barH = Math.round(t * 50 + 10);
        ctx.fillRect(i * 5, 70 - barH, 4, barH);
    });
}

export default function ResultPreview({ notes, midiBase64, duration, onImport, onPlay }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        if (canvasRef.current && notes && notes.length > 0) {
            drawNotes(canvasRef.current, notes);
        }
    }, [notes]);

    const uniquePitches = notes ? new Set(notes).size : 0;

    if (!notes || notes.length === 0) {
        return (
            <div className="ai-composer-result">
                <div className="ai-section-label">Result Preview</div>
                <div className="result-placeholder">
                    Hit ✨ Generate to create music
                </div>
            </div>
        );
    }

    return (
        <div className="ai-composer-result">
            <div className="ai-section-label">Result Preview</div>

            {/* Scrollable note visualizer */}
            <div className="result-visualizer-scroll">
                <canvas ref={canvasRef} className="result-visualizer-canvas" />
            </div>

            {/* Stats bar */}
            <div className="result-stats">
                <span className="result-stat"><strong>{notes.length}</strong> notes</span>
                <span className="result-stat"><strong>{duration?.toFixed(1) ?? '—'}s</strong></span>
                <span className="result-stat"><strong>{uniquePitches}</strong> unique pitches</span>
            </div>

            {/* Action buttons */}
            <div className="result-actions">
                {onPlay && (
                    <button className="result-action-btn" onClick={onPlay} title="Play preview">
                        ▶ Play
                    </button>
                )}
                <button
                    className="result-action-btn"
                    onClick={() => downloadMidi(midiBase64)}
                    title="Download generated MIDI"
                >
                    ↓ Download MIDI
                </button>
                {onImport && (
                    <button
                        className="result-action-btn primary"
                        onClick={() => onImport(notes)}
                        title="Import into Piano Roll"
                    >
                        → Import to Piano Roll
                    </button>
                )}
            </div>
        </div>
    );
}
