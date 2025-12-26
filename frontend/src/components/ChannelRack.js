import React, { useState, useRef, useEffect } from 'react';
import './ChannelRack.css';
import { Plus, MoreHorizontal, RotateCcw, ChevronRight, Settings, Music } from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';
import { useGuide } from '../contexts/GuideContext';

// Helper component for FL-style vertical drag knobs
const VerticalDragKnob = ({ value, min = 0, max = 100, onChange, className, title, style, ...props }) => {
    const [isDragging, setIsDragging] = useState(false);
    const startY = useRef(0);
    const startValue = useRef(0);

    useEffect(() => {
        const handlePointerMove = (e) => {
            if (!isDragging) return;
            e.preventDefault();

            const deltaY = startY.current - e.clientY;
            // Sensitivity: 1px = 1 unit change roughly, adjusted by factor
            const range = max - min;
            const sensitivity = 0.5; // Drag 2px for 1 unit change

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
            document.body.style.cursor = 'ns-resize'; // FL style cursor
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
            {/* Visual content handled by parent via chidren or built-in visuals if we moved them here */}
        </div>
    );
};

const Channel = ({ id, name, vol, pan, steps = [] }) => {
    const { toggleStepInActivePattern, activePatternId, updateChannelVolume, updateChannelPan, previewChannelSound } = useProject();
    const { useGuideHandlers } = useGuide();

    const handleToggleStep = (index) => {
        toggleStepInActivePattern(id, index);
    };

    const getPanText = (val) => {
        if (val === 50) return 'Channel panning: centered';
        const percent = Math.abs(val - 50) * 2;
        const side = val < 50 ? 'left' : 'right';
        return `Channel panning: ${percent}% ${side}`;
    };

    const getVolText = (val) => {
        return `Channel volume: ${Math.round(val)}%`; // Simple % for now, could be dB later
    };

    return (
        <div className="channel-row">
            <div className="channel-controls-left">
                {/* LED */}
                <div
                    className="status-led active"
                    title="Mute/Solo"
                    {...useGuideHandlers(`${name} - Mute/Solo`)}
                ></div>

                {/* Pan Knob */}
                <VerticalDragKnob
                    className="rack-knob"
                    title={`Pan: ${pan}%`}
                    value={pan}
                    min={0}
                    max={100}
                    onChange={(v) => updateChannelPan(id, v)}
                    {...useGuideHandlers(getPanText(pan))}
                >
                    <div
                        className={`rack-knob-indicator rack-knob-pan-${name.replace(/\s/g, '')}`}
                        style={{
                            position: 'absolute',
                            top: '50%', left: '50%',
                            width: '2px', height: '8px',
                            background: '#ccc',
                            transformOrigin: '50% 0',
                            transform: `translate(-50%, -50%) rotate(${(pan - 50) * 2.7}deg)`,
                            pointerEvents: 'none'
                        }}
                    />
                </VerticalDragKnob>

                {/* Volume Knob */}
                <VerticalDragKnob
                    className="rack-knob"
                    title={`Vol: ${vol}%`}
                    value={vol}
                    min={0}
                    max={100}
                    onChange={(v) => updateChannelVolume(id, v)}
                    {...useGuideHandlers(getVolText(vol))}
                >
                    <div
                        style={{
                            position: 'absolute',
                            top: '50%', left: '50%',
                            width: '2px', height: '8px',
                            background: '#ccc',
                            transformOrigin: '50% 0',
                            transform: `translate(-50%, -50%) rotate(${(vol - 50) * 2.7}deg)`,
                            pointerEvents: 'none'
                        }}
                    />
                </VerticalDragKnob>
            </div>

            {/* Channel Button */}
            <div
                className="channel-btn"
                onPointerDown={() => previewChannelSound(id)}
                {...useGuideHandlers(`${name} - Channel Settings`)}
            >
                {name}
            </div>

            {/* Selector/Activity Indicator */}
            <div className="channel-selector"></div>

            {/* Step Sequencer Grid */}
            <div className="step-sequencer">
                {steps.map((active, i) => {
                    // Groups of 4
                    const isEvenGroup = Math.floor(i / 4) % 2 === 1; // 0-3 odd(0), 4-7 even(1), ...
                    return (
                        <button
                            key={i}
                            className={`step-btn ${isEvenGroup ? 'group-even' : ''} ${active ? 'active' : ''}`}
                            onClick={() => handleToggleStep(i)}
                            {...useGuideHandlers(`Step ${i + 1}`)}
                        />
                    );
                })}
            </div>
        </div>
    );
};

const ChannelRack = () => {
    const { channels, activePattern, isPlaying, togglePlayback } = useProject();

    // activePattern.data.steps is an object keyed by channelId
    // e.g. { 1: [true, false...], 2: [...] }

    return (
        <div className="channel-rack-window">
            {/* Header */}
            <div className="rack-header">
                <div className="header-controls">
                    <button className="header-btn"><Settings size={14} /></button>
                    <button
                        className="header-btn"
                        onClick={togglePlayback}
                        title="Play Pattern"
                        style={{ color: isPlaying ? '#4ade80' : 'inherit' }}
                    >
                        {isPlaying ? <Music size={14} fill="currentColor" /> : <Music size={14} />}
                    </button>
                    <div className="filter-group">
                        <span>All</span>
                        <ChevronRight size={12} />
                    </div>
                    <button className="header-btn"><RotateCcw size={14} /></button>
                </div>
                <div style={{ flex: 1 }}></div>
                <div className="header-controls">
                    <button className="header-btn"><MoreHorizontal size={14} /></button>
                </div>
            </div>

            {/* Channels */}
            <div className="rack-content">
                {channels.map(ch => (
                    <Channel
                        key={ch.id}
                        id={ch.id}
                        name={ch.name}
                        vol={ch.vol}
                        pan={ch.pan}
                        steps={activePattern.data.steps[ch.id] || Array(activePattern.length).fill(false)}
                    />
                ))}
            </div>

            {/* Footer */}
            <div className="rack-footer">
                <button className="add-channel-btn">
                    <Plus size={16} />
                </button>
            </div>
        </div>
    );
};

export default ChannelRack;
