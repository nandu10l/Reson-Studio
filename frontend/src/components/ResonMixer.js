import React from 'react';
import '../styles/reson.css';

export default function ResonMixer({ tracks = [], selectedTrackId = null }) {
  return (
    <div className="reson-mixer">
      <h4 className="mixer-title">Mixer</h4>
      <div className="mixer-channels">
        {tracks.map(ch => (
          <div key={ch.id} className={`mixer-channel${ch.id === selectedTrackId ? ' selected' : ''}`}>
            <div className="mixer-name">{ch.name}</div>
            <input type="range" min="0" max="100" defaultValue="75" />
          </div>
        ))}
      </div>
    </div>
  );
}
