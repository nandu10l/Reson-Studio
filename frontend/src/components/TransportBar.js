import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, ListMusic, Grid3x3, LayoutGrid, Sliders } from 'lucide-react';
import PatternSelector from './PatternSelector';
import { useGuide } from '../contexts/GuideContext';

function TransportBar({ playing, onPlayToggle, bpm, onBpmChange, onResetTime, activeWindows, onToggleWindow }) {
  const [currentTime, setCurrentTime] = useState(0);
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [loopOn, setLoopOn] = useState(false);
  const intervalRef = useRef(null);
  const { useGuideHandlers } = useGuide();

  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        setCurrentTime(prev => prev + 0.1);
      }, 100);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [playing]);

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleBpmChange = (e) => {
    const newBpm = parseInt(e.target.value, 10);
    if (!isNaN(newBpm) && newBpm > 0) {
      onBpmChange(newBpm);
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
    if (onResetTime) onResetTime();
  };

  return (
    <div className="transport-bar">
      <div className="transport-left">
        <button className="btn small icon-btn" onClick={handleResetTime} {...useGuideHandlers('Stop / Reset')}>
          <SkipBack size={16} />
        </button>
        <button className="btn small icon-btn" onClick={() => onPlayToggle(true)} {...useGuideHandlers('Play')}>
          <Play size={16} />
        </button>
        <button className="btn small icon-btn" onClick={() => onPlayToggle(false)} {...useGuideHandlers('Pause')}>
          <Pause size={16} />
        </button>
        <div className="time-display" {...useGuideHandlers('Song Position')}>{formatTime(currentTime)}</div>
      </div>
      <div className="transport-center">
        <div className="bpm" style={{ marginRight: '16px' }} {...useGuideHandlers('Tempo (BPM)')}>
          BPM: <input
            type="number"
            value={bpm}
            onChange={handleBpmChange}
            min="60"
            max="200"
            style={{ width: '50px', textAlign: 'center', border: 'none', background: 'transparent', fontWeight: 'bold', color: '#fff' }}
          />
        </div>
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

        <div className="divider" style={{ width: 1, height: 20, background: '#ccc', margin: '0 8px' }}></div>

        <button className={`btn small ${metronomeOn ? 'active' : ''}`} onClick={toggleMetronome} {...useGuideHandlers('Metronome')}>
          Metronome {metronomeOn ? 'On' : 'Off'}
        </button>
        <button className={`btn small ${loopOn ? 'active' : ''}`} onClick={toggleLoop} {...useGuideHandlers('Loop Mode')}>
          Loop {loopOn ? 'On' : 'Off'}
        </button>
      </div>
    </div>
  );
}

export default TransportBar;
