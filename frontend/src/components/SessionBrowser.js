import React from 'react';
import { useProject } from '../contexts/ProjectContext';
import { Grid3x3 } from 'lucide-react';

export default function SessionBrowser() {
  const { patterns, setActivePatternId, activePatternId } = useProject();

  const handleDragStart = (e, pattern) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'pattern',
      patternId: pattern.id,
      length: pattern.length
    }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="picker-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#363d43', color: '#c5c5c5' }}>

      {/* Picker Tabs */}
      <div className="picker-tabs" style={{ display: 'flex', borderBottom: '1px solid #1e2226', padding: '0 4px 4px' }}>
        <div style={{ padding: '0 8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', color: '#fff', borderBottom: '2px solid #4ade80' }}>
          PAT
        </div>
        <div style={{ padding: '0 8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', color: '#6b7280' }}>
          AUDIO
        </div>
        <div style={{ padding: '0 8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', color: '#6b7280' }}>
          AUTO
        </div>
      </div>

      <div className="picker-content" style={{ flex: 1, overflowY: 'auto', padding: '0' }}>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {patterns.map((pattern) => (
            <li
              key={pattern.id}
              draggable="true"
              onDragStart={(e) => handleDragStart(e, pattern)}
              onClick={() => setActivePatternId(pattern.id)}
              className="picker-item"
              style={{
                position: 'relative',
                padding: '8px 12px',
                background: activePatternId === pattern.id ? '#4b5563' : 'transparent',
                borderBottom: '1px solid #282c31',
                cursor: 'grab',
                display: 'flex',
                alignItems: 'center',
                fontSize: '12px',
                color: activePatternId === pattern.id ? '#fff' : '#9ca3af',
              }}
            >
              {/* Active Indicator Strip */}
              <div style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: '4px',
                background: activePatternId === pattern.id ? '#4ade80' : 'transparent'
              }}></div>

              <span style={{ fontWeight: 500 }}>{pattern.name}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Bottom Hint equivalent */}
      <div style={{ padding: '8px', fontSize: '10px', color: '#6b7280', borderTop: '1px solid #1e2226' }}>
        Patterns
      </div>
    </div>
  );
}
