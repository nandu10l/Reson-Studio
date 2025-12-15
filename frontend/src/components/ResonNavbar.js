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
  return (
    <header className="header_top" role="banner">
      <div className="header_panel">
        <div className="header_panel_handle_wrapper">
          <div className="header_panel_handle" />
        </div>

        <div className="session-controls" style={{display:'flex', gap:6}}>
          <button className="header_button unclicked">New</button>
          <button className="header_button unclicked">Open</button>
          <button className="header_button unclicked">Save</button>
        </div>

        <div style={{flex:1}} />

        <div className="player_controls">
          <div className="play"><ResonTransport playing={playing} onPlayToggle={onPlayToggle} /></div>
          <div className="bpm"><p id="bpm_count">{bpm}</p></div>
        </div>

        <div style={{width:8}} />

        <div className="header_help">
          <p>Audio • MIDI</p>
        </div>
      </div>
    </header>
  );
}
