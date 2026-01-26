import React, { useState, useRef, useEffect, useCallback } from 'react';
import '../styles/butter/Mixer.css';
import { useGuide } from '../contexts/GuideContext';
import { useProject } from '../contexts/ProjectContext';
import { VolumeX, Volume2, Headphones } from './icons/BlenderIcons';

// FL Studio-style Mixer Channel
const MixerChannel = React.memo(({
  id,
  name,
  vol,
  pan,
  onVolChange,
  onPanChange,
  isMaster = false,
  channelNumber,
  effects = [],
  onAddEffect,
  isSelected = false,
  onSelect,
  muted = false,
  soloed = false,
  onMuteToggle,
  onSoloToggle
}) => {
  const [levelL, setLevelL] = useState(0);
  const [levelR, setLevelR] = useState(0);
  const [isDraggingFader, setIsDraggingFader] = useState(false);
  const [isDraggingPan, setIsDraggingPan] = useState(false);
  const faderRef = useRef(null);
  const { useGuideHandlers } = useGuide();

  // Simulate level meter animation
  useEffect(() => {
    if (!muted) {
      const interval = setInterval(() => {
        const baseLevel = (vol / 100) * 0.85;
        setLevelL(baseLevel * (0.6 + Math.random() * 0.4));
        setLevelR(baseLevel * (0.6 + Math.random() * 0.4));
      }, 50);
      return () => clearInterval(interval);
    } else {
      setLevelL(0);
      setLevelR(0);
    }
  }, [muted, vol]);

  // Pan knob rotation
  const panRotation = (pan / 50) * 140;

  // Fader handling
  const handleFaderMouseDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFader(true);

    const handleMouseMove = (moveEvent) => {
      if (faderRef.current) {
        const rect = faderRef.current.getBoundingClientRect();
        const y = moveEvent.clientY - rect.top;
        const percent = Math.max(0, Math.min(100, 100 - (y / rect.height) * 100));
        onVolChange(Math.round(percent));
      }
    };

    const handleMouseUp = () => {
      setIsDraggingFader(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [onVolChange]);

  // Pan knob handling
  const handlePanMouseDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingPan(true);
    const startY = e.clientY;
    const startPan = pan;

    const handleMouseMove = (moveEvent) => {
      const deltaY = startY - moveEvent.clientY;
      const newPan = Math.max(-50, Math.min(50, startPan + deltaY));
      onPanChange(Math.round(newPan));
    };

    const handleMouseUp = () => {
      setIsDraggingPan(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [pan, onPanChange]);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (isMaster) return;

    const pluginData = e.dataTransfer.getData('plugin');
    if (pluginData) {
      try {
        const plugin = JSON.parse(pluginData);
        const effectTypes = ['spatial', 'temporal', 'filter', 'dynamics', 'saturation', 'modulation', 'utility', 'analysis'];
        if (effectTypes.includes(plugin.type)) {
          if (onAddEffect) onAddEffect(id, plugin);
        }
      } catch (err) {
        console.error("Failed to parse dropped plugin", err);
      }
    }
  };

  const handleChannelClick = () => {
    if (onSelect) onSelect({ id, name, vol, pan, effects, isMaster, channelNumber });
  };

  // Level meter gradient
  const getMeterHeight = (level) => `${level * 100}%`;

  // Insert slots (8 visible)
  const insertSlots = Array(8).fill(null).map((_, i) => effects[i] || null);

  return (
    <div
      className={`fl-channel ${isMaster ? 'master' : ''} ${isSelected ? 'selected' : ''}`}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={handleChannelClick}
    >
      {/* Channel Number Header */}
      <div className="fl-channel-num">
        {isMaster ? 'M' : channelNumber}
      </div>

      {/* Channel Name Label */}
      <div className="fl-channel-label">
        <span className="fl-channel-label-text">
          {isMaster ? 'Master' : name}
        </span>
      </div>

      {/* Insert Slots */}
      <div className="fl-insert-rack">
        {insertSlots.map((effect, i) => (
          <div
            key={i}
            className={`fl-insert-slot ${effect ? 'active' : ''}`}
            title={effect ? effect.name : `Insert ${i + 1}`}
          >
            {effect && <div className="fl-insert-led" />}
          </div>
        ))}
      </div>

      {/* Meter + Fader Section */}
      <div className="fl-meter-fader">
        {/* Left Meter */}
        <div className="fl-meter-bar">
          <div className="fl-meter-fill" style={{ height: getMeterHeight(levelL) }} />
          <div className="fl-meter-scale">
            <span>0</span>
            <span>6</span>
            <span>12</span>
            <span>18</span>
          </div>
        </div>

        {/* Fader */}
        <div
          className="fl-fader"
          ref={faderRef}
          onMouseDown={handleFaderMouseDown}
          {...useGuideHandlers(`Volume: ${vol}%`)}
        >
          <div className="fl-fader-track">
            <div className="fl-fader-fill" style={{ height: `${vol}%` }} />
          </div>
          <div
            className={`fl-fader-thumb ${isDraggingFader ? 'dragging' : ''}`}
            style={{ bottom: `calc(${vol}% - 10px)` }}
          />
        </div>

        {/* Right Meter */}
        <div className="fl-meter-bar">
          <div className="fl-meter-fill" style={{ height: getMeterHeight(levelR) }} />
        </div>
      </div>

      {/* Pan Knob Row */}
      <div className="fl-pan-row">
        <div
          className={`fl-pan-knob ${isDraggingPan ? 'active' : ''}`}
          onMouseDown={handlePanMouseDown}
          title={`Pan: ${pan}`}
          {...useGuideHandlers(`Pan: ${pan}`)}
        >
          <div
            className="fl-pan-pointer"
            style={{ transform: `rotate(${panRotation}deg)` }}
          />
        </div>
      </div>

      {/* Stereo Separation */}
      <div className="fl-stereo-row">
        <button className="fl-arrow-btn">◀◀</button>
        <button className="fl-arrow-btn">▶▶</button>
      </div>

      {/* Mute/Solo Row */}
      <div className="fl-mute-solo-row">
        <button
          className={`fl-ms-btn ${muted ? 'muted' : ''}`}
          onClick={(e) => { e.stopPropagation(); onMuteToggle && onMuteToggle(id); }}
          title="Mute"
        >
          <Volume2 size={10} />
        </button>
        <button
          className={`fl-ms-btn solo ${soloed ? 'active' : ''}`}
          onClick={(e) => { e.stopPropagation(); onSoloToggle && onSoloToggle(id); }}
          title="Solo"
        >
          <Headphones size={10} />
        </button>
      </div>

      {/* Routing Indicator */}
      <div className="fl-routing-row">
        <div className="fl-route-arrow">▲</div>
      </div>
    </div>
  );
});

// FL Studio-style Detail Panel
const MixerDetailPanel = React.memo(({ selectedChannel, onAddEffect }) => {
  const [eqLow, setEqLow] = useState(0);
  const [eqMid, setEqMid] = useState(0);
  const [eqHigh, setEqHigh] = useState(0);

  if (!selectedChannel) {
    return (
      <div className="fl-detail-panel">
        <div className="fl-detail-header">Mixer - Master</div>
        <div className="fl-detail-content empty">
          <p>Select a channel to view details</p>
        </div>
      </div>
    );
  }

  const channelName = selectedChannel.isMaster ? 'Master' : selectedChannel.name;
  const insertSlots = Array(10).fill(null).map((_, i) => selectedChannel.effects?.[i] || null);

  const handleSlotDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleSlotDrop = (e, slotIndex) => {
    e.preventDefault();
    const pluginData = e.dataTransfer.getData('plugin');
    if (pluginData) {
      try {
        const plugin = JSON.parse(pluginData);
        if (onAddEffect) onAddEffect(selectedChannel.id, plugin);
      } catch (err) {
        console.error("Failed to parse dropped plugin", err);
      }
    }
  };

  const createEqHandler = (setter, current) => (e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startValue = current;

    const handleMouseMove = (moveEvent) => {
      const deltaY = startY - moveEvent.clientY;
      setter(Math.max(-50, Math.min(50, startValue + deltaY * 0.5)));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div className="fl-detail-panel">
      <div className="fl-detail-header">Mixer - {channelName}</div>

      {/* Source Selector */}
      <div className="fl-source-section">
        <select className="fl-source-select">
          <option>(none)</option>
          <option>Audio In 1</option>
          <option>Audio In 2</option>
          <option>Sidechain</option>
        </select>
      </div>

      {/* Insert Slots List */}
      <div className="fl-slots-list">
        {insertSlots.map((effect, i) => (
          <div
            key={i}
            className={`fl-slot-item ${effect ? 'has-fx' : ''}`}
            onDragOver={handleSlotDragOver}
            onDrop={(e) => handleSlotDrop(e, i)}
          >
            <span className="fl-slot-num">Slot {i + 1}</span>
            {effect && <span className="fl-slot-name">{effect.name}</span>}
            {effect && <div className="fl-slot-led" />}
          </div>
        ))}
      </div>

      {/* Active Effect Display */}
      <div className="fl-fx-display">
        <span className="fl-fx-name">
          {selectedChannel.effects?.[0]?.name || 'Fruity Limiter'}
        </span>
        <button className="fl-fx-power">○</button>
      </div>

      {/* Equalizer */}
      <div className="fl-eq-section">
        <div className="fl-eq-title">Equalizer</div>
        <div className="fl-eq-graph">
          <svg viewBox="0 0 100 40" preserveAspectRatio="none">
            <rect x="0" y="0" width="100" height="40" fill="#1a1a1a" />
            <line x1="0" y1="20" x2="100" y2="20" stroke="rgba(255,255,255,0.1)" />
            <path
              d={`M 0 20 Q 25 ${20 - eqLow * 0.3} 50 ${20 - eqMid * 0.3} T 100 ${20 - eqHigh * 0.3}`}
              fill="none"
              stroke="#4ade80"
              strokeWidth="1.5"
            />
          </svg>
        </div>
        <div className="fl-eq-knobs">
          <div className="fl-eq-knob-wrap">
            <div
              className="fl-eq-knob"
              onMouseDown={createEqHandler(setEqLow, eqLow)}
              style={{ '--rot': `${eqLow * 2.7}deg` }}
            >
              <div className="fl-eq-dot" />
            </div>
            <span>LOW</span>
          </div>
          <div className="fl-eq-knob-wrap">
            <div
              className="fl-eq-knob"
              onMouseDown={createEqHandler(setEqMid, eqMid)}
              style={{ '--rot': `${eqMid * 2.7}deg` }}
            >
              <div className="fl-eq-dot" />
            </div>
            <span>MID</span>
          </div>
          <div className="fl-eq-knob-wrap">
            <div
              className="fl-eq-knob"
              onMouseDown={createEqHandler(setEqHigh, eqHigh)}
              style={{ '--rot': `${eqHigh * 2.7}deg` }}
            >
              <div className="fl-eq-dot" />
            </div>
            <span>HIGH</span>
          </div>
        </div>
      </div>

      {/* Output */}
      <div className="fl-output-section">
        <div className="fl-output-ring" />
        <span>(none)</span>
      </div>
      <div className="fl-output-route">
        <div className="fl-output-dot active" />
        <span>Out 1 - Out 2</span>
      </div>
    </div>
  );
});

function Mixer() {
  const { channels, updateChannelVolume, updateChannelPan, addEffect } = useProject();
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [mutedChannels, setMutedChannels] = useState({});
  const [soloedChannels, setSoloedChannels] = useState({});

  // Generate insert tracks (16 empty insert channels)
  const insertTracks = Array(16).fill(null).map((_, i) => ({
    id: `insert-${i + 1}`,
    name: `Insert ${i + 1}`,
    vol: 80,
    pan: 0,
    effects: []
  }));

  const handleChannelSelect = (channelData) => {
    setSelectedChannel(channelData);
  };

  const handleMuteToggle = (id) => {
    setMutedChannels(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSoloToggle = (id) => {
    setSoloedChannels(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="fl-mixer-container">
      {/* Main Mixer Area */}
      <div className="fl-mixer">
        {/* Toolbar */}
        <div className="fl-mixer-toolbar">
          <div className="fl-toolbar-left">
            <button className="fl-tb-btn">◀</button>
            <button className="fl-tb-btn">▶</button>
            <button className="fl-tb-btn">↕</button>
            <span className="fl-tb-sep" />
            <button className="fl-tb-btn active">▣</button>
            <button className="fl-tb-btn">☷</button>
            <span className="fl-tb-label">+ Wide</span>
          </div>
          <div className="fl-toolbar-right">
            <span className="fl-channel-count">1 - 16</span>
          </div>
        </div>

        {/* Channel Numbers Row */}
        <div className="fl-channel-nums-row">
          <div className="fl-num-cell master">M</div>
          {channels.map((ch, i) => (
            <div key={ch.id} className="fl-num-cell">{i + 1}</div>
          ))}
          {insertTracks.slice(0, 10).map((_, i) => (
            <div key={`insert-${i}`} className="fl-num-cell insert">{channels.length + i + 1}</div>
          ))}
        </div>

        {/* Channels Container */}
        <div className="fl-channels-container">
          {/* Master Channel */}
          <MixerChannel
            id="master"
            name="Master"
            isMaster={true}
            channelNumber="M"
            vol={80}
            pan={0}
            effects={[]}
            onVolChange={() => { }}
            onPanChange={() => { }}
            isSelected={selectedChannel?.id === 'master'}
            onSelect={handleChannelSelect}
            muted={mutedChannels['master']}
            soloed={soloedChannels['master']}
            onMuteToggle={handleMuteToggle}
            onSoloToggle={handleSoloToggle}
          />

          {/* Divider */}
          <div className="fl-divider" />

          {/* Instrument Channels */}
          {channels.map((ch, i) => (
            <MixerChannel
              key={ch.id}
              id={ch.id}
              name={ch.name}
              channelNumber={i + 1}
              vol={ch.vol}
              pan={ch.pan}
              effects={ch.effects}
              onVolChange={(v) => updateChannelVolume(ch.id, v)}
              onPanChange={(p) => updateChannelPan(ch.id, p)}
              onAddEffect={(id, plugin) => addEffect(id, plugin)}
              isSelected={selectedChannel?.id === ch.id}
              onSelect={handleChannelSelect}
              muted={mutedChannels[ch.id]}
              soloed={soloedChannels[ch.id]}
              onMuteToggle={handleMuteToggle}
              onSoloToggle={handleSoloToggle}
            />
          ))}

          {/* Insert Channels */}
          {insertTracks.slice(0, 10).map((track, i) => (
            <MixerChannel
              key={track.id}
              id={track.id}
              name={track.name}
              channelNumber={channels.length + i + 1}
              vol={track.vol}
              pan={track.pan}
              effects={track.effects}
              onVolChange={() => { }}
              onPanChange={() => { }}
              isSelected={selectedChannel?.id === track.id}
              onSelect={handleChannelSelect}
              muted={mutedChannels[track.id]}
              soloed={soloedChannels[track.id]}
              onMuteToggle={handleMuteToggle}
              onSoloToggle={handleSoloToggle}
            />
          ))}

          {/* Add Button */}
          <div className="fl-add-channel-btn">
            <span>+</span>
          </div>
        </div>
      </div>

      {/* Detail Panel */}
      <MixerDetailPanel
        selectedChannel={selectedChannel}
        onAddEffect={addEffect}
      />
    </div>
  );
}

export default React.memo(Mixer);
