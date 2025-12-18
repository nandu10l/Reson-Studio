import React, { useState, useRef, useEffect } from 'react';
import { Mic, Guitar, Drumstick, Piano, Volume2, Volume1, VolumeX, Radio, Plus } from 'lucide-react';
import TrackClip from './TrackClip';

function Track({ track, onSelect, trackState, onToggleState, onAddClip, onRemoveClip, onStartDrag, pixelsPerBeat, measures, beatsPerBar }) {
  const TrackIcon = track.icon || Piano;

  return (
    <div className="track-row" data-track-id={track.id}>
      <div className="track-header" style={{ borderLeft: `3px solid ${track.color || 'var(--primary)'}` }}>
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

        <div className="track-fader">
          <div className="track-fader-thumb" style={{ left: '75%' }} />
        </div>
        <div className="track-pan">
          <div className="track-pan-thumb" style={{ left: '50%' }} />
        </div>
      </div>

      <div
        className="track-clip-area"
        style={{ minWidth: `${measures * beatsPerBar * pixelsPerBeat}px` }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          // Paint clip at position
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
        {track.clips.map((clip, idx) => (
          <div
            key={idx}
            className="track-clip"
            style={{
              left: `${clip.offset * pixelsPerBeat}px`,
              width: `${clip.length * pixelsPerBeat}px`,
              background: track.color ? `${track.color}40` : undefined, // 25% opacity
              borderColor: track.color || undefined,
            }}
            onClick={(e) => {
              e.stopPropagation(); // Prevent parent adding new clip
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
            <button
              className="clip-delete"
              onClick={(e) => { e.stopPropagation(); onRemoveClip(track.id, idx); }}
              title="Delete clip"
            >
              ×
            </button>
            <div className="clip-title">{clip.title}</div>
            <div className="clip-waveform">
              <svg className="waveform-svg" viewBox="0 0 100 30">
                <path
                  d="M0 15 Q25 5, 50 15 T100 15"
                  fill="none"
                  stroke="var(--primary-light)"
                  strokeWidth="1.5"
                />
              </svg>
            </div>
          </div>
        ))}

        <button className="add-clip-inline" onClick={(e) => { e.stopPropagation(); onAddClip(track.id, 0); }} title="Add clip start">+ Clip</button>
      </div>
    </div>
  );
}

export default function TrackList({ onSelectClip, pixelsPerBeat = 60, measures = 16, beatsPerBar = 4 }) {
  const [selected, setSelected] = useState(null);

  const defaultTracks = [
    {
      id: 1,
      name: 'Drums',
      icon: Drumstick,
      color: '#f97316', // Orange
      clips: [
        { title: 'Loop A', offset: 0, length: 4 },
        { title: 'Fill', offset: 6, length: 2 }
      ]
    },
    {
      id: 2,
      name: 'Bass',
      icon: Guitar,
      color: '#0ea5e9', // Sky Blue
      clips: [
        { title: 'Bassline', offset: 0, length: 8 }
      ]
    },
    {
      id: 3,
      name: 'Keys',
      icon: Piano,
      color: '#22c55e', // Green
      clips: [
        { title: 'Chords', offset: 2, length: 8 }
      ]
    },
    {
      id: 4,
      name: 'Vocals',
      icon: Mic,
      color: '#a855f7', // Purple
      clips: [
        { title: 'Lead', offset: 2, length: 6 }
      ]
    }
  ];

  const [tracks, setTracks] = useState(defaultTracks);

  const [trackStates, setTrackStates] = useState(
    defaultTracks.reduce((acc, track) => ({
      ...acc,
      [track.id]: { muted: false, soloed: false, armed: false }
    }), {})
  );

  const addNewTrack = () => {
    const newTrack = {
      id: tracks.length + 1,
      name: `Track ${tracks.length + 1}`,
      icon: Piano,
      color: '#64748b',
      clips: []
    };
    setTracks([...tracks, newTrack]);
    setTrackStates(prev => ({
      ...prev,
      [newTrack.id]: { muted: false, soloed: false, armed: false }
    }));
  };

  const addClip = (trackId, offset) => {
    setTracks(prev => prev.map(t => {
      if (t.id !== trackId) return t;
      const nextIndex = t.clips.length + 1;
      const newClip = { title: `Clip ${nextIndex}`, offset: offset ?? 0, length: 4 };
      return { ...t, clips: [...t.clips, newClip] };
    }));
  };

  const removeClip = (trackId, clipIndex) => {
    setTracks(prev => prev.map(t => {
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
      // cleanup any global listeners
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
    // Intentionally run once on mount/unmount; listeners are registered per drag start.
  }, []);

  const onStartDrag = (e, trackId, clipIndex) => {
    // only left button
    if (e.button && e.button !== 0) return;
    const track = tracks.find(t => t.id === trackId);
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

    // create clone element
    const clone = document.createElement('div');
    clone.className = 'drag-clone';
    clone.style.position = 'fixed';
    clone.style.left = `${e.clientX}px`;
    clone.style.top = `${e.clientY}px`;
    clone.style.pointerEvents = 'none';
    clone.style.width = `${clip.length * pixelsPerBeat}px`;
    clone.innerHTML = `<div class="clip-title">${clip.title}</div>`;
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
    // determine target track by element under pointer
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const trackEl = el?.closest?.('[data-track-id]');
    const targetTrackId = trackEl ? Number(trackEl.getAttribute('data-track-id')) : ds.trackId;

    // compute new offset based on pointer x relative to track clip area
    const clipArea = trackEl ? trackEl.querySelector('.track-clip-area') : null;
    let newOffset = ds.origOffset;
    if (clipArea) {
      const rect = clipArea.getBoundingClientRect();
      const relativeX = Math.max(0, e.clientX - rect.left);
      newOffset = Math.round(relativeX / pixelsPerBeat);
    }

    // move clip in state
    setTracks(prev => {
      let movingClip = null;
      const removed = prev.map(t => {
        if (t.id !== ds.trackId) return t;
        const newClips = t.clips.slice();
        movingClip = newClips.splice(ds.clipIndex, 1)[0];
        return { ...t, clips: newClips };
      });
      if (!movingClip) return prev;
      movingClip.offset = newOffset;
      return removed.map(t => {
        if (t.id !== targetTrackId) return t;
        return { ...t, clips: [...t.clips, movingClip] };
      });
    });

    // cleanup
    dragState.current = { dragging: false, trackId: null, clipIndex: null };
    if (dragClone.current) { document.body.removeChild(dragClone.current); dragClone.current = null; }
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  };

  const toggleTrackState = (trackId, state) => {
    setTrackStates(prev => ({
      ...prev,
      [trackId]: { ...prev[trackId], [state]: !prev[trackId][state] }
    }));
  };

  function handleSelect(c) {
    setSelected(c);
    onSelectClip?.(c);
  }

  return (
    <div className="tracklist">
      {tracks.map((track) => (
        <Track
          key={track.id}
          track={track}
          trackState={trackStates[track.id]}
          onToggleState={(state) => toggleTrackState(track.id, state)}
          onAddClip={addClip}
          onRemoveClip={removeClip}
          onStartDrag={onStartDrag}
          onSelect={handleSelect}
          pixelsPerBeat={pixelsPerBeat}
          measures={measures}
          beatsPerBar={beatsPerBar}
        />
      ))}
      <button
        className="add-track-button"
        onClick={addNewTrack}
        title="Add New Track"
        style={{ color: 'var(--text-secondary)', background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <Plus size={20} />
        Add Track
      </button>
    </div>
  );
}
