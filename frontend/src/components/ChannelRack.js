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
    const onChangeRef = useRef(onChange);

    // Keep the ref always pointing to the latest onChange callback
    // This avoids re-creating event listeners on every parent re-render
    onChangeRef.current = onChange;

    useEffect(() => {
        const handlePointerMove = (e) => {
            if (!isDragging) return;
            e.preventDefault();

            const deltaY = startY.current - e.clientY;
            const sensitivity = 0.5;

            let newValue = startValue.current + (deltaY * sensitivity);
            newValue = Math.max(min, Math.min(max, newValue));

            onChangeRef.current(Math.round(newValue));
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
    }, [isDragging, min, max]);

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

const Channel = React.memo(({ id, name, vol, pan, steps = [], color, isPlaying, isSelected, onSelect }) => {
    const { toggleStepInActivePattern, updateChannelVolume, updateChannelPan, previewChannelSound } = useProject();
    const { useGuideHandlers } = useGuide();
    const handleToggleStep = (index) => {
        toggleStepInActivePattern(id, index);
        previewChannelSound(id);
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

            {/* Channel Name - Read Only */}
            <div className="channel-name-container">
                <div
                    className="channel-name"
                    title={name}
                >
                    {name}
                </div>
            </div>

            {/* Selection Indicator */}
            <div
                className={`channel-selector ${isSelected ? 'selected' : ''}`}
                onClick={onSelect}
                title="Select Channel"
            />

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

// Audio Channel component - displays waveform instead of step sequencer
const AudioChannel = React.memo(({ audioClip, isSelected, onSelect }) => {
    const waveformRef = useRef(null);
    const { updateAudioClipVolume, updateAudioClipPan } = useProject();
    const { useGuideHandlers } = useGuide();

    const vol = audioClip.vol !== undefined ? audioClip.vol : 100;
    const pan = audioClip.pan !== undefined ? audioClip.pan : 50;

    const getPanText = (val) => {
        if (val === 50) return 'Audio clip panning: centered';
        const percent = Math.abs(val - 50) * 2;
        const side = val < 50 ? 'left' : 'right';
        return `Audio clip panning: ${percent}% ${side}`;
    };

    const getVolText = (val) => {
        return `Audio clip volume: ${Math.round(val)}%`;
    };

    return (
        <div className="channel-row audio-channel-row">
            {/* Left Controls Group */}
            <div className="channel-controls-left">
                {/* Color Indicator */}
                <div
                    className="channel-color-indicator"
                    style={{ backgroundColor: audioClip.color || '#4ade80' }}
                    title="Audio Clip"
                />

                {/* Pan Knob */}
                <VerticalDragKnob
                    className="rack-knob pan-knob"
                    title={`Pan: ${pan}%`}
                    value={pan}
                    min={0}
                    max={100}
                    onChange={(v) => updateAudioClipPan(audioClip.id, v)}
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
                    onChange={(v) => updateAudioClipVolume(audioClip.id, v)}
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

            {/* Channel Name */}
            <div className="channel-name-container">
                <div className="channel-name audio-channel-name" title={audioClip.name}>
                    {audioClip.name}
                </div>
            </div>

            {/* Selection Indicator */}
            <div
                className={`channel-selector ${isSelected ? 'selected' : ''}`}
                onClick={onSelect}
                title="Select Channel"
            />

            {/* Waveform Display instead of Step Sequencer */}
            <div className="audio-waveform-container" ref={waveformRef}>
                <canvas
                    className="audio-waveform-canvas"
                    ref={(canvas) => {
                        if (canvas && audioClip.waveform) {
                            const ctx = canvas.getContext('2d');
                            const dpr = window.devicePixelRatio || 1;
                            const rect = canvas.getBoundingClientRect();
                            canvas.width = rect.width * dpr;
                            canvas.height = rect.height * dpr;
                            ctx.scale(dpr, dpr);

                            // Draw waveform
                            ctx.clearRect(0, 0, rect.width, rect.height);
                            ctx.fillStyle = '#1e1e1e';
                            ctx.fillRect(0, 0, rect.width, rect.height);

                            const waveform = audioClip.waveform;
                            const barWidth = rect.width / waveform.length;
                            const centerY = rect.height / 2;

                            ctx.fillStyle = '#4ade80';
                            waveform.forEach((val, i) => {
                                const barHeight = val * rect.height * 0.8;
                                ctx.fillRect(
                                    i * barWidth,
                                    centerY - barHeight / 2,
                                    Math.max(1, barWidth - 0.5),
                                    barHeight
                                );
                            });
                        }
                    }}
                />
            </div>
        </div>
    );
});

const ChannelRack = () => {
    const { channels, activePattern, isPlaying, togglePlayback, bpm, addChannel, audioClips, selectedChannelIds, selectChannel } = useProject();
    const rackRef = useRef(null);
    const [filterType, setFilterType] = useState('all'); // 'all', 'audio', 'unsorted'
    const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
    const filterDropdownRef = useRef(null);

    // Filter options similar to FL Studio
    const filterOptions = [
        { id: 'all', label: 'All', description: 'Show all channels' },
        { id: 'audio', label: 'Audio', description: 'Audio clips and samplers' },
        { id: 'unsorted', label: 'Unsorted', description: 'Synthesizers and other' }
    ];

    // Get the current filter label
    const currentFilterLabel = filterOptions.find(opt => opt.id === filterType)?.label || 'All';

    // Filter channels based on the selected filter type
    const getFilteredItems = () => {
        if (filterType === 'all') {
            // Combine pattern channels and audio clips
            const patternItems = channels.map(ch => ({ ...ch, itemType: 'pattern' }));
            const audioItems = (audioClips || []).map(clip => ({ ...clip, itemType: 'audio' }));
            return [...patternItems, ...audioItems];
        } else if (filterType === 'audio') {
            // Show only audio clips (with waveform display)
            return (audioClips || []).map(clip => ({ ...clip, itemType: 'audio' }));
        } else if (filterType === 'unsorted') {
            // Show only pattern-based channels (with step sequencer)
            return channels.map(ch => ({ ...ch, itemType: 'pattern' }));
        }
        return channels.map(ch => ({ ...ch, itemType: 'pattern' }));
    };

    const filteredItems = getFilteredItems();

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
                setFilterDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const pluginData = e.dataTransfer.getData('plugin');
        if (pluginData) {
            try {
                const plugin = JSON.parse(pluginData);
                // Check if plugin is an instrument (simple check for now)
                // Assuming instrument types don't include 'utility' or 'analysis' or 'effect' type keywords if strict
                // But plugin.type in PluginToolbar: 'synthesizer', 'sampler', 'drums' etc.
                // We'll trust the user or check if it's NOT an effect category? 
                // Let's just allow adding anything as a generator for now, or filter.

                // PluginToolbar categories: instruments, effects, utilities
                // Better check: is this an instrument?
                // types: synthesizer, sampler, drums
                const instrumentTypes = ['synthesizer', 'sampler', 'drums'];

                if (instrumentTypes.includes(plugin.type)) {
                    addChannel(plugin);
                } else {
                    // alert("Only instruments can be added to the Channel Rack.");
                    // Optionally silently fail or show toast
                    console.log("Ignored non-instrument drop on rack");
                }
            } catch (err) {
                console.error("Failed to parse dropped plugin", err);
            }
        }
    };

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
        // 16th note interval: (milliseconds per beat) / 4 = (60000 / bpm) / 4
        const stepInterval = (60000 / (bpm || 120)) / 4;
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
        <div
            className="channel-rack-window"
            ref={rackRef}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
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
                    <div
                        className="filter-group"
                        ref={filterDropdownRef}
                        onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
                    >
                        <span>{currentFilterLabel}</span>
                        <ChevronRight
                            size={12}
                            style={{
                                transform: filterDropdownOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                                transition: 'transform 0.2s ease'
                            }}
                        />
                        {filterDropdownOpen && (
                            <div className="filter-dropdown">
                                {filterOptions.map(option => (
                                    <div
                                        key={option.id}
                                        className={`filter-dropdown-item ${filterType === option.id ? 'active' : ''}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setFilterType(option.id);
                                            setFilterDropdownOpen(false);
                                        }}
                                    >
                                        <span className="filter-item-label">{option.label}</span>
                                    </div>
                                ))}
                            </div>
                        )}
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
                {filteredItems.length > 0 ? (
                    filteredItems.map((item, index) => (
                        item.itemType === 'audio' ? (
                            <AudioChannel
                                key={`audio-${item.id}`}
                                audioClip={item}
                                isSelected={selectedChannelIds.includes(`audio-${item.id}`)}
                                onSelect={(e) => selectChannel(`audio-${item.id}`, e.ctrlKey || e.metaKey)}
                            />
                        ) : (
                            <Channel
                                key={`pattern-${item.id}`}
                                id={item.id}
                                name={item.name}
                                vol={item.vol}
                                pan={item.pan}
                                color={item.color || activePattern.color}
                                steps={activePattern.data.steps[item.id] || Array(activePattern.length).fill(false)}
                                isPlaying={isPlaying}
                                isSelected={selectedChannelIds.includes(item.id)}
                                onSelect={(e) => selectChannel(item.id, e.ctrlKey || e.metaKey)}
                            />
                        )
                    ))
                ) : (
                    <div className="no-channels-message">
                        {filterType === 'audio' ? 'No audio clips imported' : 'No channels available'}
                    </div>
                )}
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
