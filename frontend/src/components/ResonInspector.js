import React, { useState, useEffect } from 'react';
import '../styles/reson.css';

export default function ResonInspector({ selected, onUpdateClip }) {
  // `selected` is expected to be { trackId, clip, clipIndex }
  const [offset, setOffset] = useState(0);
  const [length, setLength] = useState(0);

  useEffect(() => {
    if (selected?.clip) {
      setOffset(selected.clip.offset ?? 0);
      setLength(selected.clip.length ?? 0);
    }
  }, [selected]);

  const applyChanges = () => {
    if (!selected) return;
    onUpdateClip?.({ trackId: selected.trackId, clipIndex: selected.clipIndex, newClip: { offset: Number(offset), length: Number(length) } });
  };

  return (
    <aside className="reson-inspector">
      <h3 className="inspector-title">Inspector</h3>
      {selected && selected.clip ? (
        <div className="inspector-content">
          <div><strong>Clip:</strong> {selected.clip.title}</div>
          <div>
            <label>Offset: <input type="number" value={offset} onChange={(e) => setOffset(e.target.value)} /></label>
          </div>
          <div>
            <label>Length: <input type="number" value={length} onChange={(e) => setLength(e.target.value)} /></label>
          </div>
          <div style={{ marginTop: 8 }}>
            <button className="btn small" onClick={applyChanges}>Apply</button>
          </div>
        </div>
      ) : (
        <div className="inspector-empty">No selection</div>
      )}
    </aside>
  );
}
