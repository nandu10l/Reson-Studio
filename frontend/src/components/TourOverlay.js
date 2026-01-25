import React, { useState, useEffect, useRef } from 'react';
import '../styles/tour.css';
import { X } from 'lucide-react';

const TourOverlay = ({ steps, isOpen, onClose }) => {
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [spotlightStyle, setSpotlightStyle] = useState({});
    const [cardStyle, setCardStyle] = useState({});
    const [arrowStyle, setArrowStyle] = useState({});
    const cardRef = useRef(null);

    const currentStep = steps[currentStepIndex];

    useEffect(() => {
        if (!isOpen) {
            setCurrentStepIndex(0);
            return;
        }

        const updatePosition = () => {
            requestAnimationFrame(calculatePositions);
        };

        updatePosition(); // Initial calculation

        window.addEventListener('resize', updatePosition);
        window.addEventListener('scroll', updatePosition, true); // Capture scroll events

        return () => {
            window.removeEventListener('resize', updatePosition);
            window.removeEventListener('scroll', updatePosition, true);
        };
    }, [currentStepIndex, isOpen, steps]);

    const calculatePositions = () => {
        if (!isOpen || !currentStep) return;

        if (!currentStep.selector) {
            // Center positioning if no selector
            setSpotlightStyle({ display: 'none' });
            setCardStyle({
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                position: 'fixed',
                opacity: 1
            });
            setArrowStyle({ display: 'none' });
            return;
        }

        const element = document.querySelector(currentStep.selector);
        if (element) {
            const rect = element.getBoundingClientRect();
            const padding = 8;
            const cardWidth = 340;
            const cardHeight = 200; // Approximate height, or use ref to measure
            const arrowSize = 8;
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            // Spotlight Position
            setSpotlightStyle({
                display: 'block',
                top: rect.top - padding,
                left: rect.left - padding,
                width: rect.width + (padding * 2),
                height: rect.height + (padding * 2),
            });

            // Card Positioning Logic
            let top = 0;
            let left = 0;
            let placement = 'bottom'; // default

            // Try Bottom
            if (rect.bottom + cardHeight + 20 < viewportHeight) {
                top = rect.bottom + padding + 12;
                left = rect.left + (rect.width / 2) - (cardWidth / 2);
                placement = 'bottom';
            }
            // Try Top
            else if (rect.top - cardHeight - 20 > 0) {
                top = rect.top - padding - 12 - cardHeight; // Need actual height for perfect placement, but this is a heuristic
                left = rect.left + (rect.width / 2) - (cardWidth / 2);
                placement = 'top';
            }
            // Try Right
            else if (rect.right + cardWidth + 20 < viewportWidth) {
                top = rect.top + (rect.height / 2) - (cardHeight / 2);
                left = rect.right + padding + 12;
                placement = 'right';
            }
            // Try Left
            else if (rect.left - cardWidth - 20 > 0) {
                top = rect.top + (rect.height / 2) - (cardHeight / 2);
                left = rect.left - padding - 12 - cardWidth;
                placement = 'left';
            }
            // Fallback: Center it roughly if nothing fits well, or clamp heavily
            else {
                top = rect.bottom + padding + 12;
                left = rect.left + (rect.width / 2) - (cardWidth / 2);
            }

            // Boundary Clamping (Keep card inside viewport)
            if (left < 10) left = 10;
            if (left + cardWidth > viewportWidth - 10) left = viewportWidth - cardWidth - 10;

            if (top < 10) top = 10;
            // We don't clamp bottom strictly as it might overlap the element, which is better than being offscreen
            if (top + cardHeight > viewportHeight - 10) {
                // If it's going off bottom, and we haven't already tried top (logic above), 
                // we might need to force it up, but the logic above should handle most cases.
                // This acts as a final safety net.
                top = Math.min(top, viewportHeight - cardHeight - 10);
            }


            setCardStyle({
                top: top,
                left: left,
                position: 'fixed',
                opacity: 1,
                transform: 'none' // Reset any centering transforms
            });

            // Arrow Positioning
            // (Simplified: showing arrow only for top/bottom placements for now as they are most common)
            // Ideally we calculate arrow relative to the card and the target

            // For now, let's keep it simple and clean without the arrow to avoid complexity with clamping
            // setArrowStyle({ ... }); 

            // Scroll into view if needed
            element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });

        } else {
            // Fallback if element not found
            setSpotlightStyle({ display: 'none' });
            setCardStyle({
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                position: 'fixed',
                opacity: 1
            });
            setArrowStyle({ display: 'none' });
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
            <div className={`tour-overlay ${isOpen ? 'active' : ''}`}>
                <div className="tour-spotlight" style={spotlightStyle} />
            </div>

            <div className="tour-card" style={cardStyle} ref={cardRef}>
                <div className="tour-header">
                    <h3>{currentStep.title}</h3>
                    <button
                        onClick={onClose}
                        className="tour-close-btn"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="tour-content">
                    <p>{currentStep.content}</p>
                </div>

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
                            <button className="tour-btn secondary" onClick={handleBack}>
                                Back
                            </button>
                        )}
                        <button className="tour-btn primary" onClick={handleNext}>
                            {currentStepIndex === steps.length - 1 ? 'Finish' : 'Next'}
                        </button>
                    </div>
                </div>
                {/* <div className="tour-arrow" style={arrowStyle} /> */}
            </div>
        </>
    );
};

export default TourOverlay;
