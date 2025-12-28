import React, { useState, useRef, useEffect, useCallback } from 'react';
import './PianoRoll.css';
import { Pencil, Eraser, Magnet, ZoomIn, ZoomOut, Music, MousePointer2, Target, Link2, AlignCenter, Volume2, VolumeX, Sliders, Edit } from './icons/BlenderIcons';
import Playhead from './Playhead';
import '../styles/blender-icons.css';
import { useProject } from '../contexts/ProjectContext';

const KEYS = ['B', 'A#', 'A', 'G#', 'G', 'F#', 'F', 'E', 'D#', 'D', 'C#', 'C'];

const PianoRoll = () => {
    // Context
    const {
        activePattern,
        addNoteToActivePattern,
        removeNoteFromActivePattern,
        updateNote,
        deleteNotes,
        isPlaying,
        togglePlayback,
        bpm,
        updatePattern,
        activePatternId,
        playheadPosition
    } = useProject();

    // Local State
    const [zoom, setZoom] = useState(30); // pixels per step
    const pixelsPerStep = zoom;
    const [selectedTool, setSelectedTool] = useState('pencil'); // pencil, eraser, select
    const [selection, setSelection] = useState([]); // Array of note IDs
    const [hoveredKey, setHoveredKey] = useState(null); // Currently hovered key fullName
    const [currentStep, setCurrentStep] = useState(0); // Current playback step for pulse animation
    
    // New tool states
    const [snapEnabled, setSnapEnabled] = useState(true);
    const [snapStrength, setSnapStrength] = useState(4); // 1, 2, 4, 8, 16
    const [previewNoteOnDraw, setPreviewNoteOnDraw] = useState(true);
    const [velocityEditMode, setVelocityEditMode] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [editName, setEditName] = useState(activePattern?.name || '');
    const nameInputRef = useRef(null);

    // Drag State
    // type: 'MOVE' | 'RESIZE' | 'SELECT' | 'CREATE'
    const [dragState, setDragState] = useState(null);

    // Constants
    const octaves = 8;
    const startOctave = 8;
    const totalBars = 8;
    const stepsPerBar = 16;
    const keyHeight = 24;

    const pianoKeysRef = useRef(null);
    const gridAreaRef = useRef(null);
    const mainAreaRef = useRef(null);

    // Generate keys
    const allKeys = [];
    for (let o = startOctave; o >= 1; o--) {
        KEYS.forEach(key => {
            allKeys.push({
                note: key,
                octave: o,
                isBlack: key.includes('#'),
                fullName: key + o
            });
        });
    }

    // Scroll to C5 on mount and sync vertical scrolling
    useEffect(() => {
        const rowC5 = allKeys.findIndex(k => k.note === 'C' && k.octave === 5);
        if (rowC5 !== -1) {
            const scrollTop = (rowC5 * keyHeight) - ((pianoKeysRef.current?.clientHeight || 400) / 2) + (keyHeight / 2);
            if (pianoKeysRef.current) {
                pianoKeysRef.current.scrollTop = scrollTop;
            }
            if (gridAreaRef.current) {
                gridAreaRef.current.scrollTop = scrollTop;
            }
        }
    }, [allKeys, keyHeight]);

    // Auto-scroll to keep playhead visible during playback (only grid area scrolls)
    useEffect(() => {
        if (!gridAreaRef.current || !isPlaying) return;
        
        const scrollContainer = gridAreaRef.current;
        const playheadPixelX = playheadPosition * pixelsPerStep * 4; // 4 steps per beat, no piano keys offset
        
        // Get viewport bounds
        const scrollLeft = scrollContainer.scrollLeft;
        const viewportWidth = scrollContainer.clientWidth;
        const visibleStart = scrollLeft;
        const visibleEnd = scrollLeft + viewportWidth;
        
        // Calculate margins (keep playhead centered with some padding)
        const margin = viewportWidth * 0.2; // 20% margin on each side
        
        // Check if playhead is outside visible area
        if (playheadPixelX < visibleStart + margin) {
            // Scroll left to show playhead
            scrollContainer.scrollLeft = Math.max(0, playheadPixelX - margin);
        } else if (playheadPixelX > visibleEnd - margin) {
            // Scroll right to show playhead
            scrollContainer.scrollLeft = playheadPixelX - viewportWidth + margin;
        }
    }, [playheadPosition, pixelsPerStep, isPlaying]);

    // --- Helpers ---
    const getStepFromX = (x) => {
        // x is relative to grid area (no piano keys offset needed)
        if (gridAreaRef.current) {
            const rect = gridAreaRef.current.getBoundingClientRect();
            const gridX = x - rect.left + gridAreaRef.current.scrollLeft;
            const step = Math.floor(gridX / pixelsPerStep);
            return Math.max(0, step);
        }
        return 0;
    };
    const getKeyFromY = (y) => {
        // y is already in content coordinates (includes scrollTop)
        const index = Math.floor(y / keyHeight);
        if (index < 0 || index >= allKeys.length) return null;
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

        if (!mainAreaRef.current || !gridAreaRef.current) return;

        const scrollRect = gridAreaRef.current.getBoundingClientRect();
        // Calculate coordinates relative to the grid area viewport
        const viewportX = e.clientX - scrollRect.left;
        const viewportY = e.clientY - scrollRect.top;
        
        // Add scroll offsets to get content coordinates
        const x = viewportX + gridAreaRef.current.scrollLeft;
        const y = viewportY + gridAreaRef.current.scrollTop;

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
        // Only create notes if clicking in the grid area (not on piano keys)
        if (x < 300) return; // Clicked on piano keys, ignore
        
        const step = getStepFromX(x);
        const noteName = getKeyFromY(y);

        if (!noteName) return; // Invalid key position

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
            if (!gridAreaRef.current) return;
            const scrollRect = gridAreaRef.current.getBoundingClientRect();
            const viewportX = e.clientX - scrollRect.left;
            const viewportY = e.clientY - scrollRect.top;
            const x = viewportX + gridAreaRef.current.scrollLeft;
            const y = viewportY + gridAreaRef.current.scrollTop;

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
            // Adjust selection box coordinates to account for piano key offset (300px)
            const adjustedX1 = Math.max(0, x1 - 300);
            const adjustedX2 = Math.max(0, x2 - 300);
            
            const selectedIds = activePattern.data.notes.filter(n => {
                const noteY = getYFromKey(n.noteName);
                const noteX = n.startStep * pixelsPerStep;
                const noteW = n.length * pixelsPerStep;
                const noteH = keyHeight;

                // Simple AABB collision
                return (noteX < adjustedX2 && noteX + noteW > adjustedX1 &&
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

    // Track current playback step for pulse animation
    useEffect(() => {
        if (!isPlaying) {
            setCurrentStep(0);
            return;
        }

        const interval = setInterval(() => {
            setCurrentStep(prev => {
                const next = prev + 1;
                return next >= totalBars * stepsPerBar ? 0 : next;
            });
        }, (60 / (bpm || 120)) * 250); // 16th note interval

        return () => clearInterval(interval);
    }, [isPlaying, bpm, totalBars, stepsPerBar]);

    // Get notes for each key
    const getNotesForKey = (keyFullName) => {
        return activePattern.data.notes.filter(n => n.noteName === keyFullName);
    };

    // Check if a note is currently playing
    const isNotePlaying = (note) => {
        if (!isPlaying) return false;
        const noteEnd = note.startStep + note.length;
        return currentStep >= note.startStep && currentStep < noteEnd;
    };

    // Pattern name editing
    useEffect(() => {
        if (activePattern) {
            setEditName(activePattern.name);
        }
    }, [activePattern]);

    useEffect(() => {
        if (isEditingName && nameInputRef.current) {
            nameInputRef.current.focus();
            nameInputRef.current.select();
        }
    }, [isEditingName]);

    const handleNameClick = () => {
        setIsEditingName(true);
    };

    const handleNameBlur = () => {
        if (editName.trim() && editName !== activePattern.name) {
            updatePattern(activePatternId, { name: editName.trim() });
        } else {
            setEditName(activePattern.name);
        }
        setIsEditingName(false);
    };

    const handleNameKeyDown = (e) => {
        if (e.key === 'Enter') {
            handleNameBlur();
        } else if (e.key === 'Escape') {
            setEditName(activePattern.name);
            setIsEditingName(false);
        }
    };


    return (
        <div className="piano-roll-window">
            {/* Header - Blender-style context area */}
            <div className="piano-header" style={{ backgroundColor: '#1e1e1e', background: '#1e1e1e' }}>
                <div className="piano-header-left">
                    {/* Pattern name - inline editable capsule */}
                    <div className="pattern-name-capsule">
                        {isEditingName ? (
                            <input
                                ref={nameInputRef}
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                onBlur={handleNameBlur}
                                onKeyDown={handleNameKeyDown}
                                className="pattern-name-input"
                            />
                        ) : (
                            <span 
                                className="pattern-name-text"
                                onClick={handleNameClick}
                                title="Click to rename"
                            >
                                {activePattern.name}
                            </span>
                        )}
                    </div>

                    {/* Context indicators */}
                    <div className="context-indicators">
                        {snapEnabled && (
                            <div className="context-badge" title={`Snap: 1/${snapStrength}`}>
                                <Target size={12} className="blender-icon" />
                                <span>{snapStrength}</span>
                            </div>
                        )}
                        {velocityEditMode && (
                            <div className="context-badge" title="Velocity Edit Mode">
                                <Sliders size={12} className="blender-icon" />
                            </div>
                        )}
                        {previewNoteOnDraw && (
                            <div className="context-badge" title="Preview Note on Draw">
                                <Volume2 size={12} className="blender-icon" />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Toolbar */}
            <div className="piano-toolbar">
                {/* Play Control */}
                <button
                    className={`tool-btn ${isPlaying ? 'active' : ''}`}
                    onClick={togglePlayback}
                    title="Play/Pause Pattern"
                >
                    <Music size={16} className="blender-icon" />
                </button>
                <div className="toolbar-separator"></div>

                {/* Draw / Select Group */}
                <div className="tool-group">
                    <button
                        className={`tool-btn ${selectedTool === 'pencil' ? 'active' : ''}`}
                        onClick={() => setSelectedTool('pencil')}
                        title="Pencil Tool">
                        <Pencil size={16} className="blender-icon" />
                    </button>
                    <button
                        className={`tool-btn ${selectedTool === 'select' ? 'active' : ''}`}
                        onClick={() => setSelectedTool('select')}
                        title="Select Tool">
                        <MousePointer2 size={16} className="blender-icon" />
                    </button>
                </div>

                {/* Erase Group */}
                <div className="toolbar-separator"></div>
                <div className="tool-group">
                    <button
                        className={`tool-btn ${selectedTool === 'eraser' ? 'active' : ''}`}
                        onClick={() => setSelectedTool('eraser')}
                        title="Eraser Tool">
                        <Eraser size={16} className="blender-icon" />
                    </button>
                </div>

                {/* Link Group */}
                <div className="toolbar-separator"></div>
                <div className="tool-group">
                    <button 
                        className="tool-btn" 
                        title="Link Notes"
                        onClick={() => {/* TODO: Implement link notes */}}
                    >
                        <Link2 size={16} className="blender-icon" />
                    </button>
                </div>

                {/* Snap Group */}
                <div className="toolbar-separator"></div>
                <div className="tool-group">
                    <button
                        className={`tool-btn ${snapEnabled ? 'active' : ''}`}
                        onClick={() => setSnapEnabled(!snapEnabled)}
                        title="Snap to Grid">
                        <Target size={16} className="blender-icon" />
                    </button>
                    {snapEnabled && (
                        <div className="snap-strength-selector">
                            <button
                                className={`snap-btn ${snapStrength === 1 ? 'active' : ''}`}
                                onClick={() => setSnapStrength(1)}
                                title="1/16 note snap"
                            >
                                1
                            </button>
                            <button
                                className={`snap-btn ${snapStrength === 2 ? 'active' : ''}`}
                                onClick={() => setSnapStrength(2)}
                                title="1/8 note snap"
                            >
                                2
                            </button>
                            <button
                                className={`snap-btn ${snapStrength === 4 ? 'active' : ''}`}
                                onClick={() => setSnapStrength(4)}
                                title="1/4 note snap"
                            >
                                4
                            </button>
                            <button
                                className={`snap-btn ${snapStrength === 8 ? 'active' : ''}`}
                                onClick={() => setSnapStrength(8)}
                                title="1/2 note snap"
                            >
                                8
                            </button>
                            <button
                                className={`snap-btn ${snapStrength === 16 ? 'active' : ''}`}
                                onClick={() => setSnapStrength(16)}
                                title="1 bar snap"
                            >
                                16
                            </button>
                        </div>
                    )}
                </div>

                {/* Quantize */}
                <div className="toolbar-separator"></div>
                <div className="tool-group">
                    <button
                        className="tool-btn"
                        onClick={() => {/* TODO: Implement quantize */}}
                        title="Quantize Selected Notes">
                        <AlignCenter size={16} className="blender-icon" />
                    </button>
                </div>

                {/* Preview & Velocity */}
                <div className="toolbar-separator"></div>
                <div className="tool-group">
                    <button
                        className={`tool-btn ${previewNoteOnDraw ? 'active' : ''}`}
                        onClick={() => setPreviewNoteOnDraw(!previewNoteOnDraw)}
                        title="Preview Note on Draw">
                        {previewNoteOnDraw ? <Volume2 size={16} className="blender-icon" /> : <VolumeX size={16} className="blender-icon" />}
                    </button>
                    <button
                        className={`tool-btn ${velocityEditMode ? 'active' : ''}`}
                        onClick={() => setVelocityEditMode(!velocityEditMode)}
                        title="Velocity Edit Mode">
                        <Sliders size={16} className="blender-icon" />
                    </button>
                </div>

                {/* Zoom Group */}
                <div className="toolbar-separator"></div>
                <div className="tool-group">
                    <button className="tool-btn" onClick={() => setZoom(z => Math.max(10, z - 5))} title="Zoom Out">
                        <ZoomOut size={16} className="blender-icon" />
                    </button>
                <button className="tool-btn" onClick={() => setZoom(z => Math.min(100, z + 5))} title="Zoom In">
                    <ZoomIn size={16} className="blender-icon" />
                </button>
                </div>
            </div>

            {/* Main Scrollable Area */}
            <div
                className="piano-main-area"
                onContextMenu={handleContextMenu}
                onMouseDown={handleMouseDown}
            >
                {/* Piano Keys Column - Fixed, no horizontal scroll */}
                <div className="piano-keys-column" ref={pianoKeysRef}>
                    {allKeys.map((k) => {
                        const keyNotes = getNotesForKey(k.fullName);
                        const hasNotes = keyNotes.length > 0;
                        const isPlayingNote = keyNotes.some(note => isNotePlaying(note));
                        const isHovered = hoveredKey === k.fullName;

                        return (
                            <div 
                                className={`piano-key-sticky ${k.isBlack ? 'black' : 'white'} ${isHovered ? 'hovered' : ''} ${hasNotes ? 'has-notes' : ''} ${isPlayingNote ? 'playing' : ''}`}
                                key={k.fullName}
                                style={{ height: `${keyHeight}px` }}
                                onMouseEnter={() => setHoveredKey(k.fullName)}
                                onMouseLeave={() => setHoveredKey(null)}
                            >
                                {k.note === 'C' && <span className="key-label">C{k.octave}</span>}
                                {!k.isBlack && k.note !== 'C' && <span className="key-label" style={{ opacity: 0.4 }}>{k.note}</span>}
                                {hasNotes && <div className="key-note-indicator"></div>}
                            </div>
                        );
                    })}
                </div>

                {/* Grid Area - Scrollable horizontally */}
                <div className="piano-grid-area" ref={gridAreaRef}>
                    <div ref={mainAreaRef} style={{ position: 'relative' }}>
                        {/* Playhead for piano roll */}
                        <Playhead
                            mode="smooth"
                            pixelsPerBeat={pixelsPerStep * 4} // 4 steps per beat
                            headerOffset={0} // No header offset in grid area
                        />
                        {allKeys.map((k) => {
                            const keyNotes = getNotesForKey(k.fullName);
                            const hasNotes = keyNotes.length > 0;
                            const isPlayingNote = keyNotes.some(note => isNotePlaying(note));

                            return (
                                <div 
                                    className={`piano-grid-row ${k.isBlack ? 'black-row' : 'white-row'}`} 
                                    key={k.fullName}
                                    style={{ width: `${totalBars * stepsPerBar * pixelsPerStep}px`, height: `${keyHeight}px` }}
                                >
                                    {/* Render Grid Background Cells */}
                                    {Array.from({ length: totalBars * stepsPerBar }).map((_, step) => {
                                        const isBar = step % 16 === 0;
                                        const isBeat = step % 4 === 0;
                                        return (
                                            <div
                                                key={step}
                                                className={`grid-bg-cell ${isBar ? 'bar' : isBeat ? 'beat' : ''}`}
                                                style={{ width: `${pixelsPerStep}px` }}
                                            ></div>
                                        );
                                    })}
                                </div>
                            );
                        }                        )}

                        {/* Render Notes Layer Overlay */}
                        <div className="piano-notes-overlay" style={{
                            position: 'absolute',
                            top: 0,
                            left: 0, // No offset needed, grid area starts at 0
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
                                    left: Math.min(dragState.startX, dragState.currentX), // No piano key offset needed
                                    top: Math.min(dragState.startY, dragState.currentY),
                                    width: Math.abs(dragState.currentX - dragState.startX),
                                    height: Math.abs(dragState.currentY - dragState.startY),
                                    border: '1px solid #4ade80',
                                    backgroundColor: 'rgba(74, 222, 128, 0.15)',
                                    pointerEvents: 'none',
                                    borderRadius: '2px'
                                }}></div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PianoRoll;
