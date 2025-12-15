import React from 'react';
import '../styles/reson.css';

export default function ResonTransport({ playing, onPlayToggle }) {
  return (
    <div className="reson-transport">
      <div className="transport-left">
        <button className="btn small" onClick={() => onPlayToggle && onPlayToggle(!playing)}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <button className="btn small">Stop</button>
        <button className="btn small primary-btn">Record</button>
      </div>
      <div className="transport-center">
        <div className="transport-clock">00:00</div>
      </div>
      <div className="transport-right">
        <div className="transport-compact">120 BPM</div>
      </div>
    </div>
  );
}
