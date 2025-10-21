import React, { useState } from 'react';
import { Mic, Guitar, Drumstick, Piano, Volume2, Volume1, VolumeX, Radio, Plus } from 'lucide-react';
import TrackClip from './TrackClip';

function Track({ track, onSelect, trackState, onToggleState }) {
  const TrackIcon = track.icon || Piano;
  
  return (
    <div className="track-row">
      <div className="track-header">
        <div className="track-controls">
          <button 
            className={'track-button' + (trackState.muted ? ' active' : '')}
            onClick={() => onToggleState('muted')}
            title="Mute"
          >
            {trackState.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
          <button 
            className={'track-button' + (trackState.soloed ? ' active' : '')}
            onClick={() => onToggleState('soloed')}
            title="Solo"
          >
            <Volume1 size={14} />
          </button>
          <button 
            className={'track-button' + (trackState.armed ? ' active' : '')}
            onClick={() => onToggleState('armed')}
            title="Record Arm"
          >
            <Radio size={14} />
          </button>
        </div>

        <div className="track-name">
          <div className="track-icon">
            <TrackIcon size={14} />
          </div>
          {track.name}
        </div>

        <div className="track-fader">
          <div className="track-fader-thumb" style={{ left: '75%' }} />
        </div>
        <div className="track-pan">
          <div className="track-pan-thumb" style={{ left: '50%' }} />
        </div>
      </div>

      <div className="track-clip-area">
        <div className="track-grid">
          {[...Array(16)].map((_, i) => (
            <div key={i} className="grid-line" />
          ))}
        </div>
        {track.clips.map((clip, idx) => (
          <div
            key={idx}
            className="track-clip"
            style={{ 
              left: `${clip.offset * 60}px`,
              width: `${clip.length * 60}px`
            }}
            onClick={() => onSelect(clip)}
          >
            <div className="clip-title">{clip.title}</div>
            <div className="clip-waveform">
              <svg className="waveform-svg" viewBox="0 0 100 30">
                <path
                  d="M0 15 Q25 5, 50 15 T100 15"
                  fill="none"
                  stroke="var(--primary-light)"
                  strokeWidth="1.5"
                />
              </svg>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TrackList({ onSelectClip }) {
  const [selected, setSelected] = useState(null);
  
  const defaultTracks = [
    { 
      id: 1,
      name: 'Drums',
      icon: Drumstick,
      clips: [
        { title: 'Loop A', offset: 0, length: 4 },
        { title: 'Fill', offset: 6, length: 2 }
      ]
    },
    { 
      id: 2,
      name: 'Bass',
      icon: Guitar,
      clips: [
        { title: 'Bassline', offset: 0, length: 8 }
      ]
    },
    { 
      id: 3,
      name: 'Keys',
      icon: Piano,
      clips: [
        { title: 'Chords', offset: 2, length: 8 }
      ]
    },
    { 
      id: 4,
      name: 'Vocals',
      icon: Mic,
      clips: [
        { title: 'Lead', offset: 2, length: 6 }
      ]
    }
  ];

  const [tracks, setTracks] = useState(defaultTracks);
  
  const [trackStates, setTrackStates] = useState(
    defaultTracks.reduce((acc, track) => ({
      ...acc,
      [track.id]: { muted: false, soloed: false, armed: false }
    }), {})
  );

  const addNewTrack = () => {
    const newTrack = {
      id: tracks.length + 1,
      name: `Track ${tracks.length + 1}`,
      icon: Piano,
      clips: []
    };
    setTracks([...tracks, newTrack]);
    setTrackStates(prev => ({
      ...prev,
      [newTrack.id]: { muted: false, soloed: false, armed: false }
    }));
  };

  const toggleTrackState = (trackId, state) => {
    setTrackStates(prev => ({
      ...prev,
      [trackId]: { ...prev[trackId], [state]: !prev[trackId][state] }
    }));
  };

  function handleSelect(c) {
    setSelected(c);
    onSelectClip?.(c);
  }

  return (
    <div className="tracklist">
      {tracks.map((track) => (
        <Track
          key={track.id}
          track={track}
          trackState={trackStates[track.id]}
          onToggleState={(state) => toggleTrackState(track.id, state)}
          onSelect={handleSelect}
        />
      ))}
      <button 
        className="add-track-button" 
        onClick={addNewTrack}
        title="Add New Track"
      >
        <Plus size={20} />
        Add Track
      </button>
    </div>
  );
}
