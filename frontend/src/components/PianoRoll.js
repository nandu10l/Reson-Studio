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
        activePattern, activePatternId, updatePattern, addNoteToActivePattern, removeNoteFromActivePattern,
        isPlaying, playheadPosition, setPlayheadPosition, updateNote, setActiveTool, activeTool, bpm,
        previewPianoNote, deleteNotes, togglePlayback, channels, addNotesToActivePattern,
        pushNotesHistory, undoNotes, redoNotes, selectedChannelIds, selectChannel // Added selectedChannelIds/selectChannel
    } = useProject();

    // Local State
    const [zoom, setZoom] = useState(40); // pixels per step (bigger UI)
    const pixelsPerStep = zoom;
    const [selectedTool, setSelectedTool] = useState('pencil'); // pencil, eraser, select
    const [selection, setSelection] = useState([]); // Array of note IDs
    const [selectedChannelId, setSelectedChannelId] = useState(channels.length > 0 ? channels[0].id : 1);

    const [hoveredKey, setHoveredKey] = useState(null); // Currently hovered key fullName
    const lastStepRef = useRef(-1); // Pulse animation step tracker (Ref-based)

    // New tool states
    const [snapEnabled, setSnapEnabled] = useState(true);
    const [snapStrength, setSnapStrength] = useState(4); // 1, 2, 4, 8, 16
    const [previewNoteOnDraw, setPreviewNoteOnDraw] = useState(true);
    const [velocityEditMode, setVelocityEditMode] = useState(false);
    const [velocityLaneCollapsed, setVelocityLaneCollapsed] = useState(false);
    const [velocityDragState, setVelocityDragState] = useState(null);
    const [isEditingName, setIsEditingName] = useState(false);
    const [editName, setEditName] = useState(activePattern?.name || '');
    const nameInputRef = useRef(null);

    // Drag State
    // type: 'MOVE' | 'RESIZE' | 'SELECT' | 'CREATE'
    const [dragState, setDragState] = useState(null);

    // Clipboard for copy/paste operations
    const [clipboard, setClipboard] = useState([]);

    // Track mouse position in grid for paste operations
    const mouseGridPositionRef = useRef({ step: 0, key: null });

    // Constants
    const octaves = 8;
    const startOctave = 8;
    const totalBars = 256;
    const stepsPerBar = 16;
    const keyHeight = 32; // increased row height for bigger UI

    const scrollContainerRef = useRef(null);
    const pianoKeysRef = useRef(null);
    const gridAreaRef = useRef(null);
    const playheadRef = useRef(null); // Added

    const KEYS_WIDTH = 140; // Must match CSS .piano-keys-column width (bigger UI)

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

    // Auto-sync local selectedChannelId with project state
    useEffect(() => {
        if (selectedChannelIds?.length > 0) {
            const currentSelected = selectedChannelIds[0];
            // Only update if it's a numeric ID (ignoring audio clips IDs like "audio-0")
            if (typeof currentSelected === 'number') {
                setSelectedChannelId(currentSelected);
            }
        }
    }, [selectedChannelIds]);

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

            // Sync Playhead Position Visually
            if (playheadRef.current) {
                playheadRef.current.style.left = `${playheadPixelX}px`;
            }

            // Sync Note/Key Highlights Visually (High Performance)
            const currentStep = Math.floor(beats * 4); // 16th note step
            if (currentStep !== lastStepRef.current) {
                lastStepRef.current = currentStep;

                if (gridAreaRef.current) {
                    // 1. Update Notes - Single pass
                    const playingNoteNames = new Set();
                    const notes = gridAreaRef.current.querySelectorAll('.piano-note');
                    notes.forEach(note => {
                        const start = parseInt(note.dataset.startStep);
                        const end = start + parseInt(note.dataset.len);
                        if (currentStep >= start && currentStep < end) {
                            note.classList.add('playing');
                            // Find the key name from parent or data
                            const row = note.closest('.piano-grid-row');
                            if (row) playingNoteNames.add(row.dataset.key);
                        } else {
                            note.classList.remove('playing');
                        }
                    });

                    // 2. Update Keys based on playingNoteNames
                    if (scrollContainerRef.current) {
                        const keys = scrollContainerRef.current.querySelectorAll('.piano-key-sticky');
                        keys.forEach(key => {
                            if (playingNoteNames.has(key.dataset.key)) {
                                key.classList.add('playing');
                            } else {
                                key.classList.remove('playing');
                            }
                        });
                    }
                }
            }

            animationFrameId = requestAnimationFrame(animateScroll);
        };

        animationFrameId = requestAnimationFrame(animateScroll);

        return () => cancelAnimationFrame(animationFrameId);
    }, [isPlaying, bpm, pixelsPerStep]);

    // Update playhead position when NOT playing (Seeking)
    useEffect(() => {
        if (!isPlaying && playheadRef.current) {
            const playheadPixelX = playheadPosition * pixelsPerStep * 4; // 4 steps per beat
            playheadRef.current.style.left = `${playheadPixelX}px`;
        }
    }, [isPlaying, playheadPosition, pixelsPerStep]);



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

        const scrollContainer = scrollContainerRef.current;
        const scrollRect = scrollContainer.getBoundingClientRect();

        // Dynamic measure of keys width to ensure accuracy
        const currentKeysWidth = pianoKeysRef.current ? pianoKeysRef.current.offsetWidth : KEYS_WIDTH;

        // Calculate coordinates relative to the scroll container viewport, accounting for border
        const borderLeft = (parseFloat(window.getComputedStyle(scrollContainer).borderLeftWidth) || 0);
        const borderTop = (parseFloat(window.getComputedStyle(scrollContainer).borderTopWidth) || 0);

        const viewportX = e.clientX - scrollRect.left - borderLeft;
        const viewportY = e.clientY - scrollRect.top - borderTop;

        // Add scroll offsets to get content coordinates
        const globalX = viewportX + scrollContainer.scrollLeft;
        // globalY is relative to the start of the content area vertically
        const globalY = viewportY + scrollContainer.scrollTop;

        // Check if clicked ON keys (sticky)
        // With sticky keys, they visually cover the first 'currentKeysWidth' pixels of the viewport always
        if (viewportX < currentKeysWidth) {
            // Clicked on Keys - potentially preview note sound? 
            if (e.button === 0) {
                // Calculate which key was clicked
                // Since keys scroll vertically with content, globalY is correct for finding the key index
                const keyName = getKeyFromY(globalY);
                if (keyName) {
                    // Parse note and octave
                    // Assuming format like "C#5"
                    previewPianoNote(keyName, selectedChannelId);
                }
            }
            return;
        }

        const gridX = globalX - currentKeysWidth; // Coordinate relative to grid start
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

            const isLeft = e.target.classList.contains('piano-note-resize-left');

            setDragState({
                type: 'RESIZE',
                notes: selection.includes(noteId) ? selection : [noteId],
                startX: e.clientX,
                isLeft: isLeft,
                initialLengths: selection.includes(noteId)
                    ? selection.reduce((acc, id) => ({ ...acc, [id]: activePattern.data.notes.find(n => n.id === id).length }), {})
                    : { [noteId]: note.length },
                initialSteps: selection.includes(noteId)
                    ? selection.reduce((acc, id) => ({ ...acc, [id]: activePattern.data.notes.find(n => n.id === id).startStep }), {})
                    : { [noteId]: note.startStep }
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
        const noteName = getKeyFromY(globalY); // Use globalY for key lookup

        if (!noteName) return;

        if (selectedTool === 'pencil' || selectedTool === 'brush') {
            // Preview sound
            previewPianoNote(noteName, selectedChannelId);

            // Calculate snapped start position and length based on snapStrength
            const finalStartStep = snapEnabled ? Math.floor(step / snapStrength) * snapStrength : step;
            const noteLength = snapEnabled ? snapStrength : 4;
            const noteId = Date.now();

            const newNote = {
                id: noteId,
                noteName,
                channelId: selectedChannelId,
                startStep: finalStartStep,
                length: noteLength,
                velocity: 100  // Default velocity (0-127 range)
            };
            addNoteToActivePattern(newNote);

            // Start 'CREATE' drag to allow extending length immediately
            setDragState({
                type: 'CREATE',
                noteId: noteId,
                startX: e.clientX,
                initialLength: noteLength,
                initialStep: finalStartStep
            });
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

    // Track mouse position in grid (for paste at cursor)
    const handleGridMouseMove = useCallback((e) => {
        if (!scrollContainerRef.current || !pianoKeysRef.current) return;

        const scrollRect = scrollContainerRef.current.getBoundingClientRect();
        const borderLeft = parseFloat(window.getComputedStyle(scrollContainerRef.current).borderLeftWidth) || 0;
        const borderTop = parseFloat(window.getComputedStyle(scrollContainerRef.current).borderTopWidth) || 0;

        const viewportX = e.clientX - scrollRect.left - borderLeft;
        const viewportY = e.clientY - scrollRect.top - borderTop;

        const globalX = viewportX + scrollContainerRef.current.scrollLeft;
        const globalY = viewportY + scrollContainerRef.current.scrollTop;

        const currentKeysWidth = pianoKeysRef.current.offsetWidth || KEYS_WIDTH;
        const gridX = globalX - currentKeysWidth;

        // Calculate step and key from grid position
        const step = Math.max(0, Math.floor(gridX / pixelsPerStep));
        const keyIndex = Math.floor(globalY / keyHeight);
        const keyName = allKeys[keyIndex]?.fullName || null;

        // Update the ref (no re-render needed)
        mouseGridPositionRef.current = { step, key: keyName };
    }, [pixelsPerStep, keyHeight, allKeys]);

    const handleMouseMove = (e) => {
        if (!dragState) return;

        if (dragState.type === 'MOVE') {
            const dxPixels = e.clientX - dragState.startX;
            const dyPixels = e.clientY - dragState.startY;
            const rawDxSteps = Math.round(dxPixels / pixelsPerStep);

            // Alt key bypasses snap (snapStrength becomes 1)
            const effectiveSnap = (snapEnabled && !e.altKey) ? snapStrength : 1;
            const dxSteps = snapEnabled ? Math.round(rawDxSteps / effectiveSnap) * effectiveSnap : rawDxSteps;

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
            const rawDxSteps = Math.round(dxPixels / pixelsPerStep);

            // Alt key bypasses snap
            const effectiveSnap = (snapEnabled && !e.altKey) ? snapStrength : 1;
            const dxSteps = snapEnabled ? Math.round(rawDxSteps / effectiveSnap) * effectiveSnap : rawDxSteps;

            dragState.notes.forEach(id => {
                const initLength = dragState.initialLengths[id];
                const initStep = dragState.initialSteps[id];

                if (dragState.isLeft) {
                    const newStartStep = Math.max(0, initStep + dxSteps);
                    const newLength = Math.max(1, initLength - (newStartStep - initStep));
                    updateNote(id, { startStep: newStartStep, length: newLength });
                } else {
                    const newLength = Math.max(1, initLength + dxSteps);
                    updateNote(id, { length: newLength });
                }
            });
        }

        if (dragState.type === 'CREATE') {
            const dxPixels = e.clientX - dragState.startX;
            const rawDxSteps = Math.round(dxPixels / pixelsPerStep);
            const dxSteps = snapEnabled ? Math.round(rawDxSteps / snapStrength) * snapStrength : rawDxSteps;

            const newLength = Math.max(1, dragState.initialLength + dxSteps);
            updateNote(dragState.noteId, { length: newLength });
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

    // Velocity drag handlers
    useEffect(() => {
        if (!velocityDragState) return;

        const handleVelocityMove = (e) => {
            const dy = velocityDragState.startY - e.clientY; // Inverted: drag up = higher velocity
            const deltaVelocity = Math.round(dy * 0.5); // Sensitivity
            const newVelocity = Math.max(1, Math.min(127, velocityDragState.initialVelocity + deltaVelocity));
            updateNote(velocityDragState.noteId, { velocity: newVelocity });
        };

        const handleVelocityUp = () => {
            setVelocityDragState(null);
        };

        window.addEventListener('mousemove', handleVelocityMove);
        window.addEventListener('mouseup', handleVelocityUp);
        return () => {
            window.removeEventListener('mousemove', handleVelocityMove);
            window.removeEventListener('mouseup', handleVelocityUp);
        };
    }, [velocityDragState, updateNote]);

    // Comprehensive keyboard handler for FL Studio-style shortcuts
    const handleKeyDown = useCallback((e) => {
        // Don't handle if typing in an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

        const isCtrl = e.ctrlKey || e.metaKey;

        // Delete/Backspace - Delete selected notes
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (selection.length > 0) {
                pushNotesHistory(); // Save state before deletion
                deleteNotes(selection);
                setSelection([]);
            }
            return;
        }

        // Ctrl+A - Select All
        if (isCtrl && e.key.toLowerCase() === 'a') {
            e.preventDefault();
            if (activePattern?.data?.notes) {
                setSelection(activePattern.data.notes.map(n => n.id));
            }
            return;
        }

        // Ctrl+D - Deselect All
        if (isCtrl && e.key.toLowerCase() === 'd') {
            e.preventDefault();
            setSelection([]);
            return;
        }

        // Ctrl+C - Copy selected notes
        if (isCtrl && e.key.toLowerCase() === 'c') {
            e.preventDefault();
            if (selection.length === 0 || !activePattern?.data?.notes) return;

            const selectedNotes = activePattern.data.notes.filter(n => selection.includes(n.id));
            if (selectedNotes.length === 0) return;

            // Find the minimum startStep and key index to create relative positions
            const minStep = Math.min(...selectedNotes.map(n => n.startStep));

            // Store notes with relative positions
            const clipboardNotes = selectedNotes.map(n => ({
                ...n,
                relativeStep: n.startStep - minStep
            }));

            setClipboard(clipboardNotes);
            console.log('Copied', clipboardNotes.length, 'notes to clipboard');
            return;
        }

        // Ctrl+X - Cut (copy + delete)
        if (isCtrl && e.key.toLowerCase() === 'x') {
            e.preventDefault();
            if (selection.length === 0 || !activePattern?.data?.notes) return;

            const selectedNotes = activePattern.data.notes.filter(n => selection.includes(n.id));
            if (selectedNotes.length === 0) return;

            // Copy to clipboard
            const minStep = Math.min(...selectedNotes.map(n => n.startStep));
            const clipboardNotes = selectedNotes.map(n => ({
                ...n,
                relativeStep: n.startStep - minStep
            }));
            setClipboard(clipboardNotes);

            // Delete the notes
            pushNotesHistory();
            deleteNotes(selection);
            setSelection([]);
            console.log('Cut', clipboardNotes.length, 'notes');
            return;
        }

        // Ctrl+V - Paste notes at mouse cursor position in grid
        if (isCtrl && e.key.toLowerCase() === 'v') {
            e.preventDefault();
            if (clipboard.length === 0) return;

            pushNotesHistory();

            // Use the tracked mouse position in the grid, or fall back to playhead
            const pasteStep = mouseGridPositionRef.current.step || Math.floor(playheadPosition * 4);

            // Create new notes with new IDs and adjusted positions
            const newNotes = clipboard.map(n => ({
                id: Date.now() + Math.random(),
                noteName: n.noteName,
                channelId: n.channelId,
                startStep: pasteStep + n.relativeStep,
                length: n.length,
                velocity: n.velocity || 100
            }));

            addNotesToActivePattern(newNotes);

            // Select the newly pasted notes
            setSelection(newNotes.map(n => n.id));
            console.log('Pasted', newNotes.length, 'notes at step', pasteStep);
            return;
        }

        // Ctrl+B - Duplicate (FL Studio style: paste after selection)
        if (isCtrl && e.key.toLowerCase() === 'b') {
            e.preventDefault();
            if (selection.length === 0 || !activePattern?.data?.notes) return;

            const selectedNotes = activePattern.data.notes.filter(n => selection.includes(n.id));
            if (selectedNotes.length === 0) return;

            pushNotesHistory();

            // Find the rightmost end point of selected notes
            const maxEndStep = Math.max(...selectedNotes.map(n => n.startStep + n.length));
            const minStep = Math.min(...selectedNotes.map(n => n.startStep));

            // Create duplicates placed right after the selection
            const newNotes = selectedNotes.map(n => ({
                id: Date.now() + Math.random(),
                noteName: n.noteName,
                channelId: n.channelId,
                startStep: maxEndStep + (n.startStep - minStep),
                length: n.length,
                velocity: n.velocity || 100
            }));

            addNotesToActivePattern(newNotes);

            // Select the newly duplicated notes
            setSelection(newNotes.map(n => n.id));
            console.log('Duplicated', newNotes.length, 'notes');
            return;
        }

        // Ctrl+Z - Undo
        if (isCtrl && !e.shiftKey && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            undoNotes();
            setSelection([]);
            console.log('Undo');
            return;
        }

        // Ctrl+Shift+Z or Ctrl+Y - Redo
        if ((isCtrl && e.shiftKey && e.key.toLowerCase() === 'z') || (isCtrl && e.key.toLowerCase() === 'y')) {
            e.preventDefault();
            redoNotes();
            setSelection([]);
            console.log('Redo');
            return;
        }

        // Arrow Key Movement
        // Shift+Arrows = Semitone / Step
        // Ctrl+Arrows = Octave / Step
        if (selection.length > 0 && activePattern?.data?.notes) {
            const isShift = e.shiftKey;

            if (isShift || isCtrl) {
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                    e.preventDefault();
                    pushNotesHistory();

                    const selectedNotes = activePattern.data.notes.filter(n => selection.includes(n.id));

                    // Collect all updates first, then apply in a single batch
                    const noteUpdates = {};
                    let previewNoteName = null;
                    let previewChannelId = null;

                    selectedNotes.forEach(note => {
                        let updates = {};

                        // Pitch Movement (Up/Down)
                        if (e.key === 'ArrowUp') {
                            const currentKeyIndex = allKeys.findIndex(k => k.fullName === note.noteName);
                            const delta = isCtrl ? 12 : 1;
                            const newIndex = Math.max(0, currentKeyIndex - delta);
                            if (currentKeyIndex !== -1 && newIndex !== currentKeyIndex) {
                                updates.noteName = allKeys[newIndex].fullName;
                                if (!previewNoteName) {
                                    previewNoteName = allKeys[newIndex].fullName;
                                    previewChannelId = note.channelId;
                                }
                            }
                        } else if (e.key === 'ArrowDown') {
                            const currentKeyIndex = allKeys.findIndex(k => k.fullName === note.noteName);
                            const delta = isCtrl ? 12 : 1;
                            const newIndex = Math.min(allKeys.length - 1, currentKeyIndex + delta);
                            if (currentKeyIndex !== -1 && newIndex !== currentKeyIndex) {
                                updates.noteName = allKeys[newIndex].fullName;
                                if (!previewNoteName) {
                                    previewNoteName = allKeys[newIndex].fullName;
                                    previewChannelId = note.channelId;
                                }
                            }
                        }

                        // Time Movement (Left/Right)
                        if (e.key === 'ArrowLeft') {
                            const moveStep = snapEnabled ? snapStrength : 1;
                            updates.startStep = Math.max(0, note.startStep - moveStep);
                        } else if (e.key === 'ArrowRight') {
                            const moveStep = snapEnabled ? snapStrength : 1;
                            updates.startStep = note.startStep + moveStep;
                        }

                        if (Object.keys(updates).length > 0) {
                            noteUpdates[note.id] = updates;
                        }
                    });

                    // Apply all updates in a single batch via updatePattern
                    if (Object.keys(noteUpdates).length > 0) {
                        const updatedNotes = activePattern.data.notes.map(n => {
                            if (noteUpdates[n.id]) {
                                return { ...n, ...noteUpdates[n.id] };
                            }
                            return n;
                        });

                        updatePattern(activePatternId, {
                            data: {
                                ...activePattern.data,
                                notes: updatedNotes
                            }
                        });

                        // Preview sound after batch update
                        if (previewNoteName) {
                            previewPianoNote(previewNoteName, previewChannelId);
                        }
                    }
                    return;
                }
            }
        }

    }, [selection, deleteNotes, activePattern, activePatternId, clipboard, playheadPosition, addNotesToActivePattern, pushNotesHistory, undoNotes, redoNotes, allKeys, updatePattern, snapEnabled, snapStrength, previewPianoNote]);

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);

    // Track current playback step for pulse animation (REMOVED - now handled in animateScroll)

    // Get notes for each key
    const getNotesForKey = (keyFullName) => {
        return activePattern.data.notes.filter(n => n.noteName === keyFullName);
    };

    // Check if a note is currently playing (REMOVED - now handled in animateScroll)

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

                    {/* Channel Selector */}
                    <div className="channel-selector" style={{ display: 'flex', alignItems: 'center', marginLeft: '24px', gap: '12px' }}>
                        <span style={{ fontSize: '11px', color: '#888' }}>Channel:</span>
                        <select
                            value={selectedChannelId}
                            onChange={(e) => {
                                const id = parseInt(e.target.value);
                                setSelectedChannelId(id);
                                if (selectChannel) selectChannel(id);
                            }}
                            style={{
                                background: '#333',
                                color: '#eee',
                                border: '1px solid #444',
                                borderRadius: '4px',
                                fontSize: '11px',
                                padding: '2px 4px',
                                outline: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            {channels.map(ch => (
                                <option key={ch.id} value={ch.id}>{ch.id}. {ch.name}</option>
                            ))}
                        </select>
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
                onMouseMove={handleGridMouseMove}
            >
                {/* Piano Keys Column - Fixed via sticky */}
                <div className="piano-keys-column" ref={pianoKeysRef}>
                    {allKeys.map((k) => {
                        const keyNotes = getNotesForKey(k.fullName);
                        const hasNotes = keyNotes.length > 0;
                        return (
                            <div
                                className={`piano-key-sticky ${k.isBlack ? 'black' : 'white'} ${hoveredKey === k.fullName ? 'hovered' : ''} ${hasNotes ? 'has-notes' : ''}`}
                                key={k.fullName}
                                data-key={k.fullName}
                                style={{ height: `${keyHeight}px` }}
                                onMouseEnter={() => setHoveredKey(k.fullName)}
                                onMouseLeave={() => setHoveredKey(null)}
                                onMouseDown={() => previewPianoNote(k.note + k.octave, selectedChannelId)}
                            >
                                <span className="key-label" style={{ opacity: k.note === 'C' ? 1 : 0.4 }}>
                                    {k.note === 'C' ? `${k.note}${k.octave}` : k.note}
                                </span>
                                {hasNotes && <div className="key-note-indicator"></div>}
                            </div>
                        );
                    })}
                </div>

                {/* Grid Area - Flows naturally now */}
                <div className="piano-grid-area" ref={gridAreaRef}>
                    <div style={{ position: 'relative' }}>
                        {/* Playhead for piano roll - Local High-Perf Render */}
                        <div
                            ref={playheadRef}
                            className="piano-playhead"
                            style={{
                                position: 'absolute',
                                top: 0,
                                bottom: 0,
                                width: '2px',
                                background: '#ef4444',
                                zIndex: 30,
                                pointerEvents: 'none',
                                left: '0px' // Initial
                            }}
                        >
                            <div className="playhead-highlighter"></div>
                            <div className="playhead-time-label" style={{
                                position: 'absolute',
                                top: '0px',
                                left: '4px',
                                backgroundColor: '#2a2a2a',
                                color: '#ef4444',
                                fontSize: '10px',
                                padding: '2px 4px',
                                borderRadius: '3px',
                                pointerEvents: 'none',
                                whiteSpace: 'nowrap'
                            }}>
                                {/* Time label could be updated via ref too if needed, or omitted for speed */}
                            </div>
                        </div>
                        {allKeys.map((k) => {
                            return (
                                <div
                                    className={`piano-grid-row ${k.isBlack ? 'black-row' : 'white-row'}`}
                                    key={k.fullName}
                                    data-key={k.fullName}
                                    style={{
                                        width: `${totalBars * stepsPerBar * pixelsPerStep}px`,
                                        height: `${keyHeight}px`,
                                        backgroundImage: `
                                            linear-gradient(to right, rgba(255, 255, 255, 0.35) 1px, transparent 1px),
                                            linear-gradient(to right, rgba(255, 255, 255, 0.25) 1px, transparent 1px),
                                            linear-gradient(to right, rgba(255, 255, 255, 0.15) 1px, transparent 1px)
                                        `,
                                        backgroundSize: `
                                            ${pixelsPerStep * 16}px 100%,
                                            ${pixelsPerStep * 4}px 100%,
                                            ${pixelsPerStep}px 100%
                                        `,
                                        backgroundPosition: '0 0'
                                    }}
                                >
                                    {/* Render Grid Background Cells */}
                                    {/* Grid rendered via CSS background on the row for performance */}
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
                            {activePattern.data.notes
                                .filter(note => {
                                    // Show note if it matches selected channel
                                    // OR if it has no channelId (legacy) and we are on channel 0 (Grand Piano)
                                    // Default undefined channelId to 0 (Grand Piano)
                                    const noteChannelId = note.channelId !== undefined ? note.channelId : 0;
                                    return noteChannelId === selectedChannelId;
                                })
                                .map(note => {
                                    const top = getYFromKey(note.noteName);
                                    const left = note.startStep * pixelsPerStep;
                                    const width = note.length * pixelsPerStep;
                                    const isSelected = selection.includes(note.id);

                                    return (
                                        <div
                                            key={note.id}
                                            data-id={note.id}
                                            data-start-step={note.startStep}
                                            data-len={note.length}
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
                                            <div className="piano-note-resize-left"></div>
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

            {/* Velocity Lane */}
            {!velocityLaneCollapsed && (
                <div className="velocity-lane" style={{
                    height: '120px',
                    background: '#1a1a1a',
                    borderTop: '1px solid #333',
                    display: 'flex',
                    flexDirection: 'column'
                }}>
                    {/* Lane Header */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '4px 8px',
                        background: '#252525',
                        borderBottom: '1px solid #333',
                        fontSize: '11px',
                        color: '#888'
                    }}>
                        <button
                            onClick={() => setVelocityLaneCollapsed(true)}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: '#666',
                                cursor: 'pointer',
                                padding: '2px 6px',
                                marginRight: '8px'
                            }}
                        >
                            ▼
                        </button>
                        <span style={{ color: '#4ade80' }}>Control ▸</span>
                        <span style={{ marginLeft: '8px', color: '#aaa' }}>Velocity</span>
                    </div>
                    {/* Velocity Bars Area - FL Studio Style */}
                    <div style={{
                        flex: 1,
                        position: 'relative',
                        overflowX: 'hidden',
                        overflowY: 'hidden',
                        marginLeft: `${KEYS_WIDTH}px`
                    }}>
                        {/* Grid background */}
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'repeating-linear-gradient(90deg, transparent 0, transparent 63px, #333 63px, #333 64px)',
                            opacity: 0.3
                        }} />
                        {/* FL Studio-style Step Velocity */}
                        <svg style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: `${totalBars * stepsPerBar * pixelsPerStep}px`,
                            height: '100%',
                            pointerEvents: 'none'
                        }}>
                            {(() => {
                                const filteredNotes = activePattern.data.notes
                                    .filter(note => {
                                        const noteChannelId = note.channelId !== undefined ? note.channelId : 0;
                                        return noteChannelId === selectedChannelId;
                                    })
                                    .sort((a, b) => a.startStep - b.startStep);

                                const laneHeight = 80;
                                const baseY = 85;

                                return filteredNotes.map((note, index) => {
                                    const velocity = note.velocity !== undefined ? note.velocity : 100;
                                    const barHeight = (velocity / 127) * laneHeight;
                                    const x = note.startStep * pixelsPerStep + (note.length * pixelsPerStep / 2);
                                    const topY = baseY - barHeight;
                                    const isSelected = selection.includes(note.id);
                                    const color = isSelected ? '#60a5fa' : '#4ade80';

                                    // Get next note for horizontal connector
                                    const nextNote = filteredNotes[index + 1];
                                    const nextX = nextNote
                                        ? nextNote.startStep * pixelsPerStep + (nextNote.length * pixelsPerStep / 2)
                                        : null;

                                    return (
                                        <g key={note.id}>
                                            {/* Vertical line from baseline */}
                                            <line
                                                x1={x} y1={baseY} x2={x} y2={topY}
                                                stroke={color} strokeWidth="2"
                                            />
                                            {/* Horizontal line to next note (step pattern) */}
                                            {nextX !== null && (
                                                <line
                                                    x1={x} y1={topY} x2={nextX} y2={topY}
                                                    stroke={color} strokeWidth="2"
                                                />
                                            )}
                                            {/* Drag handle circle */}
                                            <circle
                                                cx={x} cy={topY} r="4"
                                                fill={color} stroke="#222" strokeWidth="1"
                                                style={{ pointerEvents: 'auto', cursor: 'ns-resize' }}
                                                onMouseDown={(e) => {
                                                    e.stopPropagation();
                                                    setVelocityDragState({
                                                        noteId: note.id,
                                                        startY: e.clientY,
                                                        initialVelocity: velocity
                                                    });
                                                }}
                                            />
                                        </g>
                                    );
                                });
                            })()}
                        </svg>
                    </div>
                </div>
            )}

            {/* Collapsed Velocity Lane Toggle */}
            {velocityLaneCollapsed && (
                <div
                    onClick={() => setVelocityLaneCollapsed(false)}
                    style={{
                        height: '24px',
                        background: '#252525',
                        borderTop: '1px solid #333',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '0 8px',
                        cursor: 'pointer',
                        fontSize: '11px',
                        color: '#666'
                    }}
                >
                    ▶ Control
                </div>
            )}
        </div>
    );
};

export default React.memo(PianoRoll);
