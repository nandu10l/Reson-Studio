import React from 'react';

function MixerChannel({ name }) {
  return (
    <div className="mixer-channel">
      <div className="channel-name">{name}</div>
      <div className="pan-control">Pan</div>
      <input className="fader" type="range" min="0" max="100" defaultValue="75" />
      <div className="channel-controls">
        <button className="btn tiny">S</button>
        <button className="btn tiny">M</button>
      </div>
    </div>
  );
}

export default function Mixer() {
  const channels = ['Drums','Bass','Keys','Lead','Master'];
  return (
    <div className="mixer">
      {channels.map((c) => (
        <MixerChannel key={c} name={c} />
      ))}
    </div>
  );
}
