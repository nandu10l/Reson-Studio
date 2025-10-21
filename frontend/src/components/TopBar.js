import React from 'react';

export default function TopBar() {
  return (
    <div className="topbar">
      <div className="brand">Reson Studio</div>
      <div className="top-controls">
        <button className="btn small">New Project</button>
        <button className="btn small">Open</button>
        <button className="btn small">Save</button>
      </div>
      <div className="top-right">
        <input placeholder="Search projects" className="search" />
      </div>
    </div>
  );
}
