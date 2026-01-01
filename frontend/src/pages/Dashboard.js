import React, { useState, useRef, useEffect } from 'react';
import Navbar from '../components/Navbar';
import ProjectSidebar from '../components/ProjectSidebar';
import TransportBar from '../components/TransportBar';
import Timeline from '../components/Timeline';
import TrackList from '../components/TrackList';
import Playhead from '../components/Playhead';
import Mixer from '../components/Mixer';
// import Inspector from '../components/Inspector';
import PluginPanel from '../components/PluginPanel';
import SessionBrowser from '../components/SessionBrowser';
import TitleBar from '../components/TitleBar';
import { GripVertical } from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';
import * as Tone from 'tone';
import '../styles/daw.css';

import DraggableWindow from '../components/DraggableWindow';
import PianoRoll from '../components/PianoRoll';
import ChannelRack from '../components/ChannelRack';
// Mixer is already imported

function Dashboard() {
  const { playheadPosition, setPlayheadPosition, isPlaying, bpm, playlistTracks, seek } = useProject();

  // Window states
  const [activeWindows, setActiveWindows] = useState({
    mixer: false,
    pianoRoll: false,
    channelRack: false,
    playlist: true, // Default view
    browser: true
  });

  const toggleWindow = (name) => {
    setActiveWindows(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  const [playing, setPlaying] = useState(false);
  const [selectedClip, setSelectedClip] = useState(null);
  const [view, setView] = useState('arrange'); // arrange | projects | settings | home
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);

  // State for panel widths for sideways resizing
  const [browserWidth, setBrowserWidth] = useState(240);

  // Timeline scroll state
  const [timelineScrollLeft, setTimelineScrollLeft] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pixelsPerBeat, setPixelsPerBeat] = useState(40);
  const trackAreaRef = useRef(null);
  const [playheadHeight, setPlayheadHeight] = useState('100%');

  // Update playhead height to span all content
  useEffect(() => {
    if (!trackAreaRef.current) return;

    const updateHeight = () => {
      const trackArea = trackAreaRef.current;
      if (trackArea) {
        // Use scrollHeight to get full content height, or clientHeight if no scroll
        const height = Math.max(trackArea.scrollHeight, trackArea.clientHeight);
        setPlayheadHeight(`${height}px`);
      }
    };

    updateHeight();

    // Update on resize or content changes
    const resizeObserver = new ResizeObserver(updateHeight);
    if (trackAreaRef.current) {
      resizeObserver.observe(trackAreaRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [playlistTracks]); // Update when tracks change

  // Auto-scroll to keep playhead visible during playback (using rAF for smoothness)
  useEffect(() => {
    if (!trackAreaRef.current || !isPlaying) return;

    let rAF;
    const scrollLoop = () => {
      if (!trackAreaRef.current) return;

      const seconds = Tone.Transport.seconds;
      const beats = seconds * (bpm / 60);
      const playheadPixelX = 200 + (beats * pixelsPerBeat); // 200px header offset

      const trackArea = trackAreaRef.current;
      const scrollLeft = trackArea.scrollLeft;
      const viewportWidth = trackArea.clientWidth;

      // Margins for auto-scroll trigger
      const margin = viewportWidth * 0.2;

      // Simple discrete scroll logic
      if (playheadPixelX > scrollLeft + viewportWidth - margin) {
        // Scroll forward in chunks or smooth?
        // Smooth scroll following playhead:
        trackArea.scrollLeft = playheadPixelX - (viewportWidth * 0.2);
      } else if (playheadPixelX < scrollLeft) {
        // Jump back if playhead jumped (looping/seeking)
        trackArea.scrollLeft = Math.max(0, playheadPixelX - margin);
      }

      rAF = requestAnimationFrame(scrollLoop);
    };

    rAF = requestAnimationFrame(scrollLoop);
    return () => cancelAnimationFrame(rAF);
  }, [isPlaying, pixelsPerBeat, bpm]);

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

    resizeState.current = {
      resizing: true,
      startX: e.clientX,
      startWidth: browserWidth,
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
            <SessionBrowser projects={projects} />
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
                '--inspector-width': '0px'
              }}
            >
              {/* 1. Left Panel (Session Browser) */}
              <div className="session-browser">
                <ProjectSidebar projects={projects} />
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
                <div className="track-area" ref={trackAreaRef} style={{ position: 'relative' }}>
                  {/* Unified playhead that spans both timeline and tracks */}
                  <Playhead
                    mode="smooth"
                    pixelsPerBeat={pixelsPerBeat}
                    headerOffset={200}
                    beatsPerBar={4}
                    style={{ height: playheadHeight }}
                  />
                  <Timeline
                    measures={64}
                    zoom={zoom}
                    onZoomChange={setZoom}
                    pixelsPerBeat={pixelsPerBeat}
                    onPixelsPerBeatChange={setPixelsPerBeat}
                    playheadPosition={playheadPosition}
                    isPlaying={isPlaying}
                    bpm={bpm}
                    onSeek={seek}
                  />
                  <TrackList
                    measures={64}
                    onSelectClip={(c) => setSelectedClip(c)}
                    pixelsPerBeat={pixelsPerBeat}
                    playheadPosition={playheadPosition}
                  />
                </div>
              </div>
            </div>
          </div >
        );
    }
  }

  return (
    <div className="app-container">
      <TitleBar />
      <Navbar
        onChangeView={(v) => setView(v)}
        currentView={view}
        onCreateProject={(project) => setProjects(prev => [...prev, project])}
        onSaveProject={() => console.log('Project saved:', currentProject)}
      />
      <TransportBar
        activeWindows={activeWindows}
        onToggleWindow={toggleWindow}
      />
      <div className="view-container">
        {renderView()}
      </div>

      {/* Floating Windows */}
      {activeWindows.pianoRoll && (
        <DraggableWindow title="Piano Roll" onClose={() => toggleWindow('pianoRoll')} initialPosition={{ x: 100, y: 100 }} width={800} height={400}>
          <PianoRoll />
        </DraggableWindow>
      )}

      {activeWindows.channelRack && (
        <DraggableWindow title="Channel Rack" onClose={() => toggleWindow('channelRack')} initialPosition={{ x: 150, y: 150 }}>
          <ChannelRack />
        </DraggableWindow>
      )}

      {/* Mixer as a floating window if enabled (overriding the fixed one currently in arrange view?) 
          For now, I'll just add it as floating and maybe hide the one in renderView if needed, or just let them coexist/user choice.
          Actually, the user asked for FL style where these pop out.
      */}
      {activeWindows.mixer && (
        <DraggableWindow title="Mixer" onClose={() => toggleWindow('mixer')} initialPosition={{ x: 100, y: 150 }} width={1120} height={400}>
          <Mixer />
        </DraggableWindow>
      )}
    </div>
  );
}

export default Dashboard;