import React, { useEffect, useState } from 'react';
import { Music, FolderOpen, Settings, Home, MinusCircle, User } from 'lucide-react';

function Navbar({ onChangeView, currentView = 'arrange' }) {
  const [isElectron, setIsElectron] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

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
      <div className="navbar-brand">Reson Studio</div>
      <div className="navbar-menu">
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

        <div className="right-controls">
          <button onClick={() => window.electronAPI?.toTray?.()}>
            <MinusCircle size={16} />
            Minimize to Tray
          </button>
          <div className="user-info">
            <User size={16} />
            Nandu
          </div>
        </div>
      </div>

      {isElectron && (
        <div className="window-controls" style={{ marginLeft: 'auto' }}>
          <button onClick={minimize}>_</button>
          <button onClick={toggleMaximize}>{isMaximized ? '🗗' : '🗖'}</button>
          <button onClick={closeWin}>×</button>
        </div>
      )}
    </nav>
  );
}

export default Navbar;