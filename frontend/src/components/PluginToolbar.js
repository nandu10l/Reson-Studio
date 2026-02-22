import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Search, Music, Sliders, Wrench, AudioLines, Zap, CircleDot, Music2, Radio, Waves } from 'lucide-react';
import './PluginToolbar.css';
import audioPackSynth from '../audio/AudioPackSynth';

// Preset audio packs for quick access to common sounds
const AUDIO_PACKS = {
    risers: {
        name: 'Risers',
        icon: Zap,
        color: '#ff6b6b',
        samples: [
            { id: 'riser-white', name: 'White Noise Riser', duration: '4 bars' },
            { id: 'riser-sweep', name: 'Sweep Riser', duration: '2 bars' },
            { id: 'riser-cinematic', name: 'Cinematic Riser', duration: '8 bars' },
            { id: 'riser-reverse', name: 'Reverse Crash', duration: '2 bars' },
            { id: 'riser-tension', name: 'Tension Builder', duration: '4 bars' },
            { id: 'riser-sub', name: 'Sub Riser', duration: '4 bars' },
        ]
    },
    swooshes: {
        name: 'Swooshes',
        icon: Waves,
        color: '#4ecdc4',
        samples: [
            { id: 'swoosh-fast', name: 'Fast Swoosh', duration: '0.5s' },
            { id: 'swoosh-slow', name: 'Slow Swoosh', duration: '1.5s' },
            { id: 'swoosh-vinyl', name: 'Vinyl Swoosh', duration: '1s' },
            { id: 'swoosh-air', name: 'Air Swoosh', duration: '0.8s' },
            { id: 'swoosh-transition', name: 'Transition Swoosh', duration: '1.2s' },
        ]
    },
    clicks: {
        name: 'Clicks & Snaps',
        icon: CircleDot,
        color: '#a8e6cf',
        samples: [
            { id: 'click-vintage', name: 'Vintage Click', duration: '0.1s' },
            { id: 'click-finger-snap', name: 'Finger Snap', duration: '0.2s' },
            { id: 'click-wood', name: 'Wood Click', duration: '0.1s' },
            { id: 'click-digital', name: 'Digital Click', duration: '0.05s' },
            { id: 'click-metronome', name: 'Metronome', duration: '0.1s' },
            { id: 'click-mouth', name: 'Mouth Click', duration: '0.15s' },
        ]
    },
    bassNotes: {
        name: 'Bass Notes',
        icon: Music2,
        color: '#f38181',
        samples: [
            { id: 'bass-808', name: '808 Sub', duration: '1 bar' },
            { id: 'bass-deep', name: 'Deep Bass Hit', duration: '2 bars' },
            { id: 'bass-punch', name: 'Punchy Bass', duration: '1 beat' },
            { id: 'bass-reese', name: 'Reese Bass', duration: '1 bar' },
            { id: 'bass-wobble', name: 'Wobble Bass', duration: '1 bar' },
            { id: 'bass-slide', name: 'Bass Slide', duration: '2 beats' },
        ]
    },
    beeps: {
        name: 'Beeps & Tones',
        icon: Radio,
        color: '#dfe6e9',
        samples: [
            { id: 'beep-alert', name: 'Alert Beep', duration: '0.3s' },
            { id: 'beep-scan', name: 'Scanner Beep', duration: '0.5s' },
            { id: 'beep-notification', name: 'Notification', duration: '0.4s' },
            { id: 'beep-retro', name: 'Retro Game Beep', duration: '0.2s' },
            { id: 'beep-robot', name: 'Robot Beep', duration: '0.3s' },
            { id: 'beep-countdown', name: 'Countdown Beep', duration: '0.25s' },
        ]
    },
    fx: {
        name: 'FX & Textures',
        icon: AudioLines,
        color: '#74b9ff',
        samples: [
            { id: 'fx-impact', name: 'Impact Hit', duration: '1s' },
            { id: 'fx-atmosphere', name: 'Dark Atmosphere', duration: '8 bars' },
            { id: 'fx-glitch', name: 'Glitch FX', duration: '0.5s' },
            { id: 'fx-vinyl-crackle', name: 'Vinyl Crackle', duration: 'loop' },
            { id: 'fx-downlifter', name: 'Downlifter', duration: '2 bars' },
            { id: 'fx-stutter', name: 'Stutter Effect', duration: '1 beat' },
        ]
    }
};

const PLUGIN_CATEGORIES = {
    instruments: {
        name: 'Instruments',
        icon: Music,
        plugins: [
            { id: 'synth-1', name: 'Analog Synth', type: 'synthesizer' },
            { id: 'piano-1', name: 'Grand Piano', type: 'sampler' },
            { id: 'guitar-1', name: 'Electric Guitar', type: 'sampler' },
            { id: 'bass-1', name: 'Bass Synth', type: 'synthesizer' },
            { id: 'bass-2', name: 'Electric Bass', type: 'sampler' },
            { id: 'drum-1', name: 'Drum Machine', type: 'drums' },
            { id: 'strings-1', name: 'String Ensemble', type: 'sampler' },
        ]
    },
    effects: {
        name: 'Effects',
        icon: Sliders,
        plugins: [
            { id: 'reverb-1', name: 'Reverb', type: 'spatial' },
            { id: 'delay-1', name: 'Delay', type: 'temporal' },
            { id: 'eq-1', name: 'Parametric EQ', type: 'filter' },
            { id: 'comp-1', name: 'Compressor', type: 'dynamics' },
            { id: 'dist-1', name: 'Distortion', type: 'saturation' },
            { id: 'chorus-1', name: 'Chorus', type: 'modulation' },
            { id: 'phaser-1', name: 'Phaser', type: 'modulation' },
        ]
    },
    utilities: {
        name: 'Utilities',
        icon: Wrench,
        plugins: [
            { id: 'gain-1', name: 'Gain', type: 'utility' },
            { id: 'pan-1', name: 'Panner', type: 'utility' },
            { id: 'meter-1', name: 'Level Meter', type: 'analysis' },
            { id: 'spectrum-1', name: 'Spectrum Analyzer', type: 'analysis' },
        ]
    }
};

export default function PluginToolbar() {
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedCategories, setExpandedCategories] = useState({
        instruments: true,
        effects: true,
        utilities: false
    });
    const [expandedAudioPacks, setExpandedAudioPacks] = useState({
        risers: true,
        swooshes: false,
        clicks: false,
        bassNotes: false,
        beeps: false,
        fx: false
    });
    const [activeSection, setActiveSection] = useState('plugins'); // 'plugins' or 'audioPacks'

    const toggleCategory = (categoryId) => {
        setExpandedCategories(prev => ({
            ...prev,
            [categoryId]: !prev[categoryId]
        }));
    };

    const handleDragStart = (e, plugin) => {
        e.dataTransfer.setData('plugin', JSON.stringify(plugin));
        e.dataTransfer.effectAllowed = 'copy';
    };

    const filterPlugins = (plugins) => {
        if (!searchQuery) return plugins;
        return plugins.filter(p =>
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.type.toLowerCase().includes(searchQuery.toLowerCase())
        );
    };

    const filterSamples = (samples) => {
        if (!searchQuery) return samples;
        return samples.filter(s =>
            s.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    };

    const toggleAudioPack = (packId) => {
        setExpandedAudioPacks(prev => ({
            ...prev,
            [packId]: !prev[packId]
        }));
    };

    const handleSampleDragStart = (e, sample, packId, packColor) => {
        // Include packId so TrackList knows how to synthesize this sample
        e.dataTransfer.setData('audioSample', JSON.stringify({
            ...sample,
            packId,
            color: packColor,
            type: 'audioPackSample'
        }));
        e.dataTransfer.effectAllowed = 'copy';
    };

    const handlePreviewClick = async (e, sample, packId) => {
        e.stopPropagation(); // Prevent drag start
        e.preventDefault();
        try {
            await audioPackSynth.previewSample(sample.id, packId);
        } catch (error) {
            console.error('Preview failed:', error);
        }
    };

    return (
        <div className="plugin-toolbar">
            <div className="plugin-toolbar-header">
                <div className="section-tabs">
                    <button
                        className={`section-tab ${activeSection === 'plugins' ? 'active' : ''}`}
                        onClick={() => setActiveSection('plugins')}
                    >
                        <Sliders size={14} />
                        Plugins
                    </button>
                    <button
                        className={`section-tab ${activeSection === 'audioPacks' ? 'active' : ''}`}
                        onClick={() => setActiveSection('audioPacks')}
                    >
                        <AudioLines size={14} />
                        Audio Packs
                    </button>
                </div>
                <div className="plugin-search">
                    <Search size={14} />
                    <input
                        type="text"
                        placeholder={`Search ${activeSection === 'plugins' ? 'plugins' : 'samples'}...`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Plugins Section */}
            {activeSection === 'plugins' && (
                <div className="plugin-categories">
                    {Object.entries(PLUGIN_CATEGORIES).map(([categoryId, category]) => {
                        const filteredPlugins = filterPlugins(category.plugins);
                        const isExpanded = expandedCategories[categoryId];
                        const CategoryIcon = category.icon;

                        // Hide category if no plugins match search
                        if (searchQuery && filteredPlugins.length === 0) return null;

                        return (
                            <div key={categoryId} className="plugin-category">
                                <div
                                    className="category-header"
                                    onClick={() => toggleCategory(categoryId)}
                                >
                                    <div className="category-title">
                                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                        <CategoryIcon size={16} />
                                        <span>{category.name}</span>
                                    </div>
                                    <span className="plugin-count">{filteredPlugins.length}</span>
                                </div>

                                {isExpanded && (
                                    <div className="plugin-list">
                                        {filteredPlugins.map(plugin => (
                                            <div
                                                key={plugin.id}
                                                className="plugin-item"
                                                data-category={categoryId}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, plugin)}
                                                title={`${plugin.name} (${plugin.type})`}
                                            >
                                                <div className="plugin-icon">
                                                    <CategoryIcon size={14} />
                                                </div>
                                                <div className="plugin-info">
                                                    <div className="plugin-name">{plugin.name}</div>
                                                    <span className="plugin-type-badge">{plugin.type}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {activeSection === 'plugins' && searchQuery && Object.values(PLUGIN_CATEGORIES).every(cat =>
                filterPlugins(cat.plugins).length === 0
            ) && (
                    <div className="no-results">
                        No plugins found for "{searchQuery}"
                    </div>
                )}

            {/* Audio Packs Section */}
            {activeSection === 'audioPacks' && (
                <div className="audio-packs-section">
                    {Object.entries(AUDIO_PACKS).map(([packId, pack]) => {
                        const filteredSamples = filterSamples(pack.samples);
                        const isExpanded = expandedAudioPacks[packId];
                        const PackIcon = pack.icon;

                        if (searchQuery && filteredSamples.length === 0) return null;

                        return (
                            <div key={packId} className="audio-pack-category">
                                <div
                                    className="category-header audio-pack-header"
                                    onClick={() => toggleAudioPack(packId)}
                                    style={{ '--pack-color': pack.color }}
                                >
                                    <div className="category-title">
                                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                        <div className="pack-icon" style={{ background: pack.color }}>
                                            <PackIcon size={14} />
                                        </div>
                                        <span>{pack.name}</span>
                                    </div>
                                    <span className="plugin-count">{filteredSamples.length}</span>
                                </div>

                                {isExpanded && (
                                    <div className="sample-list">
                                        {filteredSamples.map(sample => (
                                            <div
                                                key={sample.id}
                                                className="sample-item"
                                                draggable
                                                onDragStart={(e) => handleSampleDragStart(e, sample, packId, pack.color)}
                                                title={`${sample.name} - ${sample.duration}`}
                                                style={{ '--sample-accent': pack.color }}
                                            >
                                                <div className="sample-icon" style={{ background: `${pack.color}22`, borderColor: pack.color }}>
                                                    <PackIcon size={12} style={{ color: pack.color }} />
                                                </div>
                                                <div className="sample-info">
                                                    <div className="sample-name">{sample.name}</div>
                                                    <div className="sample-duration">{sample.duration}</div>
                                                </div>
                                                <div
                                                    className="sample-preview"
                                                    title="Preview"
                                                    onClick={(e) => handlePreviewClick(e, sample, packId)}
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                >
                                                    ▶
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {searchQuery && Object.values(AUDIO_PACKS).every(pack =>
                        filterSamples(pack.samples).length === 0
                    ) && (
                            <div className="no-results">
                                No samples found for "{searchQuery}"
                            </div>
                        )}
                </div>
            )}
        </div>
    );
}
