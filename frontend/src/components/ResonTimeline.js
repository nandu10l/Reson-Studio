import React, { useRef, useEffect } from 'react';
import '../styles/reson.css';

export default function ResonTimeline({ measures = 32, pixelsPerBeat = 60, scrollLeft = 0, onScrollChange }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) containerRef.current.scrollLeft = scrollLeft;
  }, [scrollLeft]);

  return (
    <div className="reson-timeline" ref={containerRef} onScroll={(e) => typeof onScrollChange === 'function' && onScrollChange(e.target.scrollLeft)}>
      <div className="reson-timeline-ruler" style={{ width: `${measures * pixelsPerBeat}px` }}>
        {Array.from({ length: measures }).map((_, i) => (
          <div key={i} className="reson-tick" style={{ left: `${i * pixelsPerBeat}px` }}>{i + 1}</div>
        ))}
      </div>
    </div>
  );
}
