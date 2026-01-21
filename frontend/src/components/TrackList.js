import React, { useState, useRef, useEffect } from 'react';
import { Plus, Grid, ChevronDown, Trash, Edit, Copy, Palette, Volume2, VolumeX, GripVertical, Headphones } from './icons/BlenderIcons';
import '../styles/blender-icons.css';
import { useGuide } from '../contexts/GuideContext';
import { useProject } from '../contexts/ProjectContext';

import PatternClipPreview from './PatternClipPreview';
import AudioClip from './AudioClip';
import AutomationClip from './AutomationClip';

// Update Track signature to include onResizeStart
const Track = React.memo(({ track, onSelect, onToggleMute, onToggleSolo, onAddClip, onRemoveClip, onStartDrag, onResizeStart, pixelsPerBeat, measures, beatsPerBar, patterns, audioClips, automations, selected, onOpenMenu, onRenameTrack, onDeleteTrack, activeTool, onSlice, onAddAudioClip, onAddAutomationClip, updateAutomationPoints, onAddChannel, onAddEffect }) => {
  const TrackIcon = track.icon || Grid;
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(track.name);
  const [hoveredClipIndex, setHoveredClipIndex] = useState(null);
  const [showActions, setShowActions] = useState(false);
  const inputRef = useRef(null);

  const handleRename = () => {
    setIsEditing(true);
    setEditName(track.name);
  };

  const handleDoubleClick = () => {
    if (!isEditing) {
      handleRename();
    }
  };

  const handleSaveRename = () => {
    if (editName.trim() && editName !== track.name) {
      onRenameTrack(track.id, editName.trim());
    }
    setIsEditing(false);
  };

  const handleCancelRename = () => {
    setEditName(track.name);
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSaveRename();
    } else if (e.key === 'Escape') {
      handleCancelRename();
    }
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Generate or get track color (for visual identification)
  const trackColor = track.color || `hsl(${(track.id * 137.5) % 360}, 45%, 45%)`;
  const isSelected = selected && selected.trackId === track.id;
  const isActive = isSelected;

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const pluginData = e.dataTransfer.getData('plugin');
    if (pluginData) {
      try {
        const plugin = JSON.parse(pluginData);
        // If instrument, we could potentially "bind" this track to a new channel
        // For now, let's just create the channel to be helpful
        const instrumentTypes = ['synthesizer', 'sampler', 'drums'];
        const effectTypes = ['spatial', 'temporal', 'filter', 'dynamics', 'saturation', 'modulation', 'utility', 'analysis'];

        if (instrumentTypes.includes(plugin.type)) {
          if (onAddChannel) {
            // Determine if we want to auto-assign pattern clips to this track?
            // Just create the channel for now.
            onAddChannel(plugin);
            // Feedback?
            console.log("Added channel from track drop");
          }
        } else if (effectTypes.includes(plugin.type)) {
          if (onAddEffect) {
            // Heuristic: Map Track ID (1-based) to Channel ID (0-based)
            // e.g. Track 1 -> Channel 0
            const targetChannelId = track.id - 1;
            onAddEffect(targetChannelId, plugin);
          } else {
            alert('Please drag effects to a Mixer Channel (bottom panel).');
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div
      className="track-row"
      data-track-id={track.id}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{
        position: 'relative',
        display: 'flex',
        borderBottom: '1px solid rgba(255, 255, 255, 0.03)'
      }}
    >
      {/* Color Strip - Far Left */}
      <div
        className="track-color-strip"
        style={{
          width: '3px',
          background: isActive ? trackColor : trackColor,
          opacity: isActive ? 1 : 0.4,
          flexShrink: 0,
          transition: 'opacity 0.2s ease',
          cursor: 'pointer'
        }}
        onClick={() => onSelect && onSelect({ trackId: track.id })}
      />

      {/* Track Header */}
      <div
        className="track-header"
        style={{
          width: '197px', // Fixed width (200px total with 3px color strip)
          flex: 'none',
          background: isActive
            ? 'rgba(96, 165, 250, 0.06)'
            : '#1a1a1a',
          borderLeft: isActive
            ? '2px solid #60a5fa'
            : '2px solid transparent',
          borderRight: '1px solid rgba(255, 255, 255, 0.05)',
          padding: '0 6px',
          minHeight: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxSizing: 'border-box',
          position: 'relative',
          transition: 'all 0.15s ease',
          cursor: 'default'
        }}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => !isEditing && setShowActions(false)}
        onClick={() => onSelect && onSelect({ trackId: track.id })}
      >
        {/* Left: Drag Handle (Progressive Disclosure) */}
        <div
          className="track-drag-handle"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '14px',
            height: '14px',
            marginRight: '4px',
            cursor: 'grab',
            opacity: showActions ? 1 : 0,
            transition: 'opacity 0.2s ease',
            pointerEvents: showActions ? 'auto' : 'none',
            flexShrink: 0
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            // Drag handle functionality would go here
          }}
        >
          <GripVertical size={11} className="blender-icon" style={{ color: '#6b7280' }} />
        </div>

        {/* Center: Track Name - Always Visible, Double-click to Edit */}
        <div
          className="track-name-container"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            minWidth: 0
          }}
          onDoubleClick={handleDoubleClick}
        >
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSaveRename}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
              style={{
                flex: 1,
                background: 'rgba(96, 165, 250, 0.12)',
                border: '1px solid rgba(96, 165, 250, 0.4)',
                borderRadius: '2px',
                padding: '2px 6px',
                color: '#e5e7eb',
                fontSize: '11px',
                fontWeight: 400,
                outline: 'none',
                minWidth: 0,
                fontFamily: 'inherit',
                letterSpacing: '0.01em'
              }}
            />
          ) : (
            <>
              <div
                className="track-name"
                style={{
                  flex: 1,
                  color: isActive ? '#9ca3af' : '#6b7280',
                  fontWeight: 400,
                  fontSize: '11px',
                  letterSpacing: '0.01em',
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  lineHeight: '1.3',
                  opacity: isActive ? 1 : 0.75,
                  transition: 'opacity 0.15s ease',
                  position: 'relative',
                  cursor: 'default'
                }}
                title={track.name}
                onMouseEnter={(e) => {
                  // Show full name on hover by expanding
                  const nameEl = e.currentTarget;
                  const isOverflowing = nameEl.scrollWidth > nameEl.clientWidth;
                  if (isOverflowing) {
                    nameEl.style.position = 'absolute';
                    nameEl.style.background = '#1a1a1a';
                    nameEl.style.padding = '3px 8px',
                      nameEl.style.borderRadius = '2px';
                    nameEl.style.border = '1px solid rgba(255, 255, 255, 0.1)';
                    nameEl.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.5)';
                    nameEl.style.zIndex = '1000';
                    nameEl.style.whiteSpace = 'nowrap';
                    nameEl.style.overflow = 'visible';
                    nameEl.style.textOverflow = 'clip';
                    nameEl.style.maxWidth = 'none';
                    nameEl.style.width = 'auto';
                    nameEl.style.left = '0';
                    nameEl.style.top = '-2px';
                  }
                }}
                onMouseLeave={(e) => {
                  // Restore truncated state
                  const nameEl = e.currentTarget;
                  nameEl.style.position = 'relative';
                  nameEl.style.background = 'transparent';
                  nameEl.style.padding = '0';
                  nameEl.style.borderRadius = '0';
                  nameEl.style.border = 'none';
                  nameEl.style.boxShadow = 'none';
                  nameEl.style.zIndex = 'auto';
                  nameEl.style.whiteSpace = 'nowrap';
                  nameEl.style.overflow = 'hidden';
                  nameEl.style.textOverflow = 'ellipsis';
                  nameEl.style.maxWidth = '100%';
                  nameEl.style.width = '100%';
                  nameEl.style.left = 'auto';
                  nameEl.style.top = 'auto';
                }}
              >
                {track.name}
              </div>

              {/* Secondary Controls - Progressive Disclosure on Hover */}
              <div
                className="track-secondary-controls"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px',
                  flexShrink: 0,
                  opacity: showActions ? 1 : 0,
                  transition: 'opacity 0.2s ease',
                  pointerEvents: showActions ? 'auto' : 'none'
                }}
              >
                {/* Solo Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSolo(track.id);
                  }}
                  title={track.solo ? "Unsolo" : "Solo"}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '3px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '2px',
                    transition: 'all 0.15s ease',
                    width: '18px',
                    height: '18px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <Headphones
                    size={12}
                    className="blender-icon"
                    style={{
                      color: track.solo ? '#fbbf24' : '#6b7280'
                    }}
                  />
                </button>

                {/* Edit Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRename();
                  }}
                  title="Rename Track"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '3px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '2px',
                    transition: 'all 0.15s ease',
                    width: '18px',
                    height: '18px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    const icon = e.currentTarget.querySelector('.blender-icon');
                    if (icon) icon.style.color = '#60a5fa';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    const icon = e.currentTarget.querySelector('.blender-icon');
                    if (icon) icon.style.color = '#6b7280';
                  }}
                >
                  <Edit size={12} className="blender-icon" style={{ color: '#6b7280' }} />
                </button>

                {/* Delete Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Delete "${track.name}"?`)) {
                      onDeleteTrack(track.id);
                    }
                  }}
                  title="Delete Track"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '3px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '2px',
                    transition: 'all 0.15s ease',
                    width: '18px',
                    height: '18px'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
                    const icon = e.currentTarget.querySelector('.blender-icon');
                    if (icon) icon.style.color = '#ef4444';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    const icon = e.currentTarget.querySelector('.blender-icon');
                    if (icon) icon.style.color = '#6b7280';
                  }}
                >
                  <Trash size={12} className="blender-icon" style={{ color: '#6b7280' }} />
                </button>
              </div>
            </>
          )}
        </div>

        {/* Right: Mute Icon - Always Visible */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleMute(track.id);
          }}
          title={track.muted ? "Unmute" : "Mute"}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '2px',
            transition: 'all 0.15s ease',
            width: '18px',
            height: '18px',
            flexShrink: 0,
            marginLeft: '4px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          {track.muted ? (
            <VolumeX
              size={13}
              className="blender-icon"
              style={{ color: '#6b7280' }}
            />
          ) : (
            <Volume2
              size={13}
              className="blender-icon"
              style={{ color: '#60a5fa' }}
            />
          )}
        </button>
      </div>

      <div
        className="track-clip-area"
        style={{ minWidth: `${measures * beatsPerBar * pixelsPerBeat}px` }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }}
        onDrop={(e) => {
          e.preventDefault();
          const dataStr = e.dataTransfer.getData('application/json');
          if (!dataStr) return;
          try {
            const data = JSON.parse(dataStr);
            if (data.type === 'pattern') {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const offset = Math.floor(x / pixelsPerBeat);
              onAddClip(track.id, offset, data.patternId);
            } else if (data.type === 'audio') {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const offset = Math.floor(x / pixelsPerBeat);
              onAddAudioClip(track.id, offset, data.audioClipId);
            } else if (data.type === 'automation') {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const offset = Math.floor(x / pixelsPerBeat);
              // We need onAddAutomationClip prop.
              if (onAddAutomationClip) onAddAutomationClip(track.id, offset, data.automationId);
            }
          } catch (err) {
            console.error("Drop failed", err);
          }
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const offset = Math.floor(x / pixelsPerBeat);
          onAddClip(track.id, offset);
        }}
      >
        <div className="track-grid">
          {[...Array(measures * beatsPerBar * 4)].map((_, i) => {
            const sixteenth = i;
            const beat = Math.floor(sixteenth / 4);
            const sixteenthInBeat = sixteenth % 4;
            const isBeat = sixteenthInBeat === 0;
            const isDownbeat = isBeat && (beat % beatsPerBar === 0);

            return (
              <div
                key={i}
                className={`grid-line ${isDownbeat ? 'downbeat' : isBeat ? 'beat' : 'sixteenth'}`}
                style={{
                  width: `${pixelsPerBeat / 4}px`,
                  left: `${(sixteenth / 4) * pixelsPerBeat}px`
                }}
              />
            );
          })}
        </div>
        {track.clips.map((clip, idx) => {
          // Handle audio clips
          if (clip.type === 'audio') {
            const audioClip = audioClips.find(ac => ac.id === clip.audioClipId);
            if (!audioClip) return null;

            // Merge clip data with audioClip data for rendering
            const mergedClip = {
              ...audioClip,
              ...clip,
              trackId: track.id,
              clipIndex: idx
            };

            return (
              <AudioClip
                key={clip.id || idx}
                clip={mergedClip}
                pixelsPerBeat={pixelsPerBeat}
                onSelect={(c) => onSelect({ ...c, trackId: track.id, clipIndex: idx })}
                onRemove={(c) => onRemoveClip(track.id, idx)}
                onStartDrag={(e, c) => onStartDrag(e, track.id, idx)}
                onResizeStart={(e, c, side) => onResizeStart(e, track.id, idx, side)}
                onOpenMenu={(menuData) => onOpenMenu({ ...menuData, trackId: track.id, clipIndex: idx })}
                isSelected={selected?.trackId === track.id && selected?.clipIndex === idx}
                activeTool={activeTool}
                automation={automations ? automations.find(a => a.targetClipId === clip.id && a.type === 'volume') : null}
                onSlice={(rawSplitPoint) => {
                  // Calculate correct split point based on raw click or handle in AudioClip
                  // AudioClip passes relative click? No, we need logic.
                  // Actually, let's pass the raw handler and let AudioClip determine position if needed?
                  // Or passing (trackId, clipIndex, splitPoint) is standard.
                  // Allow AudioClip to compute splitPoint or pass event.
                  // Let's rely on AudioClip calling this with simple event or calculated point.
                  // Implementation choice: Pass specific handler for this clip index.
                  onSlice(track.id, idx, rawSplitPoint);
                }}
              />
            );
          } else if (clip.type === 'automation') {
            const automationData = automations ? automations.find(a => a.id === clip.automationId) : null;

            return (
              <AutomationClip
                key={clip.id || idx}
                clip={clip}
                automation={automationData}
                pixelsPerBeat={pixelsPerBeat}
                onSelect={(c) => onSelect({ ...c, trackId: track.id, clipIndex: idx })}
                onRemove={(c) => onRemoveClip(track.id, idx)}
                onStartDrag={(e, c) => onStartDrag(e, track.id, idx)}
                onResizeStart={(e, c, side) => onResizeStart(e, track.id, idx, side)}
                onOpenMenu={(menuData) => onOpenMenu({ ...menuData, trackId: track.id, clipIndex: idx })}
                onUpdatePoints={updateAutomationPoints}
                isSelected={selected?.trackId === track.id && selected?.clipIndex === idx}
                activeTool={activeTool}
              />
            );
          }

          // Handle pattern clips (existing code)
          const pattern = patterns.find(p => p.id === clip.patternId);
          const clipName = pattern ? pattern.name : `Pattern ${clip.patternId}`;
          const clipColor = pattern ? pattern.color : '#ccc';
          const isClipSelected = selected?.trackId === track.id && selected?.clipIndex === idx;
          const isClipHovered = hoveredClipIndex === idx;

          return (
            <div
              key={idx}
              className="track-clip"
              onMouseEnter={() => setHoveredClipIndex(idx)}
              onMouseLeave={() => setHoveredClipIndex(null)}
              style={{
                left: `${clip.offset * pixelsPerBeat}px`,
                width: `${clip.length * pixelsPerBeat}px`,
                background: isClipSelected
                  ? `linear-gradient(180deg, ${clipColor}E6 0%, ${clipColor}CC 100%)`
                  : `linear-gradient(180deg, ${clipColor}80 0%, ${clipColor}60 100%)`,
                borderColor: isClipSelected ? clipColor : `${clipColor}80`,
                borderWidth: isClipSelected ? '2px' : '1px',
                borderStyle: 'solid',
                borderRadius: '8px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: isClipSelected
                  ? `inset 0 1px 2px rgba(255, 255, 255, 0.25), 0 0 16px ${clipColor}80, 0 4px 8px rgba(0, 0, 0, 0.4)`
                  : isClipHovered
                    ? `inset 0 1px 2px rgba(255, 255, 255, 0.2), 0 2px 4px rgba(0, 0, 0, 0.3)`
                    : `inset 0 1px 2px rgba(255, 255, 255, 0.15), 0 1px 2px rgba(0, 0, 0, 0.2)`,
                minHeight: '52px',
                opacity: isClipSelected ? 1 : isClipHovered ? 0.95 : 0.85,
                transition: 'all 0.2s ease',
                filter: isClipHovered && !isClipSelected ? 'brightness(1.15)' : 'brightness(1)',
                position: 'absolute',
                top: '50%',
                transform: 'translateY(-50%)',
                height: '52px',
                zIndex: isClipSelected ? 10 : 1,
                cursor: activeTool === 'slice' ? 'url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBvbHlsaW5lIHBvaW50cz0iMTAgMTggNiAyMiAzIDIyIDMgMTkgNyAxNSI+PC9wb2x5bGluZT48cGF0aCBkPSJNMjEgNGwtOSA5Ij48L3BhdGg+PHBhdGggZD0iTTE1IDdsNiA2Ij48L3BhdGg+PC9zdmc+") 12 12, crosshair' : 'default'
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (activeTool === 'slice') {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const beatOffset = x / pixelsPerBeat; // Relative beats
                  const splitPoint = clip.offset + beatOffset;
                  onSlice(track.id, idx, splitPoint);
                } else {
                  onSelect(clip);
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRemoveClip(track.id, idx);
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                onStartDrag(e, track.id, idx);
              }}
            >
              <div className="clip-header" style={{
                background: isClipSelected ? clipColor : `${clipColor}CC`,
                padding: '0 8px',
                fontSize: '10px',
                color: '#fff',
                fontWeight: 600,
                height: '18px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: 'flex',
                alignItems: 'center',
                letterSpacing: '0.01em',
                opacity: isClipSelected ? 1 : 0.9
              }}>
                <div className="clip-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '4px' }}>{clipName}</span>
                  <button
                    className="clip-menu-btn"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      const rect = e.currentTarget.getBoundingClientRect();
                      onSelect({ ...clip, trackId: track.id, clipIndex: idx }); // Select clip too
                      // setMenu
                      // We need to pass setMenu from TrackList? Or pass handler?
                      // Track component doesn't have setMenu.
                      // Better: Pass `onOpenMenu` prop to Track.
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      // The logic needs to be lifted or passed down. 
                      // I'll emit an event "onOpenMenu"
                      // See update below for Track Props.
                    }}
                    style={{
                      background: 'rgba(255, 255, 255, 0.1)',
                      border: 'none',
                      color: '#fff',
                      cursor: 'pointer',
                      padding: '2px 4px',
                      borderRadius: '2px',
                      transition: 'background 0.15s ease',
                      flexShrink: 0
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                  >
                    <ChevronDown size={10} color="#fff" className="blender-icon" />
                  </button>
                </div>
              </div>

              {/* Pattern Preview Area */}
              <div className="clip-content" style={{ flex: 1, position: 'relative', opacity: 0.8, padding: '4px' }}>
                {pattern && <PatternClipPreview
                  pattern={pattern}
                  startStep={(clip.startOffset || 0) * 4}
                  lengthStep={clip.length * 4}
                />}
              </div>

              {/* Resize Handle */}
              <div
                className="resize-handle"
                onPointerDown={(e) => onResizeStart(e, track.id, idx)}
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: '10px',
                  height: '100%',
                  cursor: 'ew-resize',
                  zIndex: 20
                }}
              />

              <button
                className="clip-delete"
                onClick={(e) => { e.stopPropagation(); onRemoveClip(track.id, idx); }}
                title="Delete clip"
                style={{
                  position: 'absolute',
                  top: '4px',
                  right: '4px',
                  background: 'rgba(0,0,0,0.6)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                  cursor: 'pointer',
                  zIndex: 10,
                  padding: '3px 6px',
                  borderRadius: '3px',
                  fontSize: '12px',
                  lineHeight: 1,
                  fontWeight: 600,
                  transition: 'all 0.15s ease',
                  opacity: 0.8
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.8)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '0.8';
                  e.currentTarget.style.background = 'rgba(0,0,0,0.6)';
                }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
});

const TrackList = React.memo(({ onSelectClip, pixelsPerBeat = 60, measures = 16, beatsPerBar = 4, playheadPosition = 0 }) => {
  const { playlistTracks, setPlaylistTracks, activePatternId, patterns, setActivePatternId, createPattern, audioClips, activeClipType, activeAudioClipId, activeTool, toggleTrackMute, toggleTrackSolo, createAutomation, automations, activeAutomationId, updateAutomationPoints, addChannel, addEffect } = useProject();
  const [selected, setSelected] = useState(null);

  // Menu State
  const [menu, setMenu] = useState(null); // { trackId, clipIndex, x, y, patternId }
  const [activeSubmenu, setActiveSubmenu] = useState(null);
  const menuRef = useRef(null);

  // Modal states for dialogs (replacing prompt())
  const [renameModal, setRenameModal] = useState({ open: false, trackId: null, clipIndex: null, currentName: '' });
  const [colorModal, setColorModal] = useState({ open: false, trackId: null, clipIndex: null, currentColor: '#3b82f6' });
  const [iconModal, setIconModal] = useState({ open: false, trackId: null, clipIndex: null });
  const [renameInput, setRenameInput] = useState('');
  const [colorInput, setColorInput] = useState('#3b82f6');

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenu(null);
      }
    };
    if (menu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menu]);

  // Menu Handlers
  // Helper function to generate random color
  const generateRandomColor = () => {
    const colors = [
      '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
      '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
      '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
      '#ec4899', '#f43f5e'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const handleMenuAction = (action) => {
    if (!menu) return;
    const { trackId, clipIndex, patternId, type, clip } = menu;

    if (action === 'delete') {
      removeClip(trackId, clipIndex);
    } else if (action === 'toggle_mute') {
      setPlaylistTracks(prev => prev.map(t => {
        if (t.id !== trackId) return t;
        const newClips = [...t.clips];
        const c = newClips[clipIndex];
        if (c) {
          newClips[clipIndex] = { ...c, muted: !c.muted };
        }
        return { ...t, clips: newClips };
      }));
    } else if (action === 'preview') {
      console.log('Preview audio clip:', clip?.name);
      // TODO: Integrate with AudioEngine to play preview
      if (clip && clip.audioClipId) {
        const audioClip = audioClips.find(ac => ac.id === clip.audioClipId);
        if (audioClip) {
          console.log('Playing preview for:', audioClip.name);
        }
      }
    } else if (action === 'rename') {
      const currentName = clip ? (clip.name || 'Clip') : 'Pattern';
      setRenameInput(currentName);
      setRenameModal({ open: true, trackId, clipIndex, currentName });
      return; // Don't close menu yet
    } else if (action === 'random_color') {
      const newColor = generateRandomColor();
      setPlaylistTracks(prev => prev.map(t => {
        if (t.id !== trackId) return t;
        const newClips = [...t.clips];
        if (newClips[clipIndex]) {
          newClips[clipIndex] = { ...newClips[clipIndex], color: newColor };
        }
        return { ...t, clips: newClips };
      }));
    } else if (action === 'change_color') {
      setColorInput(clip?.color || '#3b82f6');
      setColorModal({ open: true, trackId, clipIndex, currentColor: clip?.color || '#3b82f6' });
      return; // Don't close menu yet
    } else if (action === 'change_icon') {
      setIconModal({ open: true, trackId, clipIndex });
      return; // Don't close menu yet
    } else if (action === 'select_source_channel') {
      // Show available channels for routing
      console.log('Select source channel - would show channel picker');
    } else if (action === 'select_all_similar') {
      // Select all clips with the same audioClipId
      if (clip && clip.audioClipId) {
        const similarClips = [];
        playlistTracks.forEach(t => {
          t.clips.forEach((c, idx) => {
            if (c.audioClipId === clip.audioClipId) {
              similarClips.push({ trackId: t.id, clipIndex: idx });
            }
          });
        });
        console.log('Found similar clips:', similarClips);
        // TODO: Implement multi-selection state
      }
    } else if (action === 'extract_stems') {
      console.log('Extract stems from sample - AI feature');
      // TODO: Integrate with backend AI stem separation
    } else if (action === 'automate_volume') {
      if (type === 'audio' && clip) {
        createAutomation(clip.audioClipId, 'volume');
      }
    } else if (action === 'automate_panning') {
      if (type === 'audio' && clip) {
        createAutomation(clip.audioClipId, 'panning');
      }
    } else if (action === 'edit') {
      if (type === 'audio') {
        console.log('Edit sample - would open sample editor');
      } else {
        setActivePatternId(patternId);
      }
    } else {
      console.log('Menu action:', action);
    }

    setMenu(null);
  };




  const addClip = (trackId, offset, specificPatternId = null, specificType = null) => {
    // If painting (no specific ID/Type), use active context
    if (!specificPatternId && !specificType) {
      if (activeClipType === 'audio' && activeAudioClipId) {
        onAddAudioClip(trackId, offset, activeAudioClipId);
        return;
      } else if (activeClipType === 'automation' && activeAutomationId) {
        onAddAutomationClip(trackId, offset, activeAutomationId);
        return;
      }
    }

    // Default: Add Pattern Clip
    setPlaylistTracks(prev => prev.map(t => {
      if (t.id !== trackId) return t;

      const patId = specificPatternId || activePatternId || (patterns.length > 0 ? patterns[0].id : null);
      if (!patId) return t; // No pattern to add

      const pattern = patterns.find(p => p.id === patId);
      const length = pattern ? pattern.length : 16;
      const lengthBeats = length / 4;

      const newClip = {
        id: Date.now(),
        type: 'pattern',
        patternId: patId,
        offset: offset,
        length: lengthBeats
      };
      return { ...t, clips: [...t.clips, newClip] };
    }));
  };

  const onAddAudioClip = (trackId, offset, audioClipId) => {
    const audioClip = audioClips.find(ac => ac.id === audioClipId);
    if (!audioClip) return;

    setPlaylistTracks(prev => prev.map(t => {
      if (t.id !== trackId) return t;

      const newClip = {
        id: Date.now(),
        type: 'audio',
        audioClipId: audioClipId,
        offset: offset,
        length: audioClip.durationBeats,
        name: audioClip.name
      };
      return { ...t, clips: [...t.clips, newClip] };
    }));
  };

  const onAddAutomationClip = (trackId, offset, automationId) => {
    const automation = automations.find(a => a.id === automationId);
    console.log('Adding Automation:', automationId, automation);
    if (!automation) return;

    // Find target audio clip to get its duration
    let targetAudio = audioClips.find(ac => ac.id === automation.targetClipId);

    // Fallback: If not found, maybe targetClipId is an Instance ID (Legacy)
    if (!targetAudio) {
      console.warn("Target Audio Source not found directly. Checking for Instance ID...");
      // Flatten tracks to find clip
      for (const track of playlistTracks) {
        const foundClip = track.clips.find(c => c.id === automation.targetClipId);
        if (foundClip && foundClip.type === 'audio') {
          targetAudio = audioClips.find(ac => ac.id === foundClip.audioClipId);
          if (targetAudio) {
            console.log("Found Source via Instance ID:", targetAudio);
            break;
          }
        }
      }
    }

    const defaultLength = targetAudio ? targetAudio.durationBeats : 16;
    console.log('Target Audio:', targetAudio, 'Duration:', targetAudio?.durationBeats, 'Default:', defaultLength);

    setPlaylistTracks(prev => prev.map(t => {
      if (t.id !== trackId) return t;

      const newClip = {
        id: Date.now(),
        type: 'automation',
        automationId: automationId,
        offset: offset,
        length: defaultLength,
        name: automation.name
      };
      return { ...t, clips: [...t.clips, newClip] };
    }));
  };

  const removeClip = (trackId, clipIndex) => {
    setPlaylistTracks(prev => prev.map(t => {
      if (t.id !== trackId) return t;
      const newClips = t.clips.slice();
      newClips.splice(clipIndex, 1);
      return { ...t, clips: newClips };
    }));
  };

  const handleSlice = (trackId, clipIndex, splitPointBeats) => {
    setPlaylistTracks(prev => prev.map(t => {
      if (t.id !== trackId) return t;

      const clip = t.clips[clipIndex];
      // Check if split point is valid (inside clip, with buffer)
      if (splitPointBeats <= clip.offset + 0.01 || splitPointBeats >= clip.offset + clip.length - 0.01) {
        return t;
      }

      // 1. Calculate split details
      const splitOffset = splitPointBeats - clip.offset; // Relative to clip start
      const originalLength = clip.length;

      // 2. Modify original clip (First Half)
      const firstHalf = {
        ...clip,
        length: splitOffset
      };

      // 3. Create new clip (Second Half)
      const secondHalf = {
        ...clip,
        id: Date.now(), // New unique ID
        offset: clip.offset + splitOffset, // Starts at split point
        length: originalLength - splitOffset, // Remaining length
        startOffset: (clip.startOffset || 0) + splitOffset // Offset into the underlying pattern/audio
      };

      // 4. Update track clips
      const newClips = [...t.clips];
      newClips[clipIndex] = firstHalf;
      newClips.splice(clipIndex + 1, 0, secondHalf); // Insert second half after first

      return { ...t, clips: newClips };
    }));
  };

  const renameTrack = (trackId, newName) => {
    setPlaylistTracks(prev => prev.map(t => {
      if (t.id !== trackId) return t;
      return { ...t, name: newName };
    }));
  };

  const deleteTrack = (trackId) => {
    setPlaylistTracks(prev => prev.filter(t => t.id !== trackId));
  };

  // Drag/drop state
  const dragState = useRef({ dragging: false, trackId: null, clipIndex: null, startX: 0, origOffset: 0 });
  const dragClone = useRef(null);

  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, []);

  const onStartDrag = (e, trackId, clipIndex) => {
    if (e.button && e.button !== 0) return;
    const track = playlistTracks.find(t => t.id === trackId);
    if (!track) return;
    const clip = track.clips[clipIndex];
    if (!clip) return;

    e.preventDefault();
    dragState.current = {
      dragging: true,
      trackId,
      clipIndex,
      startX: e.clientX,
      origOffset: clip.offset
    };

    const pattern = patterns.find(p => p.id === clip.patternId);
    const clipName = pattern ? pattern.name : 'Pattern';

    const clone = document.createElement('div');
    clone.className = 'drag-clone';
    clone.style.position = 'fixed';
    clone.style.left = `${e.clientX}px`;
    clone.style.top = `${e.clientY}px`;
    clone.style.pointerEvents = 'none';
    clone.style.zIndex = 9999;
    clone.style.padding = '4px';
    clone.style.background = '#444';
    clone.style.color = '#fff';
    clone.style.borderRadius = '6px';
    clone.innerHTML = clipName;
    document.body.appendChild(clone);
    dragClone.current = clone;

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };


  // Resize state
  const resizeState = useRef({ resizing: false, trackId: null, clipIndex: null, startX: 0, startLength: 0, startOffset: 0, side: 'right' });

  const onResizeStart = (e, trackId, clipIndex, side = 'right') => {
    if (e.button && e.button !== 0) return;
    const track = playlistTracks.find(t => t.id === trackId);
    if (!track) return;
    const clip = track.clips[clipIndex];
    if (!clip) return;

    e.preventDefault();
    e.stopPropagation(); // Prevent drag start

    resizeState.current = {
      resizing: true,
      trackId,
      clipIndex,
      startX: e.clientX,
      startLength: clip.length,
      startOffset: clip.offset,
      side: side // 'left' or 'right'
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    document.body.style.cursor = 'ew-resize';
  };

  const onPointerMove = (e) => {
    const rs = resizeState.current;
    if (rs.resizing) {
      const deltaX = e.clientX - rs.startX;
      const deltaBeats = deltaX / pixelsPerBeat;

      if (rs.side === 'left') {
        // Resizing from left - adjust offset and length
        const newOffset = Math.max(0, rs.startOffset + deltaBeats);
        const newLength = Math.max(0.25, rs.startLength - deltaBeats);
        const snappedOffset = Math.round(newOffset * 4) / 4;
        const snappedLength = Math.round(newLength * 4) / 4;

        setPlaylistTracks(prev => prev.map(t => {
          if (t.id !== rs.trackId) return t;
          const newClips = [...t.clips];
          if (newClips[rs.clipIndex]) {
            newClips[rs.clipIndex] = {
              ...newClips[rs.clipIndex],
              offset: snappedOffset,
              length: snappedLength
            };
          }
          return { ...t, clips: newClips };
        }));
      } else {
        // Resizing from right - adjust length only
        const newLength = Math.max(0.25, rs.startLength + deltaBeats);
        const snappedLength = Math.round(newLength * 4) / 4;

        setPlaylistTracks(prev => prev.map(t => {
          if (t.id !== rs.trackId) return t;
          const newClips = [...t.clips];
          if (newClips[rs.clipIndex]) {
            newClips[rs.clipIndex] = { ...newClips[rs.clipIndex], length: snappedLength };
          }
          return { ...t, clips: newClips };
        }));
      }
      return;
    }

    const ds = dragState.current;
    if (!ds.dragging) return;
    if (dragClone.current) {
      dragClone.current.style.left = `${e.clientX + 8}px`;
      dragClone.current.style.top = `${e.clientY + 8}px`;
    }
  };

  const onPointerUp = (e) => {
    const rs = resizeState.current;
    if (rs.resizing) {
      resizeState.current = { resizing: false, trackId: null, clipIndex: null };
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      document.body.style.cursor = '';
      return;
    }

    const ds = dragState.current;
    if (!ds.dragging) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const trackEl = el?.closest?.('[data-track-id]');
    const targetTrackId = trackEl ? Number(trackEl.getAttribute('data-track-id')) : ds.trackId;

    const clipArea = trackEl ? trackEl.querySelector('.track-clip-area') : null;
    let newOffset = ds.origOffset;
    if (clipArea) {
      const rect = clipArea.getBoundingClientRect();
      const relativeX = Math.max(0, e.clientX - rect.left);
      newOffset = Math.round(relativeX / pixelsPerBeat);
    }

    setPlaylistTracks(prev => {
      let movingClip = null;
      let originalTrack = null;

      // Remove from source
      const afterRemove = prev.map(t => {
        if (t.id !== ds.trackId) return t;
        originalTrack = t;
        const newClips = t.clips.slice();
        movingClip = newClips.splice(ds.clipIndex, 1)[0];
        return { ...t, clips: newClips };
      });

      if (!movingClip) return prev;
      movingClip.offset = newOffset;

      // Add to target
      return afterRemove.map(t => {
        if (t.id !== targetTrackId) return t;
        return { ...t, clips: [...t.clips, movingClip] };
      });
    });

    dragState.current = { dragging: false, trackId: null, clipIndex: null };
    if (dragClone.current) { document.body.removeChild(dragClone.current); dragClone.current = null; }
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  };



  return (
    <div className="tracklist">
      {playlistTracks.map((track) => (
        <Track
          key={track.id}
          track={track}
          onToggleMute={toggleTrackMute}
          onToggleSolo={toggleTrackSolo}
          onAddClip={addClip}
          onAddAudioClip={onAddAudioClip}
          onAddAutomationClip={onAddAutomationClip}
          updateAutomationPoints={updateAutomationPoints}
          onRemoveClip={removeClip}
          onStartDrag={onStartDrag}
          onResizeStart={onResizeStart}
          onSelect={setSelected}
          pixelsPerBeat={pixelsPerBeat}
          measures={measures}
          beatsPerBar={beatsPerBar}
          patterns={patterns}
          audioClips={audioClips}
          automations={automations}
          selected={selected}
          onOpenMenu={setMenu}
          onRenameTrack={renameTrack}
          onDeleteTrack={deleteTrack}
          activeTool={activeTool}
          onSlice={handleSlice}
          onAddChannel={addChannel}
          onAddEffect={addEffect}
        />
      ))}

      {menu && (
        <div
          className="clip-menu"
          style={{
            left: menu.x,
            top: menu.y,
            minWidth: '280px',
            maxHeight: '800px',
            overflowY: 'auto',
            background: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '2px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)',
            padding: '2px 0',
            color: '#d1d5db',
            fontFamily: 'Segoe UI, sans-serif',
            fontSize: '12px',
            zIndex: 1000,
            position: 'fixed'
          }}
          ref={menuRef}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {menu.type === 'audio' ? (
            <>
              {/* Audio Clip Header Section */}
              <div className="clip-menu-header" style={{ color: '#60a5fa', padding: '4px 12px', fontWeight: 600, opacity: 0.8 }}>Audio clip</div>

              <div className="clip-menu-item" onClick={() => handleMenuAction('preview')}
                style={{ padding: '4px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.1s' }}>
                Preview
              </div>
              <div className="clip-menu-item" onClick={() => handleMenuAction('toggle_mute')}
                style={{ padding: '4px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.1s' }}>
                <div style={{ width: '16px', display: 'flex', justifyContent: 'center', marginRight: '4px' }}>
                  {/* Checkmark logic would go here */}
                </div>
                Muted
              </div>

              <div className="clip-menu-separator" style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0', opacity: 0.5 }}></div>

              <div className="clip-menu-item" onClick={() => handleMenuAction('rename')}
                style={{ padding: '4px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.1s' }}>
                Rename and color...
              </div>
              <div className="clip-menu-item" onClick={() => handleMenuAction('random_color')}
                style={{ padding: '4px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.1s' }}>
                Random color
              </div>
              <div className="clip-menu-item" onClick={() => handleMenuAction('change_color')}
                style={{ padding: '4px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.1s' }}>
                Change color...
              </div>
              <div className="clip-menu-item" onClick={() => handleMenuAction('change_icon')}
                style={{ padding: '4px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.1s' }}>
                Change icon...
              </div>

              <div className="clip-menu-separator" style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0', opacity: 0.5 }}></div>

              <div className="clip-menu-item" onClick={() => handleMenuAction('select_source_channel')}
                style={{ justifyContent: 'space-between', padding: '4px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.1s' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                Select source channel <ChevronDown size={10} style={{ transform: 'rotate(-90deg)', color: '#d1d5db' }} />
              </div>
              <div className="clip-menu-item" onClick={() => handleMenuAction('select_all_similar')}
                style={{ padding: '4px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.1s' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                Select all similar clips
              </div>
              <div className="clip-menu-item" onClick={() => handleMenuAction('delete')}
                style={{ padding: '4px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.1s' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                Delete
              </div>

              <div className="clip-menu-separator" style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0', opacity: 0.5 }}></div>
              <div className="clip-menu-item" onClick={() => handleMenuAction('extract_stems')}
                style={{ padding: '4px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.1s' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                Extract stems from sample
              </div>

              {/* Automation Section */}
              <div className="clip-menu-header" style={{ marginTop: '4px', color: '#60a5fa', padding: '4px 12px', fontWeight: 600, opacity: 0.8 }}>Automation</div>
              <div className="clip-menu-item"
                onClick={(e) => { e.stopPropagation(); setActiveSubmenu(activeSubmenu === 'automation' ? null : 'automation'); }}
                style={{ justifyContent: 'space-between', padding: '4px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.1s' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                Automate <ChevronDown size={10} style={{ transform: activeSubmenu === 'automation' ? 'rotate(0deg)' : 'rotate(-90deg)', color: '#d1d5db', transition: 'transform 0.2s' }} />
              </div>
              {activeSubmenu === 'automation' && (
                <div style={{ background: 'rgba(0,0,0,0.2)', paddingBottom: '4px' }}>
                  <div className="clip-menu-item" onClick={() => handleMenuAction('automate_volume')}
                    style={{ padding: '4px 12px 4px 24px', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '11px', color: '#9ca3af' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.color = '#fff' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9ca3af' }}>
                    Volume
                  </div>
                  <div className="clip-menu-item" onClick={() => handleMenuAction('automate_panning')}
                    style={{ padding: '4px 12px 4px 24px', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: '11px', color: '#9ca3af' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'; e.currentTarget.style.color = '#fff' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#9ca3af' }}>
                    Panning
                  </div>
                </div>
              )}
              <div className="clip-menu-item" style={{ color: '#6b7280', padding: '4px 12px', cursor: 'default', display: 'flex', alignItems: 'center' }}>Crossfade with</div>

              {/* Fades Section */}
              <div className="clip-menu-header" style={{ marginTop: '4px', color: '#60a5fa', padding: '4px 12px', fontWeight: 600, opacity: 0.8 }}>Fades</div>
              <div className="clip-menu-item" style={{ padding: '4px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.1s' }}>Reset fades</div>
              <div className="clip-menu-item" style={{ justifyContent: 'space-between', padding: '4px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.1s' }}>
                Fade in curve <ChevronDown size={10} style={{ transform: 'rotate(-90deg)', color: '#d1d5db' }} />
              </div>
              <div className="clip-menu-item" style={{ justifyContent: 'space-between', padding: '4px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.1s' }}>
                Fade out curve <ChevronDown size={10} style={{ transform: 'rotate(-90deg)', color: '#d1d5db' }} />
              </div>

              {/* Region Section */}
              <div className="clip-menu-header" style={{ marginTop: '4px', color: '#60a5fa', padding: '4px 12px', fontWeight: 600, opacity: 0.8 }}>Region</div>
              <div className="clip-menu-item" style={{ justifyContent: 'space-between', padding: '4px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.1s' }}>
                Select region <ChevronDown size={10} style={{ transform: 'rotate(-90deg)', color: '#d1d5db' }} />
              </div>
              <div className="clip-menu-item" style={{ justifyContent: 'space-between', padding: '4px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.1s' }}>
                Chop <ChevronDown size={10} style={{ transform: 'rotate(-90deg)', color: '#d1d5db' }} />
              </div>
            </>
          ) : (
            <>
              {/* Pattern Menu - keeping dark or matching? Let's match for consistency but use existing logic if simpler. */}
              {/* Pattern menu was relying on global CSS .clip-menu probably. Let's start with matching Audio clip style roughly */}
              <div className="clip-menu-header" style={{ color: '#60a5fa', padding: '4px 12px', fontWeight: 600 }}>Pattern Clip</div>
              <div className="clip-menu-item" onClick={() => handleMenuAction('edit')} style={{ padding: '4px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.1s' }}>
                <Edit size={12} color="#000" className="blender-icon" style={{ marginRight: '6px' }} /> Edit pattern
              </div>
              <div className="clip-menu-separator" style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0', opacity: 0.5 }}></div>
              <div className="clip-menu-item" onClick={() => handleMenuAction('rename')} style={{ padding: '4px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.1s' }}>
                <Palette size={12} color="#000" className="blender-icon" style={{ marginRight: '6px' }} /> Rename and color...
              </div>
              <div className="clip-menu-item" onClick={() => handleMenuAction('make_unique')} style={{ padding: '4px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.1s' }}>
                <Copy size={12} color="#000" className="blender-icon" style={{ marginRight: '6px' }} /> Make unique
              </div>
              <div className="clip-menu-separator" style={{ height: '1px', background: 'rgba(255,255,255,0.1)', margin: '4px 0', opacity: 0.5 }}></div>
              <div className="clip-menu-item" onClick={() => handleMenuAction('delete')} style={{ padding: '4px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.1s' }}>
                <Trash size={12} color="#000" className="blender-icon" style={{ marginRight: '6px' }} /> Delete
              </div>
            </>
          )}
        </div>
      )}

      {/* Add Track Row */}
      <div className="track-row add-track-row" style={{
        display: 'flex',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        minHeight: '64px',
        position: 'relative',
        cursor: 'pointer',
        transition: 'background 0.15s ease'
      }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
        }}
        onClick={() => {
          setPlaylistTracks(prev => [
            ...prev,
            { id: prev.length + 1, name: `Track ${prev.length + 1}`, clips: [] }
          ]);
        }}
      >
        <div className="track-header" style={{
          background: 'transparent',
          borderBottom: 'none',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          padding: '0 12px',
          minHeight: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxSizing: 'border-box',
          width: '140px',
          flexShrink: 0
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: '#9ca3af',
            fontSize: '13px',
            fontWeight: 500,
            letterSpacing: '0.01em'
          }}>
            <Plus size={18} color="#9ca3af" className="blender-icon" />
            <span>Add Track</span>
          </div>
        </div>
        <div className="track-clip-area" style={{
          flex: 1,
          position: 'relative',
          overflow: 'visible',
          background: '#14181C',
          minWidth: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderLeft: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
          <div style={{
            color: '#6b7280',
            fontSize: '12px',
            letterSpacing: '0.01em',
            userSelect: 'none'
          }}>
            Click to add a new track
          </div>
        </div>
      </div>

      {/* Rename Modal */}
      {renameModal.open && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }} onClick={() => setRenameModal({ open: false, trackId: null, clipIndex: null, currentName: '' })}>
          <div style={{
            background: '#1f2937',
            padding: '20px',
            borderRadius: '8px',
            minWidth: '300px',
            border: '1px solid #374151'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px 0', color: '#fff', fontSize: '14px' }}>Rename Clip</h3>
            <input
              type="text"
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                background: '#374151',
                border: '1px solid #4b5563',
                borderRadius: '4px',
                color: '#fff',
                fontSize: '13px',
                boxSizing: 'border-box'
              }}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setPlaylistTracks(prev => prev.map(t => {
                    if (t.id !== renameModal.trackId) return t;
                    const newClips = [...t.clips];
                    if (newClips[renameModal.clipIndex]) {
                      newClips[renameModal.clipIndex] = { ...newClips[renameModal.clipIndex], name: renameInput };
                    }
                    return { ...t, clips: newClips };
                  }));
                  setRenameModal({ open: false, trackId: null, clipIndex: null, currentName: '' });
                  setMenu(null);
                } else if (e.key === 'Escape') {
                  setRenameModal({ open: false, trackId: null, clipIndex: null, currentName: '' });
                }
              }}
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setRenameModal({ open: false, trackId: null, clipIndex: null, currentName: '' })}
                style={{ padding: '6px 16px', background: '#374151', border: 'none', borderRadius: '4px', color: '#9ca3af', cursor: 'pointer' }}
              >Cancel</button>
              <button
                onClick={() => {
                  setPlaylistTracks(prev => prev.map(t => {
                    if (t.id !== renameModal.trackId) return t;
                    const newClips = [...t.clips];
                    if (newClips[renameModal.clipIndex]) {
                      newClips[renameModal.clipIndex] = { ...newClips[renameModal.clipIndex], name: renameInput };
                    }
                    return { ...t, clips: newClips };
                  }));
                  setRenameModal({ open: false, trackId: null, clipIndex: null, currentName: '' });
                  setMenu(null);
                }}
                style={{ padding: '6px 16px', background: '#3b82f6', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}
              >Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Color Modal */}
      {colorModal.open && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }} onClick={() => setColorModal({ open: false, trackId: null, clipIndex: null, currentColor: '#3b82f6' })}>
          <div style={{
            background: '#1f2937',
            padding: '20px',
            borderRadius: '8px',
            minWidth: '300px',
            border: '1px solid #374151'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px 0', color: '#fff', fontSize: '14px' }}>Choose Color</h3>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
              {['#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'].map(color => (
                <div
                  key={color}
                  onClick={() => {
                    setPlaylistTracks(prev => prev.map(t => {
                      if (t.id !== colorModal.trackId) return t;
                      const newClips = [...t.clips];
                      if (newClips[colorModal.clipIndex]) {
                        newClips[colorModal.clipIndex] = { ...newClips[colorModal.clipIndex], color };
                      }
                      return { ...t, clips: newClips };
                    }));
                    setColorModal({ open: false, trackId: null, clipIndex: null, currentColor: '#3b82f6' });
                    setMenu(null);
                  }}
                  style={{
                    width: '32px',
                    height: '32px',
                    background: color,
                    borderRadius: '4px',
                    cursor: 'pointer',
                    border: colorInput === color ? '2px solid #fff' : '2px solid transparent'
                  }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="color"
                value={colorInput}
                onChange={(e) => setColorInput(e.target.value)}
                style={{ width: '40px', height: '32px', border: 'none', cursor: 'pointer' }}
              />
              <input
                type="text"
                value={colorInput}
                onChange={(e) => setColorInput(e.target.value)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  background: '#374151',
                  border: '1px solid #4b5563',
                  borderRadius: '4px',
                  color: '#fff',
                  fontSize: '13px'
                }}
                placeholder="#hex or color name"
              />
              <button
                onClick={() => {
                  setPlaylistTracks(prev => prev.map(t => {
                    if (t.id !== colorModal.trackId) return t;
                    const newClips = [...t.clips];
                    if (newClips[colorModal.clipIndex]) {
                      newClips[colorModal.clipIndex] = { ...newClips[colorModal.clipIndex], color: colorInput };
                    }
                    return { ...t, clips: newClips };
                  }));
                  setColorModal({ open: false, trackId: null, clipIndex: null, currentColor: '#3b82f6' });
                  setMenu(null);
                }}
                style={{ padding: '8px 16px', background: '#3b82f6', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer' }}
              >Apply</button>
            </div>
          </div>
        </div>
      )}

      {/* Icon Modal */}
      {iconModal.open && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000
        }} onClick={() => setIconModal({ open: false, trackId: null, clipIndex: null })}>
          <div style={{
            background: '#1f2937',
            padding: '20px',
            borderRadius: '8px',
            minWidth: '280px',
            border: '1px solid #374151'
          }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px 0', color: '#fff', fontSize: '14px' }}>Choose Icon</h3>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {['🎵', '🎹', '🥁', '🎸', '🎺', '🎻', '🎤', '🔊', '💿', '🎧', '🎼', '🎶', '🔉', '📻', '🎚️', '🎛️'].map(icon => (
                <div
                  key={icon}
                  onClick={() => {
                    setPlaylistTracks(prev => prev.map(t => {
                      if (t.id !== iconModal.trackId) return t;
                      const newClips = [...t.clips];
                      if (newClips[iconModal.clipIndex]) {
                        newClips[iconModal.clipIndex] = { ...newClips[iconModal.clipIndex], icon };
                      }
                      return { ...t, clips: newClips };
                    }));
                    setIconModal({ open: false, trackId: null, clipIndex: null });
                    setMenu(null);
                  }}
                  style={{
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '24px',
                    background: '#374151',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#4b5563'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#374151'}
                >
                  {icon}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default TrackList;
