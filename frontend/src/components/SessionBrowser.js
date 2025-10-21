import React from 'react';

export default function SessionBrowser() {
  const sessions = ['Untitled Project', 'My Beat', 'Vocal Edit', 'Soundscape'];
  return (
    <div className="session-browser">
      <h4>Projects</h4>
      <ul>
        {sessions.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
    </div>
  );
}
