import React, { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut } from './icons/BlenderIcons';
import '../styles/blender-icons.css';
import { audioEngine } from '../audio/AudioEngine';
import { useProject } from '../contexts/ProjectContext';

function Timeline({ measures = 16, beatsPerBar = 4, bpm = 120, zoom, onZoomChange, pixelsPerBeat, onPixelsPerBeatChange }) {
  const { playbackMode } = useProject();
  const timelineRef = useRef(null);
  const playheadRef = useRef(null);
  const rafRef = useRef(null);

  // Sync Playhead with Audio Engine
  useEffect(() => {
    const updatePlayhead = () => {
      if (playbackMode === 'PAT') {
        // Don't update position in PAT mode
        rafRef.current = requestAnimationFrame(updatePlayhead);
        return;
      }

      if (playheadRef.current) {
        const time = audioEngine.getCurrentTime();
        // Time (s) -> Beats -> Pixels
        const beats = time * (bpm / 60);
        const x = beats * pixelsPerBeat;
        playheadRef.current.style.transform = `translateX(${x}px)`;
      }
      rafRef.current = requestAnimationFrame(updatePlayhead);
    };

    rafRef.current = requestAnimationFrame(updatePlayhead);
    return () => cancelAnimationFrame(rafRef.current);
  }, [bpm, pixelsPerBeat, playbackMode]);

  const pixelsToTime = (pixels) => {
    const beats = pixels / pixelsPerBeat;
    const secondsPerBeat = 60 / bpm;
    return beats * secondsPerBeat;
  };

  const handleZoomIn = () => {
    onZoomChange(prev => Math.min(prev * 1.5, 4));
    onPixelsPerBeatChange(prev => Math.min(prev * 1.5, 120));
  };

  const handleZoomOut = () => {
    onZoomChange(prev => Math.max(prev / 1.5, 0.25));
    onPixelsPerBeatChange(prev => Math.max(prev / 1.5, 15));
  };

  // Seeking Logic
  const seek = (e) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = Math.max(0, e.clientX - rect.left);
    const time = pixelsToTime(x);
    audioEngine.seek(time);
  };

  const handlePointerDown = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    seek(e);

    const onPointerMove = (moveEvent) => {
      seek(moveEvent);
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const renderTicks = () => {
    const ticks = [];
    const totalBeats = measures * beatsPerBar;
    const sixteenthsPerBeat = 4; // 4 sixteenth notes per beat
    const totalSixteenths = totalBeats * sixteenthsPerBeat;

    for (let sixteenth = 0; sixteenth < totalSixteenths; sixteenth++) {
      const beat = Math.floor(sixteenth / sixteenthsPerBeat);
      const sixteenthInBeat = sixteenth % sixteenthsPerBeat;
      const bar = Math.floor(beat / beatsPerBar);
      const beatInBar = (beat % beatsPerBar);

      const isDownbeat = beatInBar === 0 && sixteenthInBeat === 0;
      const isBeat = sixteenthInBeat === 0 && !isDownbeat;
      const isSixteenth = !isBeat && !isDownbeat;

      const position = (sixteenth / sixteenthsPerBeat) * pixelsPerBeat;

      ticks.push(
        <div
          key={`tick-${sixteenth}`}
          className={`timeline-tick ${isDownbeat ? 'downbeat' : isBeat ? 'beat' : 'sixteenth'}`}
          style={{
            left: `${position}px`,
            width: `${pixelsPerBeat / sixteenthsPerBeat}px`
          }}
        >
          {isDownbeat && (
            <div className="tick-label">
              {bar + 1}
            </div>
          )}
          <div className="tick-line" />
        </div>
      );
    }
    return ticks;
  };

  return (
    <div className="timeline">
      <div className="timeline-header" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: '0 8px',
        height: '100%',
        borderRight: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        <div className="timeline-controls" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          height: '100%'
        }}>
          <button
            className="timeline-btn"
            onClick={handleZoomOut}
            title="Zoom Out"
            style={{
              width: '24px',
              height: '24px',
              padding: '0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              borderRadius: '2px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <ZoomOut size={18} color="#b3b3b3" className="blender-icon" />
          </button>

          <span className="zoom-level" style={{
            padding: '0 8px',
            minWidth: '48px',
            textAlign: 'center',
            fontSize: '12px',
            color: '#b3b3b3',
            fontWeight: 500,
            letterSpacing: '0.01em',
            userSelect: 'none'
          }}>
            {Math.round(zoom * 100)}%
          </span>

          <button
            className="timeline-btn"
            onClick={handleZoomIn}
            title="Zoom In"
            style={{
              width: '24px',
              height: '24px',
              padding: '0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              borderRadius: '2px',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <ZoomIn size={18} color="#b3b3b3" className="blender-icon" />
          </button>
        </div>
      </div>

      <div
        className="timeline-ruler"
        ref={timelineRef}
        onPointerDown={handlePointerDown}
        style={{
          minWidth: `${measures * beatsPerBar * pixelsPerBeat}px`,
          height: '100%',
          minHeight: '40px'
        }}
      >
        <div className="timeline-grid">
          {renderTicks()}
        </div>

        {/* Playhead Head Only (Sticky) */}
        <div
          ref={playheadRef}
          className="playhead"
          style={{
            left: 0, // Controlled by transform
            willChange: 'transform',
            width: '1px', // Keep it minimal to not block clicks?
            display: 'block' // Always show
          }}
        >
          {/* We only render the head here. The line is in PlayheadOverlay */}
          <div className="playhead-head" style={{ left: '-5px' }} />
        </div>

        {/* Time markers for major divisions */}
        <div className="time-markers">
          {Array.from({ length: measures }, (_, i) => (
            <div
              key={`marker-${i}`}
              className="time-marker"
              style={{ left: `${i * beatsPerBar * pixelsPerBeat}px` }}
            >
              {i + 1}:00
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Timeline;
