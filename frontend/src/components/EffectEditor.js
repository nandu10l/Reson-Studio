import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import './EffectEditor.css';

// Effect parameters configuration for each effect type
const EFFECT_PARAMS = {
    // Reverb (Spatial)
    spatial: {
        name: 'Reeverb 2',
        params: [
            { id: 'lowCut', name: 'L.Cut', min: 20, max: 2000, default: 100, unit: 'Hz' },
            { id: 'highCut', name: 'H.Cut', min: 1000, max: 20000, default: 6000, unit: 'Hz' },
            { id: 'preDelay', name: 'Del', min: 0, max: 0.5, default: 0.02, unit: 's' },
            { id: 'size', name: 'Size', min: 0.1, max: 1, default: 0.7, unit: '' },
            { id: 'diffusion', name: 'Diff', min: 0, max: 1, default: 0.8, unit: '' },
            { id: 'decay', name: 'Dec', min: 0.1, max: 20, default: 2.5, unit: 's' },
            { id: 'damping', name: 'Damp', min: 100, max: 20000, default: 5000, unit: 'Hz' },
            { id: 'dryVol', name: 'Dry', min: 0, max: 1, default: 0.8, unit: '', type: 'slider' },
            { id: 'erVol', name: 'ER', min: 0, max: 1, default: 0.3, unit: '', type: 'slider' },
            { id: 'wet', name: 'Wet', min: 0, max: 1, default: 0.6, unit: '', type: 'slider' },
            { id: 'separation', name: 'Sep', min: -1, max: 1, default: 0, unit: '' }
        ]
    },
    // Delay (Temporal)
    temporal: {
        name: 'Delay',
        params: [
            { id: 'inputPan', name: 'Pan', min: -50, max: 50, default: 0, unit: '' },
            { id: 'inputVol', name: 'Vol', min: 0, max: 1, default: 1, unit: '' },
            { id: 'feedbackMode', name: 'Mode', type: 'mode', options: ['Normal', 'Invert', 'P.Pong'], default: 'Normal' },
            { id: 'feedbackVol', name: 'Vol', min: 0, max: 1, default: 0.4, unit: '' },
            { id: 'cut', name: 'Cut', min: 100, max: 20000, default: 10000, unit: 'Hz' },
            { id: 'delayTime', name: 'Time', min: 0.01, max: 1, default: 0.3, unit: 's' },
            { id: 'offset', name: 'Ofs', min: -0.5, max: 0.5, default: 0, unit: 's' },
            { id: 'dryVol', name: 'Vol', min: 0, max: 1, default: 0.5, unit: '' }
        ]
    },
    // Chorus
    chorus: {
        name: 'Fruity Chorus',
        params: [
            // Row 1
            { id: 'delayTime', name: 'Delay', min: 0, max: 20, default: 15, unit: 'ms' },
            { id: 'depth', name: 'Depth', min: 0, max: 10, default: 2.25, unit: 'ms' },
            { id: 'stereo', name: 'Stereo', min: 0, max: 360, default: 59, unit: 'deg' },
            // Row 2
            { id: 'lfo1Freq', name: 'LFO 1', min: 0.1, max: 5, default: 0.45, unit: 'Hz' },
            { id: 'lfo2Freq', name: 'LFO 2', min: 0.1, max: 5, default: 1.25, unit: 'Hz' },
            { id: 'lfo3Freq', name: 'LFO 3', min: 0.1, max: 5, default: 2.45, unit: 'Hz' },
            // Row 3
            { id: 'lfo1Wave', name: 'LFO 1', type: 'mode', options: ['sin', 'tri', 'sqr'], default: 'sin' },
            { id: 'lfo2Wave', name: 'LFO 2', type: 'mode', options: ['sin', 'tri', 'sqr'], default: 'sin' },
            { id: 'lfo3Wave', name: 'LFO 3', type: 'mode', options: ['sin', 'tri', 'sqr'], default: 'sin' },
            // Row 4
            { id: 'crossType', name: 'Cross', type: 'mode', options: ['HF', 'LF', 'Off'], default: 'HF' },
            { id: 'crossCutoff', name: 'Cutoff', min: 20, max: 2000, default: 320, unit: 'Hz' },
            { id: 'wet', name: 'Wet Only', min: 0, max: 1, default: 0.5, unit: '' }
        ]
    },
    // Phaser (Modulation)
    phaser: {
        name: 'Fruity Phaser',
        params: [
            // Row 1
            { id: 'sweepFreq', name: 'Sweep Freq', min: 0.1, max: 10, default: 0.5, unit: 'Hz' },
            { id: 'minDepth', name: 'Min Depth', min: 0, max: 1, default: 0.1, unit: '' },
            { id: 'maxDepth', name: 'Max Depth', min: 0, max: 1, default: 0.8, unit: '' },
            // Row 2
            { id: 'freqRange', name: 'Freq Range', type: 'mode', options: ['Small', 'Large'], default: 'Large' },
            { id: 'stereo', name: 'Stereo', min: 0, max: 1, default: 0.5, unit: 'phase' },
            { id: 'stages', name: 'Nr. Stages', min: 2, max: 12, default: 8, unit: '' },
            // Row 3
            { id: 'feedback', name: 'Feedback', min: 0, max: 1, default: 0.4, unit: '' },
            { id: 'wet', name: 'Dry-Wet', min: 0, max: 1, default: 0.5, unit: '%' },
            { id: 'outGain', name: 'Out Gain', min: -20, max: 20, default: 4, unit: 'dB' }
        ]
    },
    // Distortion
    distortion: {
        name: 'Fruity Fast Dist',
        params: [
            { id: 'preGain', name: 'Pre', min: 0, max: 2, default: 1, unit: '' },
            { id: 'threshold', name: 'Thresh', min: 0, max: 1, default: 0.5, unit: '' },
            { id: 'distType', name: 'Type', type: 'mode', options: ['A', 'B'], default: 'A' },
            { id: 'mix', name: 'Mix', min: 0, max: 1, default: 1, unit: '' },
            { id: 'postGain', name: 'Post', min: 0, max: 2, default: 1, unit: '' }
        ]
    },
    // Compressor
    compressor: {
        name: 'Fruity Compressor',
        params: [
            { id: 'threshold', name: 'Threshold', min: -60, max: 0, default: -15, unit: 'dB' },
            { id: 'ratio', name: 'Ratio', min: 1, max: 30, default: 2.4, unit: ':1' },
            { id: 'gain', name: 'Gain', min: 0, max: 30, default: 0, unit: 'dB' },
            { id: 'attack', name: 'Attack', min: 0, max: 500, default: 15, unit: 'ms' },
            { id: 'release', name: 'Release', min: 0, max: 2000, default: 200, unit: 'ms' },
            { id: 'type', name: 'Type', type: 'mode', options: ['Hard', 'Medium', 'Soft', 'Vintage'], default: 'Vintage' }
        ]
    },
    // EQ
    eq: {
        name: 'Parametric EQ',
        params: [
            { id: 'low', name: 'Low', min: -24, max: 24, default: 0, unit: 'dB' },
            { id: 'mid', name: 'Mid', min: -24, max: 24, default: 0, unit: 'dB' },
            { id: 'high', name: 'High', min: -24, max: 24, default: 0, unit: 'dB' }
        ]
    },
    // Alias to support legacy types if needed
    reverb: { /* Aliased below */ },
    delay: { /* Aliased below */ },
    modulation: { /* Aliased below */ },
    dynamics: { /* Aliased below */ },
    filter: { /* Aliased below */ }
};

// Map Aliases
EFFECT_PARAMS.reverb = EFFECT_PARAMS.spatial;
EFFECT_PARAMS.delay = EFFECT_PARAMS.temporal;
EFFECT_PARAMS.modulation = EFFECT_PARAMS.phaser;
EFFECT_PARAMS.dynamics = EFFECT_PARAMS.compressor;
EFFECT_PARAMS.filter = EFFECT_PARAMS.eq;

// --- Helper Functions ---

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

const freqToX = (freq, width) => {
    const minF = 20;
    const maxF = 20000;
    const minLog = Math.log10(minF);
    const maxLog = Math.log10(maxF);
    const scale = width / (maxLog - minLog);
    return (Math.log10(freq) - minLog) * scale;
};

const xToFreq = (x, width) => {
    const minF = 20;
    const maxF = 20000;
    const minLog = Math.log10(minF);
    const maxLog = Math.log10(maxF);
    return Math.pow(10, minLog + (x / width) * (maxLog - minLog));
};

const dbToY = (db, height) => {
    const maxDb = 18;
    const minDb = -18;
    const range = maxDb - minDb;
    const ratio = (maxDb - db) / range;
    return ratio * height;
};

const yToDb = (y, height) => {
    const maxDb = 18;
    const minDb = -18;
    const ratio = y / height;
    return maxDb - (ratio * (maxDb - minDb));
};

// Curve calculation for EQ visualization
const getFilterResponse = (f, type, f0, Q, gainDb) => {
    const x = Math.log10(f / f0);
    if (type === 'peaking') {
        const width = 1 / (2 * Math.max(0.1, Q));
        const g = gainDb * Math.exp(-(x * x) / (2 * width * width));
        return g;
    }
    if (type === 'lowshelf') {
        const k = 4;
        return gainDb / (1 + Math.exp(k * x));
    }
    if (type === 'highshelf') {
        return gainDb / (1 + Math.exp(-4 * x));
    }
    if (type === 'lowpass') {
        if (f <= f0) return 0;
        const octaves = Math.log2(f / f0);
        return -12 * octaves * octaves;
    }
    if (type === 'highpass') {
        if (f >= f0) return 0;
        const octaves = Math.log2(f0 / f);
        return -12 * octaves * octaves;
    }
    return 0;
};

// --- Sub-Components ---

const EffectKnob = memo(({ param, value, onChange }) => {
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

    return (
        <div className="effect-param">
            <div
                className="effect-param-knob"
                onMouseDown={handleMouseDown}
                style={{ '--rotation': `${rotation}deg` }}
                title={`${param.name}: Drag up/down to adjust`}
            >
                <div className="effect-param-knob-bg" />
                <div className="effect-param-knob-indicator" />
                <svg className="effect-param-knob-track" viewBox="0 0 40 40">
                    <circle
                        cx="20" cy="20" r="16"
                        fill="none"
                        stroke="#1a1a1a"
                        strokeWidth="2"
                        strokeDasharray="75 25"
                        transform="rotate(135 20 20)"
                    />
                    <circle
                        cx="20" cy="20" r="16"
                        fill="none"
                        stroke="#4ade80"
                        strokeWidth="2"
                        strokeDasharray={`${percent * 0.75} 100`}
                        transform="rotate(135 20 20)"
                    />
                </svg>
            </div>
            <div className="effect-param-info">
                <span className="effect-param-name">{param.name}</span>
                <span className="effect-param-value">{formatValue(param, displayValue)}</span>
            </div>
        </div>
    );
});

const EffectSlider = memo(({ param, value, onChange }) => {
    const handleMouseDown = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();

        const startY = e.clientY;
        const startValue = value ?? param.default;
        const range = param.max - param.min;

        const handleMouseMove = (moveEvent) => {
            moveEvent.preventDefault();
            const deltaY = startY - moveEvent.clientY;
            const sensitivity = range / 200;
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

    return (
        <div className="effect-param effect-param-slider">
            <div
                className="effect-slider-track"
                onMouseDown={handleMouseDown}
            >
                <div className="effect-slider-fill" style={{ height: `${percent}%` }} />
                <div className="effect-slider-handle" style={{ bottom: `${percent}%` }} />
            </div>
            <div className="effect-param-info">
                <span className="effect-param-name">{param.name}</span>
                <span className="effect-param-value">{formatValue(param, displayValue)}</span>
            </div>
        </div>
    );
});

const EffectMode = memo(({ param, value, onChange }) => {
    const currentMode = value || param.default;
    return (
        <div className="effect-mode-group">
            {param.options.map(option => (
                <div
                    key={option}
                    className={`effect-mode-option ${currentMode === option ? 'active' : ''}`}
                    onClick={() => onChange(param.id, option)}
                >
                    <div className="effect-mode-radio" />
                    <span className="effect-mode-label">{option}</span>
                </div>
            ))}
        </div>
    );
});

// --- EQ Component ---
const ParametricEQEditor = ({ bands, onBandChange }) => {
    const canvasRef = useRef(null);
    const [dragging, setDragging] = useState(null);
    const [hoverBand, setHoverBand] = useState(null);

    const getBand = (i) => ({
        freq: bands[`b${i}Freq`] ?? (i === 0 ? 60 : (i === 6 ? 12000 : [130, 300, 800, 2000, 5000][i - 1])),
        gain: bands[`b${i}Gain`] ?? 0,
        bw: bands[`b${i}BW`] ?? 1,
        type: bands[`b${i}Type`] ?? (i === 0 ? 'lowshelf' : (i === 6 ? 'highshelf' : 'peaking')),
        slope: bands[`b${i}Slope`] ?? -12
    });

    const draw = () => {
        const cvs = canvasRef.current;
        if (!cvs) return;
        const ctx = cvs.getContext('2d');
        const w = cvs.width;
        const h = cvs.height;

        // Clear
        ctx.fillStyle = '#222';
        ctx.fillRect(0, 0, w, h);

        // Grid
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 1;
        ctx.beginPath();
        [100, 1000, 10000].forEach(f => {
            const x = freqToX(f, w);
            ctx.moveTo(x, 0); ctx.lineTo(x, h);
        });
        [12, 6, 0, -6, -12].forEach(db => {
            const y = dbToY(db, h);
            ctx.moveTo(0, y); ctx.lineTo(w, y);
        });
        ctx.stroke();

        ctx.beginPath();
        const y0 = dbToY(0, h);
        ctx.strokeStyle = '#666';
        ctx.moveTo(0, y0); ctx.lineTo(w, y0);
        ctx.stroke();

        // Curve
        ctx.beginPath();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        for (let x = 0; x < w; x += 2) {
            const f = xToFreq(x, w);
            let totalDb = 0;
            for (let i = 0; i < 7; i++) {
                const b = getBand(i);
                totalDb += getFilterResponse(f, b.type, b.freq, b.bw, b.gain);
            }
            const y = dbToY(totalDb, h);
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Tokens
        for (let i = 0; i < 7; i++) {
            const b = getBand(i);
            const x = freqToX(b.freq, w);
            const y = dbToY(b.gain, h);

            ctx.beginPath();
            ctx.arc(x, y, 10, 0, Math.PI * 2);
            ctx.fillStyle = dragging?.index === i ? '#fff' : (hoverBand === i ? '#ddd' : `hsla(${i * 50}, 70%, 50%, 0.8)`);
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#000';
            ctx.stroke();

            ctx.fillStyle = '#000';
            ctx.font = 'bold 9px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(i + 1, x, y);
        }
    };

    useEffect(() => {
        draw();
    }, [bands, dragging, hoverBand]);

    const handleMouseDown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const cvs = canvasRef.current;
        if (!cvs) return;
        const rect = cvs.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        for (let i = 6; i >= 0; i--) {
            const b = getBand(i);
            const x = freqToX(b.freq, cvs.width);
            const y = dbToY(b.gain, cvs.height);
            const dx = mx - x;
            const dy = my - y;
            if (dx * dx + dy * dy < 144) {
                setDragging({ index: i, startX: mx, startY: my, startFreq: b.freq, startGain: b.gain });
                return;
            }
        }
    };

    const handleMouseMove = (e) => {
        const cvs = canvasRef.current;
        if (!cvs) return;
        const rect = cvs.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        if (dragging) {
            e.preventDefault();
            const newFreq = xToFreq(mx, cvs.width);
            const newGain = yToDb(my, cvs.height);
            const clampedFreq = Math.max(20, Math.min(20000, newFreq));
            const clampedGain = Math.max(-18, Math.min(18, newGain));
            onBandChange(dragging.index, { freq: clampedFreq, gain: clampedGain });
        } else {
            let hovered = null;
            for (let i = 6; i >= 0; i--) {
                const b = getBand(i);
                const x = freqToX(b.freq, cvs.width);
                const y = dbToY(b.gain, cvs.height);
                const dx = mx - x;
                const dy = my - y;
                if (dx * dx + dy * dy < 144) {
                    hovered = i;
                    break;
                }
            }
            setHoverBand(hovered);
        }
    };

    const handleMouseUp = (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        setDragging(null);
    };

    const handleWheel = (e) => {
        if (hoverBand !== null) {
            e.preventDefault();
            const b = getBand(hoverBand);
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            const newBW = Math.max(0.1, Math.min(10, b.bw * delta));
            onBandChange(hoverBand, { bw: newBW });
        }
    };

    useEffect(() => {
        const cvs = canvasRef.current;
        if (cvs) {
            const preventDefault = (e) => { if (hoverBand !== null) e.preventDefault(); };
            cvs.addEventListener('wheel', preventDefault, { passive: false });
            return () => cvs.removeEventListener('wheel', preventDefault);
        }
    }, [hoverBand]);

    return (
        <div className="eq-editor-container" style={{ display: 'flex', gap: '10px', height: '320px', padding: '10px' }}>
            <div style={{ flex: 1, position: 'relative' }}>
                <canvas
                    ref={canvasRef}
                    width={500}
                    height={300}
                    style={{
                        background: '#222', borderRadius: '4px',
                        cursor: dragging ? 'grabbing' : (hoverBand !== null ? 'grab' : 'default'),
                        width: '100%', height: '100%'
                    }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onWheel={handleWheel}
                />
            </div>
            <div className="eq-faders" style={{ display: 'flex', gap: '4px', padding: '4px', background: '#1a1a1a', borderRadius: '4px', border: '1px solid #333' }}>
                {Array(7).fill(0).map((_, i) => {
                    const b = getBand(i);
                    const percent = ((b.gain + 18) / 36) * 100;
                    return (
                        <div key={i} className="eq-fader-col" style={{ width: '30px', position: 'relative', height: '100%', background: '#222', borderRadius: '2px', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ height: '4px', background: `hsla(${i * 50}, 70%, 50%, 0.8)`, marginBottom: '2px' }} />
                            <div style={{ flex: 1, position: 'relative', margin: '0 8px' }}>
                                <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: '#444' }}></div>
                                <div style={{
                                    position: 'absolute',
                                    bottom: `${Math.max(0, Math.min(100, percent))}%`,
                                    left: '-4px', right: '-4px', height: '8px', marginTop: '-4px',
                                    background: '#888', borderRadius: '2px',
                                    pointerEvents: 'none',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.5)'
                                }} />
                                <input
                                    type="range"
                                    min="-18" max="18" step="0.1"
                                    value={b.gain}
                                    onChange={(e) => onBandChange(i, { gain: parseFloat(e.target.value) })}
                                    style={{
                                        position: 'absolute', width: '300px', height: '30px',
                                        top: '50%', left: '50%',
                                        transform: 'translate(-50%, -50%) rotate(-90deg)',
                                        opacity: 0, cursor: 'ns-resize', margin: 0
                                    }}
                                />
                            </div>
                            <div style={{ height: '16px', fontSize: '9px', textAlign: 'center', color: '#666' }}>{i + 1}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// --- Main Component ---

const EffectEditor = React.memo(({
    effect,
    onClose,
    onUpdateParams,
    onUpdateMix,
    onToggleEnabled
}) => {
    // Local params state
    const [params, setParams] = useState({});
    const editorRef = useRef(null);

    // Initialize params
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

    // Close handlers - only Escape key (no click-outside, so other windows remain usable)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    // Drag support for repositioning
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const isDragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0 });

    const handleHeaderMouseDown = useCallback((e) => {
        if (e.target.tagName === 'BUTTON') return; // Don't drag when clicking buttons
        isDragging.current = true;
        dragStart.current = { x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y };

        const handleMouseMove = (moveEvent) => {
            if (!isDragging.current) return;
            setDragOffset({
                x: moveEvent.clientX - dragStart.current.x,
                y: moveEvent.clientY - dragStart.current.y
            });
        };

        const handleMouseUp = () => {
            isDragging.current = false;
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [dragOffset]);

    if (!effect) return null;

    const effectConfig = EFFECT_PARAMS[effect.type];
    if (!effectConfig) return null;

    // Param Change Handler
    const handleParamChange = useCallback((paramId, value) => {
        setParams(prev => {
            const newParams = { ...prev, [paramId]: value };
            // Debounce or immediate update?
            // For dragging, we want immediate UI feedback.
            // onUpdateParams handles backend throttling if needed, or we throttle here.
            // React state update is async but we need sync for smoothness.
            if (onUpdateParams) {
                onUpdateParams({ [paramId]: value });
            }
            return newParams;
        });
    }, [onUpdateParams]);

    // Render Sections Logic
    const renderSections = () => {
        const { type } = effect;

        // Define section layouts
        // ... (Same as before but simplified to just filtered params) ...
        const sectionLayouts = {
            delay: [
                { title: 'INPUT', params: ['inputPan', 'inputVol'] },
                { title: 'FEEDBACK', params: ['feedbackMode', 'feedbackVol', 'cut'] },
                { title: 'TIME', params: ['delayTime', 'offset'] },
                { title: 'DRY', params: ['dryVol'] }
            ],
            temporal: [
                { title: 'INPUT', params: ['inputPan', 'inputVol'] },
                { title: 'FEEDBACK', params: ['feedbackMode', 'feedbackVol', 'cut'] },
                { title: 'TIME', params: ['delayTime', 'offset'] },
                { title: 'DRY', params: ['dryVol'] }
            ],
            spatial: [
                { title: 'FILTERS', params: ['lowCut', 'highCut'] },
                { title: 'SPACE', params: ['preDelay', 'size', 'diffusion'] },
                { title: 'COLOR', params: ['decay', 'damping'] },
                { title: 'MIX', params: ['dryVol', 'erVol', 'wet', 'separation'] }
            ],
            chorus: [
                { title: 'DELAY / STEREO', params: ['delayTime', 'depth', 'stereo'] },
                { title: 'LFO FREQUENCY', params: ['lfo1Freq', 'lfo2Freq', 'lfo3Freq'] },
                { title: 'LFO WAVEFORM', params: ['lfo1Wave', 'lfo2Wave', 'lfo3Wave'] },
                { title: 'OUTPUT', params: ['crossType', 'crossCutoff', 'wet'] }
            ],
            phaser: [
                { title: 'SWEEP', params: ['sweepFreq', 'minDepth', 'maxDepth'] },
                { title: 'STAGES / COLOR', params: ['freqRange', 'stereo', 'stages'] },
                { title: 'OUTPUT', params: ['feedback', 'wet', 'outGain'] }
            ],
            distortion: [
                { title: 'INPUT', params: ['preGain', 'threshold'] },
                { title: 'TYPE', params: ['distType'] },
                { title: 'OUTPUT', params: ['mix', 'postGain'] }
            ],
            compressor: [
                { title: 'LEVELS', params: ['threshold', 'ratio', 'gain'] },
                { title: 'ENVELOPE / TYPE', params: ['attack', 'release', 'type'] }
            ],
            eq: [{ title: 'BANDS', params: ['low', 'mid', 'high'] }] // Fallback for simple EQ
        };

        // Normalize layout keys
        const layout = sectionLayouts[type] || sectionLayouts[type === 'reverb' ? 'spatial' : type] || [{ title: 'PARAMETERS', params: effectConfig.params.map(p => p.id) }];

        return layout.map((section, idx) => {
            // Find full param objects
            const sectionParams = section.params.map(pid => effectConfig.params.find(p => p.id === pid)).filter(Boolean);

            return (
                <div key={idx} className="effect-section">
                    <div className="effect-section-header">{section.title}</div>
                    <div className="effect-section-content">
                        {sectionParams.map(param => {
                            if (param.type === 'mode') {
                                return <EffectMode key={param.id} param={param} value={params[param.id]} onChange={handleParamChange} />;
                            }
                            if (param.type === 'slider') {
                                return <EffectSlider key={param.id} param={param} value={params[param.id]} onChange={handleParamChange} />;
                            }
                            return <EffectKnob key={param.id} param={param} value={params[param.id]} onChange={handleParamChange} />;
                        })}
                    </div>
                </div>
            );
        });
    };

    return (
        <div className="effect-editor-overlay">
            <div ref={editorRef} className="effect-editor-modal" style={{ transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` }}>
                <div className="effect-editor-header" onMouseDown={handleHeaderMouseDown} style={{ cursor: 'grab' }}>
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
                    {effect.type === 'eq' ? (
                        <ParametricEQEditor
                            bands={params}
                            onBandChange={(index, changes) => {
                                const updates = {};
                                Object.entries(changes).forEach(([k, v]) => {
                                    updates[`b${index}${k.charAt(0).toUpperCase() + k.slice(1)}`] = v;
                                });
                                setParams(prev => {
                                    const newP = { ...prev, ...updates };
                                    if (onUpdateParams) onUpdateParams(updates);
                                    return newP;
                                });
                            }}
                        />
                    ) : (
                        <div className="effect-editor-sections">
                            {renderSections()}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});

export default EffectEditor;
