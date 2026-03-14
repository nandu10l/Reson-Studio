import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import '../styles/butter/Mixer.css';
import { useGuide } from '../contexts/GuideContext';
import { useProject } from '../contexts/ProjectContext';
import { VolumeX, Volume2, Headphones } from './icons/BlenderIcons';
import { audioEngine } from '../audio/AudioEngine';
import EffectEditor from './EffectEditor';

// Available effects for the selector
const AVAILABLE_EFFECTS = [
  { id: 'reverb-1', name: 'Reverb', type: 'spatial' },
  { id: 'delay-1', name: 'Delay', type: 'temporal' },
  { id: 'chorus-1', name: 'Chorus', type: 'chorus' },
  { id: 'phaser-1', name: 'Phaser', type: 'phaser' },
  { id: 'dist-1', name: 'Distortion', type: 'distortion' },
  { id: 'comp-1', name: 'Compressor', type: 'compressor' },
  { id: 'eq-1', name: 'Parametric EQ', type: 'eq' },
  { id: 'gain-1', name: 'Gain', type: 'gain' },
  { id: 'pan-1', name: 'Panner', type: 'pan' }
];

// Effect Selector Portal — renders outside DraggableWindow to avoid stacking context issues
const EffectSelector = React.memo(({ isOpen, onClose, onSelect, position }) => {
  if (!isOpen) return null;

  const modal = (
    <div
      className="effect-selector-modal"
      style={{
        position: 'fixed',
        left: position?.x || 200,
        top: position?.y || 200,
        zIndex: 99999
      }}
    >
      <div className="effect-selector-header">
        <span>Select Effect</span>
        <button onClick={onClose} className="effect-selector-close">×</button>
      </div>
      <div className="effect-selector-list">
        {AVAILABLE_EFFECTS.map(effect => (
          <div
            key={effect.id}
            className="effect-selector-item"
            onClick={() => { onSelect(effect); onClose(); }}
          >
            <span className="effect-selector-name">{effect.name}</span>
            <span className="effect-selector-type">{effect.type}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return ReactDOM.createPortal(modal, document.body);
});

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
  const rafRef = useRef(null);
  const { useGuideHandlers } = useGuide();

  // Optimized audio level meter using requestAnimationFrame for better performance
  useEffect(() => {
    let lastUpdate = 0;
    const minInterval = 66; // Update at ~15fps for better performance (still smooth)
    let prevLevelL = 0;
    let prevLevelR = 0;

    const updateLevels = (timestamp) => {
      if (timestamp - lastUpdate >= minInterval) {
        if (!muted && audioEngine.isPlaying()) {
          const level = audioEngine.getChannelLevel(id);
          const newLevelL = level * (0.95 + Math.random() * 0.1);
          const newLevelR = level * (0.95 + Math.random() * 0.1);

          // Only update if values changed significantly (reduce unnecessary renders)
          if (Math.abs(newLevelL - prevLevelL) > 0.01 || Math.abs(newLevelR - prevLevelR) > 0.01) {
            setLevelL(newLevelL);
            setLevelR(newLevelR);
            prevLevelL = newLevelL;
            prevLevelR = newLevelR;
          }
        } else if (prevLevelL !== 0 || prevLevelR !== 0) {
          setLevelL(0);
          setLevelR(0);
          prevLevelL = 0;
          prevLevelR = 0;
        }
        lastUpdate = timestamp;
      }
      rafRef.current = requestAnimationFrame(updateLevels);
    };

    rafRef.current = requestAnimationFrame(updateLevels);
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [muted, id]);

  // Pan knob rotation
  const panRotation = (pan / 50) * 140;

  // Fader handling
  const handleFaderMouseDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFader(true);

    const rect = faderRef.current?.getBoundingClientRect();
    if (!rect) return;

    let rafId = null;
    const handleMouseMove = (moveEvent) => {
      // Cancel previous RAF if still pending
      if (rafId) cancelAnimationFrame(rafId);

      // Schedule update for next frame
      rafId = requestAnimationFrame(() => {
        const y = moveEvent.clientY - rect.top;
        const percent = Math.max(0, Math.min(100, 100 - (y / rect.height) * 100));
        onVolChange(Math.round(percent));
        rafId = null;
      });
    };

    const handleMouseUp = () => {
      if (rafId) cancelAnimationFrame(rafId);
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

    let rafId = null;
    const handleMouseMove = (moveEvent) => {
      // Cancel previous RAF if still pending
      if (rafId) cancelAnimationFrame(rafId);

      // Schedule update for next frame
      rafId = requestAnimationFrame(() => {
        const deltaY = startY - moveEvent.clientY;
        const newPan = Math.max(-50, Math.min(50, startPan + deltaY));
        onPanChange(Math.round(newPan));
        rafId = null;
      });
    };

    const handleMouseUp = () => {
      if (rafId) cancelAnimationFrame(rafId);
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

  // Insert slots (8 visible) - Memoize to prevent recalculation on every render
  const insertSlots = React.useMemo(
    () => Array(8).fill(null).map((_, i) => effects[i] || null),
    [effects]
  );

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
const MixerDetailPanel = React.memo(({
  selectedChannel,
  onAddEffect,
  onRemoveEffect,
  onUpdateEffectMix,
  onUpdateEffectEnabled,
  onReorderEffect,
  onUpdateEffectParams
}) => {
  const [eqLow, setEqLow] = useState(0);
  const [eqMid, setEqMid] = useState(0);
  const [eqHigh, setEqHigh] = useState(0);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorPosition, setSelectorPosition] = useState({ x: 200, y: 200 });
  const [activeSlot, setActiveSlot] = useState(null);
  const [editingEffect, setEditingEffect] = useState(null);
  const [editingSlotIndex, setEditingSlotIndex] = useState(null);

  if (!selectedChannel) {
    return (
      <div className="fl-detail-panel">
        <div className="fl-detail-header">Mixer - Master</div>
        <div className="fl-detail-subheader" />
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
        if (onAddEffect) onAddEffect(selectedChannel.id, plugin, slotIndex);
      } catch (err) {
        console.error("Failed to parse dropped plugin", err);
      }
    }
  };

  const handleSlotClick = (e, slotIndex, effect) => {
    if (effect) {
      // If slot has effect, open the effect editor
      setEditingEffect(effect);
      setEditingSlotIndex(slotIndex);
      return;
    }
    // Open effect selector for empty slot
    // Smart positioning: prefer left of the panel since detail panel is at the right edge
    const rect = e.currentTarget.getBoundingClientRect();
    const popupWidth = 260;
    const popupHeight = 300;
    const margin = 6;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Try left of the slot first (since detail panel is at the right edge)
    let x = rect.left - popupWidth - margin;
    // If that goes off-screen to the left, try right of the slot
    if (x < margin) {
      x = rect.right + margin;
    }
    // Clamp to viewport
    x = Math.max(margin, Math.min(x, vw - popupWidth - margin));

    let y = rect.top;
    // Clamp vertically
    y = Math.max(margin, Math.min(y, vh - popupHeight - margin));

    setSelectorPosition({ x, y });
    setActiveSlot(slotIndex);
    setSelectorOpen(true);
  };

  const handleCloseEffectEditor = () => {
    setEditingEffect(null);
    setEditingSlotIndex(null);
  };

  const handleUpdateParams = (params) => {
    if (onUpdateEffectParams && editingSlotIndex !== null) {
      onUpdateEffectParams(selectedChannel.id, editingSlotIndex, params);
      // Update local editing effect to reflect changes, merging with existing params
      setEditingEffect(prev => prev ? {
        ...prev,
        params: { ...prev.params, ...params }
      } : null);
    }
  };

  const handleEffectSelect = (effect) => {
    if (onAddEffect && activeSlot !== null) {
      onAddEffect(selectedChannel.id, effect, activeSlot);
    }
    setActiveSlot(null);
  };

  const handleToggleEnabled = (e, slotIndex, effect) => {
    e.stopPropagation();
    if (onUpdateEffectEnabled && effect) {
      onUpdateEffectEnabled(selectedChannel.id, slotIndex, !effect.enabled);
    }
  };

  const handleRemoveEffect = (e, slotIndex) => {
    e.stopPropagation();
    if (onRemoveEffect) {
      onRemoveEffect(selectedChannel.id, slotIndex);
    }
  };

  const handleMixChange = (slotIndex, mix) => {
    if (onUpdateEffectMix) {
      onUpdateEffectMix(selectedChannel.id, slotIndex, mix);
    }
  };

  const handleSlotWheel = (e, slotIndex) => {
    if (!onReorderEffect) return;
    const direction = e.deltaY > 0 ? 1 : -1;
    const newSlot = Math.max(0, Math.min(9, slotIndex + direction));
    if (newSlot !== slotIndex) {
      onReorderEffect(selectedChannel.id, slotIndex, newSlot);
    }
  };

  const createEqHandler = (setter, current) => (e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startValue = current;

    const handleMouseMove = (moveEvent) => {
      // Use RAF for smooth EQ updates
      requestAnimationFrame(() => {
        const deltaY = startY - moveEvent.clientY;
        setter(Math.max(-50, Math.min(50, startValue + deltaY * 0.5)));
      });
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
      <div className="fl-detail-subheader" />

      {/* Effect Selector Modal */}
      <EffectSelector
        isOpen={selectorOpen}
        onClose={() => setSelectorOpen(false)}
        onSelect={handleEffectSelect}
        position={selectorPosition}
      />

      {/* Effect Editor Modal */}
      {editingEffect && (
        <EffectEditor
          effect={editingEffect}
          onClose={handleCloseEffectEditor}
          onUpdateParams={handleUpdateParams}
          onUpdateMix={(mix) => handleMixChange(editingSlotIndex, mix)}
          onToggleEnabled={() => {
            if (onUpdateEffectEnabled) {
              onUpdateEffectEnabled(selectedChannel.id, editingSlotIndex, !(editingEffect.enabled !== false));
              setEditingEffect(prev => prev ? { ...prev, enabled: !(prev.enabled !== false) } : null);
            }
          }}
        />
      )}

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
            className={`fl-slot-item ${effect ? 'has-fx' : ''} ${effect?.enabled === false ? 'bypassed' : ''}`}
            onDragOver={handleSlotDragOver}
            onDrop={(e) => handleSlotDrop(e, i)}
            onClick={(e) => handleSlotClick(e, i, effect)}
            onWheel={(e) => handleSlotWheel(e, i)}
            title={effect ? `${effect.name} - Scroll to reorder, click power to bypass` : 'Click to add effect'}
          >
            <span className="fl-slot-num">Slot {i + 1}</span>
            {effect && (
              <>
                <span className="fl-slot-name">{effect.name}</span>
                <button
                  className={`fl-slot-power ${effect.enabled !== false ? 'active' : ''}`}
                  onClick={(e) => handleToggleEnabled(e, i, effect)}
                  title="Enable/Bypass"
                >
                  ●
                </button>
                <button
                  className="fl-slot-remove"
                  onClick={(e) => handleRemoveEffect(e, i)}
                  title="Remove Effect"
                >
                  ×
                </button>
                <div className="fl-slot-led" />
              </>
            )}
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
  const {
    channels,
    updateChannelVolume,
    updateChannelPan,
    addEffect,
    removeEffect,
    updateEffectMix,
    updateEffectEnabled,
    reorderEffect,
    updateEffectParams,
    mixerInserts,
    selectedChannelIds,
    audioClips,
    addAudioClipsToMixerAsGroup,
    addAudioClipsToMixerSeparately,
    updateMixerInsertVolume,
    updateMixerInsertPan
  } = useProject();
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [mutedChannels, setMutedChannels] = useState({});
  const [soloedChannels, setSoloedChannels] = useState({});
  const [contextMenu, setContextMenu] = useState({ open: false, x: 0, y: 0 });
  const contextMenuRef = useRef(null);

  // Determine which selected IDs are audio clips
  const selectedAudioClipIds = selectedChannelIds.filter(id => typeof id === 'string' && id.startsWith('audio-'));
  const hasSelectedAudioClips = selectedAudioClipIds.length > 0;

  // Generate remaining empty insert tracks to fill up to 16 total
  const remainingEmptyCount = Math.max(0, 16 - mixerInserts.length);
  const emptyInsertTracks = Array(remainingEmptyCount).fill(null).map((_, i) => ({
    id: `insert-empty-${i + 1}`,
    name: `Insert ${mixerInserts.length + i + 1}`,
    vol: 80,
    pan: 0,
    effects: []
  }));

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (contextMenu.open && contextMenuRef.current && !contextMenuRef.current.contains(e.target)) {
        setContextMenu({ open: false, x: 0, y: 0 });
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [contextMenu.open]);

  // Keep selectedChannel in sync with channels state
  useEffect(() => {
    if (selectedChannel && typeof selectedChannel.id === 'number') {
      const updatedChannel = channels.find(ch => ch.id === selectedChannel.id);
      if (updatedChannel) {
        setSelectedChannel(prev => ({ ...prev, ...updatedChannel }));
      }
    }
  }, [channels, selectedChannel?.id]);

  // Keep selectedChannel in sync with mixerInserts state
  useEffect(() => {
    if (selectedChannel && typeof selectedChannel.id === 'string' && selectedChannel.id.startsWith('mixer-insert-')) {
      const updatedInsert = mixerInserts.find(ins => ins.id === selectedChannel.id);
      if (updatedInsert) {
        setSelectedChannel(prev => ({ ...prev, ...updatedInsert }));
      }
    }
  }, [mixerInserts, selectedChannel?.id]);

  const handleMuteToggle = useCallback((id) => {
    setMutedChannels(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleSoloToggle = useCallback((id) => {
    setSoloedChannels(prev => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleChannelSelect = useCallback((channelData) => {
    setSelectedChannel(channelData);
  }, []);

  return (
    <div className="fl-mixer-container">
      {/* Main Mixer Area */}
      <div className="fl-mixer">
        {/* Toolbar */}
        <div className="fl-mixer-toolbar">
          <div className="fl-toolbar-left">
            <button className="fl-tb-btn">S</button>
            <button className="fl-tb-btn">A</button>
            <div className="fl-tb-sep" />
            <button className="fl-tb-btn active">1</button>
            <button className="fl-tb-btn">2</button>
            <button className="fl-tb-btn">3</button>
            <button className="fl-tb-btn">4</button>
            <div className="fl-tb-sep" />
            <button className="fl-tb-btn">D</button>
            <button className="fl-tb-btn">L</button>
          </div>
          <div className="fl-toolbar-right">
            <span className="fl-channel-count">{channels.length} channels</span>
          </div>
        </div>

        {/* Channel Numbers Row */}
        <div
          className="fl-channel-nums-row"
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu({ open: true, x: e.clientX, y: e.clientY });
          }}
        >
          <div className="fl-num-cell master">M</div>
          <div className="fl-divider" />
          {channels.map((ch, i) => (
            <div key={ch.id} className="fl-num-cell">{i + 1}</div>
          ))}
          {mixerInserts.map((ins, i) => (
            <div key={ins.id} className="fl-num-cell insert has-audio">{channels.length + i + 1}</div>
          ))}
          {emptyInsertTracks.map((_, i) => (
            <div key={`empty-insert-${i}`} className="fl-num-cell insert">{channels.length + mixerInserts.length + i + 1}</div>
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

          {/* Audio Clip Mixer Inserts */}
          {mixerInserts.map((ins, i) => (
            <MixerChannel
              key={ins.id}
              id={ins.id}
              name={ins.name}
              channelNumber={channels.length + i + 1}
              vol={ins.vol}
              pan={ins.pan}
              effects={ins.effects}
              onVolChange={(v) => updateMixerInsertVolume(ins.id, v)}
              onPanChange={(p) => updateMixerInsertPan(ins.id, p)}
              isSelected={selectedChannel?.id === ins.id}
              onSelect={handleChannelSelect}
              muted={mutedChannels[ins.id]}
              soloed={soloedChannels[ins.id]}
              onMuteToggle={handleMuteToggle}
              onSoloToggle={handleSoloToggle}
            />
          ))}

          {/* Remaining Empty Insert Channels */}
          {emptyInsertTracks.map((track, i) => (
            <MixerChannel
              key={track.id}
              id={track.id}
              name={track.name}
              channelNumber={channels.length + mixerInserts.length + i + 1}
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

      {/* Right-Click Context Menu */}
      {contextMenu.open && (
        <div
          className="mixer-context-menu"
          ref={contextMenuRef}
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 10000
          }}
        >
          <div
            className={`mixer-context-item ${!hasSelectedAudioClips ? 'disabled' : ''}`}
            onClick={() => {
              if (hasSelectedAudioClips) {
                addAudioClipsToMixerAsGroup(selectedAudioClipIds);
                setContextMenu({ open: false, x: 0, y: 0 });
              }
            }}
          >
            Add Selected as Group
            {hasSelectedAudioClips && <span className="mixer-context-badge">{selectedAudioClipIds.length}</span>}
          </div>
          <div
            className={`mixer-context-item ${!hasSelectedAudioClips ? 'disabled' : ''}`}
            onClick={() => {
              if (hasSelectedAudioClips) {
                addAudioClipsToMixerSeparately(selectedAudioClipIds);
                setContextMenu({ open: false, x: 0, y: 0 });
              }
            }}
          >
            Add to Separate Inserts
            {hasSelectedAudioClips && <span className="mixer-context-badge">{selectedAudioClipIds.length}</span>}
          </div>
          {!hasSelectedAudioClips && (
            <div className="mixer-context-hint">
              Select audio clips in Channel Rack first
            </div>
          )}
        </div>
      )}

      {/* Detail Panel */}
      <MixerDetailPanel
        selectedChannel={selectedChannel}
        onAddEffect={addEffect}
        onRemoveEffect={removeEffect}
        onUpdateEffectMix={updateEffectMix}
        onUpdateEffectEnabled={updateEffectEnabled}
        onReorderEffect={reorderEffect}
        onUpdateEffectParams={updateEffectParams}
      />
    </div>
  );
}

export default React.memo(Mixer);
