import React from 'react';

const ChannelRack = () => {
    return (
        <div className="channel-rack-placeholder" style={{ padding: '20px', color: '#fff' }}>
            <h3>Channel Rack</h3>
            <div className="channel-row" style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <div style={{ width: '100px', background: '#333' }}>Kick</div>
                <div style={{ flex: 1, background: '#444' }}>Steps...</div>
            </div>
            <div className="channel-row" style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <div style={{ width: '100px', background: '#333' }}>Snare</div>
                <div style={{ flex: 1, background: '#444' }}>Steps...</div>
            </div>
        </div>
    );
};

export default ChannelRack;
