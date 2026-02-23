import React from 'react';
import { GM_INSTRUMENTS } from '../../services/aiComposerService';

function SliderRow({ label, value, min, max, step = 1, displayValue, onChange }) {
    const pct = ((value - min) / (max - min)) * 100;
    return (
        <div className="gen-control-row">
            <div className="gen-control-header">
                <span className="gen-control-label">{label}</span>
                <span className="gen-control-value">{displayValue ?? value}</span>
            </div>
            <div className="gen-track">
                <div className="gen-track-filled" style={{ width: `${pct}%` }} />
                <input
                    type="range"
                    className="gen-slider"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={e => onChange(Number(e.target.value))}
                />
            </div>
        </div>
    );
}

export default function GenerationControls({ params, onChange }) {
    const set = (key) => (val) => onChange({ ...params, [key]: val });

    return (
        <div className="gen-controls">
            <SliderRow
                label="Notes to Generate"
                value={params.numNotes}
                min={50}
                max={500}
                step={10}
                onChange={set('numNotes')}
            />
            <SliderRow
                label="Tempo (BPM)"
                value={params.tempo}
                min={60}
                max={200}
                displayValue={`${params.tempo} BPM`}
                onChange={set('tempo')}
            />
            <SliderRow
                label="Velocity"
                value={params.velocity}
                min={1}
                max={127}
                onChange={set('velocity')}
            />
            <SliderRow
                label="Note Duration (s)"
                value={params.noteDuration}
                min={0.1}
                max={1.0}
                step={0.05}
                displayValue={`${params.noteDuration.toFixed(2)}s`}
                onChange={set('noteDuration')}
            />
            <div className="gen-control-row">
                <div className="gen-control-header">
                    <span className="gen-control-label">Instrument</span>
                </div>
                <select
                    className="gen-select"
                    value={params.instrument}
                    onChange={e => set('instrument')(Number(e.target.value))}
                >
                    {GM_INSTRUMENTS.map(inst => (
                        <option key={inst.value} value={inst.value}>{inst.label}</option>
                    ))}
                </select>
            </div>
        </div>
    );
}
