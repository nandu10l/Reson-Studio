import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import {
  ListMusic, Piano, LayoutGrid, Sliders, Play, Pause, Stop, Circle,
  Magnet, Pencil, Brush, Ban, VolumeX, ArrowRightLeft, Scissors, BoxSelect, Search, Volume2
} from './icons/BlenderIcons';
import PatternSelector from './PatternSelector';
import MidifyDialog from './MidifyDialog';
import { useGuide } from '../contexts/GuideContext';
import { useProject } from '../contexts/ProjectContext';
import '../styles/blender-icons.css';
import './TransportBar.css';

// Professional DAW Transport Bar Component
function TransportBar({ onResetTime, activeWindows, onToggleWindow }) {
  const {
    isPlaying, togglePlayback, bpm, updateBpm, stopPlayback, playheadPosition,
    playbackMode, setPlaybackMode, isRecording, setIsRecording,
    recordingNoiseRemovalEnabled, setRecordingNoiseRemovalEnabled,
    recordingVocalEnhanceEnabled, setRecordingVocalEnhanceEnabled,
    isProcessingRecording,
    activeTool, setActiveTool,
    snapEnabled, setSnapEnabled
  } = useProject();

  const { useGuideHandlers } = useGuide();
  const [displayBeats, setDisplayBeats] = useState(playheadPosition);
  const [isMidifyOpen, setIsMidifyOpen] = useState(false);

  // Sync display with playheadPosition when NOT playing (seeking/stopped)
  useEffect(() => {
    if (!isPlaying) {
      setDisplayBeats(playheadPosition);
    }
  }, [playheadPosition, isPlaying]);

  // Real-time update loop during playback
  useEffect(() => {
    if (!isPlaying) return;

    let rAF;
    const loop = () => {
      const seconds = Tone.Transport.seconds;
      const beats = seconds * (bpm / 60);
      setDisplayBeats(beats);
      rAF = requestAnimationFrame(loop);
    };

    loop();
    return () => cancelAnimationFrame(rAF);
  }, [isPlaying, bpm]);

  // Format time position from playhead (in beats) to MM:SS:ms
  const formatTimePosition = (beats) => {
    // Convert beats to seconds: beats / (BPM / 60)
    const currentBpm = bpm || 120;
    const totalSeconds = beats / (currentBpm / 60);

    // Calculate parts
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const milliseconds = Math.floor((totalSeconds % 1) * 100);

    // Pad with zeros
    const m = minutes.toString().padStart(2, '0');
    const s = seconds.toString().padStart(2, '0');
    const ms = milliseconds.toString().padStart(2, '0');

    return `${m}:${s}:${ms}`;
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
            className={`transport-tool-btn ${snapEnabled ? 'active' : ''}`}
            onClick={() => setSnapEnabled(prev => !prev)}
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
            className={`transport-tool-btn ${activeTool === 'eraser' ? 'active' : ''}`}
            onClick={() => setActiveTool('eraser')}
            title="Eraser (Delete)"
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
            disabled={isProcessingRecording}
          >
            <Circle size={18} className="blender-icon" />
          </button>

          <button
            className={`transport-recopt-btn ${recordingNoiseRemovalEnabled ? 'active' : ''}`}
            onClick={() => setRecordingNoiseRemovalEnabled(prev => !prev)}
            title="Recorded clip noise removal"
            disabled={isRecording}
          >
            Denoise
          </button>

          <button
            className={`transport-recopt-btn ${recordingVocalEnhanceEnabled ? 'active' : ''}`}
            onClick={() => setRecordingVocalEnhanceEnabled(prev => !prev)}
            title="Recorded clip vocal enhancement"
            disabled={isRecording}
          >
            Vocal FX
          </button>

          {isProcessingRecording && (
            <span className="transport-recopt-status">Processing...</span>
          )}
        </div>

        {/* Time Position - Prominent */}
        <div className="transport-time-display">
          {formatTimePosition(displayBeats)}
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

        {/* Midify Button */}
        <button
          className={`transport-midify-btn ${isMidifyOpen ? 'active' : ''}`}
          onClick={() => setIsMidifyOpen(prev => !prev)}
          title="Midify — Convert Audio to MIDI"
        >
          <span className="transport-midify-icon">🎵</span>
          <span className="transport-midify-label">Midify</span>
        </button>

        {/* View Controls — labeled icon buttons */}
        <div className="transport-views-cluster">
          <button
            className={`transport-view-btn ${activeWindows?.playlist ? 'active' : ''}`}
            onClick={() => onToggleWindow && onToggleWindow('playlist')}
            title="Playlist"
            {...useGuideHandlers('View Playlist')}
          >
            <ListMusic size={17} className="blender-icon" />
            <span className="transport-view-label">Playlist</span>
          </button>
          <button
            className={`transport-view-btn ${activeWindows?.pianoRoll ? 'active' : ''}`}
            onClick={() => onToggleWindow && onToggleWindow('pianoRoll')}
            title="Piano Roll"
            {...useGuideHandlers('View Piano Roll')}
          >
            <Piano size={17} className="blender-icon" />
            <span className="transport-view-label">Piano</span>
          </button>
          <button
            className={`transport-view-btn ${activeWindows?.channelRack ? 'active' : ''}`}
            onClick={() => onToggleWindow && onToggleWindow('channelRack')}
            title="Channel Rack"
            {...useGuideHandlers('View Channel Rack')}
          >
            <LayoutGrid size={17} className="blender-icon" />
            <span className="transport-view-label">Channels</span>
          </button>
          <button
            className={`transport-view-btn ${activeWindows?.mixer ? 'active' : ''}`}
            onClick={() => onToggleWindow && onToggleWindow('mixer')}
            title="Mixer"
            {...useGuideHandlers('View Mixer')}
          >
            <Sliders size={17} className="blender-icon" />
            <span className="transport-view-label">Mixer</span>
          </button>
          <button
            className={`transport-view-btn ${activeWindows?.aiStudio ? 'active' : ''}`}
            onClick={() => onToggleWindow && onToggleWindow('aiStudio')}
            title="AI Studio — Lyria music generator & MIDI-LLM"
            style={activeWindows?.aiStudio ? { borderColor: '#8b5cf6', color: '#c4b5fd' } : {}}
          >
            <span style={{ fontSize: 14 }}>✨</span>
            <span className="transport-view-label">AI</span>
          </button>
        </div>
      </div>

      {/* Midify Dialog */}
      <MidifyDialog isOpen={isMidifyOpen} onClose={() => setIsMidifyOpen(false)} />
    </div>
  );
}

export default TransportBar;
