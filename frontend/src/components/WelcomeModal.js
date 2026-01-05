import React from 'react';
import '../styles/welcome.css';
import { X, FilePlus, Music, Mic, Zap } from 'lucide-react';

const WelcomeModal = ({ onClose, onNewProject }) => {

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
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="welcome-body">

          <div className="welcome-column">

            {/* What's New Section */}
            <div className="whats-new-section" style={{ marginBottom: '24px' }}>
              <div className="column-header" style={{ color: '#fff' }}>What's New</div>
              <div className="whats-new-card" style={{
                background: 'linear-gradient(145deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                gap: '12px'
              }}>
                <div style={{
                  width: '40px', height: '40px',
                  borderRadius: '50%', background: 'rgba(99, 102, 241, 0.2)',
                  color: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Zap size={20} />
                </div>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#fff' }}>Reson Update 2026.1</h4>
                  <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', lineHeight: '1.4' }}>
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
          </div>

          {/* Recent Projects Removed as requested */}

        </div>
      </div>
    </div>
  );
};

export default WelcomeModal;
