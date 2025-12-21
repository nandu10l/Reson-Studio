import React from 'react';
import './ChannelRack.css';
import { Plus, MoreHorizontal, RotateCcw, ChevronRight, Settings } from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';

const Channel = ({ id, name, vol, pan, steps = [] }) => {
    const { toggleStepInActivePattern, activePatternId } = useProject();

    const handleToggleStep = (index) => {
        toggleStepInActivePattern(id, index);
    };

    return (
        <div className="channel-row">
            <div className="channel-controls-left">
                {/* LED */}
                <div className="status-led active" title="Mute/Solo"></div>

                {/* Pan Knob */}
                <div className="rack-knob" title={`Pan: ${pan}%`}>
                    <style>{`
            .rack-knob-pan-${name.replace(/\s/g, '')}::before {
              transform: translate(-50%, -50%) rotate(${(pan - 50) * 2.7}deg);
            }
          `}</style>
                    <div
                        className={`rack-knob-indicator rack-knob-pan-${name.replace(/\s/g, '')}`}
                        style={{
                            position: 'absolute',
                            top: '50%', left: '50%',
                            width: '2px', height: '8px',
                            background: '#ccc',
                            transformOrigin: '50% 0',
                            transform: `translate(-50%, -50%) rotate(${(pan - 50) * 2.7}deg)`
                        }}
                    />
                </div>

                {/* Volume Knob */}
                <div className="rack-knob" title={`Vol: ${vol}%`}>
                    <div
                        style={{
                            position: 'absolute',
                            top: '50%', left: '50%',
                            width: '2px', height: '8px',
                            background: '#ccc',
                            transformOrigin: '50% 0',
                            transform: `translate(-50%, -50%) rotate(${(vol - 50) * 2.7}deg)`
                        }}
                    />
                </div>
            </div>

            {/* Channel Button */}
            <div className="channel-btn">
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
                        />
                    );
                })}
            </div>
        </div>
    );
};

const ChannelRack = () => {
    const { channels, activePattern } = useProject();

    // activePattern.data.steps is an object keyed by channelId
    // e.g. { 1: [true, false...], 2: [...] }

    return (
        <div className="channel-rack-window">
            {/* Header */}
            <div className="rack-header">
                <div className="header-controls">
                    <button className="header-btn"><Settings size={14} /></button>
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
