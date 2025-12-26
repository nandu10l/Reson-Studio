import React from 'react';
import ResonTransport from './ResonTransport';
import '../styles/reson.css';
import '../styles/butter/Header.css';

export default function ResonNavbar({
  playing,
  onPlayToggle,
  bpm,
  onBpmChange,
  onChangeView,
}) {
  const [activeMenu, setActiveMenu] = React.useState(null);
  const menuRef = React.useRef(null);

  React.useEffect(() => {
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

  const handleMenuClick = (menuName) => {
    setActiveMenu(activeMenu === menuName ? null : menuName);
  };

  const handleOptionClick = (action) => {
    console.log("Menu action:", action);
    setActiveMenu(null);
    // Future implementation: trigger actual actions
  };

  const MENU_ITEMS = {
    File: [
      { label: "New", action: "new" },
      { label: "New from template", action: "new_template" },
      { label: "Open...", action: "open" },
      { type: "divider" },
      { label: "Save", action: "save" },
      { label: "Save as...", action: "save_as" },
      { label: "Save new version", action: "save_new_ver" },
      { type: "divider" },
      { label: "Import", action: "import" },
      { label: "Export", action: "export" },
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
    ],
    Patterns: [
      { label: "Find first empty", action: "find_empty" },
      { label: "Clone", action: "clone_pattern" },
      { label: "Rename / color...", action: "rename_pattern" },
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
      { label: "File settings", action: "opt_file" },
    ],
    Tools: [
      { label: "Macros", action: "tools_macros" },
      { label: "Switches", action: "tools_switches" },
    ],
    Help: [
      { label: "Help index", action: "help_index" },
      { label: "About", action: "about" },
    ],
  };

  return (
    <header className="header_top" role="banner">
      <div className="header_panel" ref={menuRef} style={{ zIndex: 1001 }}> {/* Added zIndex to ensure menu is on top */}
        <div className="header_panel_handle_wrapper">
          <div className="header_panel_handle" />
        </div>

        <div className="menu-container">
          {Object.entries(MENU_ITEMS).map(([menuName, items]) => (
            <div key={menuName} className="menu-wrapper">
              <button
                className={`menu-button ${activeMenu === menuName ? "active" : ""}`}
                onClick={() => handleMenuClick(menuName)}
              >
                {menuName}
              </button>
              {activeMenu === menuName && (
                <div className="dropdown-menu">
                  {items.map((item, index) =>
                    item.type === "divider" ? (
                      <div key={index} className="dropdown-divider" />
                    ) : (
                      <div
                        key={index}
                        className="dropdown-item"
                        onClick={() => handleOptionClick(item.action)}
                      >
                        {item.label}
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <div className="player_controls">
          <div className="play"><ResonTransport playing={playing} onPlayToggle={onPlayToggle} /></div>
          <div className="bpm"><p id="bpm_count">{bpm}</p></div>
        </div>

        <div style={{ width: 8 }} />

        <div className="header_help">
          <p>Audio • MIDI</p>
        </div>
      </div>
    </header>
  );
}
