import React from 'react';

export default function Inspector({ selected }) {
  return (
    <aside className="inspector">
      <h4>Inspector</h4>
      {selected ? (
        <div>
          <div><strong>{selected.name}</strong></div>
          <div>Length: {selected.length} bars</div>
          <div>Gain: 0 dB</div>
        </div>
      ) : (
        <div>Select a clip or track to inspect</div>
      )}
    </aside>
  );
}
