import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sparkles } from '../icons/BlenderIcons';
import { generateAiMidi, getAiStatus, listAiFiles, getAiDownloadUrl } from '../../services/aiComposerService';
import './AIComposer.css';

const GENRES = [
    { id: 'lofi', name: 'Lo-Fi', emoji: '🌙', sub: 'Chill · Warm · 70–90 BPM', bpm: 85 },
    { id: 'trap', name: 'Trap', emoji: '🔥', sub: 'Hard · Dark · 130–150 BPM', bpm: 140 },
];

const TRACKS = [
    { id: 'melody', name: 'Melody', icon: '🎵' },
    { id: 'bass', name: 'Bass', icon: '🎸' },
    { id: 'chords', name: 'Chords', icon: '🎻' },
    { id: 'piano', name: 'Piano', icon: '🎹' },
    { id: 'kick', name: 'Kick', icon: '🥁' },
    { id: 'claps', name: 'Claps', icon: '👏' },
    { id: 'hihat', name: 'Hi-Hat', icon: '🎩' },
    { id: 'snare', name: 'Snare', icon: '🪘' },
];

export default function AIComposer() {
    const [status, setStatus] = useState({ ready: false, text: 'Connecting...' });
    const [genre, setGenre] = useState('lofi');
    const [activeTracks, setActiveTracks] = useState(['melody', 'bass', 'chords', 'piano', 'kick', 'claps', 'hihat', 'snare']);
    const [bpm, setBpm] = useState(85);
    const [notes, setNotes] = useState(200);
    const [temp, setTemp] = useState(1.0);
    const [duration, setDuration] = useState(0.30);
    const [isGenerating, setIsGenerating] = useState(false);
    const [logs, setLogs] = useState([{ text: '// Waiting for input...', type: 'muted' }]);
    const [files, setFiles] = useState([]);

    const terminalRef = useRef(null);

    useEffect(() => {
        checkStatus();
        loadFiles();
        const interval = setInterval(checkStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [logs]);

    const checkStatus = async () => {
        const data = await getAiStatus();
        if (data.ready) {
            setStatus({ ready: true, text: `Model v${data.version} ready` });
        } else {
            setStatus({ ready: false, text: data.error || 'Server offline' });
        }
    };

    const loadFiles = async () => {
        const data = await listAiFiles();
        if (data.files) setFiles(data.files);
    };

    const addLog = (text, type = 'muted') => {
        setLogs(prev => [...prev, { text, type }]);
    };

    const toggleTrack = (trackId) => {
        setActiveTracks(prev =>
            prev.includes(trackId)
                ? prev.filter(t => t !== trackId)
                : [...prev, trackId]
        );
    };

    const handleGenerate = async () => {
        if (!activeTracks.length) {
            alert('Select at least one track!');
            return;
        }

        setIsGenerating(true);
        setLogs([]);
        addLog(`> Genre: ${genre.toUpperCase()} | BPM: ${bpm} | Notes: ${notes}`, 'cyan');
        addLog(`> Creativity: ${temp.toFixed(1)} | Duration: ${duration.toFixed(2)}s`, 'cyan');
        addLog(`> Tracks: ${activeTracks.join(', ')}`, 'cyan');
        addLog(`> Sending to AI model...`, 'accent');

        try {
            const data = await generateAiMidi({
                genre,
                bpm: parseInt(bpm),
                notes: parseInt(notes),
                temperature: temp,
                duration,
                tracks: activeTracks
            });

            if (data.success) {
                addLog(`> ✅ Generated: ${data.filename}`, 'green');
                addLog(`> Tracks inside: ${data.tracks}`, 'green');
                addLog(`> Import → File → Import MIDI`, 'yellow');
                loadFiles();
            } else {
                addLog(`> ❌ Error: ${data.error}`, 'red');
            }
        } catch (e) {
            addLog(`> ❌ Connection failed!`, 'red');
            addLog(`> Make sure backend is running`, 'muted');
        } finally {
            setIsGenerating(false);
        }
    };

    const selectGenre = (g) => {
        setGenre(g.id);
        setBpm(g.bpm);
    };

    return (
        <div className="ai-composer-container">
            <aside className="ai-sidebar">
                <div className="ai-logo-section">
                    <div className="ai-logo-badge">AI Music Engine v2</div>
                    <h1 className="ai-title"><Sparkles size={24} style={{ marginRight: '8px', verticalAlign: 'middle' }} />MIDI<br />Generator</h1>
                </div>

                <div className="ai-status-bar">
                    <div className={`ai-dot ${status.ready ? 'green' : 'red'}`}></div>
                    <span className="ai-status-text">{status.text}</span>
                </div>

                <div className="ai-section">
                    <div className="ai-sec-label">Genre</div>
                    <div className="ai-genre-grid">
                        {GENRES.map(g => (
                            <button
                                key={g.id}
                                className={`ai-genre-btn ${g.id} ${genre === g.id ? 'active' : ''}`}
                                onClick={() => selectGenre(g)}
                            >
                                <div className="ai-genre-btn-inner">
                                    <span className="ai-genre-emoji">{g.emoji}</span>
                                    <div className="ai-genre-info">
                                        <span className="ai-genre-name">{g.name}</span>
                                        <span className="ai-genre-sub">{g.sub}</span>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="ai-section">
                    <div className="ai-sec-label">Tracks</div>
                    <div className="ai-tracks-wrap">
                        {TRACKS.map(t => (
                            <div
                                key={t.id}
                                className={`ai-track-pill ${activeTracks.includes(t.id) ? 'on' : ''}`}
                                onClick={() => toggleTrack(t.id)}
                            >
                                {t.icon} {t.name}
                                <span className="ai-tick">✓</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="ai-waveform">
                    {[...Array(9)].map((_, i) => <span key={i}></span>)}
                </div>
            </aside>

            <main className="ai-main-content">
                <div className="ai-card">
                    <div className="ai-sec-label" style={{ marginBottom: '18px' }}>Parameters</div>
                    <div className="ai-sliders-grid">
                        <div className="ai-sl-group">
                            <div className="ai-sl-label"><span>BPM</span><span className="ai-sl-val">{bpm}</span></div>
                            <input type="range" min="60" max="180" value={bpm} onChange={(e) => setBpm(e.target.value)} />
                        </div>
                        <div className="ai-sl-group">
                            <div className="ai-sl-label"><span>Notes</span><span className="ai-sl-val">{notes}</span></div>
                            <input type="range" min="50" max="500" value={notes} onChange={(e) => setNotes(e.target.value)} />
                        </div>
                        <div className="ai-sl-group">
                            <div className="ai-sl-label"><span>Creativity</span><span className="ai-sl-val">{temp.toFixed(1)}</span></div>
                            <input type="range" min="1" max="20" value={temp * 10} onChange={(e) => setTemp(e.target.value / 10)} />
                        </div>
                        <div className="ai-sl-group">
                            <div className="ai-sl-label"><span>Note Length</span><span className="ai-sl-val">{duration.toFixed(2)}s</span></div>
                            <input type="range" min="1" max="10" value={duration * 10} onChange={(e) => setDuration(e.target.value / 10)} />
                        </div>
                    </div>
                </div>

                <button
                    className="ai-gen-btn"
                    onClick={handleGenerate}
                    disabled={isGenerating || !status.ready}
                >
                    <span>{isGenerating ? '⏳ GENERATING...' : '⚡ GENERATE MIDI'}</span>
                </button>

                <div className="ai-terminal">
                    <div className="ai-term-head">
                        <div className="ai-term-dots"><span></span><span></span><span></span></div>
                        <span className="ai-term-title">OUTPUT CONSOLE</span>
                    </div>
                    <div className="ai-term-body" ref={terminalRef}>
                        {logs.map((log, i) => (
                            <div key={i} className={`ai-t-${log.type}`}>{log.text}</div>
                        ))}
                    </div>
                </div>

                <div className="ai-card">
                    <div className="ai-sec-label" style={{ marginBottom: '14px' }}>Generated Files</div>
                    <div className="ai-files-list">
                        {files.length === 0 ? (
                            <div className="ai-t-muted" style={{ fontSize: '11px' }}>No files yet. Generate your first MIDI!</div>
                        ) : (
                            files.map((f, i) => (
                                <div
                                    key={i}
                                    className="ai-file-row"
                                    draggable
                                    onDragStart={(e) => {
                                        e.dataTransfer.setData('ai-midi', f);
                                        e.dataTransfer.effectAllowed = 'copy';
                                    }}
                                >
                                    <span className="ai-file-icon">{f.includes('lofi') ? '🌙' : '🔥'}</span>
                                    <div className="ai-file-info">
                                        <div className="ai-file-name">{f}</div>
                                        <div className="ai-file-meta">{f.match(/(\d+)bpm/)?.[1] || '?'} BPM · MIDI</div>
                                    </div>
                                    <a className="ai-file-dl" href={getAiDownloadUrl(f)} download>↓ GET</a>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
