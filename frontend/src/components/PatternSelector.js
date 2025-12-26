import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus } from './icons/BlenderIcons';
import '../styles/blender-icons.css';
import { useProject } from '../contexts/ProjectContext';

const PatternSelector = () => {
    const {
        patterns,
        activePatternId,
        setActivePatternId,
        createPattern,
        updatePattern
    } = useProject();

    const activePattern = patterns.find(p => p.id === activePatternId) || patterns[0];
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(activePattern?.name || '');
    const inputRef = useRef(null);

    useEffect(() => {
        if (activePattern) {
            setEditName(activePattern.name);
        }
    }, [activePattern]);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleNext = () => {
        const currentIndex = patterns.findIndex(p => p.id === activePatternId);
        if (currentIndex < patterns.length - 1) {
            setActivePatternId(patterns[currentIndex + 1].id);
        }
    };

    const handlePrev = () => {
        const currentIndex = patterns.findIndex(p => p.id === activePatternId);
        if (currentIndex > 0) {
            setActivePatternId(patterns[currentIndex - 1].id);
        }
    };

    const handleNameClick = () => {
        setIsEditing(true);
    };

    const handleNameBlur = () => {
        if (editName.trim() && editName !== activePattern.name) {
            updatePattern(activePatternId, { name: editName.trim() });
        } else {
            setEditName(activePattern.name);
        }
        setIsEditing(false);
    };

    const handleNameKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.target.blur();
        } else if (e.key === 'Escape') {
            setEditName(activePattern.name);
            setIsEditing(false);
        }
    };

    const canGoPrev = patterns.findIndex(p => p.id === activePatternId) > 0;
    const canGoNext = patterns.findIndex(p => p.id === activePatternId) < patterns.length - 1;

    return (
        <div className="pattern-selector" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0',
            height: '100%'
        }}>
            {/* Navigation Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
                <button
                    onClick={handlePrev}
                    disabled={!canGoPrev}
                    title="Previous Pattern"
                    style={{
                        width: '24px',
                        height: '24px',
                        padding: '0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'transparent',
                        border: 'none',
                        cursor: canGoPrev ? 'pointer' : 'not-allowed',
                        opacity: canGoPrev ? 1 : 0.3,
                        transition: 'opacity 0.15s ease'
                    }}
                >
                    <ChevronLeft size={16} color="#b3b3b3" className="blender-icon" />
                </button>

                {/* Color Indicator */}
                <div
                    style={{
                        width: '16px',
                        height: '16px',
                        background: activePattern?.color || '#4C8DB0',
                        borderRadius: '2px',
                        margin: '0 8px',
                        flexShrink: 0
                    }}
                    title="Pattern Color"
                />

                {/* Inline-editable Pattern Name */}
                {isEditing ? (
                    <input
                        ref={inputRef}
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={handleNameBlur}
                        onKeyDown={handleNameKeyDown}
                        style={{
                            background: 'transparent',
                            border: '1px solid #60a5fa',
                            outline: 'none',
                            color: '#fff',
                            fontSize: '13px',
                            fontWeight: 500,
                            padding: '2px 6px',
                            minWidth: '80px',
                            maxWidth: '120px',
                            fontFamily: 'inherit',
                            letterSpacing: '0.01em'
                        }}
                    />
                ) : (
                    <span
                        onClick={handleNameClick}
                        style={{
                            fontSize: '13px',
                            fontWeight: 500,
                            color: '#b3b3b3',
                            padding: '2px 6px',
                            minWidth: '80px',
                            cursor: 'text',
                            userSelect: 'none',
                            letterSpacing: '0.01em',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: 'inline-block',
                            maxWidth: '120px'
                        }}
                        title="Click to edit"
                    >
                        {activePattern?.name || 'Pattern 1'}
                    </span>
                )}

                <button
                    onClick={handleNext}
                    disabled={!canGoNext}
                    title="Next Pattern"
                    style={{
                        width: '24px',
                        height: '24px',
                        padding: '0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'transparent',
                        border: 'none',
                        cursor: canGoNext ? 'pointer' : 'not-allowed',
                        opacity: canGoNext ? 1 : 0.3,
                        transition: 'opacity 0.15s ease'
                    }}
                >
                    <ChevronRight size={16} color="#b3b3b3" className="blender-icon" />
                </button>

                {/* Divider */}
                <div style={{
                    width: '1px',
                    height: '16px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    margin: '0 8px'
                }} />

                {/* Add Pattern Button */}
                <button
                    onClick={createPattern}
                    title="Create New Pattern"
                    style={{
                        width: '24px',
                        height: '24px',
                        padding: '0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'opacity 0.15s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                    <Plus size={16} color="#b3b3b3" className="blender-icon" />
                </button>
            </div>
        </div>
    );
};

export default PatternSelector;
