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
        name: 'Reeverb 2',
        params: [
            // Filters
            { id: 'lowCut', name: 'L.Cut', min: 20, max: 2000, default: 100, unit: 'Hz' },
            { id: 'highCut', name: 'H.Cut', min: 1000, max: 20000, default: 6000, unit: 'Hz' },
            // Time / Space
            { id: 'preDelay', name: 'Del', min: 0, max: 0.5, default: 0.02, unit: 's' },
            { id: 'size', name: 'Size', min: 0.1, max: 1, default: 0.7, unit: '' }, // Virtual param for ReverbGen
            { id: 'diffusion', name: 'Diff', min: 0, max: 1, default: 0.8, unit: '' }, // Virtual
            // Color
            { id: 'decay', name: 'Dec', min: 0.1, max: 20, default: 2.5, unit: 's' },
            { id: 'damping', name: 'Damp', min: 100, max: 20000, default: 5000, unit: 'Hz' },
            // Mix (Sliders)
            { id: 'dryVol', name: 'Dry', min: 0, max: 1, default: 0.8, unit: '', type: 'slider' },
            { id: 'erVol', name: 'ER', min: 0, max: 1, default: 0.3, unit: '', type: 'slider' }, // Simulation
            { id: 'wet', name: 'Wet', min: 0, max: 1, default: 0.6, unit: '', type: 'slider' },
            { id: 'separation', name: 'Sep', min: -1, max: 1, default: 0, unit: '' } // Knob for separation
        ]
    },
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
    delay: {
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
    modulation: {
        name: 'Chorus/Phaser',
        params: [
            { id: 'frequency', name: 'Rate', min: 0.1, max: 10, default: 1.5, unit: 'Hz' },
            { id: 'depth', name: 'Depth', min: 0, max: 1, default: 0.7, unit: '' },
            { id: 'wet', name: 'Mix', min: 0, max: 1, default: 0.5, unit: '' }
        ]
    },
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
    phaser: {
        name: 'Fruity Phaser',
        params: [
            // Row 1
            { id: 'sweepFreq', name: 'Sweep Freq', min: 0.1, max: 10, default: 0.5, unit: 'Hz' },
            { id: 'minDepth', name: 'Min Depth', min: 0, max: 1, default: 0.1, unit: '' },
            { id: 'maxDepth', name: 'Max Depth', min: 0, max: 1, default: 0.8, unit: '' },
            // Row 2
            { id: 'freqRange', name: 'Freq Range', type: 'mode', options: ['Small', 'Large'], default: 'Large' }, // Simplified range
            { id: 'stereo', name: 'Stereo', min: 0, max: 1, default: 0.5, unit: 'phase' },
            { id: 'stages', name: 'Nr. Stages', min: 2, max: 12, default: 8, unit: '' },
            // Row 3
            { id: 'feedback', name: 'Feedback', min: 0, max: 1, default: 0.4, unit: '' }, // amount
            { id: 'wet', name: 'Dry-Wet', min: 0, max: 1, default: 0.5, unit: '%' },
            { id: 'outGain', name: 'Out Gain', min: -20, max: 20, default: 4, unit: 'dB' } // dB
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
        name: 'Fruity Fast Dist',
        params: [
            { id: 'preGain', name: 'Pre', min: 0, max: 2, default: 1, unit: '' },
            { id: 'threshold', name: 'Thresh', min: 0, max: 1, default: 0.5, unit: '' },
            { id: 'distType', name: 'Type', type: 'mode', options: ['A', 'B'], default: 'A' },
            { id: 'mix', name: 'Mix', min: 0, max: 1, default: 1, unit: '' },
            { id: 'postGain', name: 'Post', min: 0, max: 2, default: 1, unit: '' }
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
        name: 'Fruity Compressor',
        params: [
            // Row 1
            { id: 'threshold', name: 'Threshold', min: -60, max: 0, default: -15, unit: 'dB' },
            { id: 'ratio', name: 'Ratio', min: 1, max: 30, default: 2.4, unit: ':1' },
            { id: 'gain', name: 'Gain', min: 0, max: 30, default: 0, unit: 'dB' },
            // Row 2
            { id: 'attack', name: 'Attack', min: 0, max: 500, default: 15, unit: 'ms' },
            { id: 'release', name: 'Release', min: 0, max: 2000, default: 200, unit: 'ms' },
            { id: 'type', name: 'Type', type: 'mode', options: ['Hard', 'Medium', 'Soft', 'Vintage'], default: 'Vintage' } // Knee control
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
// --- EQ HELPER FUNCTIONS ---

// Map Frequency to Canvas X (Logarithmic)
const freqToX = (freq, width) => {
    const minF = 20;
    const maxF = 20000;
    const minLog = Math.log10(minF);
    const maxLog = Math.log10(maxF);
    const scale = width / (maxLog - minLog);
    return (Math.log10(freq) - minLog) * scale;
};

// Map Canvas X to Frequency
const xToFreq = (x, width) => {
    const minF = 20;
    const maxF = 20000;
    const minLog = Math.log10(minF);
    const maxLog = Math.log10(maxF);
    return Math.pow(10, minLog + (x / width) * (maxLog - minLog));
};

// Map dB to Canvas Y
const dbToY = (db, height) => {
    const maxDb = 18;
    const minDb = -18; // Range +/- 18dB
    // 0dB is vertically centered
    const range = maxDb - minDb;
    const ratio = (maxDb - db) / range;
    return ratio * height;
};

// Map Canvas Y to dB
const yToDb = (y, height) => {
    const maxDb = 18;
    const minDb = -18;
    const ratio = y / height;
    return maxDb - (ratio * (maxDb - minDb));
};

// Biquad Magnitude Response Calculation (Approximation)
const getFilterResponse = (f, type, f0, Q, gainDb) => {
    // f: frequency to evaluate
    // f0: center frequency
    // type: lowshelf, highshelf, peaking, lowpass, highpass
    // gainDb: gain for peaking/shelf

    // Simplifed curve logic for visualization
    const x = Math.log10(f / f0); // log distance from center

    if (type === 'peaking') {
        const width = 1 / (2 * Math.max(0.1, Q));
        const g = gainDb * Math.exp(-(x * x) / (2 * width * width));
        return g;
    }

    if (type === 'lowshelf') {
        const k = 4;
        const scale = 1 / (1 + Math.exp(k * x));
        return gainDb * scale;
    }

    if (type === 'highshelf') {
        const scale = 1 / (1 + Math.exp(-4 * x));
        return gainDb * scale;
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

// Main EQ Component
const ParametricEQEditor = ({ bands, onBandChange }) => {
    const canvasRef = useRef(null);
    const [dragging, setDragging] = useState(null);
    const [hoverBand, setHoverBand] = useState(null);

    // Helper to extract band data from flattened params
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
        // Freq Grid
        [100, 1000, 10000].forEach(f => {
            const x = freqToX(f, w);
            ctx.moveTo(x, 0); ctx.lineTo(x, h);
        });
        // dB Grid
        [12, 6, 0, -6, -12].forEach(db => {
            const y = dbToY(db, h);
            ctx.moveTo(0, y); ctx.lineTo(w, y);
        });
        ctx.stroke();

        // Zero Line
        ctx.beginPath();
        const y0 = dbToY(0, h);
        ctx.strokeStyle = '#666';
        ctx.moveTo(0, y0); ctx.lineTo(w, y0);
        ctx.stroke();

        // Calculate Curve
        ctx.beginPath();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;

        // Step size for drawing
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

        // Draw Tokens
        for (let i = 0; i < 7; i++) {
            const b = getBand(i);
            const x = freqToX(b.freq, w);
            const y = dbToY(b.gain, h);

            // Token Circle
            ctx.beginPath();
            ctx.arc(x, y, 10, 0, Math.PI * 2);
            ctx.fillStyle = dragging?.index === i ? '#fff' : (hoverBand === i ? '#ddd' : `hsla(${i * 50}, 70%, 50%, 0.8)`);
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#000';
            ctx.stroke();

            // Number
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
        const cvs = canvasRef.current;
        const rect = cvs.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        // Check hits
        for (let i = 6; i >= 0; i--) { // Reverse order to select top first
            const b = getBand(i);
            const x = freqToX(b.freq, cvs.width);
            const y = dbToY(b.gain, cvs.height);
            const dx = mx - x;
            const dy = my - y;
            if (dx * dx + dy * dy < 144) { // radius 12 squared
                setDragging({ index: i, startX: mx, startY: my, startFreq: b.freq, startGain: b.gain });
                return;
            }
        }
    };

    const handleMouseMove = (e) => {
        const cvs = canvasRef.current;
        const rect = cvs.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        if (dragging) {
            // Update Band
            const newFreq = xToFreq(mx, cvs.width); // Raw freq
            const newGain = yToDb(my, cvs.height); // Raw gain

            // Limiters
            const clampedFreq = Math.max(20, Math.min(20000, newFreq));
            const clampedGain = Math.max(-18, Math.min(18, newGain));

            onBandChange(dragging.index, { freq: clampedFreq, gain: clampedGain });
        } else {
            // Hover check
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

    const handleMouseUp = () => {
        setDragging(null);
    };

    const handleWheel = (e) => {
        if (hoverBand !== null) {
            e.preventDefault(); // Stop page scroll
            const b = getBand(hoverBand);
            // Scroll Up (neg delta) -> Increase Q
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            const newBW = Math.max(0.1, Math.min(10, b.bw * delta));
            onBandChange(hoverBand, { bw: newBW });
        }
    };

    // Prevent scrolling when over canvas
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
            {/* Graph */}
            <div style={{ flex: 1, position: 'relative' }}>
                <canvas
                    ref={canvasRef}
                    width={500}
                    height={300}
                    style={{
                        background: '#222', borderRadius: '4px',
                        cursor: dragging ? 'grabbing' : (hoverBand !== null ? 'grab' : 'default'),
                        width: '100%', height: '100%' // Responsive to container
                    }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onWheel={handleWheel}
                />
            </div>

            {/* Faders */}
            <div className="eq-faders" style={{
                display: 'flex', gap: '4px', padding: '4px',
                background: '#1a1a1a', borderRadius: '4px',
                border: '1px solid #333'
            }}>
                {Array(7).fill(0).map((_, i) => {
                    const b = getBand(i);
                    const percent = ((b.gain + 18) / 36) * 100;
                    return (
                        <div key={i} className="eq-fader-col" style={{
                            width: '30px', position: 'relative', height: '100%',
                            background: '#222', borderRadius: '2px', display: 'flex', flexDirection: 'column'
                        }}>
                            {/* Color Header */}
                            <div style={{ height: '4px', background: `hsla(${i * 50}, 70%, 50%, 0.8)`, marginBottom: '2px' }} />

                            {/* Slider Track Area */}
                            <div style={{ flex: 1, position: 'relative', margin: '0 8px' }}>
                                {/* Center Line */}
                                <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: '#444' }}></div>

                                {/* Handle (Visual) */}
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
                    if (p.type === 'mode') {
                        defaults[p.id] = p.default;
                    } else {
                        defaults[p.id] = p.default;
                    }
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
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const createSliderHandler = (param) => (e) => {
        e.preventDefault();
        const startY = e.clientY;
        const startValue = params[param.id] ?? param.default;
        const range = param.max - param.min;

        const handleMouseMove = (moveEvent) => {
            const deltaY = startY - moveEvent.clientY;
            // Faders have more linear travel perception
            const sensitivity = range / 200;
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

    // Organize parameters into sections based on effect type
    const renderSections = () => {
        const { type } = effect;

        // Define section layouts for different effect types
        const sectionLayouts = {
            delay: [
                {
                    title: 'INPUT',
                    params: effectConfig.params.filter(p => p.id === 'inputPan' || p.id === 'inputVol')
                },
                {
                    title: 'FEEDBACK',
                    params: effectConfig.params.filter(p => p.id === 'feedbackMode' || p.id === 'feedbackVol' || p.id === 'cut')
                },
                {
                    title: 'TIME',
                    params: effectConfig.params.filter(p => p.id === 'delayTime' || p.id === 'offset')
                },
                {
                    title: 'DRY',
                    params: effectConfig.params.filter(p => p.id === 'dryVol')
                }
            ],
            temporal: [
                {
                    title: 'INPUT',
                    params: effectConfig.params.filter(p => p.id === 'inputPan' || p.id === 'inputVol')
                },
                {
                    title: 'FEEDBACK',
                    params: effectConfig.params.filter(p => p.id === 'feedbackMode' || p.id === 'feedbackVol' || p.id === 'cut')
                },
                {
                    title: 'TIME',
                    params: effectConfig.params.filter(p => p.id === 'delayTime' || p.id === 'offset')
                },
                {
                    title: 'DRY',
                    params: effectConfig.params.filter(p => p.id === 'dryVol')
                }
            ],
            reverb: [
                {
                    title: 'FILTERS',
                    params: effectConfig.params.filter(p => p.id === 'lowCut' || p.id === 'highCut')
                },
                {
                    title: 'SPACE',
                    params: effectConfig.params.filter(p => p.id === 'preDelay' || p.id === 'size' || p.id === 'diffusion')
                },
                {
                    title: 'COLOR',
                    params: effectConfig.params.filter(p => p.id === 'decay' || p.id === 'damping')
                },
                {
                    title: 'MIX',
                    params: effectConfig.params.filter(p => ['dryVol', 'erVol', 'wet', 'separation'].includes(p.id))
                }
            ],
            spatial: [
                {
                    title: 'FILTERS',
                    params: effectConfig.params.filter(p => p.id === 'lowCut' || p.id === 'highCut')
                },
                {
                    title: 'SPACE',
                    params: effectConfig.params.filter(p => p.id === 'preDelay' || p.id === 'size' || p.id === 'diffusion')
                },
                {
                    title: 'COLOR',
                    params: effectConfig.params.filter(p => p.id === 'decay' || p.id === 'damping')
                },
                {
                    title: 'MIX',
                    params: effectConfig.params.filter(p => ['dryVol', 'erVol', 'wet', 'separation'].includes(p.id))
                }
            ],
            chorus: [
                {
                    title: 'DELAY / STEREO',
                    params: effectConfig.params.filter(p => ['delayTime', 'depth', 'stereo'].includes(p.id))
                },
                {
                    title: 'LFO FREQUENCY',
                    params: effectConfig.params.filter(p => ['lfo1Freq', 'lfo2Freq', 'lfo3Freq'].includes(p.id))
                },
                {
                    title: 'LFO WAVEFORM',
                    params: effectConfig.params.filter(p => ['lfo1Wave', 'lfo2Wave', 'lfo3Wave'].includes(p.id))
                },
                {
                    title: 'OUTPUT',
                    params: effectConfig.params.filter(p => ['crossType', 'crossCutoff', 'wet'].includes(p.id))
                }
            ],
            phaser: [
                {
                    title: 'SWEEP',
                    params: effectConfig.params.filter(p => ['sweepFreq', 'minDepth', 'maxDepth'].includes(p.id))
                },
                {
                    title: 'STAGES / COLOR',
                    params: effectConfig.params.filter(p => ['freqRange', 'stereo', 'stages'].includes(p.id))
                },
                {
                    title: 'OUTPUT',
                    params: effectConfig.params.filter(p => ['feedback', 'wet', 'outGain'].includes(p.id))
                }
            ],
            modulation: [
                {
                    title: 'MODULATION',
                    params: effectConfig.params.filter(p => p.id === 'frequency' || p.id === 'depth')
                },
                {
                    title: 'MIX',
                    params: effectConfig.params.filter(p => p.id === 'wet')
                }
            ],
            distortion: [
                {
                    title: 'INPUT',
                    params: effectConfig.params.filter(p => ['preGain', 'threshold'].includes(p.id))
                },
                {
                    title: 'TYPE',
                    params: effectConfig.params.filter(p => ['distType'].includes(p.id))
                },
                {
                    title: 'OUTPUT',
                    params: effectConfig.params.filter(p => ['mix', 'postGain'].includes(p.id))
                }
            ],
            saturation: [
                {
                    title: 'DRIVE',
                    params: effectConfig.params.filter(p => p.id === 'distortion')
                },
                {
                    title: 'MIX',
                    params: effectConfig.params.filter(p => p.id === 'wet')
                }
            ],
            compressor: [
                {
                    title: 'LEVELS',
                    params: effectConfig.params.filter(p => ['threshold', 'ratio', 'gain'].includes(p.id))
                },
                {
                    title: 'ENVELOPE / TYPE',
                    params: effectConfig.params.filter(p => ['attack', 'release', 'type'].includes(p.id))
                }
            ],
            dynamics: [
                {
                    title: 'THRESHOLD',
                    params: effectConfig.params.filter(p => p.id === 'threshold' || p.id === 'ratio')
                },
                {
                    title: 'TIMING',
                    params: effectConfig.params.filter(p => p.id === 'attack' || p.id === 'release')
                }
            ],
            eq: [
                {
                    title: 'LOW',
                    params: effectConfig.params.filter(p => p.id === 'low')
                },
                {
                    title: 'MID',
                    params: effectConfig.params.filter(p => p.id === 'mid')
                },
                {
                    title: 'HIGH',
                    params: effectConfig.params.filter(p => p.id === 'high')
                }
            ],
            filter: [
                {
                    title: 'LOW',
                    params: effectConfig.params.filter(p => p.id === 'low')
                },
                {
                    title: 'MID',
                    params: effectConfig.params.filter(p => p.id === 'mid')
                },
                {
                    title: 'HIGH',
                    params: effectConfig.params.filter(p => p.id === 'high')
                }
            ]
        };

        const sections = sectionLayouts[type] || [{
            title: 'PARAMETERS',
            params: effectConfig.params
        }];

        return sections.map((section, idx) => (
            <div key={idx} className="effect-section">
                <div className="effect-section-header">{section.title}</div>
                <div className="effect-section-content">
                    {section.params.map(param => {
                        // Handle mode selector (radio buttons)
                        if (param.type === 'mode') {
                            const currentMode = params[param.id] || param.default;
                            return (
                                <div key={param.id} className="effect-mode-group">
                                    {param.options.map(option => (
                                        <div
                                            key={option}
                                            className={`effect-mode-option ${currentMode === option ? 'active' : ''}`}
                                            onClick={() => handleParamChange(param.id, option)}
                                        >
                                            <div className="effect-mode-radio" />
                                            <span className="effect-mode-label">{option}</span>
                                        </div>
                                    ))}
                                </div>
                            );
                        }

                        // Handle sliders
                        if (param.type === 'slider') {
                            const value = params[param.id] ?? param.default;
                            const percent = ((value - param.min) / (param.max - param.min)) * 100;

                            return (
                                <div key={param.id} className="effect-param effect-param-slider">
                                    <div
                                        className="effect-slider-track"
                                        onMouseDown={createSliderHandler(param)}
                                    >
                                        <div className="effect-slider-fill" style={{ height: `${percent}%` }} />
                                        <div className="effect-slider-handle" style={{ bottom: `${percent}%` }} />
                                    </div>
                                    <div className="effect-param-info">
                                        <span className="effect-param-name">{param.name}</span>
                                        <span className="effect-param-value">{formatValue(param, value)}</span>
                                    </div>
                                </div>
                            );
                        }

                        // Handle regular knob parameters
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
                                    <span className="effect-param-value">{formatValue(param, value)}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        ));
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
                    {effect.type === 'eq' ? (
                        <ParametricEQEditor
                            bands={params}
                            onBandChange={(index, changes) => {
                                const updates = {};
                                Object.entries(changes).forEach(([k, v]) => {
                                    updates[`b${index}${k.charAt(0).toUpperCase() + k.slice(1)}`] = v; // b0Freq, b0Gain etc
                                });
                                // Keep raw flat params
                                const newParams = { ...params, ...updates };
                                setParams(newParams);
                                // Flattened keys map to AudioEngine expectations
                                if (onUpdateParams) onUpdateParams(updates);
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
