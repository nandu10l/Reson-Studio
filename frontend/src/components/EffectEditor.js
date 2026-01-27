import React, { useState, useEffect, useRef } from 'react';
import './EffectEditor.css';

// Effect parameters configuration for each effect type
const EFFECT_PARAMS = {
    spatial: {
        name: 'Reverb',
        params: [
            { id: 'decay', name: 'Decay', min: 0.1, max: 10, default: 1.5, unit: 's' },
            { id: 'preDelay', name: 'Pre-Delay', min: 0, max: 0.1, default: 0.01, unit: 's' },
            { id: 'wet', name: 'Mix', min: 0, max: 1, default: 0.5, unit: '' }
        ]
    },
    reverb: {
        name: 'Reverb',
        params: [
            { id: 'decay', name: 'Decay', min: 0.1, max: 10, default: 1.5, unit: 's' },
            { id: 'preDelay', name: 'Pre-Delay', min: 0, max: 0.1, default: 0.01, unit: 's' },
            { id: 'wet', name: 'Mix', min: 0, max: 1, default: 0.5, unit: '' }
        ]
    },
    temporal: {
        name: 'Delay',
        params: [
            { id: 'delayTime', name: 'Time', min: 0.01, max: 1, default: 0.3, unit: 's' },
            { id: 'feedback', name: 'Feedback', min: 0, max: 0.95, default: 0.4, unit: '' },
            { id: 'wet', name: 'Mix', min: 0, max: 1, default: 0.5, unit: '' }
        ]
    },
    delay: {
        name: 'Delay',
        params: [
            { id: 'delayTime', name: 'Time', min: 0.01, max: 1, default: 0.3, unit: 's' },
            { id: 'feedback', name: 'Feedback', min: 0, max: 0.95, default: 0.4, unit: '' },
            { id: 'wet', name: 'Mix', min: 0, max: 1, default: 0.5, unit: '' }
        ]
    },
    modulation: {
        name: 'Chorus/Phaser',
        params: [
            { id: 'frequency', name: 'Rate', min: 0.1, max: 10, default: 1.5, unit: 'Hz' },
            { id: 'depth', name: 'Depth', min: 0, max: 1, default: 0.7, unit: '' },
            { id: 'wet', name: 'Mix', min: 0, max: 1, default: 0.5, unit: '' }
        ]
    },
    chorus: {
        name: 'Chorus',
        params: [
            { id: 'frequency', name: 'Rate', min: 0.1, max: 10, default: 1.5, unit: 'Hz' },
            { id: 'delayTime', name: 'Delay', min: 2, max: 20, default: 3.5, unit: 'ms' },
            { id: 'depth', name: 'Depth', min: 0, max: 1, default: 0.7, unit: '' },
            { id: 'wet', name: 'Mix', min: 0, max: 1, default: 0.5, unit: '' }
        ]
    },
    phaser: {
        name: 'Phaser',
        params: [
            { id: 'frequency', name: 'Rate', min: 0.1, max: 10, default: 0.5, unit: 'Hz' },
            { id: 'octaves', name: 'Octaves', min: 1, max: 8, default: 3, unit: '' },
            { id: 'baseFrequency', name: 'Base Freq', min: 100, max: 1000, default: 350, unit: 'Hz' },
            { id: 'wet', name: 'Mix', min: 0, max: 1, default: 0.5, unit: '' }
        ]
    },
    saturation: {
        name: 'Distortion',
        params: [
            { id: 'distortion', name: 'Drive', min: 0, max: 1, default: 0.4, unit: '' },
            { id: 'wet', name: 'Mix', min: 0, max: 1, default: 0.5, unit: '' }
        ]
    },
    distortion: {
        name: 'Distortion',
        params: [
            { id: 'distortion', name: 'Drive', min: 0, max: 1, default: 0.4, unit: '' },
            { id: 'wet', name: 'Mix', min: 0, max: 1, default: 0.5, unit: '' }
        ]
    },
    dynamics: {
        name: 'Compressor',
        params: [
            { id: 'threshold', name: 'Threshold', min: -60, max: 0, default: -24, unit: 'dB' },
            { id: 'ratio', name: 'Ratio', min: 1, max: 20, default: 4, unit: ':1' },
            { id: 'attack', name: 'Attack', min: 0.001, max: 0.5, default: 0.003, unit: 's' },
            { id: 'release', name: 'Release', min: 0.01, max: 1, default: 0.25, unit: 's' }
        ]
    },
    compressor: {
        name: 'Compressor',
        params: [
            { id: 'threshold', name: 'Threshold', min: -60, max: 0, default: -24, unit: 'dB' },
            { id: 'ratio', name: 'Ratio', min: 1, max: 20, default: 4, unit: ':1' },
            { id: 'attack', name: 'Attack', min: 0.001, max: 0.5, default: 0.003, unit: 's' },
            { id: 'release', name: 'Release', min: 0.01, max: 1, default: 0.25, unit: 's' }
        ]
    },
    filter: {
        name: 'Parametric EQ',
        params: [
            { id: 'low', name: 'Low', min: -24, max: 24, default: 0, unit: 'dB' },
            { id: 'mid', name: 'Mid', min: -24, max: 24, default: 0, unit: 'dB' },
            { id: 'high', name: 'High', min: -24, max: 24, default: 0, unit: 'dB' }
        ]
    },
    eq: {
        name: 'Parametric EQ',
        params: [
            { id: 'low', name: 'Low', min: -24, max: 24, default: 0, unit: 'dB' },
            { id: 'mid', name: 'Mid', min: -24, max: 24, default: 0, unit: 'dB' },
            { id: 'high', name: 'High', min: -24, max: 24, default: 0, unit: 'dB' }
        ]
    }
};

/**
 * EffectEditor - Modal component for editing effect parameters
 * Opens when clicking on a filled effect slot in the mixer detail panel
 */
const EffectEditor = React.memo(({
    effect,
    onClose,
    onUpdateParams,
    onUpdateMix,
    onToggleEnabled
}) => {
    const [params, setParams] = useState({});
    const editorRef = useRef(null);

    // Initialize params from effect
    useEffect(() => {
        if (effect?.params) {
            setParams(effect.params);
        } else if (effect?.type) {
            const config = EFFECT_PARAMS[effect.type];
            if (config) {
                const defaults = {};
                config.params.forEach(p => {
                    defaults[p.id] = p.default;
                });
                setParams(defaults);
            }
        }
    }, [effect]);

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (editorRef.current && !editorRef.current.contains(e.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    if (!effect) return null;

    const effectConfig = EFFECT_PARAMS[effect.type];
    if (!effectConfig) {
        console.warn(`No config for effect type: ${effect.type}`);
        return null;
    }

    const handleParamChange = (paramId, value) => {
        const newParams = { ...params, [paramId]: value };
        setParams(newParams);
        if (onUpdateParams) {
            onUpdateParams({ [paramId]: value });
        }
    };

    const createKnobHandler = (param) => (e) => {
        e.preventDefault();
        const startY = e.clientY;
        const startValue = params[param.id] ?? param.default;
        const range = param.max - param.min;

        const handleMouseMove = (moveEvent) => {
            const deltaY = startY - moveEvent.clientY;
            const sensitivity = range / 100;
            const newValue = Math.max(param.min, Math.min(param.max, startValue + deltaY * sensitivity));
            handleParamChange(param.id, newValue);
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const formatValue = (param, value) => {
        if (value === undefined) return param.default.toFixed(2);
        if (param.unit === 'dB') return Math.round(value) + param.unit;
        if (param.unit === ':1') return value.toFixed(1) + param.unit;
        if (param.unit === 'Hz') return Math.round(value) + ' ' + param.unit;
        if (param.unit === 'ms') return Math.round(value) + param.unit;
        if (param.unit === 's') return value.toFixed(2) + param.unit;
        if (param.unit === '') return value.toFixed(2);
        return value.toFixed(2) + (param.unit ? ' ' + param.unit : '');
    };

    return (
        <div className="effect-editor-overlay">
            <div ref={editorRef} className="effect-editor-modal">
                <div className="effect-editor-header">
                    <span className="effect-editor-title">{effect.name || effectConfig.name}</span>
                    <div className="effect-editor-controls">
                        <button
                            className={`effect-editor-power ${effect.enabled !== false ? 'active' : ''}`}
                            onClick={onToggleEnabled}
                            title="Enable/Bypass"
                        >
                            ●
                        </button>
                        <button onClick={onClose} className="effect-editor-close">×</button>
                    </div>
                </div>

                <div className="effect-editor-body">
                    <div className="effect-editor-params">
                        {effectConfig.params.map(param => {
                            const value = params[param.id] ?? param.default;
                            const percent = ((value - param.min) / (param.max - param.min)) * 100;
                            const rotation = (percent / 100) * 270 - 135;

                            return (
                                <div key={param.id} className="effect-param">
                                    <div
                                        className="effect-param-knob"
                                        onMouseDown={createKnobHandler(param)}
                                        style={{ '--rotation': `${rotation}deg` }}
                                        title={`${param.name}: Drag up/down to adjust`}
                                    >
                                        <div className="effect-param-knob-bg" />
                                        <div className="effect-param-knob-indicator" />
                                        <svg className="effect-param-knob-track" viewBox="0 0 40 40">
                                            <circle
                                                cx="20" cy="20" r="16"
                                                fill="none"
                                                stroke="#333"
                                                strokeWidth="3"
                                                strokeDasharray="75 25"
                                                transform="rotate(135 20 20)"
                                            />
                                            <circle
                                                cx="20" cy="20" r="16"
                                                fill="none"
                                                stroke="#4ade80"
                                                strokeWidth="3"
                                                strokeDasharray={`${percent * 0.75} 100`}
                                                transform="rotate(135 20 20)"
                                            />
                                        </svg>
                                    </div>
                                    <div className="effect-param-info">
                                        <span className="effect-param-name">{param.name}</span>
                                        <span className="effect-param-value">{formatValue(param, value)}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
});

export default EffectEditor;
