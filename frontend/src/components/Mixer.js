import React, { useState } from 'react';
import '../styles/butter/Mixer.css';
import { useGuide } from '../contexts/GuideContext';
import { useProject } from '../contexts/ProjectContext';

function MixerChannel({ id, name, vol, pan, onVolChange, onPanChange, isMaster = false }) {
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
        {/* Invisible range for interaction */}
        <input
          type="range"
          min="-50"
          max="50"
          value={pan}
          onChange={(e) => onPanChange(parseInt(e.target.value))}
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
        {/* Vertical Range Input */}
        <input
          type="range"
          min="0"
          max="100"
          value={vol}
          onChange={(e) => onVolChange(parseInt(e.target.value))}
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
  const { channels, updateChannelVolume, updateChannelPan } = useProject();

  // For now, we mix "Channels" (instruments) and "Inserts" (Mixer tracks). 
  // In FL Studio, Channels are routed to Mixer Tracks. 
  // To keep it simple for this step, we will display the Instruments as Mixer Tracks directly.

  return (
    <div className="mixer">
      {/* Master Channel (Left) - Placeholder for now until we add global master state */}
      <MixerChannel name="Master" isMaster={true} vol={80} pan={0} onVolChange={() => { }} onPanChange={() => { }} />

      <div className="mixer-divider"></div>

      {/* Instrument Channels as Mixer Tracks */}
      {channels.map((ch) => (
        <MixerChannel
          key={ch.id}
          id={ch.id}
          name={ch.name}
          vol={ch.vol}
          pan={ch.pan}
          onVolChange={(v) => updateChannelVolume(ch.id, v)}
          onPanChange={(p) => updateChannelPan(ch.id, p)}
        />
      ))}

      {/* Spacer */}
      <div style={{ width: '50px' }}></div>
    </div>
  );
}
