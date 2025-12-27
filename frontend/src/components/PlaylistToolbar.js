import React from 'react';
import {
    Magnet, Edit, Brush, Trash, Speaker, Scissors,
    MousePointer, BoxSelect, ZoomIn, Play
} from './icons/BlenderIcons';

export default function PlaylistToolbar({ activeTool = 'draw', onToolChange }) {

    return (
        <div className="playlist-toolbar" style={{
            height: '36px',
            background: '#363d43',
            borderBottom: '1px solid #1e2226',
            display: 'flex',
            alignItems: 'center',
            padding: '0 8px',
            gap: '8px',
            flexShrink: 0,
            userSelect: 'none'
        }}>
            {/* Snap Controls */}
            <div className="toolbar-group" style={{ display: 'flex', alignItems: 'center', marginRight: '8px' }}>
                <button className="toolbar-btn" title="Snap to Grid" style={{
                    background: 'transparent', border: 'none', cursor: 'pointer', color: '#b3b3b3', display: 'flex', alignItems: 'center'
                }}>
                    <Magnet size={14} />
                </button>
                <div style={{
                    fontSize: '11px',
                    color: '#b3b3b3',
                    marginLeft: '4px',
                    cursor: 'pointer',
                    background: '#282c31',
                    padding: '2px 6px',
                    borderRadius: '2px',
                    minWidth: '30px',
                    textAlign: 'center'
                }}>
                    Line
                </div>
            </div>

            <div className="separator" style={{ width: '1px', height: '16px', background: '#4b5563', margin: '0 4px' }} />

            {/* Main Tools */}
            <div className="toolbar-group" style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                <ToolButton icon={Edit} name="draw" activeTool={activeTool} onClick={onToolChange} title="Draw (P)" />
                <ToolButton icon={Brush} name="paint" activeTool={activeTool} onClick={onToolChange} title="Paint (B)" />
                <ToolButton icon={Trash} name="delete" activeTool={activeTool} onClick={onToolChange} title="Delete (D)" />
                <ToolButton icon={Speaker} name="mute" activeTool={activeTool} onClick={onToolChange} title="Mute (T)" />
                <ToolButton icon={Scissors} name="slice" activeTool={activeTool} onClick={onToolChange} title="Slice (C)" />
                <ToolButton icon={BoxSelect} name="select" activeTool={activeTool} onClick={onToolChange} title="Select (E)" />
                <ToolButton icon={ZoomIn} name="zoom" activeTool={activeTool} onClick={onToolChange} title="Zoom (Z)" />
                <ToolButton icon={Play} name="playback" activeTool={activeTool} onClick={onToolChange} title="Playback (Y)" />
            </div>
        </div>
    );
}

const ToolButton = ({ icon: Icon, name, activeTool, onClick, title }) => (
    <button
        onClick={() => onClick && onClick(name)}
        title={title}
        style={{
            width: '28px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: activeTool === name ? '#60a5fa' : 'transparent', // Blue highlight for active
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            color: activeTool === name ? '#fff' : '#9ca3af',
            transition: 'all 0.1s'
        }}
        onMouseEnter={(e) => {
            if (activeTool !== name) {
                e.currentTarget.style.color = '#fff';
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            }
        }}
        onMouseLeave={(e) => {
            if (activeTool !== name) {
                e.currentTarget.style.color = '#9ca3af';
                e.currentTarget.style.background = 'transparent';
            }
        }}
    >
        <Icon size={14} />
    </button>
);
