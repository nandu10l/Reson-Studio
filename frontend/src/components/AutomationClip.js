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
    onUpdatePoints, // New prop: (automationId, newPoints) => void
    isSelected = false,
    activeTool
}) {
    const clipWidth = clip.length * pixelsPerBeat;
    const clipName = automation ? automation.name : 'Automation';
    const points = automation ? automation.points : [];

    const [isHovered, setIsHovered] = React.useState(false);
    const svgRef = useRef(null);

    // --- Interactive Point Editing ---
    const handlePointPointerDown = (e, pointId) => {
        e.stopPropagation(); // Prevent clip drag
        e.preventDefault();

        // Capture initial state
        const startX = e.clientX;
        const startY = e.clientY;
        const targetPoint = points.find(p => p.id === pointId);
        if (!targetPoint) return;

        const initialPointX = targetPoint.x;
        const initialPointY = targetPoint.y;

        const handlePointerMove = (moveEvent) => {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;

            // Convert px delta to normalized delta (0-1)
            // Width is clipWidth
            // Height is 34px (from viewBox/style)
            const height = 34;

            let newX = initialPointX + (dx / clipWidth);
            let newY = initialPointY - (dy / height); // Y is inverted in SVG/Audio logic usually? 
            // In rendering: y={34 - (p.y * 34)}. So p.y=1 is top (34-34=0). p.y=0 is bottom (34-0=34).
            // Mouse moves down (+dy) -> we want y to decrease.
            // So: newY = initialY - (dy / height). Correct.

            // Clamp
            newX = Math.max(0, Math.min(1, newX));
            newY = Math.max(0, Math.min(1, newY));

            // Update points
            const updatedPoints = points.map(p =>
                p.id === pointId ? { ...p, x: newX, y: newY } : p
            );

            if (onUpdatePoints && automation) {
                onUpdatePoints(automation.id, updatedPoints);
            }
        };

        const handlePointerUp = () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);
    };

    const handleSvgDoubleClick = (e) => {
        e.stopPropagation();
        if (!automation || !onUpdatePoints) return;

        const rect = svgRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        const height = 34; // Sync with CSS/SVG

        // Normalize
        const normX = Math.max(0, Math.min(1, clickX / clipWidth));
        // Y inversion: clickY=0 -> y=1. clickY=height -> y=0.
        // y = (height - clickY) / height
        const normY = Math.max(0, Math.min(1, (height - clickY) / height));

        const newPoint = {
            id: Date.now(),
            x: normX,
            y: normY
        };

        const newPoints = [...points, newPoint];
        onUpdatePoints(automation.id, newPoints);
    };

    // Sort points for rendering line
    const sortedPoints = [...points].sort((a, b) => a.x - b.x);

    return (
        <div
            className="track-clip automation-clip"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onDoubleClick={handleSvgDoubleClick}
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
                if (e.target.closest('.resize-handle') || e.target.closest('.clip-menu-btn') || e.target.tagName === 'circle') return;
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
                    opacity: isSelected ? 1 : 0.9,
                    pointerEvents: 'none' // Click through header unless button
                }}
            >
                <button
                    className="clip-menu-btn"
                    style={{ pointerEvents: 'auto', background: 'rgba(255, 255, 255, 0.1)', border: 'none', color: '#fff', cursor: 'pointer', padding: '2px 4px', display: 'flex', alignItems: 'center', borderRadius: '2px', marginRight: '6px' }}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onOpenMenu) {
                            const rect = e.currentTarget.getBoundingClientRect();
                            onOpenMenu({ clip, x: rect.left, y: rect.bottom, type: 'automation' });
                        }
                    }}
                >
                    <ChevronDown size={10} color="#fff" />
                </button>
                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{clipName}</span>
            </div>

            {/* Content / SVG */}
            <div className="clip-content" style={{ flex: 1, position: 'relative', background: 'rgba(0,0,0,0.2)' }}>
                <svg
                    ref={svgRef}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        overflow: 'visible' // Allow points to be on edge
                    }}
                    viewBox={`0 0 ${clipWidth} 34`}
                    preserveAspectRatio="none"
                >
                    <polyline
                        points={sortedPoints
                            .map(p => `${p.x * clipWidth},${34 - (p.y * 34)}`)
                            .join(' ')}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="2"
                        vectorEffect="non-scaling-stroke"
                        pointerEvents="none"
                    />
                    {points.map(p => (
                        <circle
                            key={p.id}
                            cx={p.x * clipWidth}
                            cy={34 - (p.y * 34)}
                            r="4"
                            fill="#10b981"
                            stroke="#fff"
                            strokeWidth="1"
                            style={{ cursor: 'pointer' }}
                            onPointerDown={(e) => handlePointPointerDown(e, p.id)}
                            onDoubleClick={(e) => {
                                e.stopPropagation();
                                // Remove point on double click on the point itself
                                const newPoints = points.filter(pt => pt.id !== p.id);
                                if (onUpdatePoints && automation) {
                                    onUpdatePoints(automation.id, newPoints);
                                }
                            }}
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
