import React, { useState, useRef, useEffect, useCallback } from 'react';
import './PianoRoll.css';
import { Pencil, Eraser, Magnet, ZoomIn, ZoomOut, Music, MousePointer2 } from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';

const KEYS = ['B', 'A#', 'A', 'G#', 'G', 'F#', 'F', 'E', 'D#', 'D', 'C#', 'C'];

const PianoRoll = () => {
    // Context
    const {
        activePattern,
        addNoteToActivePattern,
        removeNoteFromActivePattern,
        updateNote,
        deleteNotes
    } = useProject();

    // Local State
    const [zoom, setZoom] = useState(30); // pixels per step
    const pixelsPerStep = zoom;
    const [selectedTool, setSelectedTool] = useState('pencil'); // pencil, eraser, select
    const [selection, setSelection] = useState([]); // Array of note IDs

    // Drag State
    // type: 'MOVE' | 'RESIZE' | 'SELECT' | 'CREATE'
    const [dragState, setDragState] = useState(null);

    // Constants
    const octaves = 6;
    const startOctave = 7;
    const totalBars = 8;
    const stepsPerBar = 16;
    const keyHeight = 24;

    const scrollRef = useRef(null);
    const mainAreaRef = useRef(null);

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
    }, []);

    // --- Helpers ---
    const getStepFromX = (x) => Math.floor(x / pixelsPerStep);
    const getKeyFromY = (y) => {
        const index = Math.floor(y / keyHeight);
        return allKeys[index] ? allKeys[index].fullName : null;
    };
    const getYFromKey = (noteName) => {
        const index = allKeys.findIndex(k => k.fullName === noteName);
        return index * keyHeight;
    };

    // --- Event Handlers ---

    const handleContextMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleMouseDown = (e) => {
        // Allow Left (0) and Right (2) clicks
        if (e.button !== 0 && e.button !== 2) return;

        const rect = mainAreaRef.current.getBoundingClientRect();
        // Since rect.left/top updates as we scroll (it's the content div),
        // e.clientX - rect.left ALREADY gives us the local coordinate.
        // We do NOT need to add scrollLeft/scrollTop again.
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const targetIsNote = e.target.closest('.piano-note');
        const targetIsResize = e.target.classList.contains('piano-note-resize');

        // Right Click Handling (Delete)
        if (e.button === 2) {
            if (targetIsNote) {
                const noteId = parseInt(e.target.closest('.piano-note').dataset.id);
                removeNoteFromActivePattern(noteId);
                // If it was selected, remove from selection too
                setSelection(prev => prev.filter(id => id !== noteId));
            } else {
                // Right click on background to delete? 
                // Enhanced logic: Find note under cursor and delete it (like FL eraser)
                // For now, simpler: specific click delete.
            }
            return;
        }

        // --- Left Click Logic Below ---

        // 1. Resize Start
        if (targetIsResize) {
            const noteId = parseInt(e.target.parentElement.dataset.id);
            const note = activePattern.data.notes.find(n => n.id === noteId);
            if (!note) return;

            // If resizing a note outside selection, select only it
            if (!selection.includes(noteId)) {
                setSelection([noteId]);
            }

            setDragState({
                type: 'RESIZE',
                notes: selection.includes(noteId) ? selection : [noteId],
                startX: e.clientX,
                initialLengths: selection.includes(noteId)
                    ? selection.reduce((acc, id) => ({ ...acc, [id]: activePattern.data.notes.find(n => n.id === id).length }), {})
                    : { [noteId]: note.length }
            });
            e.stopPropagation();
            return;
        }

        // 2. Move / Select Note
        if (targetIsNote) {
            const noteId = parseInt(e.target.closest('.piano-note').dataset.id);

            // Eraser Tool (Left Click)
            if (selectedTool === 'eraser') {
                removeNoteFromActivePattern(noteId);
                return;
            }

            e.stopPropagation();

            // Toggle Selection if Ctrl/Shift
            if (e.ctrlKey || e.shiftKey) {
                setSelection(prev =>
                    prev.includes(noteId) ? prev.filter(id => id !== noteId) : [...prev, noteId]
                );
                return; // Don't move immediately on multi-select click
            }

            // Normal Click
            if (!selection.includes(noteId)) {
                setSelection([noteId]);
                // Start Move for this single note
                setDragState({
                    type: 'MOVE',
                    notes: [noteId],
                    startX: e.clientX,
                    startY: e.clientY,
                    initialData: { [noteId]: activePattern.data.notes.find(n => n.id === noteId) }
                });
            } else {
                // Moving existing selection
                setDragState({
                    type: 'MOVE',
                    notes: selection,
                    startX: e.clientX,
                    startY: e.clientY,
                    initialData: selection.reduce((acc, id) => ({
                        ...acc,
                        [id]: activePattern.data.notes.find(n => n.id === id)
                    }), {})
                });
            }
            return;
        }

        // 3. Background Interactions
        const step = getStepFromX(x);
        const noteName = getKeyFromY(y);

        if (selectedTool === 'pencil') {
            // Create Note
            const newNote = {
                id: Date.now(),
                noteName,
                startStep: step,
                length: 4
            };
            addNoteToActivePattern(newNote);
            // Immediately start moving/resizing? For now just create.
        } else {
            // Box Selection
            setSelection([]); // Clear selection
            setDragState({
                type: 'SELECT',
                startX: x, // Relative to container content
                startY: y,
                currentX: x,
                currentY: y
            });
        }
    };

    const handleMouseMove = (e) => {
        if (!dragState) return;

        const rect = mainAreaRef.current.getBoundingClientRect();

        if (dragState.type === 'MOVE') {
            const dxPixels = e.clientX - dragState.startX;
            const dyPixels = e.clientY - dragState.startY;

            const dxSteps = Math.round(dxPixels / pixelsPerStep);
            const dyKeys = Math.round(dyPixels / keyHeight);

            // Apply delta to all dragged notes
            dragState.notes.forEach(id => {
                const init = dragState.initialData[id];
                if (!init) return;

                // Calculate new step
                const newStep = Math.max(0, init.startStep + dxSteps);

                // Calculate new Key
                const currentKeyIndex = allKeys.findIndex(k => k.fullName === init.noteName);
                const newKeyIndex = Math.min(Math.max(0, currentKeyIndex + dyKeys), allKeys.length - 1);
                const newNoteName = allKeys[newKeyIndex].fullName;

                if (newStep !== init.startStep || newNoteName !== init.noteName) {
                    updateNote(id, { startStep: newStep, noteName: newNoteName });
                }
            });
        }

        if (dragState.type === 'RESIZE') {
            const dxPixels = e.clientX - dragState.startX;
            const dxSteps = Math.round(dxPixels / pixelsPerStep);

            dragState.notes.forEach(id => {
                const initLength = dragState.initialLengths[id];
                const newLength = Math.max(1, initLength + dxSteps);
                updateNote(id, { length: newLength });
            });
        }

        if (dragState.type === 'SELECT') {
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            setDragState(prev => ({ ...prev, currentX: x, currentY: y }));
        }
    };

    const handleMouseUp = (e) => {
        if (!dragState) return;

        if (dragState.type === 'SELECT') {
            // Calculate final selection box
            const x1 = Math.min(dragState.startX, dragState.currentX);
            const x2 = Math.max(dragState.startX, dragState.currentX);
            const y1 = Math.min(dragState.startY, dragState.currentY);
            const y2 = Math.max(dragState.startY, dragState.currentY);

            // Find overlapping notes
            const selectedIds = activePattern.data.notes.filter(n => {
                const noteY = getYFromKey(n.noteName);
                const noteX = n.startStep * pixelsPerStep;
                const noteW = n.length * pixelsPerStep;
                const noteH = keyHeight;

                // Simple AABB collision
                return (noteX < x2 && noteX + noteW > x1 &&
                    noteY < y2 && noteY + noteH > y1);
            }).map(n => n.id);

            setSelection(selectedIds);
        }

        setDragState(null);
    };

    // Global listener for generic mouse up/move (to catch outside drag)
    useEffect(() => {
        if (dragState) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragState, activePattern]); // Dependencies needed for closures

    const handleDelete = useCallback((e) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (selection.length > 0) {
                deleteNotes(selection);
                setSelection([]);
            }
        }
    }, [selection, deleteNotes]);

    useEffect(() => {
        window.addEventListener('keydown', handleDelete);
        return () => window.removeEventListener('keydown', handleDelete);
    }, [handleDelete]);


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
                    className={`tool-btn ${selectedTool === 'select' ? 'active' : ''}`}
                    onClick={() => setSelectedTool('select')}>
                    <MousePointer2 size={16} />
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
                <div style={{ color: '#888', fontSize: '11px', marginRight: '10px' }}>{activePattern.name}</div>
            </div>

            {/* Main Scrollable Area */}
            <div
                className="piano-main-area"
                onContextMenu={handleContextMenu}
                ref={scrollRef}
                onMouseDown={handleMouseDown}
            >
                <div ref={mainAreaRef} style={{ position: 'relative' }}>
                    {allKeys.map((k) => (
                        <div className="piano-row" key={k.fullName} style={{ height: `${keyHeight}px` }}>
                            {/* Sticky Key */}
                            <div className={`piano-key-sticky ${k.isBlack ? 'black' : 'white'}`} style={{ height: `${keyHeight}px`, position: 'sticky', left: 0, zIndex: 10 }}>
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
                                        // onPointerDown handled by parent onMouseDown
                                        ></div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}

                    {/* Render Notes Layer Overlay */}
                    <div className="piano-notes-overlay" style={{
                        position: 'absolute',
                        top: 0,
                        left: '40px', // width of sticky keys
                        width: `${totalBars * stepsPerBar * pixelsPerStep}px`,
                        height: `${allKeys.length * keyHeight}px`,
                        pointerEvents: 'none' // Let clicks pass through to rows unless on a note
                    }}>
                        {activePattern.data.notes.map(note => {
                            const top = getYFromKey(note.noteName);
                            const left = note.startStep * pixelsPerStep;
                            const width = note.length * pixelsPerStep;
                            const isSelected = selection.includes(note.id);

                            return (
                                <div
                                    key={note.id}
                                    data-id={note.id}
                                    className={`piano-note ${isSelected ? 'selected' : ''}`}
                                    style={{
                                        position: 'absolute',
                                        top: `${top}px`,
                                        left: `${left}px`,
                                        width: `${width}px`,
                                        height: `${keyHeight}px`,
                                        pointerEvents: 'auto'
                                    }}
                                >
                                    <div className="piano-note-resize"></div>
                                </div>
                            );
                        })}

                        {/* Selection Box */}
                        {dragState && dragState.type === 'SELECT' && (
                            <div style={{
                                position: 'absolute',
                                left: Math.min(dragState.startX, dragState.currentX),
                                top: Math.min(dragState.startY, dragState.currentY),
                                width: Math.abs(dragState.currentX - dragState.startX),
                                height: Math.abs(dragState.currentY - dragState.startY),
                                border: '1px solid #fff',
                                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                pointerEvents: 'none'
                            }}></div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PianoRoll;
