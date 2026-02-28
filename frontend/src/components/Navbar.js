import React, { useState, useRef, useEffect } from 'react';
import GuideBox from './GuideBox';
import NewProjectModal from './NewProjectModal';
import { useProject } from '../contexts/ProjectContext';
import { audioEngine } from '../audio/AudioEngine';
import { exportWav, exportMp3, saveAudioBlob, getLastExportFormat, setLastExportFormat } from '../services/ExportService';
import { audioBufferToWav } from '../utils/audioImport';
import '../styles/blender-icons.css';
import './Navbar.css';

function Navbar({
  onChangeView,
  currentView = 'arrange',
  onCreateProject,
  onSaveProject,
  onToggleWindow,
  onSetPluginToolbarCollapsed
}) {
  const {
    patterns,
    channels,
    playlistTracks,
    audioClips,
    automations,
    mixerInserts,
    bpm,
    currentProjectPath,
    setCurrentProjectPath,
    importAudioFile,
    importMidiFile,
    loadProject,
    createPattern,
    clonePattern,
    findFirstEmptyPattern,
    activePatternId,
    revertToLastBackup,
    undoNotes,
    redoNotes
  } = useProject();
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [activeMenu, setActiveMenu] = useState(null);
  const [activeSubmenu, setActiveSubmenu] = useState(null);
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

  // Build the JSON project data (audio files are saved externally)
  const getProjectData = () => {
    // Serialize audio clips metadata only (no audio data in JSON)
    const serializedAudioClips = audioClips.map((clip) => {
      // Use a safe filename based on clip id and original filename (always .wav)
      const baseName = (clip.fileName || 'audio.wav').replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_');
      const safeFileName = `${clip.id}_${baseName}.wav`;
      return {
        id: clip.id,
        fileName: clip.fileName,
        name: clip.name,
        audioFileName: safeFileName, // relative name in the audio folder
        duration: clip.duration,
        durationBeats: clip.durationBeats,
        sampleRate: clip.sampleRate,
        vol: clip.vol ?? 100,
        pan: clip.pan ?? 50,
        stemType: clip.stemType || null,
        color: clip.color || null,
        startOffset: clip.startOffset ?? 0,
      };
    });

    return {
      json: JSON.stringify({
        version: "1.2.0",
        bpm,
        activePatternId,
        patterns,
        channels,
        playlistTracks,
        audioClips: serializedAudioClips,
        automations,
        mixerInserts,
      }, null, 2),
      audioClipsMeta: serializedAudioClips,
    };
  };

  // Helper: convert ArrayBuffer to base64 string in chunks (avoids call stack overflow)
  const arrayBufferToBase64 = (buffer) => {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 32768;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
      binary += String.fromCharCode.apply(null, chunk);
    }
    return btoa(binary);
  };

  // Save audio clip WAV files into audio/ subfolder inside the project folder
  const saveAudioFiles = async (projectFilePath) => {
    if (!window.electronAPI?.ensureDir || !window.electronAPI?.saveAudioBuffer) return;
    if (audioClips.length === 0) return;

    // Get the project folder (parent directory of the .reson file)
    let projectDir;
    if (window.electronAPI.pathDirname) {
      projectDir = await window.electronAPI.pathDirname(projectFilePath);
    } else {
      projectDir = projectFilePath.replace(/[\/][^\/]+$/, '');
    }

    // Create audio/ subfolder inside the project folder
    const audioDir = await window.electronAPI.pathJoin(projectDir, 'audio');
    const dirResult = await window.electronAPI.ensureDir(audioDir);
    if (!dirResult?.success) {
      console.error('Failed to create audio directory:', audioDir, dirResult?.error);
      return;
    }

    for (const clip of audioClips) {
      try {
        if (!clip.audioBuffer) {
          console.warn('Skipping clip with no audioBuffer:', clip.name);
          continue;
        }
        // Build a safe filename: id + sanitized original name, always .wav extension
        const baseName = (clip.fileName || 'audio.wav').replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9._-]/g, '_');
        const safeFileName = `${clip.id}_${baseName}.wav`;

        const filePath = await window.electronAPI.pathJoin(audioDir, safeFileName);

        // Always write the WAV file — audio may have been modified in-memory
        // (e.g. via SampleEditor) even if the file already exists on disk
        const wavBlob = audioBufferToWav(clip.audioBuffer);
        const arrayBuf = await wavBlob.arrayBuffer();
        const base64Data = arrayBufferToBase64(arrayBuf);

        const saveResult = await window.electronAPI.saveAudioBuffer(filePath, base64Data);
        if (saveResult?.success) {
          console.log('Saved audio file:', filePath);
        } else {
          console.error('Failed to write audio file:', filePath, saveResult?.error);
        }
      } catch (err) {
        console.warn('Failed to save audio clip:', clip.name, err);
      }
    }
  };

  const handleSave = async () => {
    if (!window.electronAPI) return;

    if (currentProjectPath) {
      const { json } = getProjectData();
      // Ensure the project folder still exists (in case it was deleted)
      if (window.electronAPI.pathDirname) {
        const projectDir = await window.electronAPI.pathDirname(currentProjectPath);
        await window.electronAPI.ensureDir(projectDir);
      }
      const result = await window.electronAPI.saveFileSilent(currentProjectPath, json);
      if (result && result.success) {
        await saveAudioFiles(currentProjectPath);
        console.log("Project saved to:", currentProjectPath);
      }
    } else {
      await handleSaveAs();
    }
  };

  const handleSaveAs = async () => {
    if (!window.electronAPI?.saveFile) return;
    const { json } = getProjectData();
    const result = await window.electronAPI.saveFile(json);
    if (result && result.success) {
      setCurrentProjectPath(result.filePath);
      await saveAudioFiles(result.filePath);
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

    const match = base.match(/_v(\d+)$/);
    if (match) {
      const num = parseInt(match[1]) + 1;
      newPath = base.substring(0, base.lastIndexOf('_v')) + `_v${num}.${ext}`;
    } else {
      newPath = `${base}_v2.${ext}`;
    }

    // Ensure the parent folder exists
    if (window.electronAPI.pathDirname) {
      const parentDir = await window.electronAPI.pathDirname(newPath);
      await window.electronAPI.ensureDir(parentDir);
    }

    const { json } = getProjectData();
    const result = await window.electronAPI.saveFileSilent(newPath, json);
    if (result && result.success) {
      setCurrentProjectPath(newPath);
      await saveAudioFiles(newPath);
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
    if (action === 'open') {
      if (window.electronAPI?.openFileDialog && window.electronAPI?.readFile) {
        const paths = await window.electronAPI.openFileDialog();
        if (paths && paths.length > 0) {
          const filePath = paths[0];
          const result = await window.electronAPI.readFile(filePath);
          if (result && result.success) {
            try {
              const projectData = JSON.parse(result.content);
              await loadProject(projectData, filePath);
              setCurrentProjectPath(filePath);
              document.title = `Reson Studio - ${filePath.split(/[\\/]/).pop()}`;
            } catch (e) {
              console.error("Failed to parse project file:", e);
              alert("Error: Invalid project file format.");
            }
          }
        }
      } else {
        // Fallback or Web implementation (optional)
        console.warn("File opening is only supported in the desktop version.");
        alert("File opening is only supported in the desktop version.");
      }
    }
    if (action === 'open_folder') {
      if (window.electronAPI?.openFolderDialog) {
        const result = await window.electronAPI.openFolderDialog();
        if (result && result.success && result.content) {
          try {
            const projectData = JSON.parse(result.content);
            await loadProject(projectData, result.filePath);
            setCurrentProjectPath(result.filePath);
            document.title = `Reson Studio - ${result.filePath.split(/[\\/]/).pop()}`;
          } catch (e) {
            console.error("Failed to parse project file:", e);
            alert("Error: Invalid project file format.");
          }
        } else if (result && !result.success && result.error) {
          alert(result.error);
        }
      } else {
        alert("Folder opening is only supported in the desktop version.");
      }
    }
    if (action === 'add_audio_file') {
      if (importAudioFile) {
        await importAudioFile();
      }
    }
    if (action === 'import_midi') {
      if (importMidiFile) {
        await importMidiFile();
      }
    }
    if (action === 'exit' && window.electronAPI) {
      window.electronAPI.close();
    }

    // Export actions
    if (action === 'export_wave') {
      handleExport('wav');
    }
    if (action === 'export_mp3') {
      handleExport('mp3');
    }
    if (action === 'export_last') {
      const lastFormat = getLastExportFormat();
      if (lastFormat) {
        handleExport(lastFormat);
      } else {
        alert('No previous export format. Please export as WAV or MP3 first.');
      }
    }
    if (action === 'export_video') {
      alert('Video export is coming soon!');
    }
    if (action === 'export_midi') {
      alert('MIDI export is coming soon!');
    }

    // Window management
    if (action === 'view_playlist') onToggleWindow?.('playlist');
    if (action === 'view_pianoroll') onToggleWindow?.('pianoRoll');
    if (action === 'view_channelrack') onToggleWindow?.('channelRack');
    if (action === 'view_mixer') onToggleWindow?.('mixer');
    if (action === 'view_browser') onToggleWindow?.('browser');

    // Pattern/Channel Actions
    if (action === 'add_channel') onSetPluginToolbarCollapsed?.(false);
    if (action === 'add_pattern') createPattern?.();
    if (action === 'find_empty') findFirstEmptyPattern?.();
    if (action === 'clone_pattern') clonePattern?.(activePatternId);

    // Edit Actions
    if (action === 'undo') undoNotes?.();
    if (action === 'redo') redoNotes?.();

    // Misc
    if (action === 'revert_backup') revertToLastBackup?.();
  };

  const handleExport = async (format) => {
    try {
      // Show exporting message
      const exportingMsg = document.createElement('div');
      exportingMsg.id = 'exporting-overlay';
      exportingMsg.innerHTML = `
        <div style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 99999;">
          <div style="background: #2a2a2a; padding: 30px; border-radius: 8px; text-align: center;">
            <div style="color: #60a5fa; font-size: 18px; margin-bottom: 10px;">Exporting ${format.toUpperCase()}...</div>
            <div style="color: #999;">Please wait while rendering audio</div>
          </div>
        </div>
      `;
      document.body.appendChild(exportingMsg);

      let blob;
      let actualFormat = format;
      let wasFallback = false;

      if (format === 'wav') {
        blob = await exportWav(audioEngine, playlistTracks, patterns, channels, audioClips || [], automations || []);
      } else if (format === 'mp3') {
        const result = await exportMp3(audioEngine, playlistTracks, patterns, channels, audioClips || [], automations || []);
        blob = result.blob;
        actualFormat = result.format;
        wasFallback = result.fallback;
      }

      // Remove overlay
      document.getElementById('exporting-overlay')?.remove();

      if (blob) {
        setLastExportFormat(actualFormat);
        const result = await saveAudioBlob(blob, actualFormat);
        if (result.success) {
          if (wasFallback) {
            alert(`MP3 encoding not available in this environment. Exported as WAV instead.`);
          } else {
            alert(`Export successful!`);
          }
        } else if (!result.canceled) {
          alert('Export failed: ' + (result.error || 'Unknown error'));
        }
      }
    } catch (error) {
      document.getElementById('exporting-overlay')?.remove();
      console.error('Export error:', error);
      alert('Export failed: ' + error.message);
    }
  };

  const SUBMENUS = {
    import: [
      { label: "MIDI File...", action: "import_midi", shortcut: "Ctrl+Shift+I" },
    ],
    export: [
      { type: "header", label: "Audio" },
      { label: "Wave file...", action: "export_wave", shortcut: "Ctrl+R" },
      { label: "MP3 file...", action: "export_mp3", shortcut: "Shift+Ctrl+R" },
      { label: "MIDI file...", action: "export_midi", shortcut: "Shift+Ctrl+M" },
      { type: "divider" },
      { label: "Last exported format(s)...", action: "export_last" },
      { type: "divider" },
      { type: "header", label: "Video" },
      { label: "Video file...", action: "export_video" },
    ],
  };

  const MENU_ITEMS = {
    File: [
      { label: "New (Basic 808 with limiter)", action: "new" },
      { label: "New from template", action: "new_template", right: ">" },
      { label: "Open...", action: "open", shortcut: "Ctrl+O" },
      { label: "Open Project Folder...", action: "open_folder" },
      { type: "divider" },
      { label: "Save", action: "save", shortcut: "Ctrl+S" },
      { label: "Save as...", action: "save_as", shortcut: "Shift+Ctrl+S" },
      { label: "Save new version", action: "save_new_version", shortcut: "Ctrl+N" },
      { label: "Save to new project folder...", action: "save_new_folder" },
      { label: "Save as template...", action: "save_template" },
      { type: "divider" },
      { label: "Import", action: "import", right: ">", hasSubmenu: true },
      { label: "Export", action: "export", right: ">", hasSubmenu: true },
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
                    return <div key={index} className="dropdown-item dropdown-header">{item.label}</div>;
                  }
                  return (
                    <div
                      key={index}
                      className={`dropdown-item ${item.hasSubmenu ? 'has-submenu' : ''}`}
                      onClick={() => !item.hasSubmenu && handleOptionClick(item.action)}
                      onMouseEnter={() => item.hasSubmenu && setActiveSubmenu(item.action)}
                      onMouseLeave={() => item.hasSubmenu && setActiveSubmenu(null)}
                      title={item.label}
                    >
                      <span>{item.label}</span>
                      {item.shortcut && <span className="dropdown-shortcut">{item.shortcut}</span>}
                      {item.right && <span className="dropdown-right">{item.right}</span>}
                      {/* Submenu */}
                      {item.hasSubmenu && activeSubmenu === item.action && SUBMENUS[item.action] && (
                        <div className="submenu" onMouseEnter={() => setActiveSubmenu(item.action)}>
                          {SUBMENUS[item.action].map((subItem, subIndex) => {
                            if (subItem.type === "divider") {
                              return <div key={subIndex} className="dropdown-divider" />;
                            }
                            if (subItem.type === "header") {
                              return <div key={subIndex} className="dropdown-item dropdown-header">{subItem.label}</div>;
                            }
                            return (
                              <div
                                key={subIndex}
                                className="dropdown-item"
                                onClick={() => handleOptionClick(subItem.action)}
                                title={subItem.label}
                              >
                                <span>{subItem.label}</span>
                                {subItem.shortcut && <span className="dropdown-shortcut">{subItem.shortcut}</span>}
                                {subItem.right && <span className="dropdown-right">{subItem.right}</span>}
                              </div>
                            );
                          })}
                        </div>
                      )}
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
