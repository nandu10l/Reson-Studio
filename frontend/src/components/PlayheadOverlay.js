import React, { useEffect, useRef } from 'react';
import { audioEngine } from '../audio/AudioEngine';
import { useProject } from '../contexts/ProjectContext';

const PlayheadOverlay = ({ pixelsPerBeat, bpm, measures, beatsPerBar }) => {
    const { playbackMode } = useProject();
    const lineRef = useRef(null);
    const requestRef = useRef(null);

    useEffect(() => {
        const animate = () => {
            if (playbackMode === 'PAT') {
                if (lineRef.current) {
                    // Start position or hidden? Let's just keep it at 0 or hidden.
                    // Ideally it stays where the song playhead was, but we can just stop updating it.
                    // If we stop updating, it stays at last position.
                    // If we want it strictly NOT MOVING, we can just return.
                    // However, if we switch modes while playing, we want it to react.
                    // Let's force it to 0 or hide it for clarity?
                    // User request: "playhead should not move".
                    // Best behavior: Hide it or keep it static.
                    // Let's just NOT update the transform if in PAT mode.
                    // But if it was moving, it will stop.
                    // Should we hide it? FL Studio hides the song playhead in Pattern mode usually, or it just sits there.
                    // Let's trying keeping it static (no update).
                }
                // Continue loop to catch mode change
                requestRef.current = requestAnimationFrame(animate);
                return;
            }

            const time = audioEngine.getCurrentTime();
            const beats = time * (bpm / 60);
            const x = beats * pixelsPerBeat;

            if (lineRef.current) {
                lineRef.current.style.transform = `translateX(${x}px)`;
            }

            requestRef.current = requestAnimationFrame(animate);
        };

        requestRef.current = requestAnimationFrame(animate);

        return () => {
            if (requestRef.current) {
                cancelAnimationFrame(requestRef.current);
            }
        };
    }, [pixelsPerBeat, bpm, playbackMode]);

    return (
        <div
            className="playhead-overlay"
            style={{
                position: 'absolute',
                top: 0,
                left: '140px', // Match timeline/track header width
                bottom: 0,
                width: `${measures * beatsPerBar * pixelsPerBeat}px`,
                pointerEvents: 'none',
                zIndex: 15,
                overflow: 'hidden'
            }}
        >
            <div
                ref={lineRef}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0, // We move using transform for performance
                    width: '2px', // Line width
                    height: '100%',
                    background: 'rgba(239, 68, 68, 0.7)', // Red line
                    boxShadow: '0 0 4px rgba(239, 68, 68, 0.5)',
                    willChange: 'transform'
                }}
            />
        </div>
    );
};

export default PlayheadOverlay;
