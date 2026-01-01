import React, { useRef, useEffect } from 'react';
import { ChevronDown } from './icons/BlenderIcons';
import '../styles/blender-icons.css';

/**
 * AudioClip Component
 * Renders an audio clip on the timeline with waveform visualization
 */
export default function AudioClip({
  clip,
  pixelsPerBeat,
  onSelect,
  onRemove,
  onStartDrag,
  onResizeStart,
  onOpenMenu,
  isSelected = false,
  activeTool,
  onSlice
}) {
  const canvasRef = useRef(null);
  const clipRef = useRef(null);

  // Render waveform on canvas
  useEffect(() => {
    if (!canvasRef.current || !clip.waveform) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const clipWidth = clip.length * pixelsPerBeat;
    const width = Math.max(clipWidth, 10); // Minimum width safety
    const height = 44;
    const centerY = height / 2;

    // Set canvas size with device pixel ratio for crisp rendering
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Set waveform color - vibrant and visible
    const waveformColor = isSelected ? '#fb923c' : '#9ca3af'; // Orange when selected, gray when not
    ctx.strokeStyle = waveformColor;

    const peaks = clip.waveform;
    if (peaks.length === 0) return;

    // Calculate visible window of the waveform
    // peaks represents the FULL audio file
    const totalDurationBeats = clip.durationBeats || clip.length; // fallback
    const startOffset = clip.startOffset || 0;

    // Calculate indices
    const samplesPerBeat = peaks.length / totalDurationBeats;
    const startIndex = Math.floor(startOffset * samplesPerBeat);
    const endIndex = Math.min(peaks.length, Math.floor((startOffset + clip.length) * samplesPerBeat));

    // Get visible peaks
    // Note: slice might return empty array if offsets are wrong, handle safety
    const visiblePeaks = peaks.slice(Math.max(0, startIndex), Math.max(0, endIndex));

    if (visiblePeaks.length === 0) return;

    // Draw visible peaks
    const samplesToDisplay = visiblePeaks.length;
    const lineSpacing = width / samplesToDisplay;
    const maxBarHeight = centerY * 0.9; // Use 90% of available height

    // Set line properties for waveform - thinner lines for connected appearance
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';

    // Draw waveform lines that correspond to the audio
    for (let i = 0; i < samplesToDisplay; i++) {
      const peak = visiblePeaks[i];
      if (!peak) continue;

      // Position lines
      const x = i * lineSpacing;

      // Peaks are normalized (0-1 range)
      const topHeight = Math.abs(peak.max) * maxBarHeight;
      const bottomHeight = Math.abs(peak.min) * maxBarHeight;

      // Draw vertical line extending both upward and downward from center
      ctx.beginPath();
      const startY = centerY + bottomHeight;
      const endY = centerY - topHeight;
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
      ctx.stroke();
    }
  }, [clip.waveform, clip.length, clip.startOffset, clip.durationBeats, pixelsPerBeat, isSelected]);

  const clipWidth = clip.length * pixelsPerBeat;
  const clipName = clip.name || clip.fileName || 'Audio Clip';

  const [isHovered, setIsHovered] = React.useState(false);

  const handleDelete = (e) => {
    e.stopPropagation();
    onRemove(clip);
  };

  return (
    <div
      ref={clipRef}
      className="track-clip audio-clip"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        left: `${clip.offset * pixelsPerBeat}px`,
        width: `${clipWidth}px`,
        background: isSelected
          ? 'linear-gradient(180deg, rgba(59, 130, 246, 0.95) 0%, rgba(37, 99, 235, 0.9) 100%)'
          : 'linear-gradient(180deg, rgba(30, 64, 175, 0.5) 0%, rgba(30, 64, 175, 0.35) 100%)',
        borderColor: isSelected ? '#3b82f6' : '#60a5fa',
        borderWidth: isSelected ? '2px' : '1px',
        borderStyle: 'solid',
        borderRadius: '8px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        position: 'absolute',
        top: '50%',
        transform: 'translateY(-50%)',
        height: '52px',
        zIndex: isSelected ? 10 : 1,
        boxShadow: isSelected
          ? 'inset 0 1px 2px rgba(255, 255, 255, 0.2), 0 0 16px rgba(59, 130, 246, 0.7), 0 4px 8px rgba(0, 0, 0, 0.4)'
          : isHovered
            ? 'inset 0 1px 2px rgba(255, 255, 255, 0.15), 0 2px 4px rgba(0, 0, 0, 0.3)'
            : 'inset 0 1px 2px rgba(255, 255, 255, 0.1), 0 1px 2px rgba(0, 0, 0, 0.2)',
        opacity: isSelected ? 1 : isHovered ? 0.9 : 0.75,
        transition: 'all 0.2s ease',
        filter: isHovered && !isSelected ? 'brightness(1.15)' : 'brightness(1)',
        cursor: activeTool === 'slice' ? 'url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBvbHlsaW5lIHBvaW50cz0iMTAgMTggNiAyMiAzIDIyIDMgMTkgNyAxNSI+PC9wb2x5bGluZT48cGF0aCBkPSJNMjEgNGwtOSA5Ij48L3BhdGg+PHBhdGggZD0iTTE1IDdsNiA2Ij48L3BhdGg+PC9zdmc+") 12 12, crosshair' : 'default'
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (activeTool === 'slice') {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const beatOffset = x / pixelsPerBeat; // Relative beats
          const splitPoint = clip.offset + beatOffset;
          onSlice(splitPoint);
        } else {
          onSelect(clip);
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onRemove(clip);
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
        // Don't start drag if clicking on resize handle or menu button or if slicing
        if (e.target.closest('.resize-handle') || e.target.closest('.clip-menu-btn')) {
          return;
        }
        if (activeTool === 'slice') return;

        onStartDrag(e, clip);
      }}
    >
      {/* Clip Header with Top Highlight */}
      <div
        className="clip-header"
        style={{
          background: isSelected
            ? 'linear-gradient(180deg, rgba(255, 255, 255, 0.25) 0%, #2563eb 100%)'
            : 'linear-gradient(180deg, rgba(255, 255, 255, 0.15) 0%, #1e40af 100%)',
          padding: '2px 8px',
          fontSize: '10px',
          color: '#fff',
          fontWeight: 600,
          minHeight: '18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          letterSpacing: '0.01em',
          wordBreak: 'break-word',
          lineHeight: '1.3',
          opacity: isSelected ? 1 : 0.9,
          boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.2)'
        }}
      >
        <span
          style={{
            flex: 1,
            paddingRight: '4px',
            minWidth: 0,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
          title={clipName}
        >
          {clipName}
        </span>
        <button
          className="clip-menu-btn"
          onPointerDown={(e) => {
            e.stopPropagation();
            onSelect(clip);
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (onOpenMenu) {
              const rect = e.currentTarget.getBoundingClientRect();
              onOpenMenu({ clip, x: rect.right, y: rect.bottom });
            }
          }}
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            padding: '2px 4px',
            display: 'flex',
            alignItems: 'center',
            borderRadius: '2px',
            transition: 'background 0.15s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
        >
          <ChevronDown size={10} color="#fff" className="blender-icon" />
        </button>
      </div>

      {/* Waveform Canvas */}
      <div className="clip-content" style={{
        flex: 1,
        position: 'relative',
        background: 'rgba(30, 41, 59, 0.6)',
        minHeight: '48px',
        padding: '4px',
        overflow: 'hidden'
      }}>
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            opacity: 0.9
          }}
        />
      </div>

      {/* Left Resize Handle Indicator */}
      <div
        className="resize-handle left-handle"
        onPointerDown={(e) => onResizeStart(e, clip, 'left')}
        style={{
          position: 'absolute',
          top: '50%',
          left: '2px',
          transform: 'translateY(-50%)',
          width: '4px',
          height: '24px',
          cursor: 'ew-resize',
          zIndex: 20,
          background: 'rgba(255, 255, 255, 0.4)',
          borderRadius: '2px',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          transition: 'all 0.15s ease',
          opacity: isHovered || isSelected ? 1 : 0.6
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.6)';
          e.currentTarget.style.width = '5px';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.4)';
          e.currentTarget.style.width = '4px';
        }}
      />

      {/* Right Resize Handle Indicator */}
      <div
        className="resize-handle right-handle"
        onPointerDown={(e) => onResizeStart(e, clip, 'right')}
        style={{
          position: 'absolute',
          top: '50%',
          right: '2px',
          transform: 'translateY(-50%)',
          width: '4px',
          height: '24px',
          cursor: 'ew-resize',
          zIndex: 20,
          background: 'rgba(255, 255, 255, 0.4)',
          borderRadius: '2px',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          transition: 'all 0.15s ease',
          opacity: isHovered || isSelected ? 1 : 0.6
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.6)';
          e.currentTarget.style.width = '5px';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.4)';
          e.currentTarget.style.width = '4px';
        }}
      />

      {/* Transparent full-width handles for easier interaction */}
      <div
        className="resize-handle-left-full"
        onPointerDown={(e) => {
          e.stopPropagation();
          onResizeStart(e, clip, 'left');
        }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '10px',
          height: '100%',
          cursor: 'ew-resize',
          zIndex: 19,
          background: 'transparent'
        }}
      />
      <div
        className="resize-handle-right-full"
        onPointerDown={(e) => {
          e.stopPropagation();
          onResizeStart(e, clip, 'right');
        }}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '10px',
          height: '100%',
          cursor: 'ew-resize',
          zIndex: 19,
          background: 'transparent'
        }}
      />

      {/* Delete Button */}
      <button
        className="clip-delete"
        onClick={handleDelete}
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
}


