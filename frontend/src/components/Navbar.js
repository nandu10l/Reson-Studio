import React, { useEffect, useState } from 'react';
import { Music, FolderOpen, Settings, Home, MinusCircle, User, Plus, Save, Search, Maximize, Minimize2, X } from 'lucide-react';
import NewProjectModal from './NewProjectModal';

function Navbar({ onChangeView, currentView = 'arrange', onCreateProject, onSaveProject }) {
  const [isElectron, setIsElectron] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);

  useEffect(() => {
    setIsElectron(!!(window && window.electronAPI));
    if (window && window.electronAPI) {
      window.electronAPI.isMaximized().then((res) => setIsMaximized(res));
    }
  }, []);

  const minimize = () => window.electronAPI?.minimize();
  const toggleMaximize = async () => {
    await window.electronAPI?.maximize();
    const res = await window.electronAPI?.isMaximized();
    setIsMaximized(res);
  };
  const closeWin = () => window.electronAPI?.close();

  return (
    <nav className="navbar">
      <div className="navbar-menu">
        {/* File/Session Controls (New/Open/Save) */}
        <div className="session-controls">
          <button className="btn small primary-btn" onClick={() => setShowNewProjectModal(true)}>
            <Plus size={14} /> New Project
          </button>
          <button className="btn small" onClick={async () => {
            if (window.electronAPI && window.electronAPI.openFileDialog) {
              const filePaths = await window.electronAPI.openFileDialog();
              if (filePaths && filePaths.length > 0) {
                console.log('Selected file:', filePaths[0]);
                // Handle the selected file here, e.g., load the project
              }
            }
          }}>
            <FolderOpen size={14} /> Open
          </button>
          <button className="btn small" onClick={onSaveProject}>
            <Save size={14} /> Save
          </button>
        </div>

        {/* View Selection Buttons */}
        <div className="view-buttons">
          <button 
            onClick={() => onChangeView?.('arrange')}
            className={currentView === 'arrange' ? 'active' : ''}
          >
            <Music size={16} />
            Arrange
          </button>
          <button 
            onClick={() => onChangeView?.('projects')}
            className={currentView === 'projects' ? 'active' : ''}
          >
            <FolderOpen size={16} />
            Projects
          </button>
          <button 
            onClick={() => onChangeView?.('settings')}
            className={currentView === 'settings' ? 'active' : ''}
          >
            <Settings size={16} />
            Settings
          </button>
          <button 
            onClick={() => onChangeView?.('home')}
            className={currentView === 'home' ? 'active' : ''}
          >
            <Home size={16} />
            Home
          </button>
        </div>

        {/* Search and User/App Controls */}
        <div className="right-controls">
          <div className="search-input-container">
            <Search size={16} className="search-icon" />
            <input placeholder="Search projects..." className="search-input" />
          </div>

          <button onClick={() => window.electronAPI?.toTray?.()}>
            <MinusCircle size={16} />
            Tray
          </button>

          <div className="user-info">
            <User size={16} />
            Nandu
          </div>
        </div>
      </div>

      {isElectron && (
        <div className="window-controls">
          <button onClick={minimize}>
            <Minimize2 size={16} />
          </button>
          <button onClick={toggleMaximize}>
            {isMaximized ? <Minimize2 size={16} style={{ transform: 'rotate(90deg)' }} /> : <Maximize size={16} />}
          </button>
          <button onClick={closeWin} className="close-btn">
            <X size={16} />
          </button>
        </div>
      )}

      <NewProjectModal
        isOpen={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
        onCreateProject={onCreateProject}
      />
    </nav>
  );
}

export default Navbar;