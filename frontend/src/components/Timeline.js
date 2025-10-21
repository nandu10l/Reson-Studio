import React from 'react';

function Timeline({ measures = 16, beatsPerBar = 4 }) {
  const renderTicks = () => {
    const ticks = [];
    for (let bar = 1; bar <= measures; bar++) {
      // Bar number
      ticks.push(
        <div key={`bar-${bar}`} className="timeline-tick">
          {bar}.1
        </div>
      );
      
      // Beat numbers within the bar
      for (let beat = 2; beat <= beatsPerBar; beat++) {
        ticks.push(
          <div key={`${bar}.${beat}`} className="timeline-tick beat">
            {bar}.{beat}
          </div>
        );
      }
    }
    return ticks;
  };

  return (
    <div className="timeline">
      <div className="timeline-grid">
        {renderTicks()}
      </div>
    </div>
  );
}

export default Timeline;