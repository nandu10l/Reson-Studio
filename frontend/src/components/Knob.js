import React, { useCallback, memo } from 'react';

const Knob = memo(({
    param = { min: 0, max: 100, default: 50, id: 'knob' },
    value,
    onChange,
    label,
    color = '#4ade80',
    size = 'medium'
}) => {
    const handleMouseDown = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();

        const startY = e.clientY;
        const startValue = value ?? param.default;
        const range = param.max - param.min;

        const handleMouseMove = (moveEvent) => {
            moveEvent.preventDefault();
            const deltaY = startY - moveEvent.clientY;
            const sensitivity = range / 100;
            const newValue = Math.max(param.min, Math.min(param.max, startValue + deltaY * sensitivity));
            onChange(param.id, newValue);
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [param, value, onChange]);

    const displayValue = value ?? param.default;
    const percent = ((displayValue - param.min) / (param.max - param.min)) * 100;
    const rotation = (percent / 100) * 270 - 135;

    const sizeClass = size === 'small' ? 'knob-small' : (size === 'large' ? 'knob-large' : 'knob-medium');

    return (
        <div className={`reson-knob-container ${sizeClass}`}>
            <div
                className="reson-knob"
                onMouseDown={handleMouseDown}
                style={{ '--rotation': `${rotation}deg` }}
                title={`${label}: Drag up/down to adjust`}
            >
                <div className="reson-knob-bg" />
                <div className="reson-knob-indicator" />
                <svg className="reson-knob-track" viewBox="0 0 40 40">
                    <circle
                        cx="20" cy="20" r="16"
                        fill="none"
                        stroke="rgba(0,0,0,0.3)"
                        strokeWidth="3"
                        strokeDasharray="75 25"
                        transform="rotate(135 20 20)"
                    />
                    <circle
                        cx="20" cy="20" r="16"
                        fill="none"
                        stroke={color}
                        strokeWidth="3"
                        strokeDasharray={`${percent * 0.75} 100`}
                        transform="rotate(135 20 20)"
                        style={{ transition: 'stroke-dasharray 0.1s ease-out' }}
                    />
                </svg>
            </div>
            {label && <div className="reson-knob-label">{label}</div>}
        </div>
    );
});

export default Knob;
