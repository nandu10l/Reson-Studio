import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipBack } from 'lucide-react';

function TransportBar({ playing, onPlayToggle, bpm, onBpmChange, onResetTime }) {
  const [currentTime, setCurrentTime] = useState(0);
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [loopOn, setLoopOn] = useState(false);
  const intervalRef = useRef(null);

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
        <button className="btn small icon-btn" onClick={handleResetTime}>
          <SkipBack size={16} />
        </button>
        <button className="btn small icon-btn" onClick={() => onPlayToggle(true)}>
          <Play size={16} />
        </button>
        <button className="btn small icon-btn" onClick={() => onPlayToggle(false)}>
          <Pause size={16} />
        </button>
        <div className="time-display">{formatTime(currentTime)}</div>
      </div>
      <div className="transport-center">
        <div className="bpm">
          BPM: <input
            type="number"
            value={bpm}
            onChange={handleBpmChange}
            min="60"
            max="200"
            style={{ width: '50px', textAlign: 'center', border: 'none', background: 'transparent', fontWeight: 'bold' }}
          />
        </div>
      </div>
      <div className="transport-right">
        <button className={`btn small ${metronomeOn ? 'active' : ''}`} onClick={toggleMetronome}>
          Metronome {metronomeOn ? 'On' : 'Off'}
        </button>
        <button className={`btn small ${loopOn ? 'active' : ''}`} onClick={toggleLoop}>
          Loop {loopOn ? 'On' : 'Off'}
        </button>
      </div>
    </div>
  );
}

export default TransportBar;
