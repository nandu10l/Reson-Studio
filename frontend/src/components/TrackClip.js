import React from 'react';

export default function TrackClip({ title, length = 4 }) {
  return (
    <div className="track-clip" style={{ width: `${length * 120}px` }}>
      <div className="clip-title">{title}</div>
    </div>
  );
}
