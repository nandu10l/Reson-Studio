import React, { useState } from 'react';
import '../styles/butter/Mixer.css';
import { useGuide } from '../contexts/GuideContext';

function MixerChannel({ id, name, isMaster = false }) {
  const [vol, setVol] = useState(80);
  const [pan, setPan] = useState(0); // -50 to 50
  const [muted, setMuted] = useState(false);
  const [soloed, setSoloed] = useState(false);
  const { useGuideHandlers } = useGuide();

  // Helper to visually rotate pan knob
  const panStyle = {
    transform: `translateX(-50%) rotate(${pan * 2.5}deg)` // approx rotation logic
  };

  return (
    <div className={`mixer-channel ${isMaster ? 'master' : ''}`}>
      {/* Header */}
      <div className="channel-header" {...useGuideHandlers(`${name} - Properties`)}>
        <div className="channel-icon"></div>
        <div className="channel-name">{name}</div>
      </div>

      {/* Pan */}
      <div className="pan-section" {...useGuideHandlers(`Panning: ${pan}%`)}>
        <div className="pan-knob" title={`Pan: ${pan}`}>
          <div className="pan-indicator" style={panStyle}></div>
        </div>
        {/* Invisible range for interaction could go here, for now just static Knob graphic, or implement full interaction */}
        <input
          type="range"
          min="-50"
          max="50"
          value={pan}
          onChange={(e) => setPan(parseInt(e.target.value))}
          style={{ position: 'absolute', width: '100%', height: '100%', opacity: 0, cursor: 'ew-resize' }}
        />
      </div>

      {/* Controls */}
      <div className="controls-section">
        <div
          className={`mixer-btn mute ${!muted ? 'active' : ''}`}
          onClick={() => setMuted(!muted)}
          {...useGuideHandlers(muted ? 'Unmute' : 'Mute')}
        >
          M
        </div>
        <div
          className={`mixer-btn solo ${soloed ? 'active' : ''}`}
          onClick={() => setSoloed(!soloed)}
          {...useGuideHandlers(soloed ? 'Unsolo' : 'Solo')}
        >
          S
        </div>
      </div>

      {/* Fader */}
      <div className="fader-section" {...useGuideHandlers(`Volume: ${vol}%`)}>
        <div className="meter-bg"></div>
        {/* Vertical Range Input: standard HTML5 range but rotated or styled */}
        <input
          type="range"
          min="0"
          max="100"
          value={vol}
          onChange={(e) => setVol(e.target.value)}
          className="vertical-fader"
          style={{
            writingMode: 'bt-lr', /* IE/Edge */
            WebkitAppearance: 'slider-vertical', /* Chrome/Safari/Edge */
            width: '100%',
            height: '100%'
          }}
        />
      </div>

      {/* Footer */}
      <div className="channel-footer">
        {isMaster ? 'M' : id}
      </div>
    </div>
  );
}

export default function Mixer() {
  const inserts = Array.from({ length: 15 }, (_, i) => ({ id: i + 1, name: `Insert ${i + 1}` }));

  return (
    <div className="mixer">
      {/* Master Channel (Left) */}
      <MixerChannel name="Master" isMaster={true} />

      <div className="mixer-divider"></div>

      {/* Inserts */}
      {inserts.map((insert) => (
        <MixerChannel key={insert.id} id={insert.id} name={insert.name} />
      ))}

      {/* Spacer */}
      <div style={{ width: '50px' }}></div>
    </div>
  );
}
