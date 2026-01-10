import React from 'react';
import { useProject } from '../contexts/ProjectContext';
import { Grid, Music } from './icons/BlenderIcons';
import '../styles/blender-icons.css';

export default function SessionBrowser() {
  const {
    patterns, setActivePatternId, activePatternId,
    audioClips, pickerTab, setPickerTab,
    activeClipType, setActiveClipType, activeAudioClipId, setActiveAudioClipId,
    activeAutomationId, setActiveAutomationId,
    automations // Added automations
  } = useProject();

  const handleDragStart = (e, pattern) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'pattern',
      patternId: pattern.id,
      length: pattern.length
    }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleAutoDragStart = (e, automation) => {
    const targetAudio = audioClips.find(ac => ac.id === automation.targetClipId);
    const length = targetAudio ? targetAudio.durationBeats : 16;

    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'automation',
      automationId: automation.id,
      length: length
    }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleAudioDragStart = (e, audioClip) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'audio',
      audioClipId: audioClip.id,
      durationBeats: audioClip.durationBeats
    }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="picker-panel" style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', background: '#363d43', color: '#c5c5c5' }}>

      {/* Picker Tabs */}
      <div className="picker-tabs" style={{ display: 'flex', padding: '0 8px', gap: '0', borderBottom: '1px solid #1e2226' }}>
        <div
          onClick={() => setPickerTab('PAT')}
          style={{
            padding: '8px 12px',
            fontSize: '11px',
            fontWeight: 'bold',
            cursor: 'pointer',
            color: pickerTab === 'PAT' ? '#fff' : '#6b7280',
            background: pickerTab === 'PAT' ? '#4b5563' : 'transparent',
            borderBottom: pickerTab === 'PAT' ? '2px solid #4ade80' : '2px solid transparent',
            transition: 'all 0.2s',
            marginBottom: '-1px'
          }}
        >
          PAT
        </div>
        <div
          onClick={() => setPickerTab('AUDIO')}
          style={{
            padding: '8px 12px',
            fontSize: '11px',
            fontWeight: 'bold',
            cursor: 'pointer',
            color: pickerTab === 'AUDIO' ? '#fff' : '#6b7280',
            background: pickerTab === 'AUDIO' ? '#4b5563' : 'transparent',
            borderBottom: pickerTab === 'AUDIO' ? '2px solid #4ade80' : '2px solid transparent',
            transition: 'all 0.2s',
            marginBottom: '-1px'
          }}
        >
          AUDIO
        </div>
        <div
          onClick={() => setPickerTab('AUTO')}
          style={{
            padding: '8px 12px',
            fontSize: '11px',
            fontWeight: 'bold',
            cursor: 'pointer',
            color: pickerTab === 'AUTO' ? '#fff' : '#6b7280',
            background: pickerTab === 'AUTO' ? '#4b5563' : 'transparent',
            borderBottom: pickerTab === 'AUTO' ? '2px solid #4ade80' : '2px solid transparent',
            transition: 'all 0.2s',
            marginBottom: '-1px'
          }}
        >
          AUTO
        </div>
      </div>

      <div className="picker-content" style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {pickerTab === 'PAT' && (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {patterns.map((pattern) => (
              <li
                key={pattern.id}
                draggable="true"
                onDragStart={(e) => handleDragStart(e, pattern)}
                onClick={() => {
                  setActivePatternId(pattern.id);
                  setActiveClipType('pattern');
                }}
                className="picker-item"
                style={{
                  position: 'relative',
                  padding: '10px 16px',
                  paddingLeft: activePatternId === pattern.id ? '20px' : '16px',
                  background: activePatternId === pattern.id ? '#4b5563' : 'transparent',
                  borderBottom: '1px solid #282c31',
                  cursor: 'grab',
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: '12px',
                  color: activePatternId === pattern.id ? '#fff' : '#9ca3af',
                  transition: 'all 0.15s ease'
                }}
              >
                {/* Active Indicator Strip */}
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: '4px',
                  background: activePatternId === pattern.id ? '#4ade80' : 'transparent',
                  transition: 'background 0.15s ease'
                }}></div>

                <span style={{ fontWeight: 500, letterSpacing: '0.01em' }}>{pattern.name}</span>
              </li>
            ))}
          </ul>
        )}

        {pickerTab === 'AUDIO' && (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {audioClips.length === 0 ? (
              <li style={{ padding: '32px 20px', textAlign: 'center', color: '#6b7280', fontSize: '12px', lineHeight: '1.6' }}>
                No audio files imported.<br />
                <span style={{ fontSize: '11px', color: '#4b5563' }}>Use Add → Add Audio File to import.</span>
              </li>
            ) : (
              audioClips.map((audioClip) => (
                <li
                  key={audioClip.id}
                  draggable="true"
                  onDragStart={(e) => handleAudioDragStart(e, audioClip)}
                  className="picker-item"
                  style={{
                    position: 'relative',
                    padding: '10px 16px',
                    paddingLeft: (activeClipType === 'audio' && activeAudioClipId === audioClip.id) ? '20px' : '16px',
                    background: (activeClipType === 'audio' && activeAudioClipId === audioClip.id) ? '#4b5563' : 'transparent',
                    borderBottom: '1px solid #282c31',
                    cursor: 'grab',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '12px',
                    color: (activeClipType === 'audio' && activeAudioClipId === audioClip.id) ? '#fff' : '#9ca3af',
                    transition: 'all 0.15s ease'
                  }}
                  onClick={() => {
                    setActiveClipType('audio');
                    setActiveAudioClipId(audioClip.id);
                  }}
                >
                  <Music size={16} color="#60a5fa" className="blender-icon" style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 500,
                        marginBottom: '2px',
                        wordBreak: 'break-word',
                        lineHeight: '1.4',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}
                      title={audioClip.name}
                    >
                      {audioClip.name}
                    </div>
                    <div style={{ fontSize: '10px', color: '#6b7280', letterSpacing: '0.01em' }}>
                      {Math.round(audioClip.duration)}s • {audioClip.sampleRate}Hz
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        )}

        {pickerTab === 'AUTO' && (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {automations.length === 0 ? (
              <li style={{ padding: '32px 20px', textAlign: 'center', color: '#6b7280', fontSize: '12px', lineHeight: '1.6' }}>
                No automation created.<br />
                <span style={{ fontSize: '11px', color: '#4b5563' }}>Right-click Audio Clip &gt; Automate to create.</span>
              </li>
            ) : (
              automations.map(auto => (
                <li
                  key={auto.id}
                  draggable="true"
                  onDragStart={(e) => handleAutoDragStart(e, auto)}
                  onClick={() => {
                    setActiveClipType('automation');
                    setActiveAutomationId(auto.id);
                  }}
                  style={{
                    padding: '8px 16px',
                    borderBottom: '1px solid #282c31',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '12px',
                    color: (activeClipType === 'automation' && activeAutomationId === auto.id) ? '#fff' : '#9ca3af',
                    background: (activeClipType === 'automation' && activeAutomationId === auto.id) ? '#4b5563' : 'transparent',
                    cursor: 'grab',
                    transition: 'all 0.15s ease'
                  }}>
                  {/* Scalable Vector Graphic for Automation Icon */}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={activeClipType === 'automation' && activeAutomationId === auto.id ? "#fff" : "#10b981"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                  <span>{auto.name}</span>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      {/* Bottom Hint equivalent */}
      <div style={{ padding: '10px 12px', fontSize: '10px', color: '#6b7280', borderTop: '1px solid #1e2226', letterSpacing: '0.02em', textTransform: 'uppercase', fontWeight: 600 }}>
        {pickerTab === 'PAT' && 'Patterns'}
        {pickerTab === 'AUDIO' && 'Audio Clips'}
        {pickerTab === 'AUTO' && 'All Items'}
      </div>
    </div>
  );
}
