import React, { useMemo, useEffect, useState } from 'react';
import * as Tone from 'tone';
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
  const { playheadPosition, isPlaying, bpm } = useProject();
  const playheadRef = React.useRef(null);
  const timeLabelRef = React.useRef(null);

  // Animation Loop checking Tone.Transport
  useEffect(() => {
    let rAF;
    const animate = () => {
      const seconds = Tone.Transport.seconds;
      const beats = seconds * (bpm / 60);

      let pos = beats;
      // Handle looping logic in the animation loop
      if (loopStart !== null && loopEnd !== null && pos >= loopEnd) {
        const loopLength = loopEnd - loopStart;
        pos = ((pos - loopStart) % loopLength) + loopStart;
      }

      // Calculate pixel position
      let pixelPos = 0;
      if (mode === 'quantized') {
        pixelPos = Math.floor(pos) * pixelsPerStep;
      } else {
        pixelPos = pos * pixelsPerBeat;
      }

      // Direct DOM Update for visual smoothness
      if (playheadRef.current) {
        playheadRef.current.style.transform = `translateX(${headerOffset + pixelPos}px)`;
      }

      // Update time label
      if (timeLabelRef.current) {
        const sixteenthsPerBeat = 4;
        const totalSixteenths = Math.floor(pos * sixteenthsPerBeat);
        const bar = Math.floor(totalSixteenths / (beatsPerBar * sixteenthsPerBeat));
        const beat = Math.floor((totalSixteenths % (beatsPerBar * sixteenthsPerBeat)) / sixteenthsPerBeat);
        const sixteenth = totalSixteenths % sixteenthsPerBeat;
        timeLabelRef.current.textContent = `${bar}:${beat}:${sixteenth}`;
      }

      rAF = requestAnimationFrame(animate);
    };

    if (isPlaying) {
      rAF = requestAnimationFrame(animate);
    } else {
      // Static update when seeking/stopped
      animate();
    }

    return () => {
      if (rAF) cancelAnimationFrame(rAF);
    };
  }, [isPlaying, bpm, mode, pixelsPerBeat, pixelsPerStep, headerOffset, loopStart, loopEnd, beatsPerBar]);

  // Handle case where playheadPosition changes while paused (Seeking)
  useEffect(() => {
    if (!isPlaying && playheadRef.current) {
      let pos = playheadPosition;
      if (loopStart !== null && loopEnd !== null && pos >= loopEnd) {
        const loopLength = loopEnd - loopStart;
        pos = ((pos - loopStart) % loopLength) + loopStart;
      }
      const pixelPos = mode === 'quantized' ? Math.floor(pos) * pixelsPerStep : pos * pixelsPerBeat;
      playheadRef.current.style.transform = `translateX(${headerOffset + pixelPos}px)`;

      if (timeLabelRef.current) {
        const sixteenthsPerBeat = 4;
        const totalSixteenths = Math.floor(pos * sixteenthsPerBeat);
        const bar = Math.floor(totalSixteenths / (beatsPerBar * sixteenthsPerBeat));
        const beat = Math.floor((totalSixteenths % (beatsPerBar * sixteenthsPerBeat)) / sixteenthsPerBeat);
        const sixteenth = totalSixteenths % sixteenthsPerBeat;
        timeLabelRef.current.textContent = `${bar}:${beat}:${sixteenth}`;
      }
    }
  }, [playheadPosition, isPlaying, mode, pixelsPerBeat, pixelsPerStep, headerOffset, loopStart, loopEnd, beatsPerBar]);

  return (
    <div
      ref={playheadRef}
      className={`playhead playhead-${mode} ${className}`}
      style={{
        position: 'absolute',
        left: 0, // We use translateX for position
        top: 0,
        height: '100%',
        minHeight: '100%',
        width: '1px',
        zIndex: 30,
        pointerEvents: 'none',
        willChange: 'transform',
        ...style
      }}
    >
      <div
        ref={timeLabelRef}
        className="playhead-time-label"
        style={{
          color: '#60a5fa'
        }}
      >
        0:0:0
      </div>

      <div className="playhead-line" style={{ height: '100%', minHeight: '100%' }} />
    </div>
  );
};

export default React.memo(Playhead);

