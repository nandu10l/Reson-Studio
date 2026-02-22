import React, { useEffect, useState, useRef } from 'react';
import { useGuide } from '../contexts/GuideContext';
import './GuideBox.css';

function GuideBox() {
    const { guideText } = useGuide();
    const [displayText, setDisplayText] = useState('');
    const [isVisible, setIsVisible] = useState(false);
    const timeoutRef = useRef(null);

    useEffect(() => {
        if (guideText) {
            setDisplayText(guideText);
            setIsVisible(true);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        } else {
            // Short delay before hiding so it fades smoothly
            timeoutRef.current = setTimeout(() => setIsVisible(false), 200);
        }
        return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
    }, [guideText]);

    return (
        <div className={`guide-box ${isVisible && displayText ? 'guide-box--visible' : 'guide-box--hidden'}`}>
            <span className="guide-box__icon">
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M8 7v5M8 5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
            </span>
            <span className="guide-box__text">{displayText || '\u00a0'}</span>
        </div>
    );
}

export default GuideBox;
