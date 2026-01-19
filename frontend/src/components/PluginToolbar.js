import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Search, Music, Sliders, Wrench } from 'lucide-react';
import './PluginToolbar.css';

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

    return (
        <div className="plugin-toolbar">
            <div className="plugin-toolbar-header">
                <h3>Plugins</h3>
                <div className="plugin-search">
                    <Search size={14} />
                    <input
                        type="text"
                        placeholder="Search plugins..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

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
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, plugin)}
                                            title={`${plugin.name} (${plugin.type})`}
                                        >
                                            <div className="plugin-icon">
                                                <CategoryIcon size={14} />
                                            </div>
                                            <div className="plugin-info">
                                                <div className="plugin-name">{plugin.name}</div>
                                                <div className="plugin-type">{plugin.type}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {searchQuery && Object.values(PLUGIN_CATEGORIES).every(cat =>
                filterPlugins(cat.plugins).length === 0
            ) && (
                    <div className="no-results">
                        No plugins found for "{searchQuery}"
                    </div>
                )}
        </div>
    );
}
