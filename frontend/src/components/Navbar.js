import React, { useEffect, useState, useRef } from 'react';
import { Play, Stop, Pause } from './icons/BlenderIcons';
import GuideBox from './GuideBox';
import NewProjectModal from './NewProjectModal';
import { useGuide } from '../contexts/GuideContext';
import { useProject } from '../contexts/ProjectContext';
import '../styles/butter/Header.css';
import '../styles/blender-icons.css';

function Navbar({
  onChangeView,
  currentView = 'arrange',
  onCreateProject,
  onSaveProject
}) {
  const {
    getAllProjectData, // Assuming a getter or just grabbing pieces
    patterns,
    channels,
    playlistTracks,
    bpm,
    isPlaying,
    togglePlayback,
    updateBpm,
    stopPlayback,
    currentProjectPath,
    setCurrentProjectPath,
    playbackMode,
    setPlaybackMode,
    isRecording,
    setIsRecording,
    importAudioFile
  } = useProject();
  const [isElectron, setIsElectron] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const { useGuideHandlers } = useGuide();

  // Menu State
  const [activeMenu, setActiveMenu] = useState(null);
  const menuRef = useRef(null);

  // Transport State
  // const [mode, setMode] = useState('PAT'); // Moved to Context
  // const [isRecording, setIsRecording] = useState(false); // Moved to Context

  // Time State
  const [currentTime, setCurrentTime] = useState(0);
  const intervalRef = useRef(null);

  // Sync internal timer with isPlaying from context
  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentTime(prev => prev + 0.1);
      }, 100); // 100ms
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying]);

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const ms = Math.floor((time % 1) * 100);
    return { m: minutes, s: seconds.toString().padStart(2, '0'), ms: ms.toString().padStart(2, '0') };
  };

  useEffect(() => {
    setIsElectron(!!(window && window.electronAPI));
    if (window && window.electronAPI) {
      window.electronAPI.isMaximized().then((res) => setIsMaximized(res));
    }

    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setActiveMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const minimize = () => window.electronAPI?.minimize();
  const toggleMaximize = async () => {
    await window.electronAPI?.maximize();
    const res = await window.electronAPI?.isMaximized();
    setIsMaximized(res);
  };
  const closeWin = () => window.electronAPI?.close();

  const getProjectDataString = () => {
    return JSON.stringify({
      version: "1.0.0",
      bpm,
      patterns,
      channels,
      playlistTracks
    }, null, 2);
  };

  const handleSave = async () => {
    if (!window.electronAPI) return;

    if (currentProjectPath) {
      // Overwrite
      const data = getProjectDataString();
      const result = await window.electronAPI.saveFileSilent(currentProjectPath, data);
      if (result && result.success) {
        console.log("Project saved to:", currentProjectPath);
        // flash UI or toast?
      }
    } else {
      await handleSaveAs();
    }
  };

  const handleSaveAs = async () => {
    if (!window.electronAPI?.saveFile) return;
    const data = getProjectDataString();
    const result = await window.electronAPI.saveFile(data); // Opens dialog
    if (result && result.success) {
      setCurrentProjectPath(result.filePath);
      console.log("Project saved as:", result.filePath);
      document.title = `Reson Studio - ${result.filePath.split(/[\\/]/).pop()}`;
    }
  };

  const handleSaveNewVersion = async () => {
    if (!currentProjectPath) {
      await handleSaveAs();
      return;
    }

    // logic to increment version: project.reson -> project_2.reson
    let newPath = currentProjectPath;
    const ext = newPath.split('.').pop();
    const base = newPath.substring(0, newPath.lastIndexOf('.'));

    // Check for existing _N pattern
    const match = base.match(/_(\d+)$/);
    if (match) {
      const num = parseInt(match[1]) + 1;
      newPath = base.substring(0, base.lastIndexOf('_')) + `_${num}.${ext}`;
    } else {
      newPath = `${base}_2.${ext}`;
    }

    const data = getProjectDataString();
    const result = await window.electronAPI.saveFileSilent(newPath, data);
    if (result && result.success) {
      setCurrentProjectPath(newPath);
      console.log("New version saved:", newPath);
      document.title = `Reson Studio - ${newPath.split(/[\\/]/).pop()}`;
    }
  };

  const handleMenuClick = (menuName) => {
    setActiveMenu(activeMenu === menuName ? null : menuName);
  };

  const handleOptionClick = async (action) => {
    console.log("Menu action:", action);
    setActiveMenu(null);
    if (action === 'new') setShowNewProjectModal(true);
    if (action === 'save') handleSave();
    if (action === 'save_as') handleSaveAs();
    if (action === 'save_new_version') handleSaveNewVersion();
    if (action === 'open' && window.electronAPI?.openFileDialog) {
      window.electronAPI.openFileDialog().then(paths => {
        if (paths && paths.length > 0) console.log('Selected:', paths[0]);
      });
    }
    if (action === 'add_audio_file') {
      // Import audio file - handled by ProjectContext
      if (importAudioFile) {
        await importAudioFile();
      }
    }
    if (action === 'exit') closeWin();
  };

  const MENU_ITEMS = {
    File: [
      { label: "New (Basic 808 with limiter)", action: "new" },
      { label: "New from template", action: "new_template", right: ">" },
      { label: "Open...", action: "open", shortcut: "Ctrl+O" },
      { type: "divider" },
      { label: "Save", action: "save", shortcut: "Ctrl+S" },
      { label: "Save as...", action: "save_as", shortcut: "Shift+Ctrl+S" },
      { label: "Save new version", action: "save_new_version", shortcut: "Ctrl+N" },
      { label: "Save to new project folder...", action: "save_new_folder" },
      { label: "Save as template...", action: "save_template" },
      { type: "divider" },
      { label: "Import", action: "import", right: ">" },
      { label: "Export", action: "export", right: ">" },
      { type: "divider" },
      { label: "Revert to last backup", action: "revert_backup" },
      { type: "divider" },
      { label: "Exit", action: "exit" },
    ],
    Edit: [
      { label: "Undo", action: "undo" },
      { label: "Redo", action: "redo" },
      { type: "divider" },
      { label: "Cut", action: "cut" },
      { label: "Copy", action: "copy" },
      { label: "Paste", action: "paste" },
    ],
    Add: [
      { label: "Channel", action: "add_channel" },
      { label: "Pattern", action: "add_pattern" },
      { type: "divider" },
      { label: "Add Audio File (MP3/WAV)", action: "add_audio_file" },
    ],
    Patterns: [
      { label: "Find first empty", action: "find_empty" },
      { label: "Clone", action: "clone_pattern" },
    ],
    View: [
      { label: "Playlist", action: "view_playlist" },
      { label: "Piano roll", action: "view_pianoroll" },
      { label: "Channel rack", action: "view_channelrack" },
      { label: "Mixer", action: "view_mixer" },
      { label: "Browser", action: "view_browser" },
    ],
    Options: [
      { label: "MIDI settings", action: "opt_midi" },
      { label: "Audio settings", action: "opt_audio" },
      { label: "General settings", action: "opt_general" },
    ],
    Tools: [
      { label: "Macros", action: "tools_macros" },
    ],
    Help: [
      { label: "Help index", action: "help_index" },
      { label: "About", action: "about" },
    ],
  };

  return (
    <nav className="navbar" style={{ justifyContent: 'space-between', padding: '0', position: 'relative', zIndex: 999999 }}>
      <div className="navbar-left" style={{ display: 'flex', alignItems: 'center', height: '100%' }}>

        {/* MENU BAR */}
        <div className="menu-container" ref={menuRef} style={{ height: '100%', alignItems: 'center', backgroundColor: '#1e1e1e', padding: '0 12px', marginRight: 4, borderRight: '1px solid rgba(255, 255, 255, 0.08)', position: 'relative', zIndex: 999999 }}>
          {Object.entries(MENU_ITEMS).map(([menuName, items]) => (
            <div key={menuName} className="menu-wrapper" style={{ position: 'relative', zIndex: 999999 }}>
              <button
                className={`menu-button ${activeMenu === menuName ? "active" : ""}`}
                onClick={() => handleMenuClick(menuName)}
                style={{ 
                  fontSize: '12px', 
                  fontWeight: 500, 
                  letterSpacing: '0.01em', 
                  color: '#b3b3b3', 
                  padding: '6px 12px', 
                  marginRight: '2px', 
                  textTransform: 'none',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'color 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  if (activeMenu !== menuName) {
                    e.currentTarget.style.color = '#d0d0d0';
                  }
                }}
                onMouseLeave={(e) => {
                  if (activeMenu !== menuName) {
                    e.currentTarget.style.color = '#b3b3b3';
                  }
                }}
              >
                {menuName}
              </button>
              {activeMenu === menuName && (
                <div className="dropdown-menu" style={{ zIndex: 999999 }}>
                  {items.map((item, index) => {
                    if (item.type === "divider") {
                      return <div key={index} className="dropdown-divider" />;
                    }
                    if (item.type === "header") {
                      return <div key={index} className="dropdown-item" style={{ color: '#888', cursor: 'default', pointerEvents: 'none' }}>{item.label}</div>;
                    }
                    return (
                      <div
                        key={index}
                        className="dropdown-item"
                        onClick={() => handleOptionClick(item.action)}
                      >
                        <span>{item.label}</span>
                        {item.shortcut && <span style={{ marginLeft: 10, color: '#888' }}>{item.shortcut}</span>}
                        {item.right && <span style={{ marginLeft: 10, color: '#888' }}>{item.right}</span>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* TRANSPORT PANEL */}
        <div className="transport-panel" style={{ display: 'flex', alignItems: 'center', backgroundColor: '#1e1e1e', height: '100%', padding: '0 14px', borderLeft: '1px solid rgba(255, 255, 255, 0.08)' }}>
          {/* Pat/Song Mode */}
          <div className="mode-switch" style={{ display: 'flex', flexDirection: 'column', marginRight: 12, gap: 0 }}>
            <button
              className={`mode-btn ${playbackMode === 'PAT' ? 'active' : ''}`}
              onClick={() => setPlaybackMode('PAT')}
              style={{
                background: playbackMode === 'PAT' ? '#4ade80' : '#2a2a2a',
                color: playbackMode === 'PAT' ? '#000' : '#9ca3af',
                fontSize: '9px', fontWeight: 'bold', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '2px 2px 0 0', padding: '2px 6px', cursor: 'pointer', lineHeight: 1.2, transition: 'all 0.15s ease'
              }}
            >
              PAT
            </button>
            <button
              className={`mode-btn ${playbackMode === 'SONG' ? 'active' : ''}`}
              onClick={() => setPlaybackMode('SONG')}
              style={{
                background: playbackMode === 'SONG' ? '#4ade80' : '#2a2a2a',
                color: playbackMode === 'SONG' ? '#000' : '#9ca3af',
                fontSize: '9px', fontWeight: 'bold', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '0 0 2px 2px', borderTop: 'none', padding: '2px 6px', cursor: 'pointer', lineHeight: 1.2, transition: 'all 0.15s ease'
              }}
            >
              SONG
            </button>
          </div>

          {/* Play/Stop/Rec */}
          <div className="transport-controls" style={{ display: 'flex', gap: 6, marginRight: 18 }}>
            <button
              onClick={togglePlayback}
              title={isPlaying ? "Pause" : "Play"}
              style={{
                background: isPlaying ? '#4ade80' : '#2a2a2a',
                color: isPlaying ? '#000' : '#b3b3b3',
                border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '3px', width: '28px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s ease'
              }}
            >
              {isPlaying ? (
                <Pause size={14} color={isPlaying ? '#000' : '#b3b3b3'} className="blender-icon" active={isPlaying} />
              ) : (
                <Play size={14} color="#b3b3b3" className="blender-icon" />
              )}
            </button>
            <button
              onClick={() => { stopPlayback(); setCurrentTime(0); }}
              title="Stop"
              style={{
                background: '#2a2a2a',
                color: '#b3b3b3',
                border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '3px', width: '28px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#363636';
                e.currentTarget.style.color = '#d0d0d0';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#2a2a2a';
                e.currentTarget.style.color = '#b3b3b3';
              }}
            >
              <Stop size={14} color="#b3b3b3" className="blender-icon" />
            </button>
            <button
              onClick={() => setIsRecording(prev => !prev)}
              title="Record"
              style={{
                background: isRecording ? '#ef4444' : '#2a2a2a',
                color: isRecording ? '#fff' : '#b3b3b3',
                border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', width: '28px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginLeft: 4, transition: 'all 0.15s ease'
              }}
            >
              <div style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: isRecording ? '#fff' : 'transparent',
                border: isRecording ? 'none' : '2px solid #b3b3b3'
              }} />
            </button>
          </div>

          {/* BPM */}
          <div className="bpm-display" style={{
            background: '#2a2a2a', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '4px', padding: '0 8px', display: 'flex', alignItems: 'center', marginRight: 12, height: 28
          }}>
            <input
              type="number"
              value={bpm}
              onChange={(e) => updateBpm && updateBpm(parseInt(e.target.value) || 120)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#b3b3b3',
                fontSize: '16px',
                fontFamily: 'monospace',
                fontWeight: 'bold',
                width: 40,
                textAlign: 'right',
                outline: 'none',
                padding: 0,
                margin: 0
              }}
            />
            <span style={{ fontSize: '10px', color: '#9ca3af', marginLeft: 2, paddingTop: 4 }}>.000</span>
          </div>

          {/* Time */}
          <div className="time-display" style={{
            background: '#2a2a2a', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '4px', padding: '4px 10px', display: 'flex', alignItems: 'center', height: 28, minWidth: 90, justifyContent: 'center'
          }}>
            <span style={{ color: '#4ade80', fontSize: '16px', fontFamily: 'monospace', fontWeight: 'bold' }}>
              {formatTime(currentTime).m}:{formatTime(currentTime).s}
              <span style={{ fontSize: '10px', color: '#9ca3af' }}>:{formatTime(currentTime).ms}</span>
            </span>
          </div>
        </div>

      </div>

      <div className="navbar-menu" style={{ marginLeft: 20, flex: 1 }}>


        {/* Search and User/App Controls */}
        <div className="right-controls">


          <GuideBox />
        </div>
      </div>

      {/* Window controls removed - using Electron's autoHideMenuBar */}

      <NewProjectModal
        isOpen={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
        onCreateProject={onCreateProject}
      />
    </nav>
  );
}

export default Navbar;