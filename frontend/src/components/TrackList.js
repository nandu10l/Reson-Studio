import React, { useState, useRef, useEffect } from 'react';
import { Mic, Guitar, Drumstick, Piano, Volume2, Volume1, VolumeX, Radio, Plus, Grid3x3 } from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';

import PatternClipPreview from './PatternClipPreview';

function Track({ track, onSelect, trackState, onToggleState, onAddClip, onRemoveClip, onStartDrag, pixelsPerBeat, measures, beatsPerBar, patterns }) {
  const TrackIcon = track.icon || Grid3x3;

  return (
    <div className="track-row" data-track-id={track.id}>
      <div className="track-header" style={{ borderLeft: `3px solid ${track.color || '#444'}` }}>
        <div className="track-controls">
          <button
            className={'track-button' + (trackState.muted ? ' active' : '')}
            onClick={() => onToggleState('muted')}
            title="Mute"
          >
            {trackState.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
          <button
            className={'track-button' + (trackState.soloed ? ' active' : '')}
            onClick={() => onToggleState('soloed')}
            title="Solo"
          >
            <Volume1 size={14} />
          </button>
          <button
            className={'track-button' + (trackState.armed ? ' active' : '')}
            onClick={() => onToggleState('armed')}
            title="Record Arm"
          >
            <Radio size={14} />
          </button>
        </div>

        <div className="track-name">
          <div className="track-icon">
            <TrackIcon size={14} />
          </div>
          {track.name}
        </div>
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
          {[...Array(measures * beatsPerBar)].map((_, i) => (
            <div key={i} className="grid-line" style={{ width: `${pixelsPerBeat}px` }} />
          ))}
        </div>
        {track.clips.map((clip, idx) => {
          const pattern = patterns.find(p => p.id === clip.patternId);
          const clipName = pattern ? pattern.name : `Pattern ${clip.patternId}`;
          const clipColor = pattern ? pattern.color : '#ccc';

          return (
            <div
              key={idx}
              className="track-clip"
              style={{
                left: `${clip.offset * pixelsPerBeat}px`,
                width: `${clip.length * pixelsPerBeat}px`,
                background: `${clipColor}80`,
                borderColor: clipColor,
                borderWidth: '1px',
                borderStyle: 'solid',
                borderRadius: '4px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(clip);
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
              <div className="clip-header" style={{ background: clipColor, padding: '2px 4px', fontSize: '10px', color: '#fff', fontWeight: 600, height: '18px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {clipName}
              </div>

              {/* Pattern Preview Area */}
              <div className="clip-content" style={{ flex: 1, position: 'relative', opacity: 0.8 }}>
                {pattern && <PatternClipPreview pattern={pattern} />}
              </div>

              <button
                className="clip-delete"
                onClick={(e) => { e.stopPropagation(); onRemoveClip(track.id, idx); }}
                title="Delete clip"
                style={{ position: 'absolute', top: '2px', right: '2px', background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', zIndex: 10, padding: 0, lineHeight: 1 }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function TrackList({ onSelectClip, pixelsPerBeat = 60, measures = 16, beatsPerBar = 4 }) {
  const { playlistTracks, setPlaylistTracks, activePatternId, patterns } = useProject();
  const [selected, setSelected] = useState(null);

  // Local UI state for mute/solo/arm
  const [trackStates, setTrackStates] = useState({});

  const ensureTrackState = (trackId) => {
    if (!trackStates[trackId]) {
      setTrackStates(prev => ({
        ...prev,
        [trackId]: { muted: false, soloed: false, armed: false }
      }));
    }
    return trackStates[trackId] || { muted: false, soloed: false, armed: false };
  };

  const addClip = (trackId, offset, specificPatternId = null) => {
    setPlaylistTracks(prev => prev.map(t => {
      if (t.id !== trackId) return t;

      const patId = specificPatternId || activePatternId;
      const pattern = patterns.find(p => p.id === patId);
      const length = pattern ? pattern.length : 16;

      const lengthBeats = length / 4;

      const newClip = {
        id: Date.now(),
        patternId: patId,
        offset: offset,
        length: lengthBeats
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
    clone.style.borderRadius = '4px';
    clone.innerHTML = clipName;
    document.body.appendChild(clone);
    dragClone.current = clone;

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const onPointerMove = (e) => {
    const ds = dragState.current;
    if (!ds.dragging) return;
    if (dragClone.current) {
      dragClone.current.style.left = `${e.clientX + 8}px`;
      dragClone.current.style.top = `${e.clientY + 8}px`;
    }
  };

  const onPointerUp = (e) => {
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

  const toggleTrackState = (trackId, state) => {
    setTrackStates(prev => ({
      ...prev,
      [trackId]: { ...prev[trackId], [state]: !prev[trackId]?.[state] ? true : !prev[trackId][state] }
    }));
  };

  return (
    <div className="tracklist">
      {playlistTracks.map((track) => (
        <Track
          key={track.id}
          track={track}
          trackState={ensureTrackState(track.id)}
          onToggleState={(state) => toggleTrackState(track.id, state)}
          onAddClip={addClip}
          onRemoveClip={removeClip}
          onStartDrag={onStartDrag}
          onSelect={setSelected}
          pixelsPerBeat={pixelsPerBeat}
          measures={measures}
          beatsPerBar={beatsPerBar}
          patterns={patterns}
        />
      ))}
      <button
        className="add-track-button"
        onClick={() => {
          setPlaylistTracks(prev => [
            ...prev,
            { id: prev.length + 1, name: `Track ${prev.length + 1}`, clips: [] }
          ]);
        }}
        title="Add New Track"
        style={{ color: 'var(--text-secondary)', background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <Plus size={20} />
        Add Track
      </button>
    </div>
  );
}
