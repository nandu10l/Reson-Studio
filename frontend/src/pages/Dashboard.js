import React, { useState, useRef, useEffect } from 'react';
import Navbar from '../components/Navbar';
import ProjectSidebar from '../components/ProjectSidebar';
import TransportBar from '../components/TransportBar';
import Timeline from '../components/Timeline';
import TrackList from '../components/TrackList';
import Mixer from '../components/Mixer';
import Inspector from '../components/Inspector';
import PluginPanel from '../components/PluginPanel';
import SessionBrowser from '../components/SessionBrowser';
import { GripVertical } from 'lucide-react';
import '../styles/daw.css';

function Dashboard() {
  const [playing, setPlaying] = useState(false);
  const [selectedClip, setSelectedClip] = useState(null);
  const [view, setView] = useState('arrange'); // arrange | projects | settings | home
  
  // State for panel widths for sideways resizing
  const [browserWidth, setBrowserWidth] = useState(240);
  const [inspectorWidth, setInspectorWidth] = useState(300);
  
  const resizeState = useRef({ resizing: false, startX: 0, startWidth: 0, target: null });

  // Cleanup effect
  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', onResizeMove);
      window.removeEventListener('pointerup', onResizeEnd);
    };
  }, []);

  const startResize = (e, targetPanel) => {
    // Only left button
    if (e.button && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const currentWidth = targetPanel === 'browser' ? browserWidth : inspectorWidth;
    
    resizeState.current = {
      resizing: true,
      startX: e.clientX,
      startWidth: currentWidth,
      target: targetPanel,
    };

    // Add global listeners
    window.addEventListener('pointermove', onResizeMove);
    window.addEventListener('pointerup', onResizeEnd);
    document.body.style.userSelect = 'none'; // Prevent text selection during drag
    document.body.style.cursor = 'ew-resize';
  };

  const onResizeMove = (e) => {
    const rs = resizeState.current;
    if (!rs.resizing) return;
    
    const deltaX = e.clientX - rs.startX;
    let newWidth;
    const minWidth = 100;

    if (rs.target === 'browser') {
      newWidth = Math.max(minWidth, rs.startWidth + deltaX);
      setBrowserWidth(newWidth);
    } else if (rs.target === 'inspector') {
      // Right panel moves opposite direction relative to startX
      newWidth = Math.max(minWidth, rs.startWidth - deltaX);
      setInspectorWidth(newWidth);
    }
  };

  const onResizeEnd = () => {
    resizeState.current = { resizing: false, startX: 0, startWidth: 0, target: null };
    window.removeEventListener('pointermove', onResizeMove);
    window.removeEventListener('pointerup', onResizeEnd);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  };

  function renderView() {
    switch (view) {
      case 'projects':
        return (
          <div className="projects-view">
            <h2>Projects</h2>
            <SessionBrowser />
          </div>
        );
      case 'settings':
        return (
          <div className="settings-view">
            <h2>Settings</h2>
            <p>App preferences will go here.</p>
          </div>
        );
      case 'home':
        return (
          <div className="home-view">
            <h2>Welcome</h2>
            <p>Welcome to Reson Studio — use the left projects view or the arrange view to get started.</p>
          </div>
        );
      case 'arrange':
      default:
        return (
          // Apply CSS variables to control grid columns in daw.css
          <div className="daw-root">
            <div 
              className="daw-main" 
              style={{ 
                '--browser-width': `${browserWidth}px`, 
                '--inspector-width': `${inspectorWidth}px` 
              }}
            >
              {/* 1. Left Panel (Session Browser) */}
              <div className="session-browser">
                <ProjectSidebar />
              </div>
              
              {/* 2. Left Resizer */}
              <div 
                className="resizer left-resizer" 
                onPointerDown={(e) => startResize(e, 'browser')}
              >
                <GripVertical size={12} />
              </div>

              {/* 3. Center Canvas */}
              <div className="center-canvas">
                <div className="track-area">
                  <Timeline />
                  <TrackList onSelectClip={(c) => setSelectedClip(c)} />
                </div>
                <Mixer />
              </div>
              
              {/* 4. Right Resizer */}
              <div 
                className="resizer right-resizer" 
                onPointerDown={(e) => startResize(e, 'inspector')}
              >
                <GripVertical size={12} />
              </div>

              {/* 5. Right Panel (Inspector/PluginPanel) */}
              <Inspector selected={selectedClip} />
              {/* The PluginPanel element should likely be integrated/toggled inside Inspector or share its column */}
              {/* For simplicity in the grid, we'll keep only one main right panel component visible */}
              {/* <PluginPanel /> */} 
            </div>
          </div>
        );
    }
  }

  return (
    <div>
      
      <Navbar onChangeView={(v) => setView(v)} currentView={view} />
      <TransportBar playing={playing} onPlayToggle={() => setPlaying((p) => !p)} bpm={120} />
      {renderView()}
    </div>
  );
}

export default Dashboard;