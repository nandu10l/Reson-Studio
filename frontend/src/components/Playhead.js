import React, { useMemo } from 'react';
import { useProject } from '../contexts/ProjectContext';
import './Playhead.css';

/**
 * DAW-grade playhead component that acts as the single authoritative time reference.
 * 
 * Props:
 * @param {string} mode - 'smooth' for timeline/piano roll, 'quantized' for step sequencer
 * @param {number} pixelsPerBeat - Pixels per beat for positioning
 * @param {number} pixelsPerStep - Pixels per step (for quantized mode)
 * @param {number} headerOffset - Horizontal offset for track headers (default: 140)
 * @param {number} loopStart - Loop start position in beats (optional)
 * @param {number} loopEnd - Loop end position in beats (optional)
 * @param {string} className - Additional CSS classes
 */
const Playhead = ({ 
  mode = 'smooth', 
  pixelsPerBeat = 40, 
  pixelsPerStep = 30,
  headerOffset = 140,
  loopStart = null,
  loopEnd = null,
  beatsPerBar = 4,
  className = '',
  style = {}
}) => {
  const { playheadPosition, isPlaying, bpm, playbackMode } = useProject();

  // Calculate display position based on mode
  const displayPosition = useMemo(() => {
    if (mode === 'quantized') {
      // Quantized mode: snap to steps
      const step = Math.floor(playheadPosition);
      return step * pixelsPerStep;
    } else {
      // Smooth mode: continuous movement
      return playheadPosition * pixelsPerBeat;
    }
  }, [mode, playheadPosition, pixelsPerBeat, pixelsPerStep]);

  // Handle looping: if position exceeds loop end, wrap to loop start
  const finalPosition = useMemo(() => {
    if (loopStart !== null && loopEnd !== null && playheadPosition >= loopEnd) {
      const loopLength = loopEnd - loopStart;
      const positionInLoop = ((playheadPosition - loopStart) % loopLength) + loopStart;
      return mode === 'quantized' 
        ? Math.floor(positionInLoop) * pixelsPerStep
        : positionInLoop * pixelsPerBeat;
    }
    return displayPosition;
  }, [displayPosition, loopStart, loopEnd, playheadPosition, mode, pixelsPerBeat, pixelsPerStep]);

  // Calculate current step for quantized mode highlighting
  const currentStep = useMemo(() => {
    if (mode === 'quantized') {
      return Math.floor(playheadPosition);
    }
    return null;
  }, [mode, playheadPosition]);

  // Format time as bar:beat:sixteenth
  const formattedTime = useMemo(() => {
    const beats = playheadPosition;
    const sixteenthsPerBeat = 4;
    const totalSixteenths = Math.floor(beats * sixteenthsPerBeat);
    
    const bar = Math.floor(totalSixteenths / (beatsPerBar * sixteenthsPerBeat));
    const beat = Math.floor((totalSixteenths % (beatsPerBar * sixteenthsPerBeat)) / sixteenthsPerBeat);
    const sixteenth = totalSixteenths % sixteenthsPerBeat;
    
    return `${bar}:${beat}:${sixteenth}`;
  }, [playheadPosition, beatsPerBar]);

  return (
    <div
      className={`playhead playhead-${mode} ${className}`}
      style={{
        position: 'absolute',
        left: `${headerOffset + finalPosition}px`,
        top: 0,
        height: '100%',
        minHeight: '100%',
        width: '1px',
        zIndex: 30,
        pointerEvents: 'none',
        ...style
      }}
    >
      {/* Time label at the top */}
      <div 
        className="playhead-time-label"
        style={{
          color: '#60a5fa' // Explicitly set playhead color
        }}
      >
        {formattedTime}
      </div>
      
      <div className="playhead-line" style={{ height: '100%', minHeight: '100%' }} />
      {mode === 'quantized' && currentStep !== null && (
        <div 
          className="playhead-step-highlight"
          style={{
            position: 'absolute',
            left: `${-pixelsPerStep / 2}px`,
            width: `${pixelsPerStep}px`,
            top: 0,
            bottom: 0
          }}
        />
      )}
    </div>
  );
};

export default Playhead;

