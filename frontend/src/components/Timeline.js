import React, { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, Play, Square } from 'lucide-react';

function Timeline({ measures = 16, beatsPerBar = 4, bpm = 120, currentTime = 0, isPlaying = false, zoom, onZoomChange, pixelsPerBeat, onPixelsPerBeatChange }) {
  const timelineRef = useRef(null);

  // Calculate time position for playhead
  const timeToPixels = (time) => {
    const beatsPerSecond = bpm / 60;
    const totalBeats = time * beatsPerSecond;
    return totalBeats * pixelsPerBeat;
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
    const time = pixelsToTime(x);
    // Here you would typically dispatch an action to set the current time
    console.log('Seek to time:', time);
  };

  const renderTicks = () => {
    const ticks = [];
    const totalBeats = measures * beatsPerBar;

    for (let beat = 0; beat < totalBeats; beat++) {
      const bar = Math.floor(beat / beatsPerBar) + 1;
      const beatInBar = (beat % beatsPerBar) + 1;
      const isDownbeat = beatInBar === 1;

      ticks.push(
        <div
          key={`beat-${beat}`}
          className={`timeline-tick ${isDownbeat ? 'downbeat' : 'beat'}`}
          style={{
            left: `${beat * pixelsPerBeat}px`,
            width: `${pixelsPerBeat}px`
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
    return ticks;
  };

  return (
    <div className="timeline">
      <div className="timeline-header">
        <div className="timeline-controls">
          <button className="timeline-btn" onClick={handleZoomOut}>
            <ZoomOut size={16} />
          </button>
          <span className="zoom-level">{Math.round(zoom * 100)}%</span>
          <button className="timeline-btn" onClick={handleZoomIn}>
            <ZoomIn size={16} />
          </button>
        </div>
        <div className="timeline-info">
          <span className="bpm-display">{bpm} BPM</span>
          <span className="time-signature">{beatsPerBar}/4</span>
        </div>
      </div>

      <div
        className="timeline-ruler"
        ref={timelineRef}
        onClick={handleTimelineClick}
        style={{ minWidth: `${measures * beatsPerBar * pixelsPerBeat}px` }}
      >
        <div className="timeline-grid">
          {renderTicks()}
        </div>

        {/* Playhead */}
        <div
          className="playhead"
          style={{
            left: `${timeToPixels(currentTime)}px`,
            display: isPlaying ? 'block' : 'none'
          }}
        >
          <div className="playhead-line" />
          <div className="playhead-head" />
        </div>

        {/* Time markers for major divisions */}
        <div className="time-markers">
          {Array.from({ length: measures }, (_, i) => (
            <div
              key={`marker-${i + 1}`}
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
