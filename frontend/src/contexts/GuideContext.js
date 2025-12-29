import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

const GuideContext = createContext();

export const useGuide = () => {
    const context = useContext(GuideContext);
    if (!context) {
        throw new Error('useGuide must be used within a GuideProvider');
    }
    return context;
};

export const GuideProvider = ({ children }) => {
    const [guideText, setGuideText] = useState('');
    const explicitGuideRef = useRef(false); // Track if guide was set explicitly
    const clearTimeoutRef = useRef(null);
    const currentTargetRef = useRef(null);

    const setGuide = useCallback((text, isExplicit = false) => {
        if (isExplicit) {
            explicitGuideRef.current = true;
        }
        
        // Clear any pending clear timeout
        if (clearTimeoutRef.current) {
            clearTimeout(clearTimeoutRef.current);
            clearTimeoutRef.current = null;
        }
        
        setGuideText(text);
        
        // Reset explicit flag after a delay (only if not explicitly set again)
        if (isExplicit) {
            setTimeout(() => {
                explicitGuideRef.current = false;
            }, 50);
        }
    }, []);

    const clearGuide = useCallback(() => {
        explicitGuideRef.current = false;
        if (clearTimeoutRef.current) {
            clearTimeout(clearTimeoutRef.current);
        }
        clearTimeoutRef.current = setTimeout(() => {
            if (!explicitGuideRef.current) {
                setGuideText('');
                currentTargetRef.current = null;
            }
        }, 100); // Longer delay to prevent flickering
    }, []);

    // Helper hook for components to easily register events
    const useGuideHandlers = (text) => {
        return {
            onMouseEnter: () => {
                explicitGuideRef.current = true;
                if (clearTimeoutRef.current) {
                    clearTimeout(clearTimeoutRef.current);
                    clearTimeoutRef.current = null;
                }
                setGuideText(text);
            },
            onMouseLeave: () => {
                explicitGuideRef.current = false;
                clearGuide();
            }
        };
    };

    // Global mouseover listener to detect hovered elements
    useEffect(() => {
        const handleMouseOver = (e) => {
            // Don't override explicit guide handlers
            if (explicitGuideRef.current) {
                return;
            }

            // Clear any pending clear timeout
            if (clearTimeoutRef.current) {
                clearTimeout(clearTimeoutRef.current);
                clearTimeoutRef.current = null;
            }

            const target = e.target;
            
            // Skip if hovering over guide box itself or its children
            if (target.closest('.guide-box')) {
                return;
            }

            // Skip if same target (prevent re-processing)
            if (currentTargetRef.current === target) {
                return;
            }
            currentTargetRef.current = target;

            let detectedText = null;

            // Check for data-guide attribute first (highest priority)
            if (target.hasAttribute('data-guide')) {
                detectedText = target.getAttribute('data-guide');
            }
            // Check for title attribute
            else if (target.hasAttribute('title')) {
                detectedText = target.getAttribute('title');
            }
            // Check for aria-label
            else if (target.hasAttribute('aria-label')) {
                detectedText = target.getAttribute('aria-label');
            }
            // Check for button text or icon alt text
            else if (target.tagName === 'BUTTON' || target.closest('button')) {
                const button = target.tagName === 'BUTTON' ? target : target.closest('button');
                const buttonText = button.textContent?.trim();
                if (buttonText && buttonText.length > 0 && buttonText.length < 50) {
                    detectedText = buttonText;
                } else {
                    // Check for title on button
                    const buttonTitle = button.getAttribute('title');
                    if (buttonTitle) {
                        detectedText = buttonTitle;
                    }
                }
            }
            // Check for input labels
            else if (target.tagName === 'INPUT') {
                const label = target.closest('label')?.textContent?.trim();
                if (label) {
                    detectedText = label;
                } else {
                    const placeholder = target.getAttribute('placeholder');
                    if (placeholder) {
                        detectedText = placeholder;
                    }
                }
            }
            // Check for common UI element types
            else if (target.classList.contains('menu-button')) {
                detectedText = target.textContent?.trim() || target.getAttribute('title') || 'Menu';
            }
            else if (target.classList.contains('mode-tab')) {
                detectedText = target.textContent?.trim() || target.getAttribute('title') || 'Mode';
            }
            // Check for icon buttons (look for SVG or icon classes)
            else if (target.closest('.blender-icon') || target.tagName === 'svg') {
                const parent = target.closest('button') || target.closest('[title]');
                if (parent) {
                    const title = parent.getAttribute('title');
                    if (title) {
                        detectedText = title;
                    }
                }
            }
            // Check for track/clip names
            else if (target.classList.contains('track-name') || target.classList.contains('clip-name')) {
                const name = target.textContent?.trim();
                if (name) {
                    detectedText = name;
                }
            }
            // Check dropdown items
            else if (target.classList.contains('dropdown-item')) {
                detectedText = target.getAttribute('title') || target.textContent?.trim();
            }

            // Only update if we found text and it's different
            if (detectedText && detectedText !== guideText) {
                setGuideText(detectedText);
            }
        };

        const handleMouseOut = (e) => {
            // Only clear if not explicitly set and not moving to a child element
            if (!explicitGuideRef.current) {
                const relatedTarget = e.relatedTarget;
                // Don't clear if moving to a child element
                if (relatedTarget && currentTargetRef.current && currentTargetRef.current.contains(relatedTarget)) {
                    return;
                }
                clearGuide();
            }
        };

        document.addEventListener('mouseover', handleMouseOver, true); // Use capture phase
        document.addEventListener('mouseout', handleMouseOut, true);

        return () => {
            document.removeEventListener('mouseover', handleMouseOver, true);
            document.removeEventListener('mouseout', handleMouseOut, true);
            if (clearTimeoutRef.current) {
                clearTimeout(clearTimeoutRef.current);
            }
        };
    }, [setGuide, clearGuide, guideText]);

    const value = {
        guideText,
        setGuide,
        clearGuide,
        useGuideHandlers
    };

    return (
        <GuideContext.Provider value={value}>
            {children}
        </GuideContext.Provider>
    );
};
