import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    Play, Pause, Square, SkipBack, SkipForward, Repeat,
    Scissors, Download, Upload, RotateCcw, RotateCw,
    ZoomIn, ZoomOut, Volume2, Maximize2, Clock, Music,
    Flag, Copy, Send, Waves, Sliders, Mic, Timer, Eraser
} from 'lucide-react';
import './SampleEditor.css';

/**
 * SampleEditor Component - Edison-style audio sample editor
 * Provides waveform visualization, selection, and editing tools
 */
export default function SampleEditor({ audioClip, onClose, onSave }) {
    // Audio state
    const [audioBuffer, setAudioBuffer] = useState(null);
    const [waveformData, setWaveformData] = useState({ left: [], right: [] });
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLooping, setIsLooping] = useState(false);
    const [playbackPosition, setPlaybackPosition] = useState(0);
    const [duration, setDuration] = useState(0);

    // Selection state
    const [selection, setSelection] = useState({ start: 0, end: 0 });
    const [isSelecting, setIsSelecting] = useState(false);

    // Zoom state
    const [zoom, setZoom] = useState(1);
    const [scrollPosition, setScrollPosition] = useState(0);

    // Processing state
    const [isProcessing, setIsProcessing] = useState(false);
    const [processingMessage, setProcessingMessage] = useState('');

    // Refs
    const canvasRef = useRef(null);
    const overviewCanvasRef = useRef(null);
    const audioContextRef = useRef(null);
    const sourceNodeRef = useRef(null);
    const animationFrameRef = useRef(null);
    const startTimeRef = useRef(0);
    const containerRef = useRef(null);

    // Sample info
    const sampleRate = audioBuffer?.sampleRate || 48000;
    const bitDepth = 16;
    const channels = audioBuffer?.numberOfChannels || 2;

    // Initialize audio context and load audio
    useEffect(() => {
        if (!audioClip) return;

        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        loadAudio();

        return () => {
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [audioClip]);

    // Load audio from clip
    const loadAudio = async () => {
        if (!audioClip) return;

        try {
            let arrayBuffer;

            if (audioClip.file) {
                arrayBuffer = await audioClip.file.arrayBuffer();
            } else if (audioClip.url) {
                const response = await fetch(audioClip.url);
                arrayBuffer = await response.arrayBuffer();
            } else if (audioClip.audioData) {
                // Base64 encoded audio
                const binaryString = atob(audioClip.audioData);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                arrayBuffer = bytes.buffer;
            }

            if (arrayBuffer) {
                const buffer = await audioContextRef.current.decodeAudioData(arrayBuffer);
                setAudioBuffer(buffer);
                setDuration(buffer.duration);
                generateWaveformData(buffer);
            }
        } catch (error) {
            console.error('Failed to load audio:', error);
        }
    };

    // Generate waveform data for visualization
    const generateWaveformData = (buffer) => {
        const leftChannel = buffer.getChannelData(0);
        const rightChannel = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : leftChannel;

        const samples = 2000; // Number of samples for waveform
        const blockSize = Math.floor(buffer.length / samples);

        const leftData = [];
        const rightData = [];

        for (let i = 0; i < samples; i++) {
            const start = blockSize * i;
            let leftSum = 0;
            let rightSum = 0;
            let leftMax = 0;
            let rightMax = 0;

            for (let j = 0; j < blockSize; j++) {
                const leftVal = Math.abs(leftChannel[start + j] || 0);
                const rightVal = Math.abs(rightChannel[start + j] || 0);
                leftSum += leftVal;
                rightSum += rightVal;
                leftMax = Math.max(leftMax, leftVal);
                rightMax = Math.max(rightMax, rightVal);
            }

            leftData.push({ avg: leftSum / blockSize, max: leftMax });
            rightData.push({ avg: rightSum / blockSize, max: rightMax });
        }

        setWaveformData({ left: leftData, right: rightData });
    };

    // Draw waveform on canvas
    useEffect(() => {
        drawWaveform();
        drawOverview();
    }, [waveformData, selection, playbackPosition, zoom, scrollPosition]);

    const drawWaveform = () => {
        const canvas = canvasRef.current;
        if (!canvas || waveformData.left.length === 0) return;

        const ctx = canvas.getContext('2d');
        const { width, height } = canvas;
        const midY = height / 2;

        // Clear
        ctx.fillStyle = '#1a1f2e';
        ctx.fillRect(0, 0, width, height);

        // Draw grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 10; i++) {
            const y = (height / 10) * i;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // Center line
        ctx.strokeStyle = 'rgba(100, 200, 150, 0.3)';
        ctx.beginPath();
        ctx.moveTo(0, midY);
        ctx.lineTo(width, midY);
        ctx.stroke();

        // Calculate visible range based on zoom
        const totalSamples = waveformData.left.length;
        const visibleSamples = Math.floor(totalSamples / zoom);
        const startSample = Math.floor(scrollPosition * (totalSamples - visibleSamples));
        const endSample = Math.min(startSample + visibleSamples, totalSamples);

        const sampleWidth = width / visibleSamples;

        // Draw selection highlight
        if (selection.start !== selection.end) {
            const selStartX = ((selection.start * totalSamples) - startSample) * sampleWidth;
            const selEndX = ((selection.end * totalSamples) - startSample) * sampleWidth;
            ctx.fillStyle = 'rgba(100, 150, 255, 0.2)';
            ctx.fillRect(selStartX, 0, selEndX - selStartX, height);
        }

        // Draw left channel (top, blue)
        ctx.beginPath();
        for (let i = startSample; i < endSample; i++) {
            const x = (i - startSample) * sampleWidth;
            const sample = waveformData.left[i];
            if (!sample) continue;

            const y = midY - (sample.max * midY * 0.9);
            if (i === startSample) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.strokeStyle = 'rgba(100, 180, 255, 0.8)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Fill left channel
        ctx.lineTo((endSample - startSample - 1) * sampleWidth, midY);
        ctx.lineTo(0, midY);
        ctx.closePath();
        ctx.fillStyle = 'rgba(100, 180, 255, 0.3)';
        ctx.fill();

        // Draw right channel (bottom, pink/red)
        ctx.beginPath();
        for (let i = startSample; i < endSample; i++) {
            const x = (i - startSample) * sampleWidth;
            const sample = waveformData.right[i];
            if (!sample) continue;

            const y = midY + (sample.max * midY * 0.9);
            if (i === startSample) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.strokeStyle = 'rgba(255, 150, 150, 0.8)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Fill right channel
        ctx.lineTo((endSample - startSample - 1) * sampleWidth, midY);
        ctx.lineTo(0, midY);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 150, 150, 0.3)';
        ctx.fill();

        // Draw playhead
        const playheadX = ((playbackPosition / duration) * totalSamples - startSample) * sampleWidth;
        if (playheadX >= 0 && playheadX <= width) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(playheadX, 0);
            ctx.lineTo(playheadX, height);
            ctx.stroke();
        }
    };

    const drawOverview = () => {
        const canvas = overviewCanvasRef.current;
        if (!canvas || waveformData.left.length === 0) return;

        const ctx = canvas.getContext('2d');
        const { width, height } = canvas;
        const midY = height / 2;

        // Clear
        ctx.fillStyle = '#1a1f2e';
        ctx.fillRect(0, 0, width, height);

        // Draw mini waveform
        const sampleWidth = width / waveformData.left.length;

        // Left channel
        ctx.beginPath();
        waveformData.left.forEach((sample, i) => {
            const x = i * sampleWidth;
            const y = midY - (sample.max * midY * 0.8);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = 'rgba(100, 180, 255, 0.6)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Right channel
        ctx.beginPath();
        waveformData.right.forEach((sample, i) => {
            const x = i * sampleWidth;
            const y = midY + (sample.max * midY * 0.8);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.strokeStyle = 'rgba(255, 150, 150, 0.6)';
        ctx.stroke();

        // Viewport indicator
        const viewStart = scrollPosition * width * (1 - 1 / zoom);
        const viewWidth = width / zoom;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fillRect(viewStart, 0, viewWidth, height);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.strokeRect(viewStart, 0, viewWidth, height);

        // Playhead
        const playheadX = (playbackPosition / duration) * width;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, height);
        ctx.stroke();
    };

    // Playback controls
    const play = () => {
        if (!audioBuffer || !audioContextRef.current) return;

        if (isPlaying) {
            stop();
            return;
        }

        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.loop = isLooping;
        source.connect(audioContextRef.current.destination);

        const startOffset = playbackPosition;
        source.start(0, startOffset);
        sourceNodeRef.current = source;
        startTimeRef.current = audioContextRef.current.currentTime - startOffset;

        setIsPlaying(true);

        // Update playback position
        const updatePosition = () => {
            if (!audioContextRef.current) return;
            const currentTime = audioContextRef.current.currentTime - startTimeRef.current;
            if (currentTime >= duration) {
                if (isLooping) {
                    startTimeRef.current = audioContextRef.current.currentTime;
                    setPlaybackPosition(0);
                } else {
                    stop();
                    return;
                }
            }
            setPlaybackPosition(currentTime % duration);
            animationFrameRef.current = requestAnimationFrame(updatePosition);
        };
        animationFrameRef.current = requestAnimationFrame(updatePosition);

        source.onended = () => {
            if (!isLooping) {
                setIsPlaying(false);
            }
        };
    };

    const stop = () => {
        if (sourceNodeRef.current) {
            sourceNodeRef.current.stop();
            sourceNodeRef.current = null;
        }
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        setIsPlaying(false);
        setPlaybackPosition(0);
    };

    const skipToStart = () => {
        setPlaybackPosition(0);
        if (isPlaying) {
            stop();
            setTimeout(play, 50);
        }
    };

    const skipToEnd = () => {
        setPlaybackPosition(duration);
    };

    // Handle canvas mouse events for selection
    const handleCanvasMouseDown = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;

        const totalSamples = waveformData.left.length;
        const visibleSamples = totalSamples / zoom;
        const startSample = scrollPosition * (totalSamples - visibleSamples);
        const clickedSample = startSample + (x * visibleSamples);
        const normalizedPosition = clickedSample / totalSamples;

        setSelection({ start: normalizedPosition, end: normalizedPosition });
        setIsSelecting(true);
    };

    const handleCanvasMouseMove = (e) => {
        if (!isSelecting) return;

        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

        const totalSamples = waveformData.left.length;
        const visibleSamples = totalSamples / zoom;
        const startSample = scrollPosition * (totalSamples - visibleSamples);
        const clickedSample = startSample + (x * visibleSamples);
        const normalizedPosition = Math.max(0, Math.min(1, clickedSample / totalSamples));

        setSelection(prev => ({ ...prev, end: normalizedPosition }));
    };

    const handleCanvasMouseUp = () => {
        setIsSelecting(false);
    };

    // Backend API calls for effects
    const applyEffect = async (effectType, params = {}) => {
        if (!audioClip?.file) {
            console.error('No audio file available');
            return;
        }

        setIsProcessing(true);
        setProcessingMessage(`Applying ${effectType}...`);

        try {
            const formData = new FormData();
            formData.append('file', audioClip.file);
            formData.append('effect_type', effectType);
            formData.append('params', JSON.stringify(params));

            const response = await fetch('http://localhost:8000/effects/apply', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Effect processing failed');

            const processedBlob = await response.blob();
            const arrayBuffer = await processedBlob.arrayBuffer();
            const buffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

            setAudioBuffer(buffer);
            setDuration(buffer.duration);
            generateWaveformData(buffer);

        } catch (error) {
            console.error('Effect failed:', error);
            alert(`Failed to apply ${effectType}: ${error.message}`);
        } finally {
            setIsProcessing(false);
            setProcessingMessage('');
        }
    };

    const handleCut = async () => {
        if (selection.start === selection.end) {
            alert('Please select a region to cut');
            return;
        }
        if (!audioClip?.file) {
            console.error('No audio file available');
            return;
        }

        const startMs = Math.round(Math.min(selection.start, selection.end) * duration * 1000);
        const endMs = Math.round(Math.max(selection.start, selection.end) * duration * 1000);

        setIsProcessing(true);
        setProcessingMessage('Cutting selection...');

        try {
            const formData = new FormData();
            formData.append('file', audioClip.file);

            const response = await fetch(`http://localhost:8000/audio/cut?start_ms=${startMs}&end_ms=${endMs}`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Cut failed');

            const processedBlob = await response.blob();
            const arrayBuffer = await processedBlob.arrayBuffer();
            const buffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

            setAudioBuffer(buffer);
            setDuration(buffer.duration);
            generateWaveformData(buffer);
            setSelection({ start: 0, end: 0 });
        } catch (error) {
            console.error('Cut failed:', error);
            alert(`Cut failed: ${error.message}`);
        } finally {
            setIsProcessing(false);
            setProcessingMessage('');
        }
    };

    const handleTrim = async () => {
        if (selection.start === selection.end) {
            alert('Please select a region to keep');
            return;
        }
        if (!audioClip?.file) {
            console.error('No audio file available');
            return;
        }

        const startMs = Math.round(Math.min(selection.start, selection.end) * duration * 1000);
        const endMs = Math.round(Math.max(selection.start, selection.end) * duration * 1000);

        setIsProcessing(true);
        setProcessingMessage('Trimming to selection...');

        try {
            const formData = new FormData();
            formData.append('file', audioClip.file);

            const response = await fetch(`http://localhost:8000/audio/trim?start_ms=${startMs}&end_ms=${endMs}`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Trim failed');

            const processedBlob = await response.blob();
            const arrayBuffer = await processedBlob.arrayBuffer();
            const buffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

            setAudioBuffer(buffer);
            setDuration(buffer.duration);
            generateWaveformData(buffer);
            setSelection({ start: 0, end: 0 });
        } catch (error) {
            console.error('Trim failed:', error);
            alert(`Trim failed: ${error.message}`);
        } finally {
            setIsProcessing(false);
            setProcessingMessage('');
        }
    };

    const handleNormalize = () => applyEffect('normalize', { headroom_db: 0.1 });

    const handleReverse = async () => {
        if (!audioClip?.file) {
            console.error('No audio file available');
            return;
        }

        setIsProcessing(true);
        setProcessingMessage('Reversing audio...');

        try {
            const formData = new FormData();
            formData.append('file', audioClip.file);

            const response = await fetch('http://localhost:8000/audio/reverse', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Reverse failed');

            const processedBlob = await response.blob();
            const arrayBuffer = await processedBlob.arrayBuffer();
            const buffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

            setAudioBuffer(buffer);
            setDuration(buffer.duration);
            generateWaveformData(buffer);
        } catch (error) {
            console.error('Reverse failed:', error);
            alert(`Reverse failed: ${error.message}`);
        } finally {
            setIsProcessing(false);
            setProcessingMessage('');
        }
    };

    const handleFadeIn = async () => {
        if (!audioClip?.file) return;

        const fadeDuration = selection.start !== selection.end
            ? Math.round(Math.abs(selection.end - selection.start) * duration * 1000)
            : 500; // Default 500ms

        setIsProcessing(true);
        setProcessingMessage('Applying fade in...');

        try {
            const formData = new FormData();
            formData.append('file', audioClip.file);

            const response = await fetch(`http://localhost:8000/audio/fade?fade_type=in&duration_ms=${fadeDuration}`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Fade in failed');

            const processedBlob = await response.blob();
            const arrayBuffer = await processedBlob.arrayBuffer();
            const buffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

            setAudioBuffer(buffer);
            generateWaveformData(buffer);
        } catch (error) {
            console.error('Fade in failed:', error);
            alert(`Fade in failed: ${error.message}`);
        } finally {
            setIsProcessing(false);
            setProcessingMessage('');
        }
    };

    const handleFadeOut = async () => {
        if (!audioClip?.file) return;

        const fadeDuration = selection.start !== selection.end
            ? Math.round(Math.abs(selection.end - selection.start) * duration * 1000)
            : 500; // Default 500ms

        setIsProcessing(true);
        setProcessingMessage('Applying fade out...');

        try {
            const formData = new FormData();
            formData.append('file', audioClip.file);

            const response = await fetch(`http://localhost:8000/audio/fade?fade_type=out&duration_ms=${fadeDuration}`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Fade out failed');

            const processedBlob = await response.blob();
            const arrayBuffer = await processedBlob.arrayBuffer();
            const buffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

            setAudioBuffer(buffer);
            generateWaveformData(buffer);
        } catch (error) {
            console.error('Fade out failed:', error);
            alert(`Fade out failed: ${error.message}`);
        } finally {
            setIsProcessing(false);
            setProcessingMessage('');
        }
    };

    // Reverb effect
    const handleReverb = () => applyEffect('reverb', { room_size: 0.5, damping: 0.5, wet_level: 0.3 });

    // EQ effect
    const handleEQ = () => applyEffect('eq', {
        low_gain: 0,
        mid_gain: 0,
        high_gain: 0,
        low_freq: 200,
        high_freq: 3000
    });

    // Denoise (placeholder - needs backend implementation)
    const handleDenoise = async () => {
        alert('Denoise: This feature requires advanced audio processing. Coming soon!');
    };

    // Time stretch (placeholder - needs backend implementation)
    const handleTimeStretch = async () => {
        const factor = prompt('Enter time stretch factor (0.5 = half speed, 2.0 = double speed):', '1.0');
        if (!factor) return;
        alert(`Time Stretch: Factor ${factor}. This feature requires advanced audio processing. Coming soon!`);
    };

    // Add marker at current position
    const [markers, setMarkers] = useState([]);
    const handleAddMarker = () => {
        const position = playbackPosition / duration;
        if (position >= 0 && position <= 1) {
            setMarkers(prev => [...prev, { position, time: playbackPosition }].sort((a, b) => a.position - b.position));
        }
    };

    const handleRemoveMarker = () => {
        if (markers.length === 0) return;
        // Remove the marker closest to playhead
        const position = playbackPosition / duration;
        const closest = markers.reduce((prev, curr) =>
            Math.abs(curr.position - position) < Math.abs(prev.position - position) ? curr : prev
        );
        setMarkers(prev => prev.filter(m => m !== closest));
    };

    // Tune loop (placeholder)
    const handleTuneLoop = () => {
        alert('Tune Loop: Adjust loop points to match musical tempo. Coming soon!');
    };

    // Copy selection to clipboard / drag
    const handleCopySelection = async () => {
        if (selection.start === selection.end) {
            alert('Please select a region to copy');
            return;
        }
        // For now, just log - full implementation would copy to clipboard
        const startMs = Math.round(Math.min(selection.start, selection.end) * duration * 1000);
        const endMs = Math.round(Math.max(selection.start, selection.end) * duration * 1000);
        alert(`Selection copied: ${startMs}ms - ${endMs}ms\nDrag to playlist to create new clip.`);
    };

    // Trim side noise (remove silence from start/end)
    const handleTrimSideNoise = async () => {
        if (!audioClip?.file) return;

        // Simple implementation: trim first and last 50ms of silence
        // A full implementation would analyze the waveform for silence thresholds
        setIsProcessing(true);
        setProcessingMessage('Trimming silence...');

        try {
            // Find first non-silent sample
            const leftChannel = audioBuffer.getChannelData(0);
            const threshold = 0.01;
            let startSample = 0;
            let endSample = leftChannel.length - 1;

            for (let i = 0; i < leftChannel.length; i++) {
                if (Math.abs(leftChannel[i]) > threshold) {
                    startSample = Math.max(0, i - 100); // Small padding
                    break;
                }
            }

            for (let i = leftChannel.length - 1; i >= 0; i--) {
                if (Math.abs(leftChannel[i]) > threshold) {
                    endSample = Math.min(leftChannel.length - 1, i + 100);
                    break;
                }
            }

            const startMs = Math.round((startSample / sampleRate) * 1000);
            const endMs = Math.round((endSample / sampleRate) * 1000);

            const formData = new FormData();
            formData.append('file', audioClip.file);

            const response = await fetch(`http://localhost:8000/audio/trim?start_ms=${startMs}&end_ms=${endMs}`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('Trim side noise failed');

            const processedBlob = await response.blob();
            const arrayBuffer = await processedBlob.arrayBuffer();
            const buffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

            setAudioBuffer(buffer);
            setDuration(buffer.duration);
            generateWaveformData(buffer);
        } catch (error) {
            console.error('Trim side noise failed:', error);
            alert(`Trim side noise failed: ${error.message}`);
        } finally {
            setIsProcessing(false);
            setProcessingMessage('');
        }
    };

    // Send to playlist/channel
    const handleSendToPlaylist = () => {
        if (onSave) {
            // Create a blob from current audio buffer
            onSave(audioBuffer, audioClip?.name || 'Edited Sample');
        }
        alert('Sample ready to add to playlist. Drag from here or use the file menu.');
    };

    // Format time display
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 1000);
        return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    };

    return (
        <div className="sample-editor" ref={containerRef}>
            {/* Processing overlay */}
            {isProcessing && (
                <div className="processing-overlay">
                    <div className="processing-spinner"></div>
                    <div className="processing-message">{processingMessage}</div>
                </div>
            )}

            {/* Transport & Recording Controls */}
            <div className="sample-editor-transport">
                <button
                    className={`transport-btn ${isLooping ? 'active' : ''}`}
                    onClick={() => setIsLooping(!isLooping)}
                    title="Loop"
                >
                    <Repeat size={14} />
                </button>
                <button className="transport-btn" onClick={play} title={isPlaying ? "Pause" : "Play"}>
                    {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                </button>
                <button className="transport-btn" onClick={stop} title="Stop">
                    <Square size={14} />
                </button>

                <div className="transport-divider" />

                <div className="time-display">
                    <span className="time-current">{formatTime(playbackPosition)}</span>
                    <span className="time-separator">/</span>
                    <span className="time-total">{formatTime(duration)}</span>
                </div>
            </div>

            {/* Main Toolbar - Edison Style */}
            <div className="sample-editor-toolbar">
                {/* Left Edit Tools */}
                <div className="toolbar-group">
                    <button className="toolbar-btn" onClick={handleCut} title="Cut Selection">
                        <Scissors size={16} />
                    </button>
                    <button className="toolbar-btn" onClick={handleTrim} title="Trim to Selection">
                        <Maximize2 size={16} />
                    </button>
                    <button className="toolbar-btn" onClick={handleCopySelection} title="Copy / Drag Selection">
                        <Copy size={16} />
                    </button>
                </div>

                <div className="toolbar-divider" />

                {/* Zoom controls */}
                <div className="toolbar-group">
                    <button className="toolbar-btn" onClick={() => setZoom(z => Math.max(1, z / 1.5))} title="Zoom Out">
                        <ZoomOut size={16} />
                    </button>
                    <button className="toolbar-btn" onClick={() => setZoom(z => Math.min(32, z * 1.5))} title="Zoom In">
                        <ZoomIn size={16} />
                    </button>
                </div>

                <div className="toolbar-divider" />

                {/* Undo/Redo */}
                <div className="toolbar-group">
                    <button className="toolbar-btn" title="Undo">
                        <RotateCcw size={14} />
                    </button>
                    <button className="toolbar-btn" title="Redo">
                        <RotateCw size={14} />
                    </button>
                </div>

                {/* Edison-style Tool Grid (Right side) */}
                <div className="toolbar-grid" style={{ marginLeft: 'auto' }}>
                    {/* Row 1 */}
                    <button className="toolbar-btn" onClick={handleTrim} title="Trim to Selection">
                        <Maximize2 size={14} />
                    </button>
                    <button className="toolbar-btn" onClick={handleNormalize} title="Normalize">
                        <Volume2 size={14} />
                    </button>
                    <button className="toolbar-btn" onClick={handleFadeIn} title="Fade In">
                        <span style={{ fontSize: '9px', fontWeight: 'bold' }}>↗FD</span>
                    </button>
                    <button className="toolbar-btn" onClick={handleReverb} title="Reverb">
                        <Waves size={14} />
                    </button>
                    <button className="toolbar-btn" onClick={handleEQ} title="Equalize">
                        <Sliders size={14} />
                    </button>
                    <button className="toolbar-btn" onClick={handleAddMarker} title="Add Marker">
                        <Flag size={14} />
                    </button>
                    <button className="toolbar-btn" onClick={handleTuneLoop} title="Tune Loop">
                        <Music size={14} />
                    </button>
                    <button className="toolbar-btn" onClick={handleCopySelection} title="Drag/Copy Sample">
                        <Copy size={14} />
                    </button>

                    {/* Row 2 */}
                    <button className="toolbar-btn" onClick={handleTrimSideNoise} title="Trim Side Noise">
                        <Eraser size={14} />
                    </button>
                    <button className="toolbar-btn" onClick={handleFadeOut} title="Fade Out">
                        <span style={{ fontSize: '9px', fontWeight: 'bold' }}>FD↘</span>
                    </button>
                    <button className="toolbar-btn" onClick={handleTimeStretch} title="Time Stretch">
                        <Timer size={14} />
                    </button>
                    <button className="toolbar-btn" onClick={handleDenoise} title="Denoise">
                        <Mic size={14} />
                    </button>
                    <button className="toolbar-btn" onClick={handleSendToPlaylist} title="Send to Playlist/Channel">
                        <Send size={14} />
                    </button>
                    <button className="toolbar-btn" onClick={handleRemoveMarker} title="Remove Marker">
                        <Flag size={14} style={{ opacity: 0.5 }} />
                    </button>
                    <button className="toolbar-btn" onClick={handleReverse} title="Reverse">
                        <RotateCcw size={14} />
                    </button>
                    <button className="toolbar-btn" onClick={() => setZoom(1)} title="Zoom Fit">
                        <span style={{ fontSize: '9px', fontWeight: 'bold' }}>FIT</span>
                    </button>
                </div>
            </div>

            {/* Info Bar */}
            <div className="sample-editor-info">
                <div className="info-item">
                    <span className="info-label">SAMPLERATE</span>
                    <span className="info-value">{sampleRate}Hz</span>
                </div>
                <div className="info-item">
                    <span className="info-label">FORMAT</span>
                    <span className="info-value">{bitDepth} ⌂</span>
                </div>
                <div className="info-item">
                    <span className="info-label">CHANNELS</span>
                    <span className="info-value">{channels === 2 ? 'Stereo' : 'Mono'}</span>
                </div>
                <div className="info-item title">
                    <span className="info-label">TITLE</span>
                    <span className="info-value">{audioClip?.name || 'Untitled'}</span>
                </div>
                <div className="info-item" style={{ marginLeft: 'auto' }}>
                    <span className="info-label">LENGTH</span>
                    <span className="info-value">{formatTime(duration)}</span>
                </div>
            </div>

            {/* Main Waveform Display */}
            <div className="sample-editor-waveform">
                <canvas
                    ref={canvasRef}
                    width={1200}
                    height={350}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    onMouseLeave={handleCanvasMouseUp}
                />
            </div>

            {/* Overview / Timeline */}
            <div className="sample-editor-overview">
                <canvas
                    ref={overviewCanvasRef}
                    width={1200}
                    height={40}
                    onClick={(e) => {
                        const rect = e.target.getBoundingClientRect();
                        const x = (e.clientX - rect.left) / rect.width;
                        setPlaybackPosition(x * duration);
                    }}
                />
            </div>

            {/* Bottom Transport */}
            <div className="sample-editor-bottom">
                <div className="bottom-transport">
                    <button className="transport-btn small" onClick={skipToStart} title="Skip to Start">
                        <SkipBack size={12} />
                    </button>
                    <button className="transport-btn small" onClick={play}>
                        {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                    </button>
                    <button className="transport-btn small" onClick={skipToEnd} title="Skip to End">
                        <SkipForward size={12} />
                    </button>
                </div>

                {/* Scroll position slider for zoomed view */}
                {zoom > 1 && (
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.001"
                        value={scrollPosition}
                        onChange={(e) => setScrollPosition(parseFloat(e.target.value))}
                        className="scroll-slider"
                        title="Scroll Position"
                    />
                )}
            </div>
        </div>
    );
}
