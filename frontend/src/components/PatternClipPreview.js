import React, { useMemo } from 'react';

// Displays a mini visual representation of the pattern data
const PatternClipPreview = ({ pattern, startStep = 0, lengthStep = 16 }) => {
    // If no pattern data, just return empty
    if (!pattern || !pattern.data) return null;

    const { steps, notes } = pattern.data;

    // We render the view window defined by startStep and lengthStep
    // x = 0% corresponds to startStep
    // x = 100% corresponds to startStep + lengthStep

    // Render Steps (Sequencer) as small dots at the bottom
    const stepVisuals = useMemo(() => {
        const visuals = [];
        const channelIds = Object.keys(steps);
        // We iterate only the relevant range if possible, or filter.
        // Steps are arrays.

        channelIds.forEach((chId, rowIndex) => {
            const chSteps = steps[chId];
            chSteps.forEach((isActive, stepIndex) => {
                if (isActive) {
                    // Check if inside window
                    if (stepIndex >= startStep && stepIndex < startStep + lengthStep) {
                        const relativeStep = stepIndex - startStep;
                        visuals.push({
                            id: `step-${chId}-${stepIndex}`,
                            x: (relativeStep / lengthStep) * 100, // percentage of the CLIP length
                            y: 80 - (rowIndex * 5),
                            type: 'step'
                        });
                    }
                }
            });
        });
        return visuals;
    }, [steps, startStep, lengthStep]);

    // Render Notes (Piano Roll) as small lines
    const noteVisuals = useMemo(() => {
        if (!notes) return [];
        const minNote = 24; // C2 roughly
        const maxNote = 84; // C7 roughly
        const range = maxNote - minNote;

        return notes.map(note => {
            // Check visibility
            // Note start or part of note should be in window.
            // Simplified: just check intersection.
            const noteEnd = note.startStep + note.length;
            const windowEnd = startStep + lengthStep;

            if (noteEnd <= startStep || note.startStep >= windowEnd) {
                return null;
            }

            // Calculate relative position
            // Clamp start and end to window for rendering?
            const visibleStart = Math.max(note.startStep, startStep);
            const visibleEnd = Math.min(noteEnd, windowEnd);
            const visibleLength = visibleEnd - visibleStart;

            const relativeStart = visibleStart - startStep;

            // Note Name to Y
            const match = note.noteName.match(/([A-G]#?)(\d)/);
            let y = 50;
            if (match) {
                const n = match[1]; // C, C#, D...
                const o = parseInt(match[2]);
                const notesArr = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
                const semitone = notesArr.indexOf(n);
                const absNote = o * 12 + semitone;
                y = 100 - ((absNote - minNote) / range) * 100;
            }

            return {
                id: `note-${note.id}`,
                x: (relativeStart / lengthStep) * 100,
                width: (visibleLength / lengthStep) * 100,
                y: y,
                type: 'note'
            };
        }).filter(Boolean);
    }, [notes, startStep, lengthStep]);

    return (
        <div className="pattern-preview" style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
            {/* Notes */}
            {noteVisuals.map(vis => (
                <div key={vis.id} style={{
                    position: 'absolute',
                    left: `${vis.x}%`,
                    top: `${vis.y}%`,
                    width: `${Math.max(vis.width, 1)}%`,
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
