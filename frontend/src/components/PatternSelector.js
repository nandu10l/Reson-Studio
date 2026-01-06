import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, ChevronDown } from './icons/BlenderIcons';
import '../styles/blender-icons.css';
import { useProject } from '../contexts/ProjectContext';
import './PatternSelector.css';

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
    const [showDropdown, setShowDropdown] = useState(false);
    const [editName, setEditName] = useState(activePattern?.name || '');
    const inputRef = useRef(null);
    const dropdownRef = useRef(null);
    const containerRef = useRef(null);

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

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
                containerRef.current && !containerRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };
        if (showDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showDropdown]);

    const handleNext = (e) => {
        e.stopPropagation();
        const currentIndex = patterns.findIndex(p => p.id === activePatternId);
        if (currentIndex < patterns.length - 1) {
            setActivePatternId(patterns[currentIndex + 1].id);
        }
    };

    const handlePrev = (e) => {
        e.stopPropagation();
        const currentIndex = patterns.findIndex(p => p.id === activePatternId);
        if (currentIndex > 0) {
            setActivePatternId(patterns[currentIndex - 1].id);
        }
    };

    const handleNameClick = (e) => {
        e.stopPropagation();
        setIsEditing(true);
        setShowDropdown(false);
    };

    const handleCapsuleClick = (e) => {
        e.stopPropagation();
        if (!isEditing) {
            setShowDropdown(!showDropdown);
        }
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

    const handlePatternSelect = (patternId) => {
        setActivePatternId(patternId);
        setShowDropdown(false);
    };

    const canGoPrev = patterns.findIndex(p => p.id === activePatternId) > 0;
    const canGoNext = patterns.findIndex(p => p.id === activePatternId) < patterns.length - 1;

    return (
        <div className="pattern-selector" ref={containerRef}>
            {/* Secondary Navigation - Minimal */}
            <button
                onClick={handlePrev}
                disabled={!canGoPrev}
                className="pattern-nav-btn pattern-nav-prev"
                title="Previous Pattern"
            >
                <ChevronLeft size={16} className="blender-icon" />
            </button>

            {/* Primary: Pattern Name Capsule */}
            <div
                className="pattern-capsule"
                onClick={handleCapsuleClick}
                title="Click to select pattern, double-click to rename"
            >
                {/* Color Indicator - Integrated */}
                <div
                    className="pattern-color-indicator"
                    style={{
                        background: activePattern?.color || '#4C8DB0'
                    }}
                />

                {/* Pattern Name - Inline Editable */}
                {isEditing ? (
                    <input
                        ref={inputRef}
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={handleNameBlur}
                        onKeyDown={handleNameKeyDown}
                        onClick={(e) => e.stopPropagation()}
                        className="pattern-name-input"
                    />
                ) : (
                    <span
                        className="pattern-name-text"
                        onDoubleClick={handleNameClick}
                    >
                        {activePattern?.name || 'Pattern 1'}
                    </span>
                )}

                {/* Dropdown Indicator */}
                <ChevronDown size={14} className="pattern-dropdown-icon" />
            </div>

            {/* Secondary Navigation - Minimal */}
            <button
                onClick={handleNext}
                disabled={!canGoNext}
                className="pattern-nav-btn pattern-nav-next"
                title="Next Pattern"
            >
                <ChevronRight size={16} className="blender-icon" />
            </button>

            {/* Secondary: Add Button - Minimal */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    createPattern();
                }}
                className="pattern-add-btn"
                title="Create New Pattern"
            >
                <Plus size={16} className="blender-icon" />
            </button>

            {/* Dropdown Menu */}
            {showDropdown && (
                <div className="pattern-dropdown" ref={dropdownRef}>
                    {patterns.map((pattern) => (
                        <div
                            key={pattern.id}
                            className={`pattern-dropdown-item ${pattern.id === activePatternId ? 'active' : ''}`}
                            onClick={() => handlePatternSelect(pattern.id)}
                        >
                            <div
                                className="pattern-dropdown-color"
                                style={{ background: pattern.color || '#4C8DB0' }}
                            />
                            <span className="pattern-dropdown-name">{pattern.name}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default PatternSelector;
