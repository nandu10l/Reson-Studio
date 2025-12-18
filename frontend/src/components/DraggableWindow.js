import React, { useState, useRef, useEffect } from 'react';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import '../styles/daw.css'; // Ensure we have styles

const DraggableWindow = ({ title, onClose, content, initialPosition = { x: 100, y: 100 }, width = 400, height = 300, children }) => {
    const [position, setPosition] = useState(initialPosition);
    const [size, setSize] = useState({ width, height }); // Track size for restore
    const [isDragging, setIsDragging] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const dragStartInfo = useRef({ x: 0, y: 0, startX: 0, startY: 0 });

    const handleMouseDown = (e) => {
        if (isMaximized) return; // Disable drag when maximized
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

    const toggleMaximize = () => {
        setIsMaximized(!isMaximized);
    };

    const windowStyle = isMaximized ? {
        position: 'fixed',
        top: 48, // Below Transport/Navbar
        left: 0,
        width: '100vw',
        height: 'calc(100vh - 48px)',
        zIndex: 1001 // Higher than regular windows
    } : {
        position: 'absolute',
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        zIndex: 1000
    };

    return (
        <div
            className={`draggable-window ${isMaximized ? 'maximized' : ''}`}
            style={windowStyle}
        >
            <div
                className="window-header"
                onMouseDown={handleMouseDown}
                style={{ cursor: isMaximized ? 'default' : 'move' }}
                onDoubleClick={toggleMaximize}
            >
                <div className="window-title">{title}</div>
                <div className="window-controls">
                    <button onClick={toggleMaximize} className="window-control-btn" title={isMaximized ? "Restore" : "Maximize"}>
                        {isMaximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                    </button>
                    <button onClick={onClose} className="window-control-btn" title="Close">
                        <X size={14} />
                    </button>
                </div>
            </div>
            <div className="window-content" style={{ height: 'calc(100% - 30px)' }}> {/* Adjust for header height */}
                {children}
            </div>
        </div>
    );
};

export default DraggableWindow;
