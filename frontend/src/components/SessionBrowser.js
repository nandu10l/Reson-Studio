import React from 'react';

export default function SessionBrowser({ projects = [] }) {
  const defaultSessions = ['Untitled Project', 'My Beat', 'Vocal Edit', 'Soundscape'];
  const allProjects = [...projects, ...defaultSessions];

  return (
    <div className="session-browser">
      <h4>Projects</h4>
      <ul>
        {allProjects.map((s, index) => (
          <li key={index}>{s.name || s}</li>
        ))}
      </ul>
    </div>
  );
}
