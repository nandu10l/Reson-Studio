import React, { useState, useRef, useEffect } from 'react';
import '../styles/reson.css';

export default function ResonTrackList({ tracks = [], scrollLeft = 0, onSelectClip, onUpdateTracks }) {
  const defaultTracks = tracks.length ? tracks : [
    { id: 1, name: 'Drums', clips: [{ title: 'Loop A', offset: 0, length: 4 }] },
    { id: 2, name: 'Bass', clips: [{ title: 'Bassline', offset: 0, length: 8 }] },
  ];

  const [localTracks, setLocalTracks] = useState(defaultTracks);
  const dragState = useRef({ dragging: false, trackId: null, clipIndex: null, startX: 0, origOffset: 0 });
  const dragClone = useRef(null);
  const tracklistRef = useRef(null);

  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, []);

  const onStartDrag = (e, trackId, clipIndex) => {
    if (e.button && e.button !== 0) return;
    const track = localTracks.find(t => t.id === trackId);
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

    const clone = document.createElement('div');
    clone.className = 'reson-drag-clone';
    clone.style.position = 'fixed';
    clone.style.left = `${e.clientX}px`;
    clone.style.top = `${e.clientY}px`;
    clone.style.pointerEvents = 'none';
    clone.style.width = `${clip.length * 60}px`;
    clone.innerHTML = `<div class="reson-clip-title">${clip.title}</div>`;
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

    const clipArea = trackEl ? trackEl.querySelector('.reson-track-clips') : null;
    let newOffset = ds.origOffset;
    if (clipArea) {
      const rect = clipArea.getBoundingClientRect();
      // Convert clientX into content coordinates accounting for the applied translateX(-scrollLeft)
      const contentX = e.clientX - rect.left - scrollLeft;
      newOffset = Math.max(0, contentX / 60);
    }

    setLocalTracks(prev => {
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

    dragState.current = { dragging: false, trackId: null, clipIndex: null, startX: 0, origOffset: 0 };
    if (dragClone.current) { document.body.removeChild(dragClone.current); dragClone.current = null; }
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  };

  function handleSelect(c, trackId, clipIndex) {
    onSelectClip?.({ clip: c, trackId, clipIndex });
  }

  const addClip = (trackId, offset = 0) => {
    const newClip = {
      title: `Clip ${Date.now()}`,
      offset: offset,
      length: 4
    };

    setLocalTracks(prev => prev.map(t => {
      if (t.id !== trackId) return t;
      return { ...t, clips: [...t.clips, newClip] };
    }));

    // Notify parent component of track updates
    onUpdateTracks?.(localTracks);
  };

  const handleTrackClick = (e, trackId) => {
    // Only add clip if clicking on empty space in track clips area
    if (e.target.classList.contains('reson-track-clips') || e.target.classList.contains('reson-track-grid')) {
      const rect = e.currentTarget.querySelector('.reson-track-clips').getBoundingClientRect();
      const contentX = e.clientX - rect.left - scrollLeft;
      const offset = Math.max(0, contentX / 60);
      addClip(trackId, offset);
    }
  };

  return (
    <div className="reson-tracklist" ref={tracklistRef}>
      {localTracks.map((t) => (
        <div key={t.id} className="reson-track-row" data-track-id={t.id} onClick={(e) => handleTrackClick(e, t.id)}>
          <div className="reson-track-header">{t.name}</div>
          <div className="reson-track-clips" style={{ transform: `translateX(-${scrollLeft}px)` }}>
            <div className="reson-track-grid" />
            {t.clips.map((c, idx) => (
              <div
                className="reson-clip"
                key={idx}
                style={{ left: `${c.offset * 60}px`, width: `${c.length * 60}px` }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelect(c, t.id, idx);
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onStartDrag(e, t.id, idx);
                }}
              >
                <div className="reson-clip-title">{c.title}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

