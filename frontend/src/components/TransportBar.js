import React from 'react';

function TransportBar({ playing, onPlayToggle, bpm }) {
  return (
    <div className="transport-bar">
      <div className="transport-left">
        <button className="btn small" onClick={onPlayToggle}>{playing ? 'Pause' : 'Play'}</button>
        <div className="time-display">00:00</div>
      </div>
      <div className="transport-center">
        <div className="bpm">BPM: <strong>{bpm}</strong></div>
      </div>
      <div className="transport-right">
        <button className="btn small">Metronome</button>
        <button className="btn small">Loop</button>
      </div>
    </div>
  );
}

export default TransportBar;