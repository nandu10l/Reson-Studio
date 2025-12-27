import React, { useState, useRef, useEffect } from 'react';
import GuideBox from './GuideBox';
import NewProjectModal from './NewProjectModal';
import { useProject } from '../contexts/ProjectContext';
import '../styles/blender-icons.css';
import './Navbar.css';

function Navbar({
  onChangeView,
  currentView = 'arrange',
  onCreateProject,
  onSaveProject
}) {
  const {
    patterns,
    channels,
    playlistTracks,
    bpm,
    currentProjectPath,
    setCurrentProjectPath,
    importAudioFile
  } = useProject();
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [activeMenu, setActiveMenu] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
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
      const data = getProjectDataString();
      const result = await window.electronAPI.saveFileSilent(currentProjectPath, data);
      if (result && result.success) {
        console.log("Project saved to:", currentProjectPath);
      }
    } else {
      await handleSaveAs();
    }
  };

  const handleSaveAs = async () => {
    if (!window.electronAPI?.saveFile) return;
    const data = getProjectDataString();
    const result = await window.electronAPI.saveFile(data);
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

    let newPath = currentProjectPath;
    const ext = newPath.split('.').pop();
    const base = newPath.substring(0, newPath.lastIndexOf('.'));

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
      if (importAudioFile) {
        await importAudioFile();
      }
    }
    if (action === 'exit' && window.electronAPI) {
      window.electronAPI.close();
    }
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
    <nav className="command-strip" ref={menuRef}>
      {/* Menu Bar */}
      <div className="menu-container">
        {Object.entries(MENU_ITEMS).map(([menuName, items]) => (
          <div key={menuName} className="menu-wrapper">
            <button
              className={`menu-button ${activeMenu === menuName ? "active" : ""}`}
              onClick={() => handleMenuClick(menuName)}
              title={menuName}
            >
              {menuName}
            </button>
            {activeMenu === menuName && (
              <div className="dropdown-menu">
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
                      title={item.label}
                    >
                      <span>{item.label}</span>
                      {item.shortcut && <span className="dropdown-shortcut">{item.shortcut}</span>}
                      {item.right && <span className="dropdown-right">{item.right}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Right: Guide */}
      <div className="global-actions">
        <GuideBox />
      </div>

      <NewProjectModal
        isOpen={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
        onCreateProject={onCreateProject}
      />
    </nav>
  );
}

export default Navbar;
