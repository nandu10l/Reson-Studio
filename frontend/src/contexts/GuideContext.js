import React, { createContext, useContext, useState, useCallback } from 'react';

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

    const setGuide = useCallback((text) => {
        setGuideText(text);
    }, []);

    const clearGuide = useCallback(() => {
        setGuideText('');
    }, []);

    // Helper hook for components to easily register events
    const useGuideHandlers = (text) => {
        return {
            onMouseEnter: () => setGuide(text),
            onMouseLeave: () => clearGuide()
        };
    };

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
