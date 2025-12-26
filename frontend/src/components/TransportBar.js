import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, ListMusic, Grid3x3, LayoutGrid, Sliders } from 'lucide-react';
import PatternSelector from './PatternSelector';
import { useGuide } from '../contexts/GuideContext';
import { useProject } from '../contexts/ProjectContext';

// Transport Controls Component
function TransportBar({ onResetTime, activeWindows, onToggleWindow }) {
  const { isPlaying, togglePlayback, bpm, updateBpm, stopPlayback } = useProject();

  // Local UI state
  const [currentTime, setCurrentTime] = useState(0);
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [loopOn, setLoopOn] = useState(false);
  const intervalRef = useRef(null);
  const { useGuideHandlers } = useGuide();

  // Sync internal timer with isPlaying context
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentTime(prev => prev + 0.1);
      }, 100);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying]);

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleBpmChange = (e) => {
    const newBpm = parseInt(e.target.value, 10);
    if (!isNaN(newBpm) && newBpm > 0) {
      updateBpm(newBpm);
    }
  };

  const toggleMetronome = () => {
    setMetronomeOn(!metronomeOn);
  };

  const toggleLoop = () => {
    setLoopOn(!loopOn);
  };

  const handleResetTime = () => {
    setCurrentTime(0);
    stopPlayback(); // Reset often stops
    if (onResetTime) onResetTime();
  };

  return (
    <div className="transport-bar">
      {/* Pattern Selector */}
      <div className="transport-center" style={{ paddingLeft: 10 }}>
        <div {...useGuideHandlers('Pattern Selector')}>
          <PatternSelector />
        </div>
      </div>

      <div className="transport-right">
        {/* Window Toggles */}
        <button
          className={`btn small ${activeWindows?.playlist ? 'active' : ''}`}
          onClick={() => onToggleWindow && onToggleWindow('playlist')}
          title="Playlist"
          {...useGuideHandlers('View Playlist')}
        >
          <ListMusic size={16} />
        </button>
        <button
          className={`btn small ${activeWindows?.pianoRoll ? 'active' : ''}`}
          onClick={() => onToggleWindow && onToggleWindow('pianoRoll')}
          title="Piano Roll"
          {...useGuideHandlers('View Piano Roll')}
        >
          <Grid3x3 size={16} />
        </button>
        <button
          className={`btn small ${activeWindows?.channelRack ? 'active' : ''}`}
          onClick={() => onToggleWindow && onToggleWindow('channelRack')}
          title="Channel Rack"
          {...useGuideHandlers('View Channel Rack')}
        >
          <LayoutGrid size={16} />
        </button>
        <button
          className={`btn small ${activeWindows?.mixer ? 'active' : ''}`}
          onClick={() => onToggleWindow && onToggleWindow('mixer')}
          title="Mixer"
          {...useGuideHandlers('View Mixer')}
        >
          <Sliders size={16} />
        </button>
      </div>
    </div>
  );
}

export default TransportBar;
