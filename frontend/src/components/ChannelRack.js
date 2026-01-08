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
