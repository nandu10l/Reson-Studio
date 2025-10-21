import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import ProjectSidebar from '../components/ProjectSidebar';
import TopBar from '../components/TopBar';
import TransportBar from '../components/TransportBar';
import Timeline from '../components/Timeline';
import TrackList from '../components/TrackList';
import Mixer from '../components/Mixer';
import Inspector from '../components/Inspector';
import PluginPanel from '../components/PluginPanel';
import SessionBrowser from '../components/SessionBrowser';
import '../styles/daw.css';

function Dashboard() {
  const [playing, setPlaying] = useState(false);
  const [selectedClip, setSelectedClip] = useState(null);
  const [view, setView] = useState('arrange'); // arrange | projects | settings | home

  function renderView() {
    switch (view) {
      case 'projects':
        return (
          <div className="projects-view">
            <h2>Projects</h2>
            <SessionBrowser />
          </div>
        );
      case 'settings':
        return (
          <div className="settings-view">
            <h2>Settings</h2>
            <p>App preferences will go here.</p>
          </div>
        );
      case 'home':
        return (
          <div className="home-view">
            <h2>Welcome</h2>
            <p>Welcome to Reson Studio — use the left projects view or the arrange view to get started.</p>
          </div>
        );
      case 'arrange':
      default:
        return (
          <div className="daw-root">
            <div className="daw-main">
              <div className="session-browser">
                <ProjectSidebar />
              </div>
              <div className="center-canvas">
                <div className="track-area">
                  <Timeline />
                  <TrackList onSelectClip={(c) => setSelectedClip(c)} />
                </div>
                <Mixer />
              </div>
              <Inspector selected={selectedClip} />
              <PluginPanel />
            </div>
          </div>
        );
    }
  }

  return (
    <div>
      <TopBar />
      <Navbar onChangeView={(v) => setView(v)} currentView={view} />
      <TransportBar playing={playing} onPlayToggle={() => setPlaying((p) => !p)} bpm={120} />
      {renderView()}
    </div>
  );
}

export default Dashboard;