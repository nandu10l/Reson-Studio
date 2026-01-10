import React, { useRef } from 'react';
import { ChevronDown } from './icons/BlenderIcons';

export default function AutomationClip({
    clip,
    pixelsPerBeat,
    automation, // The automation definition (points, etc.)
    onSelect,
    onRemove,
    onStartDrag,
    onResizeStart,
    onOpenMenu,
    isSelected = false,
    activeTool
}) {
    const clipWidth = clip.length * pixelsPerBeat;
    const clipName = automation ? automation.name : 'Automation';
    const points = automation ? automation.points : [];

    const [isHovered, setIsHovered] = React.useState(false);

    return (
        <div
            className="track-clip automation-clip"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                left: `${clip.offset * pixelsPerBeat}px`,
                width: `${clipWidth}px`,
                background: isSelected
                    ? 'linear-gradient(180deg, rgba(16, 185, 129, 0.25) 0%, rgba(16, 185, 129, 0.15) 100%)'
                    : 'linear-gradient(180deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.05) 100%)',
                borderColor: isSelected ? '#34d399' : '#10b981',
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
                    ? 'inset 0 1px 2px rgba(255, 255, 255, 0.2), 0 0 16px rgba(16, 185, 129, 0.4), 0 4px 8px rgba(0, 0, 0, 0.4)'
                    : isHovered
                        ? 'inset 0 1px 2px rgba(255, 255, 255, 0.1), 0 2px 4px rgba(0, 0, 0, 0.2)'
                        : 'inset 0 1px 2px rgba(255, 255, 255, 0.05), 0 1px 2px rgba(0, 0, 0, 0.1)',
                opacity: isSelected ? 1 : isHovered ? 0.95 : 0.85,
                transition: 'all 0.2s ease',
                cursor: 'default'
            }}
            onClick={(e) => {
                e.stopPropagation();
                onSelect(clip);
            }}
            onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRemove(clip);
            }}
            onPointerDown={(e) => {
                e.stopPropagation();
                if (e.target.closest('.resize-handle') || e.target.closest('.clip-menu-btn')) return;
                onStartDrag(e, clip);
            }}
        >
            {/* Header */}
            <div
                className="clip-header"
                style={{
                    background: isSelected
                        ? 'linear-gradient(180deg, rgba(255, 255, 255, 0.2) 0%, rgba(16, 185, 129, 0.8) 100%)'
                        : 'linear-gradient(180deg, rgba(255, 255, 255, 0.1) 0%, rgba(16, 185, 129, 0.6) 100%)',
                    padding: '2px 8px',
                    fontSize: '10px',
                    color: '#fff',
                    fontWeight: 600,
                    minHeight: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    letterSpacing: '0.01em',
                    opacity: isSelected ? 1 : 0.9
                }}
            >
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
                            onOpenMenu({ clip, x: rect.left, y: rect.bottom, type: 'automation' });
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
                        marginRight: '6px'
                    }}
                >
                    <ChevronDown size={10} color="#fff" />
                </button>
                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{clipName}</span>
            </div>

            {/* Content / SVG */}
            <div className="clip-content" style={{ flex: 1, position: 'relative', background: 'rgba(0,0,0,0.2)' }}>
                <svg
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        pointerEvents: 'none'
                    }}
                    viewBox={`0 0 ${clipWidth} 34`}
                    preserveAspectRatio="none"
                >
                    <polyline
                        points={points
                            .sort((a, b) => a.x - b.x)
                            .map(p => `${p.x * clipWidth},${34 - (p.y * 34)}`)
                            .join(' ')}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="2"
                        vectorEffect="non-scaling-stroke"
                    />
                    {points.map(p => (
                        <circle
                            key={p.id}
                            cx={p.x * clipWidth}
                            cy={34 - (p.y * 34)}
                            r="3"
                            fill="#10b981"
                        />
                    ))}
                </svg>
            </div>

            {/* Resize Handles */}
            <div
                className="resize-handle left-handle"
                onPointerDown={(e) => onResizeStart(e, clip, 'left')}
                style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: '6px', cursor: 'ew-resize', zIndex: 20 }}
            />
            <div
                className="resize-handle right-handle"
                onPointerDown={(e) => onResizeStart(e, clip, 'right')}
                style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: '6px', cursor: 'ew-resize', zIndex: 20 }}
            />

            {/* Delete Button */}
            <button
                className="clip-delete"
                onClick={(e) => {
                    e.stopPropagation();
                    onRemove(clip);
                }}
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
