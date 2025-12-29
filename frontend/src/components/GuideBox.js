import React from 'react';
import { useGuide } from '../contexts/GuideContext';
import './GuideBox.css';

function GuideBox() {
    const { guideText } = useGuide();

    return (
        <div className="guide-box">
            <span className="guide-text">{guideText}</span>
        </div>
    );
}

export default GuideBox;
