import React, { useState } from 'react';
import '../styles/welcome.css';
import {
  X, FilePlus, Music, Mic, Compass, Sparkles,
  Clock, ChevronRight, Zap, Layers, Cpu
} from 'lucide-react';

const RECENT_PROJECTS = [
  { name: 'Untitled Project', time: 'Just now', color: '#a855f7' },
  { name: 'Beat Session 01', time: '2 hours ago', color: '#3b82f6' },
  { name: 'Chord Exploration', time: 'Yesterday', color: '#10b981' },
];

const TEMPLATES = [
  {
    id: 'empty',
    name: 'Blank Canvas',
    icon: <FilePlus size={20} />,
    desc: 'Start from scratch — your rules',
    color: '#6366f1',
  },
  {
    id: 'chord',
    name: 'Beat & Bass',
    icon: <Music size={20} />,
    desc: 'Piano · Bass · Drums pre-loaded',
    color: '#8b5cf6',
  },
  {
    id: 'recording',
    name: 'Vocal Studio',
    icon: <Mic size={20} />,
    desc: 'Optimised for recording vocals',
    color: '#ec4899',
  },
];

const FEATURES = [
  { icon: <Cpu size={14} />, label: 'AI Composer — generate melodies' },
  { icon: <Layers size={14} />, label: 'Multi-track Mixer & FX chain' },
  { icon: <Zap size={14} />, label: 'Real-time MIDI + audio engine' },
];

const WelcomeModal = ({ onClose, onNewProject, onStartTour }) => {
  const [hoveredTemplate, setHoveredTemplate] = useState(null);

  return (
    <div className="welcome-overlay" onClick={onClose}>
      <div className="welcome-modal" onClick={e => e.stopPropagation()}>

        {/* ── Ambient glows ── */}
        <div className="welcome-glow welcome-glow-1" />
        <div className="welcome-glow welcome-glow-2" />

        {/* ═══════════ LEFT PANEL ══════════ */}
        <div className="welcome-left">
          <div className="welcome-brand">
            <div className="welcome-logo">
              <Sparkles size={22} />
            </div>
            <div>
              <div className="welcome-brand-name">Reson Studio</div>
              <div className="welcome-brand-version">v2026.1</div>
            </div>
          </div>

          <div className="welcome-tagline">
            Your sound,<br />
            <span className="welcome-tagline-accent">your vision.</span>
          </div>

          <div className="welcome-features">
            {FEATURES.map((f, i) => (
              <div className="welcome-feature-pill" key={i}>
                {f.icon}
                <span>{f.label}</span>
              </div>
            ))}
          </div>

          {/* Tour button */}
          <button className="welcome-tour-btn" onClick={onStartTour}>
            <Compass size={15} />
            Take the tour
            <ChevronRight size={14} className="tour-arrow" />
          </button>
        </div>

        {/* ═══════════ RIGHT PANEL ══════════ */}
        <div className="welcome-right">

          {/* Header row */}
          <div className="welcome-right-header">
            <span className="welcome-right-title">Get started</span>
            <button className="welcome-close" onClick={onClose} aria-label="Close">
              <X size={16} />
            </button>
          </div>

          {/* Templates */}
          <div className="welcome-section-label">New project</div>
          <div className="welcome-templates">
            {TEMPLATES.map(t => (
              <button
                key={t.id}
                className={`welcome-template-card ${hoveredTemplate === t.id ? 'hovered' : ''}`}
                style={{ '--card-color': t.color }}
                onMouseEnter={() => setHoveredTemplate(t.id)}
                onMouseLeave={() => setHoveredTemplate(null)}
                onClick={() => onNewProject(t.id)}
              >
                <div className="welcome-card-icon">{t.icon}</div>
                <div className="welcome-card-text">
                  <div className="welcome-card-name">{t.name}</div>
                  <div className="welcome-card-desc">{t.desc}</div>
                </div>
                <ChevronRight size={15} className="welcome-card-arrow" />
              </button>
            ))}
          </div>

          {/* Recent projects */}
          <div className="welcome-section-label" style={{ marginTop: 24 }}>
            <Clock size={11} style={{ display: 'inline', marginRight: 5 }} />
            Recent
          </div>
          <div className="welcome-recents">
            {RECENT_PROJECTS.map((p, i) => (
              <button
                key={i}
                className="welcome-recent-row"
                onClick={() => onClose()}
              >
                <div className="welcome-recent-dot" style={{ background: p.color }} />
                <span className="welcome-recent-name">{p.name}</span>
                <span className="welcome-recent-time">{p.time}</span>
                <ChevronRight size={13} className="welcome-recent-arrow" />
              </button>
            ))}
          </div>

          {/* Footer */}
          <div className="welcome-footer">
            Press <kbd>Esc</kbd> or click outside to dismiss
          </div>
        </div>

      </div>
    </div>
  );
};

export default WelcomeModal;
