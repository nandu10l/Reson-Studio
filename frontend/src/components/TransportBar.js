import React, { useState, useEffect, useRef } from 'react';
import {
  ListMusic, Grid, LayoutGrid, Sliders, Play, Pause, Stop, Circle,
  Magnet, Pencil, Brush, Ban, VolumeX, ArrowRightLeft, Scissors, BoxSelect, Search, Volume2
} from './icons/BlenderIcons';
import PatternSelector from './PatternSelector';
import { useGuide } from '../contexts/GuideContext';
import { useProject } from '../contexts/ProjectContext';
import '../styles/blender-icons.css';
import './TransportBar.css';

// Professional DAW Transport Bar Component
function TransportBar({ onResetTime, activeWindows, onToggleWindow }) {
  const {
    isPlaying, togglePlayback, bpm, updateBpm, stopPlayback, playheadPosition,
    playbackMode, setPlaybackMode, isRecording, setIsRecording,
    activeTool, setActiveTool
  } = useProject();

  const { useGuideHandlers } = useGuide();

  // Format time position from playhead (in beats) to bar:beat:sixteenth
  const formatTimePosition = (beats) => {
    const beatsPerBar = 4;
    const sixteenthsPerBeat = 4;
    const totalSixteenths = Math.floor(beats * sixteenthsPerBeat);

    const bar = Math.floor(totalSixteenths / (beatsPerBar * sixteenthsPerBeat));
    const beat = Math.floor((totalSixteenths % (beatsPerBar * sixteenthsPerBeat)) / sixteenthsPerBeat);
    const sixteenth = totalSixteenths % sixteenthsPerBeat;

    return `${bar}:${beat}:${sixteenth}`;
  };

  const handleBpmChange = (e) => {
    const newBpm = parseInt(e.target.value, 10);
    if (!isNaN(newBpm) && newBpm > 0 && newBpm <= 300) {
      updateBpm(newBpm);
    }
  };

  const handleBpmBlur = (e) => {
    const newBpm = parseInt(e.target.value, 10);
    if (isNaN(newBpm) || newBpm <= 0 || newBpm > 300) {
      e.target.value = bpm; // Reset to current BPM if invalid
    }
  };

  return (
    <div className="transport-bar">
      {/* Left: Pattern Navigation & Tools */}
      <div className="transport-left">
        <div {...useGuideHandlers('Pattern Selector')}>
          <PatternSelector />
        </div>

        {/* Tools Toolbar */}
        <div className="transport-tools">
          <button
            className={`transport-tool-btn ${activeTool === 'magnet' ? 'active' : ''}`}
            onClick={() => setActiveTool(activeTool === 'magnet' ? 'pencil' : 'magnet')}
            title="Snap to Grid"
          >
            <Magnet size={20} className="blender-icon" />
          </button>

          <div className="transport-separator"></div>

          <button
            className={`transport-tool-btn ${activeTool === 'pencil' ? 'active' : ''}`}
            onClick={() => setActiveTool('pencil')}
            title="Draw (Pencil)"
          >
            <Pencil size={20} className="blender-icon" />
          </button>

          <button
            className={`transport-tool-btn ${activeTool === 'brush' ? 'active' : ''}`}
            onClick={() => setActiveTool('brush')}
            title="Paint (Brush)"
          >
            <Brush size={20} className="blender-icon" />
          </button>

          <button
            className={`transport-tool-btn ${activeTool === 'delete' ? 'active' : ''}`}
            onClick={() => setActiveTool('delete')}
            title="Delete"
          >
            <Ban size={20} className="blender-icon" />
          </button>

          <button
            className={`transport-tool-btn ${activeTool === 'mute' ? 'active' : ''}`}
            onClick={() => setActiveTool('mute')}
            title="Mute"
          >
            <VolumeX size={20} className="blender-icon" />
          </button>

          <button
            className={`transport-tool-btn ${activeTool === 'slip' ? 'active' : ''}`}
            onClick={() => setActiveTool('slip')}
            title="Slip Edit"
          >
            <ArrowRightLeft size={20} className="blender-icon" />
          </button>

          <button
            className={`transport-tool-btn ${activeTool === 'slice' ? 'active' : ''}`}
            onClick={() => setActiveTool('slice')}
            title="Slice"
          >
            <Scissors size={20} className="blender-icon" />
          </button>

          <button
            className={`transport-tool-btn ${activeTool === 'select' ? 'active' : ''}`}
            onClick={() => setActiveTool('select')}
            title="Select"
          >
            <BoxSelect size={20} className="blender-icon" />
          </button>

          <button
            className={`transport-tool-btn ${activeTool === 'zoom' ? 'active' : ''}`}
            onClick={() => setActiveTool('zoom')}
            title="Zoom"
          >
            <Search size={20} className="blender-icon" />
          </button>

          <button
            className={`transport-tool-btn ${activeTool === 'playback' ? 'active' : ''}`}
            onClick={() => setActiveTool('playback')}
            title="Playback (Scrub)"
          >
            <Volume2 size={20} className="blender-icon" />
          </button>
        </div>
      </div>

      {/* Center: Transport Controls - Primary */}
      <div className="transport-center">
        {/* Transport Controls Cluster */}
        <div className="transport-controls-cluster">
          <button
            className={`transport-btn transport-btn-play ${isPlaying ? 'active' : ''}`}
            onClick={togglePlayback}
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause size={22} className="blender-icon" />
            ) : (
              <Play size={22} className="blender-icon" />
            )}
          </button>

          <button
            className="transport-btn transport-btn-stop"
            onClick={stopPlayback}
            title="Stop"
          >
            <Stop size={20} className="blender-icon" />
          </button>

          <button
            className={`transport-btn transport-btn-record ${isRecording ? 'recording' : ''}`}
            onClick={() => setIsRecording(prev => !prev)}
            title="Record"
          >
            <Circle size={18} className="blender-icon" />
          </button>
        </div>

        {/* Time Position - Prominent */}
        <div className="transport-time-display">
          {formatTimePosition(playheadPosition)}
        </div>
      </div>

      {/* Right: Secondary Controls */}
      <div className="transport-right">
        {/* Mode Toggle - Secondary */}
        <div className="transport-mode-cluster">
          <button
            className={`transport-mode-btn ${playbackMode === 'PAT' ? 'active' : ''}`}
            onClick={() => setPlaybackMode('PAT')}
            title="Pattern Mode"
          >
            PAT
          </button>
          <button
            className={`transport-mode-btn ${playbackMode === 'SONG' ? 'active' : ''}`}
            onClick={() => setPlaybackMode('SONG')}
            title="Song Mode"
          >
            SONG
          </button>
        </div>

        {/* BPM - Secondary */}
        <div className="transport-bpm-cluster">
          <input
            type="number"
            className="transport-bpm-input"
            value={bpm}
            onChange={handleBpmChange}
            onBlur={handleBpmBlur}
            min="1"
            max="300"
            title="BPM"
          />
          <span className="transport-bpm-label">BPM</span>
        </div>

        {/* View Controls - Secondary */}
        <div className="transport-views-cluster">
          <button
            className={`transport-view-btn ${activeWindows?.playlist ? 'active' : ''}`}
            onClick={() => onToggleWindow && onToggleWindow('playlist')}
            title="Playlist"
            {...useGuideHandlers('View Playlist')}
          >
            <ListMusic size={20} className="blender-icon" />
          </button>
          <button
            className={`transport-view-btn ${activeWindows?.pianoRoll ? 'active' : ''}`}
            onClick={() => onToggleWindow && onToggleWindow('pianoRoll')}
            title="Piano Roll"
            {...useGuideHandlers('View Piano Roll')}
          >
            <Grid size={20} className="blender-icon" />
          </button>
          <button
            className={`transport-view-btn ${activeWindows?.channelRack ? 'active' : ''}`}
            onClick={() => onToggleWindow && onToggleWindow('channelRack')}
            title="Channel Rack"
            {...useGuideHandlers('View Channel Rack')}
          >
            <LayoutGrid size={20} className="blender-icon" />
          </button>
          <button
            className={`transport-view-btn ${activeWindows?.mixer ? 'active' : ''}`}
            onClick={() => onToggleWindow && onToggleWindow('mixer')}
            title="Mixer"
            {...useGuideHandlers('View Mixer')}
          >
            <Sliders size={20} className="blender-icon" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default TransportBar;
