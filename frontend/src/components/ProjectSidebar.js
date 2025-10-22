import React from 'react';
import SessionBrowser from './SessionBrowser';

export default function ProjectSidebar({ projects = [] }) {
  return <SessionBrowser projects={projects} />;
}
