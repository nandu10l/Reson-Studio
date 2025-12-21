import React, { useMemo } from 'react';

// Displays a mini visual representation of the pattern data
const PatternClipPreview = ({ pattern, width, height }) => {
    // If no pattern data, just return empty
    if (!pattern || !pattern.data) return null;

    const { steps, notes } = pattern.data;

    // Constants for visualization
    // We want to map the pattern length (e.g. 16 steps) to the clip width.
    // If the clip is looped, we repeat. But for V1 let's just show the pattern content once scaled to fit?
    // User asked for looping/resizing. 
    // Standard DAW behavior: The clip is a window into the pattern. If clip length > pattern length, it repeats.

    // For this simple preview, let's render the pattern data scaled to the pattern's "native" width relative to the clip.
    // However, simplest start: Render the pattern data scaled to fit 100% of the view if clip length == pattern length.

    // Let's assume the clip container handles the "windowing" via overflow:hidden and we render the full repeated pattern inside?
    // Or we render just one iteration.
    // Let's render one iteration of visual data. 

    // We need to know the pattern length in steps to normalize x-coordinates.
    const patternSteps = pattern.length || 16;

    // Render Steps (Sequencer) as small dots at the bottom
    const stepVisuals = useMemo(() => {
        const visuals = [];
        const channelIds = Object.keys(steps);
        const stepsCount = channelIds.length > 0 ? steps[channelIds[0]].length : 16;

        channelIds.forEach((chId, rowIndex) => {
            const chSteps = steps[chId];
            chSteps.forEach((isActive, stepIndex) => {
                if (isActive) {
                    visuals.push({
                        id: `step-${chId}-${stepIndex}`,
                        x: (stepIndex / stepsCount) * 100, // percentage
                        y: 80 - (rowIndex * 5), // stack from bottom up roughly
                        type: 'step'
                    });
                }
            });
        });
        return visuals;
    }, [steps]);

    // Render Notes (Piano Roll) as small lines
    const noteVisuals = useMemo(() => {
        if (!notes) return [];
        // Find min/max octave to normalize Y height?
        // Or just map C2-C7 to 0-100% height
        const minNote = 24; // C2 roughly
        const maxNote = 84; // C7 roughly
        const range = maxNote - minNote;

        return notes.map(note => {
            // Need to parse note name to value.. simplified for now
            // We'll just generate a stable pseudo-random Y if we can't parse easily without a library,
            // OR we assume standard format "C5", "F#4".
            // Let's do a simple hash or just random for "visual preview" if parsing is overkill?
            // No, user wants meaningful data.
            // Let's try to simple parse: Note + Octave.
            const match = note.noteName.match(/([A-G]#?)(\d)/);
            let y = 50;
            if (match) {
                const n = match[1]; // C, C#, D...
                const o = parseInt(match[2]);
                // Very rough mapping
                const notesArr = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
                const semitone = notesArr.indexOf(n);
                const absNote = o * 12 + semitone;
                y = 100 - ((absNote - minNote) / range) * 100;
            }

            return {
                id: `note-${note.id}`,
                x: (note.startStep / patternSteps) * 100,
                width: (note.length / patternSteps) * 100,
                y: y,
                type: 'note'
            };
        });
    }, [notes, patternSteps]);

    return (
        <div className="pattern-preview" style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
            {/* Notes */}
            {noteVisuals.map(vis => (
                <div key={vis.id} style={{
                    position: 'absolute',
                    left: `${vis.x}%`,
                    top: `${vis.y}%`,
                    width: `${Math.max(vis.width, 2)}%`,
                    height: '2px', // thin line
                    background: 'rgba(255, 255, 255, 0.8)',
                    borderRadius: '1px'
                }} />
            ))}

            {/* Steps (dots) */}
            {stepVisuals.map(vis => (
                <div key={vis.id} style={{
                    position: 'absolute',
                    left: `${vis.x}%`,
                    top: `${vis.y}%`,
                    width: '3px',
                    height: '3px',
                    background: 'rgba(255, 255, 255, 0.6)',
                    borderRadius: '50%'
                }} />
            ))}
        </div>
    );
};

export default PatternClipPreview;
