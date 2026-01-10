import React, { useState, useEffect, useRef } from 'react';
import '../styles/tour.css';
import { X } from 'lucide-react';

const TourOverlay = ({ steps, isOpen, onClose }) => {
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [spotlightStyle, setSpotlightStyle] = useState({});
    const [cardStyle, setCardStyle] = useState({});

    const currentStep = steps[currentStepIndex];

    useEffect(() => {
        if (!isOpen) {
            setCurrentStepIndex(0);
            return;
        }

        // Slight delay to allow UI to render or settle
        const rAF = requestAnimationFrame(() => {
            calculatePositions();
        });

        return () => cancelAnimationFrame(rAF);
    }, [currentStepIndex, isOpen, steps]); // Verify this dependency list

    // Recalculate on window resize
    useEffect(() => {
        window.addEventListener('resize', calculatePositions);
        return () => window.removeEventListener('resize', calculatePositions);
    }, [currentStepIndex, isOpen]);

    const calculatePositions = () => {
        if (!isOpen || !currentStep) return;

        if (!currentStep.selector) {
            // Center positioning if no selector
            setSpotlightStyle({ display: 'none' });
            setCardStyle({
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                position: 'fixed'
            });
            return;
        }

        const element = document.querySelector(currentStep.selector);
        if (element) {
            const rect = element.getBoundingClientRect();

            // Padding around the element
            const padding = 8;

            setSpotlightStyle({
                display: 'block',
                top: rect.top - padding,
                left: rect.left - padding,
                width: rect.width + (padding * 2),
                height: rect.height + (padding * 2),
            });

            // Calculate best position for card
            // Default: below
            let top = rect.bottom + padding + 20;
            let left = rect.left + (rect.width / 2) - 170; // Center 340px card

            // Check bounds
            if (left < 20) left = 20;
            if (left + 340 > window.innerWidth - 20) left = window.innerWidth - 360;

            if (top + 200 > window.innerHeight) {
                // Position above if not enough space below
                top = rect.top - padding - 220; // Approx card height
            }

            setCardStyle({
                top: top,
                left: left,
                transform: 'none',
                position: 'fixed'
            });

            // Scroll into view if needed
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            // Fallback if element not found
            setSpotlightStyle({ display: 'none' });
            setCardStyle({
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                position: 'fixed'
            });
        }
    };

    if (!isOpen) return null;

    const handleNext = () => {
        if (currentStepIndex < steps.length - 1) {
            setCurrentStepIndex(prev => prev + 1);
        } else {
            onClose();
        }
    };

    const handleBack = () => {
        if (currentStepIndex > 0) {
            setCurrentStepIndex(prev => prev - 1);
        }
    };

    return (
        <>
            <div className="tour-spotlight" style={spotlightStyle} />

            <div className="tour-card" style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h3>{currentStep.title}</h3>
                    <button
                        onClick={onClose}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 0 }}
                    >
                        <X size={16} />
                    </button>
                </div>

                <p>{currentStep.content}</p>

                <div className="tour-footer">
                    <div className="tour-dots">
                        {steps.map((_, idx) => (
                            <div
                                key={idx}
                                className={`tour-dot ${idx === currentStepIndex ? 'active' : ''}`}
                            />
                        ))}
                    </div>

                    <div className="tour-buttons">
                        {currentStepIndex > 0 && (
                            <button className="tour-btn" onClick={handleBack}>
                                Back
                            </button>
                        )}
                        <button className="tour-btn primary" onClick={handleNext}>
                            {currentStepIndex === steps.length - 1 ? 'Finish' : 'Next'}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default TourOverlay;
