import React, { useState, useRef, useEffect } from 'react';

export default function TrackClip({ title, length = 4, onResize }) {
  const [isResizing, setIsResizing] = useState(false);
  const [currentWidth, setCurrentWidth] = useState(length * 120);
  const clipRef = useRef(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = (e) => {
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = currentWidth;
    e.preventDefault();
  };

  const handleMouseMove = (e) => {
    if (isResizing) {
      const deltaX = e.clientX - startXRef.current;
      const newWidth = Math.max(startWidthRef.current + deltaX, 120); // minimum width
      setCurrentWidth(newWidth);
      if (onResize) onResize(newWidth / 120);
    }
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing]);

  return (
    <div className="track-clip" style={{ width: `${currentWidth}px` }} ref={clipRef}>
      <div className="clip-title">{title}</div>
      <div className="resize-handle" onMouseDown={handleMouseDown}></div>
    </div>
  );
}
