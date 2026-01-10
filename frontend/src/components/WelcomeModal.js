import React from 'react';
import '../styles/welcome.css';
import { X, FilePlus, Music, Mic, Zap, Compass } from 'lucide-react';

const WelcomeModal = ({ onClose, onNewProject, onStartTour }) => {

  const templates = [
    { id: 'empty', name: 'Empty Project', icon: <FilePlus size={18} />, desc: 'Start from scratch' },
    { id: 'chord', name: 'Create chord progression', icon: <Music size={18} />, desc: 'Piano, Bass, Drums' },
    { id: 'recording', name: 'Audio Recording', icon: <Mic size={18} />, desc: 'Ready for vocals' },
  ];

  return (
    <div className="welcome-overlay" onClick={onClose}>
      <div className="welcome-modal" onClick={e => e.stopPropagation()}>

        <div className="welcome-header">
          <div className="welcome-title">Welcome to Reson Studio</div>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="welcome-body">
          <div className="welcome-column">

            {/* What's New Section */}
            <div className="whats-new-section">
              <div className="column-header">What's New</div>
              <div className="whats-new-card">
                <div className="featured-icon-container">
                  <Zap size={20} />
                </div>
                <div className="featured-text-content">
                  <h4>Reson Update 2026.1</h4>
                  <p>
                    Experience the new high-performance audio engine, improved mixer workflow, and enhanced plugin support.
                  </p>
                </div>
              </div>
            </div>

            {/* New Project Section */}
            <div className="column-header">New Project</div>
            <div className="list-container">
              {templates.map(t => (
                <div key={t.id} className="list-item" onClick={() => onNewProject(t.id)}>
                  <div className="item-icon">{t.icon}</div>
                  <div className="item-text">
                    <h4>{t.name}</h4>
                    <p>{t.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Learn Section */}
            <div className="column-header" style={{ marginTop: '20px' }}>Learn</div>
            <div className="list-container">
              <div className="list-item" onClick={onStartTour}>
                <div className="item-icon"><Compass size={18} /></div>
                <div className="item-text">
                  <h4>Take a Quick Tour</h4>
                  <p>Learn the basics of Reson Studio</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeModal;
