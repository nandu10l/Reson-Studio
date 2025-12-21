import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Palette } from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';

const PatternSelector = () => {
    const {
        patterns,
        activePatternId,
        setActivePatternId,
        createPattern
    } = useProject();

    const activePattern = patterns.find(p => p.id === activePatternId) || patterns[0];

    const handleNext = () => {
        const currentIndex = patterns.findIndex(p => p.id === activePatternId);
        if (currentIndex < patterns.length - 1) {
            setActivePatternId(patterns[currentIndex + 1].id);
        } else {
            // Optional: loop back to first or create new? prefer explicit create
        }
    };

    const handlePrev = () => {
        const currentIndex = patterns.findIndex(p => p.id === activePatternId);
        if (currentIndex > 0) {
            setActivePatternId(patterns[currentIndex - 1].id);
        }
    };

    // Very basic color indicator style
    const colorStyle = {
        background: activePattern.color || '#555',
        width: '12px',
        height: '12px',
        borderRadius: '2px',
        marginRight: '8px'
    };

    return (
        <div className="pattern-selector" style={{
            display: 'flex',
            alignItems: 'center',
            background: '#2a2a2a',
            padding: '4px 8px',
            borderRadius: '4px',
            border: '1px solid #333',
            margin: '0 10px'
        }}>
            <button
                className="btn small icon-btn"
                onClick={handlePrev}
                disabled={patterns.findIndex(p => p.id === activePatternId) === 0}
            >
                <ChevronLeft size={14} />
            </button>

            <div className="pattern-display" style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0 10px',
                minWidth: '100px',
                justifyContent: 'center',
                userSelect: 'none'
            }}>
                <div style={colorStyle} title="Pattern Color"></div>
                <span style={{ fontWeight: 600, fontSize: '13px' }}>
                    {activePattern.name}
                </span>
            </div>

            <button
                className="btn small icon-btn"
                onClick={handleNext}
                disabled={patterns.findIndex(p => p.id === activePatternId) === patterns.length - 1}
            >
                <ChevronRight size={14} />
            </button>

            <div style={{ width: '8px' }}></div>

            <button
                className="btn small icon-btn"
                onClick={createPattern}
                title="Create New Pattern"
            >
                <Plus size={14} />
            </button>
        </div>
    );
};

export default PatternSelector;
