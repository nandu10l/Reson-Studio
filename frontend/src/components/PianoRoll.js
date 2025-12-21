import React, { useState, useRef, useEffect } from 'react';
import './PianoRoll.css';
import { Pencil, Eraser, Magnet, ZoomIn, ZoomOut, Music } from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';

const KEYS = ['B', 'A#', 'A', 'G#', 'G', 'F#', 'F', 'E', 'D#', 'D', 'C#', 'C'];

const PianoRoll = () => {
    // Context
    const { activePattern, addNoteToActivePattern, removeNoteFromActivePattern } = useProject();

    // Local State
    const [zoom, setZoom] = useState(30); // pixels per step
    const pixelsPerStep = zoom;
    const [selectedTool, setSelectedTool] = useState('pencil'); // pencil, eraser

    // Constants
    const octaves = 6;
    const startOctave = 7;
    const totalBars = 8;
    const stepsPerBar = 16;
    const keyHeight = 24;

    const scrollRef = useRef(null);

    // Generate keys
    const allKeys = [];
    for (let o = startOctave; o >= 2; o--) {
        KEYS.forEach(key => {
            allKeys.push({
                note: key,
                octave: o,
                isBlack: key.includes('#'),
                fullName: key + o
            });
        });
    }

    // Scroll to C5 on mount
    useEffect(() => {
        if (scrollRef.current) {
            const rowC5 = allKeys.findIndex(k => k.note === 'C' && k.octave === 5);
            if (rowC5 !== -1) {
                // Center C5 roughly
                scrollRef.current.scrollTop = (rowC5 * keyHeight) - (scrollRef.current.clientHeight / 2) + (keyHeight / 2);
            }
        }
    }, []); // Run once on mount

    const handleGridClick = (e, noteName, stepIndex) => {
        if (selectedTool === 'pencil') {
            // Check if note exists
            const existing = activePattern.data.notes.find(n => n.noteName === noteName && n.startStep === stepIndex);
            if (existing) return;

            const newNote = {
                id: Date.now(),
                noteName,
                startStep: stepIndex,
                length: 4 // default to quarter note
            };
            addNoteToActivePattern(newNote);
        }
    };

    const handleNoteClick = (e, noteId) => {
        e.stopPropagation();
        if (selectedTool === 'eraser') {
            removeNoteFromActivePattern(noteId);
        }
        else if (e.button === 2) {
            // Right click delete
            e.preventDefault();
            removeNoteFromActivePattern(noteId);
        }
    };

    const handleContextMenu = (e) => {
        e.preventDefault();
    };

    return (
        <div className="piano-roll-window">
            {/* Toolbar */}
            <div className="piano-toolbar">
                <div className="piano-curve-corner" title="Menu"></div>

                <button
                    className={`tool-btn ${selectedTool === 'pencil' ? 'active' : ''}`}
                    onClick={() => setSelectedTool('pencil')}>
                    <Pencil size={16} />
                </button>
                <button
                    className={`tool-btn ${selectedTool === 'eraser' ? 'active' : ''}`}
                    onClick={() => setSelectedTool('eraser')}>
                    <Eraser size={16} />
                </button>

                <div style={{ width: 10 }}></div>
                <button className="tool-btn"><Magnet size={16} /></button>
                <div style={{ width: 5 }}></div>
                <button className="tool-btn" onClick={() => setZoom(z => Math.max(10, z - 5))} title="Zoom Out">
                    <ZoomOut size={16} />
                </button>
                <button className="tool-btn" onClick={() => setZoom(z => Math.min(100, z + 5))} title="Zoom In">
                    <ZoomIn size={16} />
                </button>

                <div style={{ flex: 1 }}></div>

                <div className="piano-breadcrumb">
                    <Music size={14} />
                    <span>Target - </span>
                    <span style={{ color: '#fa5' }}>Grand Piano</span>
                </div>
                <div style={{ width: 20 }}></div>
                <div style={{ color: '#888', fontSize: '11px', marginRight: '10px' }}>{activePattern.name}</div>
            </div>

            {/* Main Scrollable Area */}
            <div
                className="piano-main-area"
                onContextMenu={handleContextMenu}
                ref={scrollRef}
            >
                {allKeys.map((k) => (
                    <div className="piano-row" key={k.fullName} style={{ height: `${keyHeight}px` }}>
                        {/* Sticky Key */}
                        <div className={`piano-key-sticky ${k.isBlack ? 'black' : 'white'}`} style={{ height: `${keyHeight}px` }}>
                            {k.note === 'C' && <span className="key-label">C{k.octave}</span>}
                            {!k.isBlack && k.note !== 'C' && <span className="key-label" style={{ opacity: 0.3 }}>{k.note}</span>}
                        </div>

                        {/* Grid Row */}
                        <div className={`piano-grid-row ${k.isBlack ? 'black-row' : 'white-row'}`} style={{ width: `${totalBars * stepsPerBar * pixelsPerStep}px`, height: `${keyHeight}px` }}>
                            {/* Render Grid Background Cells */}
                            {Array.from({ length: totalBars * stepsPerBar }).map((_, step) => {
                                const isBar = step % 16 === 0;
                                const isBeat = step % 4 === 0;
                                return (
                                    <div
                                        key={step}
                                        className={`grid-bg-cell ${isBar ? 'bar' : isBeat ? 'beat' : ''}`}
                                        onPointerDown={(e) => handleGridClick(e, k.fullName, step)}
                                    ></div>
                                );
                            })}

                            {/* Render Notes for this row */}
                            {activePattern.data.notes.filter(n => n.noteName === k.fullName).map(note => (
                                <div
                                    key={note.id}
                                    className="piano-note"
                                    style={{
                                        left: `${note.startStep * pixelsPerStep}px`,
                                        width: `${note.length * pixelsPerStep}px`
                                    }}
                                    onPointerDown={(e) => handleNoteClick(e, note.id)}
                                    onContextMenu={(e) => handleNoteClick(e, note.id)}
                                >
                                    <div className="piano-note-resize"></div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Velocity Panel */}
            <div className="velocity-panel">
                <div className="velocity-header">Note Velocity</div>
                <div style={{ position: 'relative', height: '100%', overflowX: 'auto', overflowY: 'hidden', display: 'flex' }}>
                    <div style={{
                        width: `${totalBars * stepsPerBar * pixelsPerStep}px`,
                        marginLeft: '70px',
                        position: 'relative',
                        height: '100%'
                    }}>
                        {activePattern.data.notes.map(note => (
                            <div key={note.id} style={{
                                position: 'absolute',
                                left: `${note.startStep * pixelsPerStep}px`,
                                bottom: 0,
                                width: '6px',
                                height: '70%',
                                background: '#fa5',
                                borderRadius: '2px 2px 0 0',
                                opacity: 0.8
                            }}>
                                <div style={{ position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%)', width: 8, height: 8, borderRadius: '50%', border: '2px solid #fa5' }}></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PianoRoll;
