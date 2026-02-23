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
import PluginToolbar from '../components/PluginToolbar';
import SessionBrowser from '../components/SessionBrowser';
import TitleBar from '../components/TitleBar';
import { GripVertical } from 'lucide-react';
import { useProject } from '../contexts/ProjectContext';
import * as Tone from 'tone';
import { generateWaveform, audioDurationToBeats, audioBufferToWav } from '../utils/audioImport';
import '../styles/daw.css';

import DraggableWindow from '../components/DraggableWindow';
import PianoRoll from '../components/PianoRoll';
import ChannelRack from '../components/ChannelRack';
import SampleEditor from '../components/SampleEditor';
// Mixer is already imported
import WelcomeModal from '../components/WelcomeModal';
import TourOverlay from '../components/TourOverlay';
import { tourSteps } from '../config/tourSteps';
import AIComposer from '../components/AIComposer/AIComposer';

function Dashboard() {
  const { playheadPosition, setPlayheadPosition, isPlaying, bpm, playlistTracks, setPlaylistTracks, seek, createTemplateProject, setAudioClips } = useProject();
  const [showWelcome, setShowWelcome] = useState(true);
  const [activeTour, setActiveTour] = useState(null); // 'main', 'pianoRoll', 'channelRack', 'mixer'

  // Window states
  const [activeWindows, setActiveWindows] = useState({
    mixer: false,
    pianoRoll: false,
    channelRack: false,
    sampleEditor: false,
    aiComposer: false,
    playlist: true, // Default view
    browser: true
  });

  // Sample editor state
  const [editingSample, setEditingSample] = useState(null);

  const toggleWindow = (name) => {
    setActiveWindows(prev => ({
      ...prev,
      [name]: !prev[name]
    }));
  };

  const startTour = (tourId) => {
    setActiveTour(tourId);
  };

  // Open sample editor for a specific audio clip
  const openSampleEditor = (audioClip) => {
    setEditingSample(audioClip);
    setActiveWindows(prev => ({ ...prev, sampleEditor: true }));
  };

  const handleSaveSample = async (audioBuffer, name) => {
    if (!audioBuffer) return;

    try {
      // 1. Convert AudioBuffer to WAV Blob/File
      const wavBlob = audioBufferToWav(audioBuffer);
      const clipName = (name || editingSample?.name || 'Edited Sample');
      const fileName = clipName.replace(/\.wav$/i, '') + '.wav';
      const file = new File([wavBlob], fileName, { type: 'audio/wav' });

      // 2. Generate waveform & duration
      const waveform = generateWaveform(audioBuffer, 2000);
      const durationBeats = audioDurationToBeats(audioBuffer, bpm);

      // 3. Create a new audio clip object
      const newAudioClipId = Date.now();
      const newAudioClip = {
        id: newAudioClipId,
        name: clipName,
        fileName: fileName,
        file: file,
        audioBuffer: audioBuffer,
        waveform: waveform,
        duration: audioBuffer.duration,
        durationBeats: durationBeats,
        sampleRate: audioBuffer.sampleRate,
        url: URL.createObjectURL(wavBlob)
      };

      // 4. Add to audioClips state
      setAudioClips(prev => [...prev, newAudioClip]);

      // 5. Place on first empty track (or first track as fallback)
      const targetTrack = playlistTracks.find(t => t.clips.length === 0) || playlistTracks[0];
      if (targetTrack) {
        const trackClip = {
          id: Date.now() + 1,
          type: 'audio',
          audioClipId: newAudioClipId,
          offset: 0,
          length: durationBeats,
          name: clipName
        };
        setPlaylistTracks(prev => prev.map(t =>
          t.id === targetTrack.id
            ? { ...t, clips: [...t.clips, trackClip] }
            : t
        ));
      }

      console.log('New audio clip created and added to playlist:', clipName);
    } catch (error) {
      console.error("Error saving sample:", error);
    }
  };

  const [playing, setPlaying] = useState(false);
  const [selectedClip, setSelectedClip] = useState(null);
  const [view, setView] = useState('arrange'); // arrange | projects | settings | home
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);

  // State for panel widths for sideways resizing
  const [browserWidth, setBrowserWidth] = useState(240);
  const [pluginToolbarWidth, setPluginToolbarWidth] = useState(220);

  // Plugin toolbar state
  const [isPluginToolbarCollapsed, setIsPluginToolbarCollapsed] = useState(true); // Hidden by default
  const [isPluginToolbarFloating, setIsPluginToolbarFloating] = useState(false);

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

    const initialWidth = targetPanel === 'browser' ? browserWidth :
      targetPanel === 'pluginToolbar' ? pluginToolbarWidth : 0;

    resizeState.current = {
      resizing: true,
      startX: e.clientX,
      startWidth: initialWidth,
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
    } else if (rs.target === 'pluginToolbar') {
      newWidth = Math.max(minWidth, rs.startWidth + deltaX);
      setPluginToolbarWidth(newWidth);
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
            {/* Plugin Toolbar Toggle Button - Leftmost */}
            {!isPluginToolbarFloating && (
              <button
                className={`plugin-toolbar-toggle ${!isPluginToolbarCollapsed ? 'active' : ''}`}
                onClick={() => setIsPluginToolbarCollapsed(!isPluginToolbarCollapsed)}
                title={isPluginToolbarCollapsed ? 'Show Plugins' : 'Hide Plugins'}
              >
                <GripVertical size={16} />
              </button>
            )}

            {/* Plugin Toolbar Drawer - Collapsed by default */}
            {!isPluginToolbarFloating && !isPluginToolbarCollapsed && (
              <div className="plugin-toolbar-drawer" style={{ width: `${pluginToolbarWidth}px` }}>
                <div className="plugin-toolbar-drawer-header">
                  <button
                    className="drag-out-btn"
                    onClick={() => {
                      setIsPluginToolbarFloating(true);
                      setIsPluginToolbarCollapsed(true);
                    }}
                    title="Pop out as floating window"
                  >
                    ↗
                  </button>
                </div>
                <PluginToolbar />
              </div>
            )}

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

              {/* 2. Session Browser Resizer */}
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
                    onOpenSampleEditor={openSampleEditor}
                    onOpenPianoRoll={() => toggleWindow('pianoRoll')}
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
        onToggleWindow={toggleWindow}
        onSetPluginToolbarCollapsed={setIsPluginToolbarCollapsed}
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
        <DraggableWindow
          title="Piano Roll"
          onClose={() => toggleWindow('pianoRoll')}
          initialPosition={{ x: 100, y: 180 }}
          width={800}
          height={400}
          onHelp={() => startTour('pianoRoll')}
        >
          <PianoRoll />
        </DraggableWindow>
      )}

      {activeWindows.channelRack && (
        <DraggableWindow
          title="Channel Rack"
          onClose={() => toggleWindow('channelRack')}
          initialPosition={{ x: 150, y: 150 }}
          onHelp={() => startTour('channelRack')}
        >
          <ChannelRack />
        </DraggableWindow>
      )}

      {activeWindows.mixer && (
        <DraggableWindow
          title="Mixer"
          onClose={() => toggleWindow('mixer')}
          initialPosition={{ x: 0, y: window.innerHeight - 580 }}
          width={window.innerWidth - 8}
          height={560}
          onHelp={() => startTour('mixer')}
        >
          <Mixer />
        </DraggableWindow>
      )}

      {/* Sample Editor */}
      {activeWindows.sampleEditor && editingSample && (
        <DraggableWindow
          title={`Sample Editor - ${editingSample.name || 'Untitled'}`}
          onClose={() => {
            toggleWindow('sampleEditor');
            setEditingSample(null);
          }}
          initialPosition={{ x: 80, y: 80 }}
          width={900}
          height={500}
        >
          <SampleEditor
            audioClip={editingSample}
            onClose={() => {
              toggleWindow('sampleEditor');
              setEditingSample(null);
            }}
            onSave={handleSaveSample}
          />
        </DraggableWindow>
      )}

      {/* Floating Plugin Toolbar */}
      {isPluginToolbarFloating && (
        <DraggableWindow
          title="Plugins"
          onClose={() => setIsPluginToolbarFloating(false)}
          initialPosition={{ x: 50, y: 100 }}
          width={280}
          height={600}
        >
          <PluginToolbar />
        </DraggableWindow>
      )}

      {/* AI Composer Panel */}
      {activeWindows.aiComposer && (
        <DraggableWindow
          title="✨ AI Composer"
          onClose={() => toggleWindow('aiComposer')}
          initialPosition={{ x: Math.max(0, window.innerWidth / 2 - 420), y: 130 }}
          width={860}
          height={480}
        >
          <AIComposer />
        </DraggableWindow>
      )}

      {/* Welcome Screen Overlay */}
      {showWelcome && (
        <WelcomeModal
          onClose={() => setShowWelcome(false)}
          onNewProject={(type) => {
            console.log("Creating new project:", type);
            // Handle template creation logic
            createTemplateProject(type);
            setShowWelcome(false);
          }}
          onLoadProject={(proj) => {
            console.log("Loading project:", proj);
            // Here you would handle loading logic
            setShowWelcome(false);
          }}
          onStartTour={() => {
            setShowWelcome(false);
            startTour('main');
          }}
        />
      )}

      {/* Onboarding Tour */}
      <TourOverlay
        isOpen={!!activeTour}
        onClose={() => setActiveTour(null)}
        steps={activeTour ? tourSteps[activeTour] : []}
      />
    </div>
  );
}


export default Dashboard;