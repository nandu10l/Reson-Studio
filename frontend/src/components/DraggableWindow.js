import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import '../styles/daw.css'; // Ensure we have styles

const DraggableWindow = ({ title, onClose, content, initialPosition = { x: 100, y: 100 }, width = 400, height = 300, children }) => {
    const [position, setPosition] = useState(initialPosition);
    const [isDragging, setIsDragging] = useState(false);
    const dragStartInfo = useRef({ x: 0, y: 0, startX: 0, startY: 0 });

    const handleMouseDown = (e) => {
        setIsDragging(true);
        dragStartInfo.current = {
            x: e.clientX,
            y: e.clientY,
            startX: position.x,
            startY: position.y
        };
        e.stopPropagation(); // Prevent event bubbling
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isDragging) return;
            const dx = e.clientX - dragStartInfo.current.x;
            const dy = e.clientY - dragStartInfo.current.y;
            setPosition({
                x: dragStartInfo.current.startX + dx,
                y: dragStartInfo.current.startY + dy
            });
        };

        const handleMouseUp = () => {
            setIsDragging(false);
        };

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    return (
        <div
            className="draggable-window"
            style={{
                position: 'absolute',
                left: position.x,
                top: position.y,
                width,
                height,
                zIndex: 1000 // Ensure it's on top
            }}
        >
            <div
                className="window-header"
                onMouseDown={handleMouseDown}
                style={{ cursor: 'move' }}
            >
                <div className="window-title">{title}</div>
                <button onClick={onClose} className="window-close-btn">
                    <X size={14} />
                </button>
            </div>
            <div className="window-content">
                {children}
            </div>
        </div>
    );
};

export default DraggableWindow;
