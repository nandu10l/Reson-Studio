import React, { useState, useEffect } from 'react';
import { Minus, Square, X } from 'lucide-react';
import '../styles/titlebar.css';

function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    // Check initial maximized state
    if (window.electronAPI) {
      window.electronAPI.isMaximized().then(setIsMaximized);
    }

    // Listen for maximize/unmaximize events (if available)
    // Note: Electron doesn't provide a direct event for this, so we'll check on click
  }, []);

  const handleMinimize = () => {
    if (window.electronAPI) {
      window.electronAPI.minimize();
    }
  };

  const handleMaximize = async () => {
    if (window.electronAPI) {
      await window.electronAPI.maximize();
      const maximized = await window.electronAPI.isMaximized();
      setIsMaximized(maximized);
    }
  };

  const handleClose = () => {
    if (window.electronAPI) {
      window.electronAPI.close();
    }
  };

  // Only show titlebar in Electron environment
  if (!window.electronAPI) {
    return null;
  }

  return (
    <div className="custom-titlebar" data-tauri-drag-region>
      <div className="titlebar-title">Reson Studio</div>
      <div className="titlebar-controls">
        <button
          className="titlebar-button titlebar-button-minimize"
          onClick={handleMinimize}
          title="Minimize"
        >
          <Minus size={14} />
        </button>
        <button
          className="titlebar-button titlebar-button-maximize"
          onClick={handleMaximize}
          title={isMaximized ? "Restore" : "Maximize"}
        >
          <Square size={12} />
        </button>
        <button
          className="titlebar-button titlebar-button-close"
          onClick={handleClose}
          title="Close"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

export default TitleBar;

