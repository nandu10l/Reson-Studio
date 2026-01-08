import React, { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut } from './icons/BlenderIcons';
import '../styles/blender-icons.css';

function Timeline({ measures = 16, beatsPerBar = 4, bpm = 120, playheadPosition = 0, isPlaying = false, zoom, onZoomChange, pixelsPerBeat, onPixelsPerBeatChange, onSeek }) {
  const timelineRef = useRef(null);

  // Calculate pixel position for playhead (playheadPosition is in beats)
  const beatsToPixels = (beats) => {
    return beats * pixelsPerBeat;
  };

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

  const handleTimelineClick = (e) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const beats = x / pixelsPerBeat;
    if (onSeek) {
      onSeek(beats);
    }
  };

  const ticks = React.useMemo(() => {
    const items = [];
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

      const position = (sixteenth / sixteenthsPerBeat) * pixelsPerBeat;

      items.push(
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
              {bar}
            </div>
          )}
          <div className="tick-line" />
        </div>
      );
    }
    return items;
  }, [measures, beatsPerBar, pixelsPerBeat]);

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
        onClick={handleTimelineClick}
        style={{
          minWidth: `${measures * beatsPerBar * pixelsPerBeat}px`,
          height: '100%',
          minHeight: '40px'
        }}
      >
        <div className="timeline-grid">
          {ticks}
        </div>

        {/* Playhead is rendered in track-area to span both timeline and tracks */}

        {/* Time markers for major divisions */}
        <div className="time-markers">
          {Array.from({ length: measures }, (_, i) => (
            <div
              key={`marker-${i}`}
              className="time-marker"
              style={{ left: `${i * beatsPerBar * pixelsPerBeat}px` }}
            >
              {i}:00
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default React.memo(Timeline);
