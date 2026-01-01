import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import './PianoRoll.css';
import * as Tone from 'tone';
import { Pencil, Eraser, Magnet, ZoomIn, ZoomOut, Music, MousePointer2, Target, Link2, AlignCenter, Volume2, VolumeX, Sliders, Edit, Brush, Scissors } from './icons/BlenderIcons';
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

    const scrollContainerRef = useRef(null);
    const pianoKeysRef = useRef(null);
    const gridAreaRef = useRef(null);
    const mainAreaRef = useRef(null);

    const KEYS_WIDTH = 100; // Must match CSS .piano-keys-column width

    // Generate keys
    // Generate keys
    const allKeys = useMemo(() => {
        const keys = [];
        for (let o = startOctave; o >= 1; o--) {
            KEYS.forEach(key => {
                keys.push({
                    note: key,
                    octave: o,
                    isBlack: key.includes('#'),
                    fullName: key + o
                });
            });
        }
        return keys;
    }, []);

    // Scroll to C5 on mount
    useEffect(() => {
        const rowC5 = allKeys.findIndex(k => k.note === 'C' && k.octave === 5);
        if (rowC5 !== -1) {
            const scrollTop = (rowC5 * keyHeight) - ((scrollContainerRef.current?.clientHeight || 400) / 2) + (keyHeight / 2);
            if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTop = scrollTop;
            }
        }
    }, [allKeys, keyHeight]);

    // Auto-scroll to keep playhead visible
    // Auto-scroll to keep playhead visible - 60FPS Smooth Version
    useEffect(() => {
        if (!scrollContainerRef.current || !isPlaying) return;

        let animationFrameId;

        const animateScroll = () => {
            const scrollContainer = scrollContainerRef.current;
            if (!scrollContainer) return;

            // Direct access to Transport time for smoothness
            const seconds = Tone.Transport.seconds;
            const beats = seconds * (bpm / 60);

            // pixelX relative to grid start
            const playheadPixelX = beats * pixelsPerStep * 4;

            // Target scroll position would be playhead X + keys offset
            // Use scrollLeft of the container
            const scrollLeft = scrollContainer.scrollLeft;
            const viewportWidth = scrollContainer.clientWidth;

            const absolutePlayheadX = KEYS_WIDTH + playheadPixelX;

            const visibleStart = scrollLeft;
            const visibleEnd = scrollLeft + viewportWidth;

            // Calculate margins
            const margin = viewportWidth * 0.2;

            // Check bounds
            if (absolutePlayheadX < visibleStart + KEYS_WIDTH + margin) {
                // Scroll left
                scrollContainer.scrollLeft = Math.max(0, absolutePlayheadX - KEYS_WIDTH - margin);
            } else if (absolutePlayheadX > visibleEnd - margin) {
                // Scroll right
                scrollContainer.scrollLeft = absolutePlayheadX - viewportWidth + margin;
            }

            animationFrameId = requestAnimationFrame(animateScroll);
        };

        animationFrameId = requestAnimationFrame(animateScroll);

        return () => cancelAnimationFrame(animationFrameId);
    }, [isPlaying, bpm, pixelsPerStep]); // Removed playheadPosition dependency

    // --- Helpers ---
    const getStepFromX = (x) => {
        // x is passed from handleMouseDown which already calculates it relative to Grid Content Start
        const step = Math.floor(x / pixelsPerStep);
        return Math.max(0, step);
    };

    const getKeyFromY = (y) => {
        // y is content offset in container
        // Since we are using a unified container, y is just scrollTop + clientY relative to container top?
        // handleMouseDown will pass the correct Y relative to content top
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

        if (!scrollContainerRef.current) return;

        const scrollRect = scrollContainerRef.current.getBoundingClientRect();
        // Calculate coordinates relative to the scroll container viewport
        const viewportX = e.clientX - scrollRect.left;
        const viewportY = e.clientY - scrollRect.top;

        // Add scroll offsets to get content coordinates
        const globalX = viewportX + scrollContainerRef.current.scrollLeft;
        const globalY = viewportY + scrollContainerRef.current.scrollTop;

        // Check if clicked ON keys (sticky)
        if (viewportX < KEYS_WIDTH) {
            // Clicked on Keys - potentially preview note sound? 
            // Logic for that is not fully detailed in original code other than ignore creation
            // Original logic: "if (x < 300) return;" (Wait, 300? CSS says 100px width ?)
            // Previous code: "Adjust selection box coordinates... offset (300px)" and "if (x < 300) return;"
            // But CSS says `.piano-keys-column { width: 100px; ... }`
            // Why did the JS say 300? 
            // Line 247 original JS: "if (x < 300) return;" 
            // Maybe legacy code or I misread? 
            // Let's stick to using the `keysWidth` variable defined as 100 for accuracy with current CSS.

            // Wait, if sticky, visual clicking is viewport dependent.
            return;
        }

        const gridX = globalX - KEYS_WIDTH; // Coordinate relative to grid start
        const gridY = globalY; // Coordinate relative to content top

        const targetIsNote = e.target.closest('.piano-note');
        const targetIsResize = e.target.classList.contains('piano-note-resize');

        // Right Click Handling (Delete)
        if (e.button === 2) {
            if (targetIsNote) {
                const noteId = parseInt(e.target.closest('.piano-note').dataset.id);
                removeNoteFromActivePattern(noteId);
                setSelection(prev => prev.filter(id => id !== noteId));
            }
            return;
        }

        // --- Left Click Logic Below ---

        // 1. Resize Start
        if (targetIsResize) {
            const noteId = parseInt(e.target.parentElement.dataset.id);
            const note = activePattern.data.notes.find(n => n.id === noteId);
            if (!note) return;

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

            // Eraser Tool
            if (selectedTool === 'eraser') {
                removeNoteFromActivePattern(noteId);
                return;
            }

            // Slice Tool
            if (selectedTool === 'slice') {
                // Start Slice Drag
                setDragState({
                    type: 'SLICE',
                    startX: gridX, // Relative to grid start
                    startY: gridY, // Relative to content top
                    currentX: gridX,
                    currentY: gridY
                });
                return;
            }

            e.stopPropagation();

            // Toggle Selection
            if (e.ctrlKey || e.shiftKey) {
                setSelection(prev =>
                    prev.includes(noteId) ? prev.filter(id => id !== noteId) : [...prev, noteId]
                );
                return;
            }

            // Normal Click
            if (!selection.includes(noteId)) {
                setSelection([noteId]);
                setDragState({
                    type: 'MOVE',
                    notes: [noteId],
                    startX: e.clientX,
                    startY: e.clientY,
                    initialData: { [noteId]: activePattern.data.notes.find(n => n.id === noteId) }
                });
            } else {
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
        const step = getStepFromX(gridX);
        const noteName = getKeyFromY(gridY);

        if (!noteName) return;

        if (selectedTool === 'pencil' || selectedTool === 'brush') {
            const newNote = {
                id: Date.now(),
                noteName,
                startStep: step,
                length: 4
            };
            addNoteToActivePattern(newNote);
        } else {
            // Box Selection
            setSelection([]);
            setDragState({
                type: 'SELECT',
                startX: gridX,
                startY: gridY,
                currentX: gridX,
                currentY: gridY
            });
        }
    };

    const handleMouseMove = (e) => {
        if (!dragState) return;

        // Note: dragState operations largely depend on deltas (clientX changes), 
        // which don't technically care about scroll container refs unless we recalc absolutes.
        // But SELECT box does need absolute grid coordinates.

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
            if (!scrollContainerRef.current) return;
            const scrollRect = scrollContainerRef.current.getBoundingClientRect();
            const viewportX = e.clientX - scrollRect.left;
            const viewportY = e.clientY - scrollRect.top;

            const globalX = viewportX + scrollContainerRef.current.scrollLeft;
            const globalY = viewportY + scrollContainerRef.current.scrollTop;

            // Convert to grid coordinates
            const x = globalX - KEYS_WIDTH;
            const y = globalY; // Relative to content top

            setDragState(prev => ({ ...prev, currentX: x, currentY: y }));
        }

        if (dragState.type === 'SLICE') {
            if (!scrollContainerRef.current) return;
            const scrollRect = scrollContainerRef.current.getBoundingClientRect();
            const viewportX = e.clientX - scrollRect.left;
            const viewportY = e.clientY - scrollRect.top;

            const globalX = viewportX + scrollContainerRef.current.scrollLeft;
            const globalY = viewportY + scrollContainerRef.current.scrollTop;

            // Convert to grid coordinates
            const x = globalX - KEYS_WIDTH;
            const y = globalY; // Relative to content top

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

            // Bounds check not strictly needed as overlap logic handles it, but good to know
            // Note: startX etc are already grid-relative in my updated handleMouseDown

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

        if (dragState.type === 'SLICE') {
            const { startX, startY, currentX, currentY } = dragState;

            // Helper to check line segment intersection with rectangle
            // Line: (x1,y1) to (x2,y2)
            // Rect: (rx, ry, rw, rh)
            const lineIntersectsRect = (x1, y1, x2, y2, rx, ry, rw, rh) => {
                // Liang-Barsky algorithm or checking intersection with each side
                // Simplified: Check if line crosses vertical boundaries within horizontal range?
                // Actually, for Piano Roll, valid split is mostly about X-coordinate crossing. 
                // But FL Studio allows diagonal slicing.
                // We need to find the X where the line crosses the Y-center or Y-range of the note.

                // Note Rect is [rx, rx+rw] x [ry, ry+rh]
                // Line equation: y - y1 = m * (x - x1)
                // m = (y2-y1)/(x2-x1)

                // Quick envelope check
                const minX = Math.min(x1, x2), maxX = Math.max(x1, x2);
                const minY = Math.min(y1, y2), maxY = Math.max(y1, y2);

                if (maxX < rx || minX > rx + rw || maxY < ry || minY > ry + rh) return null;

                // If line is vertical
                if (x1 === x2) {
                    if (x1 >= rx && x1 <= rx + rw) return x1; // Intersection X
                    return null;
                }

                // Calculate intersection with note's top/center/bottom? 
                // A note is hit if the line passes through it.
                // We want the X coordinate of the cut.
                // Let's take the intersection point within the Y-bounds of the note.

                const m = (y2 - y1) / (x2 - x1);
                const c = y1 - m * x1;

                // y = mx + c  =>  x = (y - c) / m

                // Check if line crosses the note logic: 
                // Does the segment intersect the rect?
                // Let's compute Y for the note's mid-point? No, line might clip corner.
                // Let's check intersection with Top (y=ry) and Bottom (y=ry+rh)
                // Or Left/Right?
                // Usually slicing cuts vertically. So we want to know, for a given note Y, what is the Line X?

                // Average Y of the note = ry + rh/2
                const noteMidY = ry + rh / 2;

                // Find X on the line at noteMidY
                // x = (noteMidY - c) / m

                // Handle horizontal line case (m=0) -> No clean cut usually, ignore or cut everywhere? FL ignores horizontal cuts usually.
                if (Math.abs(m) < 0.001) return null;

                const cutX = (noteMidY - c) / m;

                // Check if this cutX is within the note's X range AND within the line segment's X bounds
                if (cutX >= rx && cutX <= rx + rw &&
                    cutX >= minX && cutX <= maxX &&
                    noteMidY >= minY && noteMidY <= maxY) {
                    return cutX;
                }

                return null;
            };

            // Process all notes
            const notesToUpdate = [];
            const newNotesToAdd = [];

            // To avoid modifying array while iterating, calculate all changes first
            activePattern.data.notes.forEach(note => {
                const noteY = getYFromKey(note.noteName);
                const noteX = note.startStep * pixelsPerStep;
                const noteW = note.length * pixelsPerStep;
                const noteH = keyHeight;

                const cutX = lineIntersectsRect(startX, startY, currentX, currentY, noteX, noteY, noteW, noteH);

                if (cutX !== null) {
                    // Calculate step from cutX
                    const splitStep = getStepFromX(cutX);
                    const relStep = splitStep - note.startStep;

                    if (relStep > 0 && relStep < note.length) {
                        // Valid split
                        notesToUpdate.push({ id: note.id, length: relStep });
                        newNotesToAdd.push({
                            id: Date.now() + Math.random(), // Ensure unique ID
                            noteName: note.noteName,
                            startStep: splitStep,
                            length: note.length - relStep
                        });
                    }
                }
            });

            // Apply batches
            if (notesToUpdate.length > 0 || newNotesToAdd.length > 0) {
                // We need a batch update method or loop. 
                // Since we don't have batch update in context, we'll do it sequentially or use setPatterns callback manually if performance issues arise.
                // Ideally ProjectContext should expose `updatePattern(id, { data: ... })` which allows full overwrite.
                // Let's use `updatePattern` with full data replacement for atomicity.

                const updatedNotes = activePattern.data.notes.map(n => {
                    const update = notesToUpdate.find(u => u.id === n.id);
                    return update ? { ...n, length: update.length } : n;
                });

                const finalNotes = [...updatedNotes, ...newNotesToAdd];

                updatePattern(activePatternId, {
                    data: {
                        ...activePattern.data,
                        notes: finalNotes
                    }
                });
            }
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
                    <button
                        className={`tool-btn ${selectedTool === 'brush' ? 'active' : ''}`}
                        onClick={() => setSelectedTool('brush')}
                        title="Paint Tool">
                        <Brush size={16} className="blender-icon" />
                    </button>
                    <button
                        className={`tool-btn ${selectedTool === 'slice' ? 'active' : ''}`}
                        onClick={() => setSelectedTool('slice')}
                        title="Slice Tool">
                        <Scissors size={16} className="blender-icon" />
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
                        onClick={() => {/* TODO: Implement link notes */ }}
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
                        onClick={() => {/* TODO: Implement quantize */ }}
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
                ref={scrollContainerRef}
                onContextMenu={handleContextMenu}
                onMouseDown={handleMouseDown}
            >
                {/* Piano Keys Column - Fixed via sticky */}
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

                {/* Grid Area - Flows naturally now */}
                <div className="piano-grid-area" ref={gridAreaRef}>
                    <div style={{ position: 'relative' }}>
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
                        })}

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
                                        <span className="piano-note-label">{note.noteName}</span>
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
                                    border: '1px solid #4ade80',
                                    backgroundColor: 'rgba(74, 222, 128, 0.15)',
                                    pointerEvents: 'none',
                                    borderRadius: '2px'
                                }}></div>
                            )}

                            {/* Slice Line */}
                            {dragState && dragState.type === 'SLICE' && (
                                <svg style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    pointerEvents: 'none',
                                    zIndex: 100
                                }}>
                                    <line
                                        x1={dragState.startX}
                                        y1={dragState.startY}
                                        x2={dragState.currentX}
                                        y2={dragState.currentY}
                                        stroke="#ef4444"
                                        strokeWidth="2"
                                        strokeDasharray="4"
                                    />
                                </svg>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PianoRoll;
