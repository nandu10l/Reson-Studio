import React, { useState, useRef, useEffect } from 'react';
import { X, Maximize2, Minimize2, HelpCircle } from 'lucide-react';
import '../styles/daw.css'; // Ensure we have styles

const DraggableWindow = ({ title, onClose, content, initialPosition = { x: 100, y: 100 }, width = 400, height = 300, children, onHelp }) => {
    // ... existing hooks ...
    // ...
    // ...

    // (We will only show the modified header part in the replace call if possible, or the function signature and import)
    // Actually replace_file_content works on lines. Let's do imports first then prop change.
    // Wait, I can do it in one go if I target the top part.

    // Let's split this into two edits for safety or just target the header rendering. 
    // I need to update the prop definition too.

    // Let's do imports first.

    const [position, setPosition] = useState(initialPosition);
    const [size, setSize] = useState({ width, height }); // Track size for restore
    const [isDragging, setIsDragging] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const dragStartInfo = useRef({ x: 0, y: 0, startX: 0, startY: 0 });
    const resizeStartInfo = useRef({ x: 0, y: 0, startWidth: 0, startHeight: 0, startX: 0, startY: 0, edge: '' });

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


    const toggleMaximize = () => {
        setIsMaximized(!isMaximized);
    };

    const handleResizeStart = (e, edge) => {
        if (isMaximized) return;
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);
        resizeStartInfo.current = {
            x: e.clientX,
            y: e.clientY,
            startWidth: size.width,
            startHeight: size.height,
            startX: position.x,
            startY: position.y,
            edge: edge // 'n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'
        };
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (isResizing) {
                const dx = e.clientX - resizeStartInfo.current.x;
                const dy = e.clientY - resizeStartInfo.current.y;
                const { edge, startWidth, startHeight, startX, startY } = resizeStartInfo.current;

                let newWidth = startWidth;
                let newHeight = startHeight;
                let newX = startX;
                let newY = startY;

                const minWidth = 300;
                const minHeight = 200;

                // Handle horizontal resizing
                if (edge.includes('e')) {
                    // Resize from right
                    newWidth = Math.max(minWidth, startWidth + dx);
                } else if (edge.includes('w')) {
                    // Resize from left
                    newWidth = Math.max(minWidth, startWidth - dx);
                    newX = startX + (startWidth - newWidth);
                }

                // Handle vertical resizing
                if (edge.includes('s')) {
                    // Resize from bottom
                    newHeight = Math.max(minHeight, startHeight + dy);
                } else if (edge.includes('n')) {
                    // Resize from top
                    newHeight = Math.max(minHeight, startHeight - dy);
                    newY = startY + (startHeight - newHeight);
                }

                setSize({ width: newWidth, height: newHeight });
                setPosition({ x: newX, y: newY });
            } else if (isDragging) {
                const dx = e.clientX - dragStartInfo.current.x;
                const dy = e.clientY - dragStartInfo.current.y;
                setPosition({
                    x: dragStartInfo.current.startX + dx,
                    y: dragStartInfo.current.startY + dy
                });
            }
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            setIsResizing(false);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        if (isDragging || isResizing) {
            if (isResizing) {
                const edge = resizeStartInfo.current.edge;
                let cursor = 'default';
                if (edge === 'n' || edge === 's') {
                    cursor = 'ns-resize';
                } else if (edge === 'e' || edge === 'w') {
                    cursor = 'ew-resize';
                } else if (edge === 'ne' || edge === 'sw') {
                    cursor = 'nesw-resize';
                } else if (edge === 'nw' || edge === 'se') {
                    cursor = 'nwse-resize';
                }
                document.body.style.cursor = cursor;
                document.body.style.userSelect = 'none';
            }
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, isResizing]);

    const windowStyle = isMaximized ? {
        position: 'fixed',
        top: 124, // TitleBar(32) + Navbar(40) + TransportBar(52)
        left: 0,
        width: '100vw',
        height: 'calc(100vh - 124px)',
        zIndex: 1001,
        overflow: 'visible'
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
                    {onHelp && (
                        <button onClick={onHelp} className="window-control-btn" title="Tour / Help">
                            <HelpCircle size={12} />
                        </button>
                    )}
                    <button onClick={toggleMaximize} className="window-control-btn" title={isMaximized ? "Restore" : "Maximize"}>
                        {isMaximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                    </button>
                    <button onClick={onClose} className="window-control-btn" title="Close">
                        <X size={14} />
                    </button>
                </div>
            </div>
            <div className="window-content" style={{ height: 'calc(100% - 24px)', overflow: 'hidden' }}> {/* Adjust for header height */}
                {children}
            </div>

            {/* Resize Handles */}
            {!isMaximized && (
                <>
                    {/* Edges */}
                    <div className="resize-handle resize-handle-n" onMouseDown={(e) => handleResizeStart(e, 'n')} />
                    <div className="resize-handle resize-handle-s" onMouseDown={(e) => handleResizeStart(e, 's')} />
                    <div className="resize-handle resize-handle-e" onMouseDown={(e) => handleResizeStart(e, 'e')} />
                    <div className="resize-handle resize-handle-w" onMouseDown={(e) => handleResizeStart(e, 'w')} />
                    {/* Corners */}
                    <div className="resize-handle resize-handle-ne" onMouseDown={(e) => handleResizeStart(e, 'ne')} />
                    <div className="resize-handle resize-handle-nw" onMouseDown={(e) => handleResizeStart(e, 'nw')} />
                    <div className="resize-handle resize-handle-se" onMouseDown={(e) => handleResizeStart(e, 'se')} />
                    <div className="resize-handle resize-handle-sw" onMouseDown={(e) => handleResizeStart(e, 'sw')} />
                </>
            )}
        </div>
    );
};

export default DraggableWindow;
