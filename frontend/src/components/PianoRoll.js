import React from 'react';

const PianoRoll = () => {
    return (
        <div className="piano-roll-placeholder" style={{ padding: '20px', color: '#fff' }}>
            <h3>Piano Roll</h3>
            <div className="piano-keys">
                {/* Placeholder keys */}
                {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} style={{
                        height: '20px',
                        background: i % 2 === 0 ? '#fff' : '#000',
                        border: '1px solid #ccc',
                        marginBottom: '1px'
                    }} />
                ))}
            </div>
            <p>Notes go here...</p>
        </div>
    );
};

export default PianoRoll;
