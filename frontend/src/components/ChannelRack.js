import React, { useState, useRef, useEffect } from 'react';
import './ChannelRack.css';
import { Settings, Music, RotateCcw, ChevronRight, MoreHorizontal, Plus } from './icons/BlenderIcons';
import { useProject } from '../contexts/ProjectContext';
import { useGuide } from '../contexts/GuideContext';

// Helper component for  vertical drag knobs
const VerticalDragKnob = ({ value, min = 0, max = 100, onChange, className, title, style, children, ...props }) => {
    const [isDragging, setIsDragging] = useState(false);
    const startY = useRef(0);
    const startValue = useRef(0);

    useEffect(() => {
        const handlePointerMove = (e) => {
            if (!isDragging) return;
            e.preventDefault();

            const deltaY = startY.current - e.clientY;
            const range = max - min;
            const sensitivity = 0.5;

            let newValue = startValue.current + (deltaY * sensitivity);
            newValue = Math.max(min, Math.min(max, newValue));

            onChange(Math.round(newValue));
        };

        const handlePointerUp = () => {
            setIsDragging(false);
            document.body.style.cursor = 'default';
        };

        if (isDragging) {
            window.addEventListener('pointermove', handlePointerMove);
            window.addEventListener('pointerup', handlePointerUp);
            document.body.style.cursor = 'ns-resize';
        }

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [isDragging, min, max, onChange]);

    const handlePointerDown = (e) => {
        e.preventDefault();
        setIsDragging(true);
        startY.current = e.clientY;
        startValue.current = value;
    };

    return (
        <div
            className={className}
            title={title}
            style={style}
            onPointerDown={handlePointerDown}
            {...props}
        >
            {children}
        </div>
    );
};

const Channel = React.memo(({ id, name, vol, pan, steps = [], color, isPlaying }) => {
    const { toggleStepInActivePattern, updateChannelVolume, updateChannelPan, previewChannelSound } = useProject();
    const { useGuideHandlers } = useGuide();
    const [isEditingName, setIsEditingName] = useState(false);
    const [editName, setEditName] = useState(name);
    const nameInputRef = useRef(null);

    useEffect(() => {
        if (isEditingName && nameInputRef.current) {
            nameInputRef.current.focus();
            nameInputRef.current.select();
        }
    }, [isEditingName]);

    const handleToggleStep = (index) => {
        toggleStepInActivePattern(id, index);
        previewChannelSound(id);
    };

    const handleNameClick = () => {
        setIsEditingName(true);
    };

    const handleNameBlur = () => {
        setIsEditingName(false);
        setEditName(name);
    };

    const handleNameKeyDown = (e) => {
        if (e.key === 'Enter') {
            setIsEditingName(false);
        } else if (e.key === 'Escape') {
            setEditName(name);
            setIsEditingName(false);
        }
    };

    const getPanText = (val) => {
        if (val === 50) return 'Channel panning: centered';
        const percent = Math.abs(val - 50) * 2;
        const side = val < 50 ? 'left' : 'right';
        return `Channel panning: ${percent}% ${side}`;
    };

    const getVolText = (val) => {
        return `Channel volume: ${Math.round(val)}%`;
    };

    return (
        <div className="channel-row">
            {/* Left Controls Group */}
            <div className="channel-controls-left">
                {/* Color Indicator */}
                <div
                    className="channel-color-indicator"
                    style={{ backgroundColor: color || '#4C8DB0' }}
                    title="Channel Color"
                />

                {/* Pan Knob */}
                <VerticalDragKnob
                    className="rack-knob pan-knob"
                    title={`Pan: ${pan}%`}
                    value={pan}
                    min={0}
                    max={100}
                    onChange={(v) => updateChannelPan(id, v)}
                    {...useGuideHandlers(getPanText(pan))}
                >
                    <div
                        className="knob-indicator"
                        style={{
                            transform: `translate(-50%, -50%) rotate(${(pan - 50) * 2.7}deg)`,
                        }}
                    />
                </VerticalDragKnob>

                {/* Volume Knob */}
                <VerticalDragKnob
                    className="rack-knob vol-knob"
                    title={`Vol: ${vol}%`}
                    value={vol}
                    min={0}
                    max={100}
                    onChange={(v) => updateChannelVolume(id, v)}
                    {...useGuideHandlers(getVolText(vol))}
                >
                    <div
                        className="knob-indicator"
                        style={{
                            transform: `translate(-50%, -50%) rotate(${(vol - 50) * 2.7}deg)`,
                        }}
                    />
                </VerticalDragKnob>
            </div>

            {/* Channel Name - Inline Editable */}
            <div className="channel-name-container">
                {isEditingName ? (
                    <input
                        ref={nameInputRef}
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={handleNameBlur}
                        onKeyDown={handleNameKeyDown}
                        className="channel-name-input"
                        onClick={(e) => e.stopPropagation()}
                    />
                ) : (
                    <div
                        className="channel-name"
                        onClick={handleNameClick}
                        title="Click to rename"
                    >
                        {name}
                    </div>
                )}
            </div>

            {/* Step Sequencer Grid */}
            <div className="step-sequencer">
                {steps.map((active, i) => {
                    const isEvenGroup = Math.floor(i / 4) % 2 === 1;
                    const isBeat = i % 4 === 0;
                    const isBar = i % 16 === 0;

                    return (
                        <button
                            key={i}
                            data-step={i}
                            className={`step-btn ${isEvenGroup ? 'group-even' : ''} ${active ? 'active' : ''} ${isBeat ? 'beat' : ''} ${isBar ? 'bar' : ''}`}
                            onClick={() => handleToggleStep(i)}
                            {...useGuideHandlers(`Step ${i + 1}`)}
                        />
                    );
                })}
            </div>
        </div>
    );
});

const ChannelRack = () => {
    const { channels, activePattern, isPlaying, togglePlayback, bpm } = useProject();
    const rackRef = useRef(null);

    // Track current playback step with direct DOM manipulation
    useEffect(() => {
        if (!isPlaying) {
            // Clear highlights if stopped
            if (rackRef.current) {
                const playingSteps = rackRef.current.querySelectorAll('.step-btn.playing');
                playingSteps.forEach(el => el.classList.remove('playing'));
            }
            return;
        }

        let currentStepLocal = 0;
        const stepInterval = (60 / (bpm || 120)) * 250; // 16th note interval
        const interval = setInterval(() => {
            if (rackRef.current) {
                // Remove previous playing class
                const playingSteps = rackRef.current.querySelectorAll('.step-btn.playing');
                playingSteps.forEach(el => el.classList.remove('playing'));

                // Add to current step
                const nextStep = currentStepLocal % activePattern.length;
                const newPlayingSteps = rackRef.current.querySelectorAll(`.step-btn[data-step="${nextStep}"]`);
                newPlayingSteps.forEach(el => el.classList.add('playing'));

                currentStepLocal = (currentStepLocal + 1) % activePattern.length;
            }
        }, stepInterval);

        return () => clearInterval(interval);
    }, [isPlaying, bpm, activePattern.length]);

    // Added Logic: Dynamic Pattern Resizing based on Window Width
    const { resizeActivePattern } = useProject();

    useEffect(() => {
        if (!rackRef.current) return;

        const handleResize = (entries) => {
            for (const entry of entries) {
                const width = entry.contentRect.width;
                // Constants based on CSS:
                // Channel controls (left): 80px + padding/gap approx 10px -> let's say 90px reserved
                // Channel Name: 100px + padding -> 110px
                // Total fixed width approx: 80 + 100 + margins/padding = ~190px
                // Step button width: 16px + 1px gap = 17px

                const fixedWidth = 200; // Left controls + Channel Name + padding
                const availableForSteps = width - fixedWidth;

                if (availableForSteps > 0) {
                    const stepWidth = 17;
                    const possibleSteps = Math.floor(availableForSteps / stepWidth);
                    const currentLength = activePattern.length;

                    // Only resize if we have SIGNIFICANTLY more space to avoid jitter
                    // And only expand if we are larger than current, OR fit strictly if requested.
                    // User request: "no of step sequencers... should increase so that the length of the pattern can be extended"
                    // We will only INCREASE size to avoid destroying data on shrink.

                    if (possibleSteps > currentLength) {
                        // Snap to multiples of 4 for cleaner musical structure, or at least multiples of 4
                        // actually user just wants to extend.
                        // Let's ensure we at least fill the view.

                        // Debounce slightly or just do it? 
                        // Doing it directly might call many state updates. 
                        // But ResizeObserver callback is usually efficient.

                        // To be safe, let's max it out but maybe align to 4
                        const newLength = Math.floor(possibleSteps / 4) * 4;

                        if (newLength > currentLength) {
                            resizeActivePattern(newLength);
                        }
                    }
                }
            }
        };

        const observer = new ResizeObserver(handleResize);
        observer.observe(rackRef.current);

        return () => {
            observer.disconnect();
        };
    }, [activePattern.length, resizeActivePattern]);

    return (
        <div className="channel-rack-window" ref={rackRef}>
            {/* Header */}
            <div className="rack-header">
                <div className="header-controls">
                    <button className="header-btn" title="Settings">
                        <Settings size={14} />
                    </button>
                    <button
                        className={`header-btn ${isPlaying ? 'active' : ''}`}
                        onClick={togglePlayback}
                        title="Play Pattern"
                    >
                        <Music size={14} />
                    </button>
                    <div className="filter-group">
                        <span>All</span>
                        <ChevronRight size={12} />
                    </div>
                    <button className="header-btn" title="Reset">
                        <RotateCcw size={14} />
                    </button>
                </div>
                <div style={{ flex: 1 }}></div>
                <div className="header-controls">
                    <button className="header-btn" title="More Options">
                        <MoreHorizontal size={14} />
                    </button>
                </div>
            </div>

            {/* Channels */}
            <div className="rack-content">
                {channels.map((ch, index) => (
                    <Channel
                        key={ch.id}
                        id={ch.id}
                        name={ch.name}
                        vol={ch.vol}
                        pan={ch.pan}
                        color={activePattern.color}
                        steps={activePattern.data.steps[ch.id] || Array(activePattern.length).fill(false)}
                        isPlaying={isPlaying}
                    />
                ))}
            </div>

            {/* Footer */}
            <div className="rack-footer">
                <button className="add-channel-btn" title="Add Channel">
                    <Plus size={16} />
                </button>
            </div>
        </div>
    );
};

export default React.memo(ChannelRack);
