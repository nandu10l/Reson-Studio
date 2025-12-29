import React, { useState, useRef, useEffect } from 'react';
import '../styles/butter/Mixer.css';
import { useGuide } from '../contexts/GuideContext';
import { useProject } from '../contexts/ProjectContext';
import { VolumeX, Volume2, Headphones } from './icons/BlenderIcons';

function MixerChannel({ id, name, vol, pan, onVolChange, onPanChange, isMaster = false }) {
  const [muted, setMuted] = useState(false);
  const [soloed, setSoloed] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(name);
  const [level, setLevel] = useState(0); // Simulated level for meter
  const nameInputRef = useRef(null);
  const { useGuideHandlers } = useGuide();

  // Simulate level meter (in real app, this would come from audio engine)
  useEffect(() => {
    if (!muted && !soloed) {
      const interval = setInterval(() => {
        setLevel(Math.random() * 100);
      }, 100);
      return () => clearInterval(interval);
    } else {
      setLevel(0);
    }
  }, [muted, soloed]);

  // Handle name editing
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const handleNameClick = () => {
    if (!isMaster) {
      setIsEditingName(true);
    }
  };

  const handleNameBlur = () => {
    setIsEditingName(false);
    setEditName(name); // Reset if not saved
  };

  const handleNameKeyDown = (e) => {
    if (e.key === 'Enter') {
      setIsEditingName(false);
      // In real app, would call updateChannelName(id, editName)
    } else if (e.key === 'Escape') {
      setEditName(name);
      setIsEditingName(false);
    }
  };

  // Pan knob rotation
  const panRotation = pan * 1.8; // -90 to +90 degrees for -50 to +50 pan

  // Fader value to percentage
  const faderPercent = vol;
  const faderPosition = 100 - faderPercent; // Invert for bottom-up fader

  return (
    <div className={`mixer-channel ${isMaster ? 'master' : ''}`}>
      {/* Track Name - Inline Editable */}
      <div className="channel-header">
        {isEditingName ? (
          <input
            ref={nameInputRef}
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleNameBlur}
            onKeyDown={handleNameKeyDown}
            className="channel-name-input"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div
            className="channel-name"
            onClick={handleNameClick}
            title={isMaster ? 'Master' : 'Click to rename'}
          >
            {name}
          </div>
        )}
      </div>

      {/* Level Meter */}
      <div className="level-meter" {...useGuideHandlers(`Level: ${Math.round(level)}%`)}>
        <div className="meter-track">
          <div
            className="meter-fill"
            style={{
              height: `${level}%`,
              backgroundColor: level > 80 ? '#f44336' : level > 60 ? '#ffeb3b' : '#4ade80'
            }}
          />
        </div>
      </div>

      {/* Pan Knob */}
      <div className="pan-section" {...useGuideHandlers(`Pan: ${pan}%`)}>
        <div className="pan-knob-container">
          <div className="pan-knob" style={{ transform: `rotate(${panRotation}deg)` }}>
            <div className="pan-indicator"></div>
          </div>
          <input
            type="range"
            min="-50"
            max="50"
            value={pan}
            onChange={(e) => onPanChange(parseInt(e.target.value))}
            className="pan-input"
          />
        </div>
      </div>

      {/* Mute/Solo/Arm Buttons */}
      <div className="controls-section">
        <button
          className={`control-btn mute ${muted ? 'active' : ''}`}
          onClick={() => setMuted(!muted)}
          title={muted ? 'Unmute' : 'Mute'}
          {...useGuideHandlers(muted ? 'Unmute' : 'Mute')}
        >
          {muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
        </button>
        <button
          className={`control-btn solo ${soloed ? 'active' : ''}`}
          onClick={() => setSoloed(!soloed)}
          title={soloed ? 'Unsolo' : 'Solo'}
          {...useGuideHandlers(soloed ? 'Unsolo' : 'Solo')}
        >
          <Headphones size={12} />
        </button>
      </div>

      {/* Volume Fader */}
      <div className="fader-section" {...useGuideHandlers(`Volume: ${vol}%`)}>
        <div className="fader-track">
          <div className="fader-fill" style={{ height: `${faderPercent}%` }} />
          <div className="fader-handle" style={{ bottom: `${faderPosition}%` }}>
            <div className="fader-handle-grip"></div>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={vol}
            onChange={(e) => onVolChange(parseInt(e.target.value))}
            className="fader-input"
            orient="vertical"
          />
        </div>
        <div className="fader-value">{vol}</div>
      </div>

      {/* Channel Footer */}
      <div className="channel-footer">
        {isMaster ? 'M' : id}
      </div>
    </div>
  );
}

export default function Mixer() {
  const { channels, updateChannelVolume, updateChannelPan } = useProject();

  return (
    <div className="mixer">
      {/* Master Channel */}
      <MixerChannel
        name="Master"
        isMaster={true}
        vol={80}
        pan={0}
        onVolChange={() => {}}
        onPanChange={() => {}}
      />

      <div className="mixer-divider"></div>

      {/* Instrument Channels */}
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
      <div className="mixer-spacer"></div>
    </div>
  );
}
