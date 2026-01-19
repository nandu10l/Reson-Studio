import React, { useState, useRef, useEffect } from 'react';
import '../styles/butter/Mixer.css';
import { useGuide } from '../contexts/GuideContext';
import { useProject } from '../contexts/ProjectContext';
import { VolumeX, Volume2, Headphones } from './icons/BlenderIcons';

const MixerChannel = React.memo(({ id, name, vol, pan, onVolChange, onPanChange, isMaster = false, effects = [], onAddEffect }) => {
  const [muted, setMuted] = useState(false);
  const [soloed, setSoloed] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(name);
  const meterFillRef = useRef(null);
  const nameInputRef = useRef(null);
  const { useGuideHandlers } = useGuide();

  // Simulate level meter with direct DOM manipulation
  useEffect(() => {
    if (!muted && !soloed) {
      const interval = setInterval(() => {
        const level = Math.random() * 100;
        if (meterFillRef.current) {
          meterFillRef.current.style.height = `${level}%`;
          meterFillRef.current.style.backgroundColor = level > 80 ? '#f44336' : level > 60 ? '#ffeb3b' : '#4ade80';
        }
      }, 100);
      return () => clearInterval(interval);
    } else {
      if (meterFillRef.current) {
        meterFillRef.current.style.height = `0%`;
      }
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

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (isMaster) return; // For now

    const pluginData = e.dataTransfer.getData('plugin');
    if (pluginData) {
      try {
        const plugin = JSON.parse(pluginData);
        // Effects categories
        const effectTypes = ['spatial', 'temporal', 'filter', 'dynamics', 'saturation', 'modulation', 'utility', 'analysis'];

        if (effectTypes.includes(plugin.type)) {
          if (onAddEffect) onAddEffect(id, plugin);
        } else {
          console.log("Ignored non-effect drop on mixer");
        }
      } catch (err) {
        console.error("Failed to parse dropped plugin", err);
      }
    }
  };

  return (
    <div
      className={`mixer-channel ${isMaster ? 'master' : ''}`}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
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
      <div className="effects-rack" style={{
        minHeight: '60px',
        background: 'rgba(0,0,0,0.2)',
        margin: '4px',
        padding: '2px',
        borderRadius: '4px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        overflowY: 'auto',
        maxHeight: '80px'
      }}>
        {effects && effects.length > 0 ? (
          effects.map(effect => (
            <div key={effect.id} style={{
              fontSize: '10px',
              background: '#333',
              padding: '2px 4px',
              borderRadius: '2px',
              color: '#ddd',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }} title={effect.name}>
              {effect.name}
            </div>
          ))
        ) : (
          <div style={{ fontSize: '9px', color: '#555', textAlign: 'center', marginTop: '10px' }}>
            Drop FX Here
          </div>
        )}
      </div>

      {/* Level Meter */}
      <div className="level-meter" {...useGuideHandlers(`Level Meter`)}>
        <div className="meter-track">
          <div
            ref={meterFillRef}
            className="meter-fill"
            style={{
              height: `0%`,
              backgroundColor: '#4ade80'
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
});

function Mixer() {
  const { channels, updateChannelVolume, updateChannelPan, addEffect } = useProject();

  return (
    <div className="mixer">
      {/* Master Channel */}
      <MixerChannel
        name="Master"
        isMaster={true}
        vol={80}
        pan={0}
        onVolChange={() => { }}
        onPanChange={() => { }}
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
          effects={ch.effects}
          onAddEffect={(id, plugin) => addEffect(id, plugin)}
        />
      ))}

      {/* Spacer */}
      <div className="mixer-spacer"></div>
    </div>
  );
}

export default React.memo(Mixer);
