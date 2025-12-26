import React, { useState, useEffect, useRef } from 'react';
import { ListMusic, Grid, LayoutGrid, Sliders } from './icons/BlenderIcons';
import PatternSelector from './PatternSelector';
import { useGuide } from '../contexts/GuideContext';
import { useProject } from '../contexts/ProjectContext';
import '../styles/blender-icons.css';

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
    <div className="transport-bar" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: '32px',
      background: '#1e1e1e',
      borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
      padding: '0 12px',
      gap: '12px'
    }}>
      {/* Left: Pattern Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <div {...useGuideHandlers('Pattern Selector')}>
          <PatternSelector />
        </div>
      </div>

      {/* Center: Empty space for hierarchy */}
      <div style={{ flex: 1 }} />

      {/* Right: View Controls */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        flexShrink: 0
      }}>
        <button
          onClick={() => onToggleWindow && onToggleWindow('playlist')}
          title="Playlist"
          {...useGuideHandlers('View Playlist')}
          style={{
            width: '24px',
            height: '24px',
            padding: '0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: activeWindows?.playlist ? 'rgba(96, 165, 250, 0.2)' : 'transparent',
            border: 'none',
            borderRadius: '2px',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            if (!activeWindows?.playlist) {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            }
          }}
          onMouseLeave={(e) => {
            if (!activeWindows?.playlist) {
              e.currentTarget.style.background = 'transparent';
            }
          }}
        >
          <ListMusic size={18} color={activeWindows?.playlist ? '#60a5fa' : '#b3b3b3'} className="blender-icon" />
        </button>

        <button
          onClick={() => onToggleWindow && onToggleWindow('pianoRoll')}
          title="Piano Roll"
          {...useGuideHandlers('View Piano Roll')}
          style={{
            width: '24px',
            height: '24px',
            padding: '0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: activeWindows?.pianoRoll ? 'rgba(96, 165, 250, 0.2)' : 'transparent',
            border: 'none',
            borderRadius: '2px',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            if (!activeWindows?.pianoRoll) {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            }
          }}
          onMouseLeave={(e) => {
            if (!activeWindows?.pianoRoll) {
              e.currentTarget.style.background = 'transparent';
            }
          }}
        >
          <Grid size={18} color={activeWindows?.pianoRoll ? '#60a5fa' : '#b3b3b3'} className="blender-icon" />
        </button>

        <button
          onClick={() => onToggleWindow && onToggleWindow('channelRack')}
          title="Channel Rack"
          {...useGuideHandlers('View Channel Rack')}
          style={{
            width: '24px',
            height: '24px',
            padding: '0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: activeWindows?.channelRack ? 'rgba(96, 165, 250, 0.2)' : 'transparent',
            border: 'none',
            borderRadius: '2px',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            if (!activeWindows?.channelRack) {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            }
          }}
          onMouseLeave={(e) => {
            if (!activeWindows?.channelRack) {
              e.currentTarget.style.background = 'transparent';
            }
          }}
        >
          <LayoutGrid size={18} color={activeWindows?.channelRack ? '#60a5fa' : '#b3b3b3'} className="blender-icon" />
        </button>

        <button
          onClick={() => onToggleWindow && onToggleWindow('mixer')}
          title="Mixer"
          {...useGuideHandlers('View Mixer')}
          style={{
            width: '24px',
            height: '24px',
            padding: '0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: activeWindows?.mixer ? 'rgba(96, 165, 250, 0.2)' : 'transparent',
            border: 'none',
            borderRadius: '2px',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            if (!activeWindows?.mixer) {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
            }
          }}
          onMouseLeave={(e) => {
            if (!activeWindows?.mixer) {
              e.currentTarget.style.background = 'transparent';
            }
          }}
        >
          <Sliders size={18} color={activeWindows?.mixer ? '#60a5fa' : '#b3b3b3'} className="blender-icon" />
        </button>
      </div>
    </div>
  );
}

export default TransportBar;
