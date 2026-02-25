import React, { useState, useEffect, useCallback, useRef } from 'react';
import './ChordProgressionGenerator.css';
import { Sliders, Music, Play, RotateCcw, Search, Settings, TrendingUp } from './icons/BlenderIcons';

const CHORD_TYPES = {
    major: [0, 4, 7],
    minor: [0, 3, 7],
    major7: [0, 4, 7, 11],
    minor7: [0, 3, 7, 10],
    dom7: [0, 4, 7, 10],
    dim: [0, 3, 6]
};

const SCALES = {
    'C Major': [0, 2, 4, 5, 7, 9, 11],
    'A Minor': [0, 2, 3, 5, 7, 8, 10],
    'G Major': [7, 9, 11, 0, 2, 4, 6],
    'E Minor': [4, 6, 7, 9, 11, 0, 2],
    'F Major': [5, 7, 9, 10, 0, 2, 4],
    'D Minor': [2, 4, 5, 7, 9, 10, 0]
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const ChordProgressionGenerator = ({ onClose, onAccept, channelId, initialBpm = 120 }) => {
    const [count, setCount] = useState(4);
    const [octave, setOctave] = useState(4);
    const [length, setLength] = useState('Bar');
    const [complexity, setComplexity] = useState(50);
    const [activeTab, setActiveTab] = useState('Presets');
    const [progression, setProgression] = useState([]);
    const [scale, setScale] = useState('C Major');

    // Drag support
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const isDragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0 });

    const handleHeaderMouseDown = useCallback((e) => {
        if (e.target.tagName === 'BUTTON') return;
        isDragging.current = true;
        dragStart.current = { x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y };

        const handleMouseMove = (mmE) => {
            if (!isDragging.current) return;
            setDragOffset({
                x: mmE.clientX - dragStart.current.x,
                y: mmE.clientY - dragStart.current.y
            });
        };

        const handleMouseUp = () => {
            isDragging.current = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [dragOffset]);

    const generateNotes = useCallback(() => {
        const newProgression = [];
        const scaleNotes = SCALES[scale];
        const rootIndex = NOTE_NAMES.indexOf(scale.split(' ')[0]);

        for (let i = 0; i < count; i++) {
            // Pick a random degree from the scale
            const degree = Math.floor(Math.random() * scaleNotes.length);
            const rootPitch = (rootIndex + scaleNotes[degree]) % 12;

            // Determine chord type based on degree (simplified)
            let type = 'major';
            if (scale.includes('Major')) {
                if ([1, 2, 5].includes(degree)) type = 'minor';
                if (degree === 6) type = 'dim';
            } else {
                if ([0, 3, 4].includes(degree)) type = 'minor';
                if (degree === 1) type = 'dim';
            }

            // Complexity: add 7ths
            if (complexity > 60 && Math.random() > 0.5) {
                type += '7';
                if (type === 'major7' && degree === 4) type = 'dom7'; // V7
            }

            const intervals = CHORD_TYPES[type] || CHORD_TYPES.major;
            const notes = intervals.map(interval => {
                const pitch = (rootPitch + interval) % 12;
                const noteOctave = octave + Math.floor((rootPitch + interval) / 12);
                return `${NOTE_NAMES[pitch]}${noteOctave}`;
            });

            newProgression.push({
                name: `${NOTE_NAMES[rootPitch]}${type === 'minor' ? 'm' : (type === 'dim' ? 'dim' : '')}${type.includes('7') ? '7' : ''}`,
                notes
            });
        }
        setProgression(newProgression);
    }, [count, octave, complexity, scale]);

    useEffect(() => {
        generateNotes();
    }, []);

    const handleAccept = () => {
        // Convert progression to MIDI notes for Piano Roll
        // length 'Bar' = 16 steps
        const stepsPerChord = length === 'Bar' ? 16 : 4;
        const allNotes = [];

        progression.forEach((chord, i) => {
            chord.notes.forEach(noteName => {
                allNotes.push({
                    id: Date.now() + Math.random(),
                    noteName,
                    channelId,
                    startStep: i * stepsPerChord,
                    length: stepsPerChord,
                    velocity: 100
                });
            });
        });

        onAccept(allNotes);
        onClose();
    };

    return (
        <div className="chord-generator-overlay">
            <div
                className="chord-generator-modal"
                style={{ transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` }}
            >
                {/* Header */}
                <div className="chord-generator-header" onMouseDown={handleHeaderMouseDown}>
                    <span className="chord-generator-title">Piano roll - generate chord progression</span>
                    <button className="chord-generator-close" onClick={onClose}>×</button>
                </div>

                {/* Toolbar */}
                <div className="chord-generator-toolbar">
                    <div className="toolbar-top">
                        <div className="solo-group">
                            <button className="play-btn"><Play size={14} /></button>
                            <button className="solo-btn">Solo</button>
                        </div>
                        <div className="generate-group">
                            <div className="toolbar-item">
                                <span className="toolbar-label">Count</span>
                                <input
                                    className="toolbar-input"
                                    type="number"
                                    value={count}
                                    onChange={(e) => setCount(parseInt(e.target.value) || 1)}
                                />
                            </div>
                            <div className="toolbar-item">
                                <span className="toolbar-label">Octave</span>
                                <input
                                    className="toolbar-input"
                                    type="number"
                                    value={octave}
                                    onChange={(e) => setOctave(parseInt(e.target.value) || 1)}
                                />
                            </div>
                            <div className="toolbar-item">
                                <span className="toolbar-label">Length</span>
                                <select
                                    className="toolbar-input"
                                    style={{ width: '60px' }}
                                    value={length}
                                    onChange={(e) => setLength(e.target.value)}
                                >
                                    <option>Bar</option>
                                    <option>Beat</option>
                                </select>
                            </div>
                            <button className="settings-btn"><Settings size={14} /></button>
                            <button className="generate-btn" onClick={generateNotes}>Generate</button>
                            <button className="random-btn" onClick={generateNotes} title="Randomize progression"><RotateCcw size={14} /></button>
                            <button className="search-btn"><Search size={14} /></button>
                        </div>
                    </div>

                    <div className="toolbar-middle">
                        <span>Conventional</span>
                        <div className="complexity-slider-container">
                            <input
                                type="range"
                                className="complexity-slider"
                                value={complexity}
                                onChange={(e) => setComplexity(parseInt(e.target.value))}
                            />
                        </div>
                        <span>Adventurous</span>
                    </div>
                </div>



                {/* Main View */}
                <div>
                    <div className="chord-display-area">
                        {progression.map((chord, i) => (
                            <div key={i} className="chord-block">
                                <div className="chord-block-header">
                                    <Music size={10} />
                                    <span>{scale}</span>
                                </div>
                                <div className="chord-block-content">
                                    <div className="chord-lines">
                                        <div className="chord-line" />
                                        <div className="chord-line" />
                                        <div className="chord-line" />
                                    </div>
                                    <span className="chord-name">{chord.name}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Tabs */}
                <div className="chord-tabs">
                    <button
                        className={`tab-btn ${activeTab === 'Presets' ? 'active' : ''}`}
                        onClick={() => setActiveTab('Presets')}
                    >Presets</button>
                </div>

                <div className="tab-content">
                    {activeTab === 'Presets' && (
                        <div className="preset-row">
                            <RotateCcw size={14} style={{ cursor: 'pointer' }} onClick={generateNotes} title="Randomize" />
                            <select
                                className="preset-select"
                                value={scale}
                                onChange={(e) => setScale(e.target.value)}
                            >
                                {Object.keys(SCALES).map(s => <option key={s}>{s}</option>)}
                            </select>
                        </div>
                    )}
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '10px' }}>
                        Learn from MIDI input (disabled)
                    </div>
                </div>

                {/* Footer */}
                <div className="chord-generator-footer">
                    <button className="footer-btn" onClick={onClose}>Reset</button>
                    <button className="footer-btn accept-btn" onClick={handleAccept}>Accept</button>
                </div>
            </div>
        </div>
    );
};

export default ChordProgressionGenerator;
