import React, { useState } from 'react';
import AIMusicGenerator from '../MusicGen/AIMusicGenerator';
import MidiLLMGenerator from '../MidiLLM/MidiLLMGenerator';
import './AIStudio.css';

const TABS = [
    {
        id: 'lyria',
        label: 'Lyria',
        icon: '🎵',
        description: 'AI Music Generator',
        accent: '#22c55e',
    },
    {
        id: 'midi-llm',
        label: 'MIDI-LLM',
        icon: '🎹',
        description: 'Text → MIDI',
        accent: '#a78bfa',
    },
];

export default function AIStudio() {
    // Lyria opens as default
    const [activeTab, setActiveTab] = useState('lyria');

    const active = TABS.find(t => t.id === activeTab);

    return (
        <div className="ai-studio">
            {/* ── Tab Bar ─────────────────────────────────── */}
            <div className="ai-studio-tabbar">
                <div className="ai-studio-tabs">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            className={`ai-studio-tab ${activeTab === tab.id ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.id)}
                            style={{ '--tab-accent': tab.accent }}
                        >
                            <span className="ai-studio-tab-icon">{tab.icon}</span>
                            <span className="ai-studio-tab-label">{tab.label}</span>
                            <span className="ai-studio-tab-desc">{tab.description}</span>
                            {activeTab === tab.id && (
                                <span className="ai-studio-tab-indicator" />
                            )}
                        </button>
                    ))}
                </div>
                <div className="ai-studio-badge" style={{ background: active?.accent + '22', color: active?.accent }}>
                    AI Studio
                </div>
            </div>

            {/* ── Content Panels ───────────────────────────── */}
            <div className="ai-studio-content">
                <div className={`ai-studio-panel ${activeTab === 'lyria' ? 'visible' : ''}`}>
                    <AIMusicGenerator />
                </div>
                <div className={`ai-studio-panel ${activeTab === 'midi-llm' ? 'visible' : ''}`}>
                    <MidiLLMGenerator />
                </div>
            </div>
        </div>
    );
}
