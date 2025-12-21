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
    <div className="session-browser" style={{ padding: '10px', color: '#fff' }}>
      <h4 style={{ marginBottom: '10px', fontSize: '12px', textTransform: 'uppercase', color: '#888' }}>Patterns</h4>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {patterns.map((pattern) => (
          <li
            key={pattern.id}
            draggable="true"
            onDragStart={(e) => handleDragStart(e, pattern)}
            onClick={() => setActivePatternId(pattern.id)}
            style={{
              padding: '8px',
              marginBottom: '4px',
              background: activePatternId === pattern.id ? '#444' : '#2a2a2a',
              borderRadius: '4px',
              cursor: 'grab',
              display: 'flex',
              alignItems: 'center',
              borderLeft: `3px solid ${pattern.color}`
            }}
          >
            <Grid3x3 size={14} style={{ marginRight: '8px', opacity: 0.7 }} />
            <span>{pattern.name}</span>
          </li>
        ))}
      </ul>
      <div style={{ marginTop: '20px', fontSize: '11px', color: '#666', fontStyle: 'italic' }}>
        Drag patterns to the playlist to arrange your song.
      </div>
    </div>
  );
}
