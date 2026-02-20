import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    Play, Pause, Square, SkipBack, SkipForward, Repeat,
    Scissors, Download, Upload, RotateCcw, RotateCw,
    ZoomIn, ZoomOut, Volume2, Maximize2, Clock, Music,
    Flag, Copy, Send, Waves, Sliders, Mic, Timer, Eraser, ChevronDown
} from 'lucide-react';
import Knob from './Knob';
import EffectEditor from './EffectEditor';
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

    // Channel & Time Stretching state
    const [isOn, setIsOn] = useState(true);
    const [pan, setPan] = useState(0);
    const [vol, setVol] = useState(80);
    const [pitch, setPitch] = useState(0);
    const [mul, setMul] = useState(100);
    const [time, setTime] = useState(0);
    const [stretchMode, setStretchMode] = useState('Resample');
    const [editingEffect, setEditingEffect] = useState(null);
    const [effectParams, setEffectParams] = useState({});

    // Undo/Redo state
    const undoStackRef = useRef([]);
    const redoStackRef = useRef([]);
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);

    // Refs
    const canvasRef = useRef(null);
    const overviewCanvasRef = useRef(null);
    const audioContextRef = useRef(null);
    const sourceNodeRef = useRef(null);
    const gainNodeRef = useRef(null);
    const pannerNodeRef = useRef(null);
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

        // Create gain and panner nodes for real-time vol/pan control
        const gainNode = audioContextRef.current.createGain();
        gainNode.gain.value = isOn ? vol / 100 : 0;
        gainNodeRef.current = gainNode;

        const pannerNode = audioContextRef.current.createStereoPanner();
        pannerNode.pan.value = pan / 50; // Normalize -50..50 to -1..1
        pannerNodeRef.current = pannerNode;

        source.connect(gainNode).connect(pannerNode).connect(audioContextRef.current.destination);

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
        gainNodeRef.current = null;
        pannerNodeRef.current = null;
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        setIsPlaying(false);
        setPlaybackPosition(0);
    };

    // Sync vol/pan/isOn to audio nodes in real-time
    useEffect(() => {
        if (gainNodeRef.current) {
            gainNodeRef.current.gain.value = isOn ? vol / 100 : 0;
        }
    }, [vol, isOn]);

    useEffect(() => {
        if (pannerNodeRef.current) {
            pannerNodeRef.current.pan.value = pan / 50;
        }
    }, [pan]);

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
        if (!audioBuffer) {
            console.error('No audio buffer available');
            return;
        }

        setIsProcessing(true);
        setProcessingMessage(`Applying ${effectType}...`);

        try {
            const wavBlob = audioBufferToWav(audioBuffer);
            const formData = new FormData();
            formData.append('file', wavBlob, 'audio.wav');
            formData.append('effect_type', effectType);
            formData.append('params', JSON.stringify(params));

            const response = await fetch('http://localhost:8000/effects/apply', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `Effect processing failed (${response.status})`);
            }

            const processedBlob = await response.blob();
            const arrayBuffer = await processedBlob.arrayBuffer();
            const buffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

            updateAudioBuffer(buffer);

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

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `Cut failed (${response.status})`);
            }

            const processedBlob = await response.blob();
            const arrayBuffer = await processedBlob.arrayBuffer();
            const buffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

            updateAudioBuffer(buffer);
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

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `Trim failed (${response.status})`);
            }

            const processedBlob = await response.blob();
            const arrayBuffer = await processedBlob.arrayBuffer();
            const buffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

            updateAudioBuffer(buffer);
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

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `Reverse failed (${response.status})`);
            }

            const processedBlob = await response.blob();
            const arrayBuffer = await processedBlob.arrayBuffer();
            const buffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

            updateAudioBuffer(buffer);
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

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `Fade in failed (${response.status})`);
            }

            const processedBlob = await response.blob();
            const arrayBuffer = await processedBlob.arrayBuffer();
            const buffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

            updateAudioBuffer(buffer);
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

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `Fade out failed (${response.status})`);
            }

            const processedBlob = await response.blob();
            const arrayBuffer = await processedBlob.arrayBuffer();
            const buffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

            updateAudioBuffer(buffer);
        } catch (error) {
            console.error('Fade out failed:', error);
            alert(`Fade out failed: ${error.message}`);
        } finally {
            setIsProcessing(false);
            setProcessingMessage('');
        }
    };

    // Reverb effect — open the EffectEditor window
    const handleReverb = () => {
        setEditingEffect({ type: 'reverb', enabled: true, params: effectParams['reverb'] || {} });
    };

    // Apply effect from EffectEditor and close
    const handleApplyEffectEditor = async () => {
        if (!editingEffect) return;
        // Map EffectEditor param names to backend param names
        const editorParams = editingEffect.params || {};
        let backendParams = {};

        if (editingEffect.type === 'reverb') {
            backendParams = {
                decay: editorParams.decay ?? 1.5,
                mix: (editorParams.wet ?? 0.6) * 100  // EffectEditor wet is 0-1, backend mix is 0-100
            };
        } else if (editingEffect.type === 'delay') {
            backendParams = {
                time_ms: (editorParams.delayTime ?? 0.3) * 1000,
                feedback: editorParams.feedback ?? 0.4,
                mix: (editorParams.dryVol ?? 0.5) * 100
            };
        } else {
            backendParams = editorParams;
        }

        await applyEffect(editingEffect.type, backendParams);
        setEditingEffect(null);
    };

    // EQ effect
    const handleEQ = () => applyEffect('eq', {
        low_gain: 0,
        mid_gain: 0,
        high_gain: 0,
        low_freq: 200,
        high_freq: 3000
    });

    // Denoise - calls backend spectral gating
    const handleDenoise = async () => {
        if (!audioClip?.file) {
            console.error('No audio file available');
            return;
        }

        setIsProcessing(true);
        setProcessingMessage('Removing noise...');

        try {
            const formData = new FormData();
            formData.append('file', audioClip.file);

            const response = await fetch('http://localhost:8000/audio/denoise?strength=1.0', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `Denoise failed (${response.status})`);
            }

            const processedBlob = await response.blob();
            const arrayBuffer = await processedBlob.arrayBuffer();
            const buffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

            updateAudioBuffer(buffer);
        } catch (error) {
            console.error('Denoise failed:', error);
            alert(`Denoise failed: ${error.message}`);
        } finally {
            setIsProcessing(false);
            setProcessingMessage('');
        }
    };

    // Time stretch - calls backend librosa processing
    const handleTimeStretch = async () => {
        if (!audioClip?.file) {
            console.error('No audio file available');
            return;
        }

        const factorStr = prompt('Enter time stretch factor (0.5 = half speed, 2.0 = double speed):', '1.0');
        if (!factorStr) return;
        const factor = parseFloat(factorStr);
        if (isNaN(factor) || factor <= 0 || factor > 10) {
            alert('Invalid factor. Please enter a number between 0.01 and 10.');
            return;
        }

        setIsProcessing(true);
        setProcessingMessage(`Time stretching (${factor}x)...`);

        try {
            const formData = new FormData();
            formData.append('file', audioClip.file);

            const response = await fetch(`http://localhost:8000/audio/time-stretch?factor=${factor}`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `Time stretch failed (${response.status})`);
            }

            const processedBlob = await response.blob();
            const arrayBuffer = await processedBlob.arrayBuffer();
            const buffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

            updateAudioBuffer(buffer);
        } catch (error) {
            console.error('Time stretch failed:', error);
            alert(`Time stretch failed: ${error.message}`);
        } finally {
            setIsProcessing(false);
            setProcessingMessage('');
        }
    };

    // Apply pitch shift from PITCH knob via backend
    const handleApplyPitch = async () => {
        if (!audioBuffer || pitch === 0) return;

        setIsProcessing(true);
        const semitones = pitch / 100; // Convert cents to semitones
        setProcessingMessage(`Pitch shifting (${semitones > 0 ? '+' : ''}${semitones.toFixed(1)} st)...`);

        try {
            const wavBlob = audioBufferToWav(audioBuffer);
            const formData = new FormData();
            formData.append('file', wavBlob, 'audio.wav');

            const response = await fetch(`http://localhost:8000/audio/pitch-shift?semitones=${semitones}`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `Pitch shift failed (${response.status})`);
            }

            const processedBlob = await response.blob();
            const arrayBuffer = await processedBlob.arrayBuffer();
            const buffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

            updateAudioBuffer(buffer);
            setPitch(0); // Reset knob after applying
        } catch (error) {
            console.error('Pitch shift failed:', error);
            alert(`Pitch shift failed: ${error.message}`);
        } finally {
            setIsProcessing(false);
            setProcessingMessage('');
        }
    };

    // Apply time stretch from TIME/MUL knobs via backend
    const handleApplyTimeStretchKnob = async () => {
        // MUL = speed multiplier (100 = normal, 50 = half speed, 200 = double speed)
        // TIME = additional fine-tune (-50 to 50, negative = slower, positive = faster)
        const mulFactor = mul / 100;  // 100% -> 1.0
        const timeFactor = 1.0 + (time / 100); // -50 → 0.5x, 0 → 1.0x, 50 → 1.5x
        const rawFactor = mulFactor * timeFactor;
        const factor = Math.max(0.1, Math.min(10.0, rawFactor)); // Clamp to valid range

        if (!audioBuffer || Math.abs(factor - 1.0) < 0.01) return;

        setIsProcessing(true);
        setProcessingMessage(`Time stretching (${factor.toFixed(2)}x)...`);

        try {
            const wavBlob = audioBufferToWav(audioBuffer);
            const formData = new FormData();
            formData.append('file', wavBlob, 'audio.wav');

            const response = await fetch(`http://localhost:8000/audio/time-stretch?factor=${factor}`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `Time stretch failed (${response.status})`);
            }

            const processedBlob = await response.blob();
            const arrayBuffer = await processedBlob.arrayBuffer();
            const buffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

            updateAudioBuffer(buffer);
            setMul(100); // Reset knobs
            setTime(0);
        } catch (error) {
            console.error('Time stretch failed:', error);
            alert(`Time stretch failed: ${error.message}`);
        } finally {
            setIsProcessing(false);
            setProcessingMessage('');
        }
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

    // Tune loop - snap selection/loop points to nearest beat boundary
    const handleTuneLoop = () => {
        if (!audioBuffer || duration === 0) {
            alert('No audio loaded');
            return;
        }

        // Estimate BPM from audio using zero-crossing rate
        const channelData = audioBuffer.getChannelData(0);
        const sr = audioBuffer.sampleRate;

        // Simple onset detection: split into windows, find energy peaks
        const windowSize = Math.floor(sr * 0.02); // 20ms windows
        const energies = [];
        for (let i = 0; i < channelData.length - windowSize; i += windowSize) {
            let energy = 0;
            for (let j = 0; j < windowSize; j++) {
                energy += channelData[i + j] * channelData[i + j];
            }
            energies.push(energy / windowSize);
        }

        // Find energy peaks (onsets)
        const avgEnergy = energies.reduce((a, b) => a + b, 0) / energies.length;
        const onsets = [];
        for (let i = 1; i < energies.length - 1; i++) {
            if (energies[i] > avgEnergy * 1.5 && energies[i] > energies[i - 1] && energies[i] > energies[i + 1]) {
                onsets.push(i * windowSize / sr); // time in seconds
            }
        }

        if (onsets.length < 2) {
            alert('Could not detect enough beats to tune loop. Try a more rhythmic section.');
            return;
        }

        // Estimate beat interval from onset differences
        const intervals = [];
        for (let i = 1; i < Math.min(onsets.length, 50); i++) {
            intervals.push(onsets[i] - onsets[i - 1]);
        }
        intervals.sort((a, b) => a - b);
        const medianInterval = intervals[Math.floor(intervals.length / 2)];
        const estimatedBPM = Math.round(60 / medianInterval);
        const beatDuration = 60 / estimatedBPM; // seconds per beat

        // Snap selection to beat boundaries
        const selStart = Math.min(selection.start, selection.end) * duration;
        const selEnd = Math.max(selection.start, selection.end) * duration;

        const snappedStart = Math.round(selStart / beatDuration) * beatDuration;
        const snappedEnd = Math.round(selEnd / beatDuration) * beatDuration;

        // Ensure at least 1 beat
        const finalEnd = snappedEnd <= snappedStart ? snappedStart + beatDuration : snappedEnd;

        setSelection({
            start: Math.max(0, snappedStart / duration),
            end: Math.min(1, finalEnd / duration)
        });

        alert(`Loop tuned! Estimated ${estimatedBPM} BPM. Selection snapped to ${Math.round((finalEnd - snappedStart) / beatDuration)} beat(s).`);
    };

    // Copy selection - extract selected region as WAV blob
    const handleCopySelection = async () => {
        if (selection.start === selection.end) {
            alert('Please select a region to copy');
            return;
        }
        if (!audioBuffer || !audioContextRef.current) {
            alert('No audio loaded');
            return;
        }

        try {
            const startSample = Math.floor(Math.min(selection.start, selection.end) * audioBuffer.length);
            const endSample = Math.floor(Math.max(selection.start, selection.end) * audioBuffer.length);
            const regionLength = endSample - startSample;

            if (regionLength <= 0) return;

            // Create a new buffer with just the selected region
            const regionBuffer = audioContextRef.current.createBuffer(
                audioBuffer.numberOfChannels,
                regionLength,
                audioBuffer.sampleRate
            );

            for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
                const sourceData = audioBuffer.getChannelData(ch);
                const destData = regionBuffer.getChannelData(ch);
                for (let i = 0; i < regionLength; i++) {
                    destData[i] = sourceData[startSample + i];
                }
            }

            // Convert to WAV blob
            const wavBlob = audioBufferToWav(regionBuffer);

            // Try to copy to clipboard
            if (navigator.clipboard && navigator.clipboard.write) {
                try {
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'audio/wav': wavBlob })
                    ]);
                    const startMs = Math.round(Math.min(selection.start, selection.end) * duration * 1000);
                    const endMs = Math.round(Math.max(selection.start, selection.end) * duration * 1000);
                    alert(`Selection copied to clipboard! (${startMs}ms - ${endMs}ms)`);
                } catch {
                    // Clipboard API may not support audio, fallback to download
                    const url = URL.createObjectURL(wavBlob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `selection_${Date.now()}.wav`;
                    a.click();
                    URL.revokeObjectURL(url);
                    alert('Clipboard not supported for audio. Selection downloaded as WAV file.');
                }
            } else {
                // Fallback: download the selection
                const url = URL.createObjectURL(wavBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `selection_${Date.now()}.wav`;
                a.click();
                URL.revokeObjectURL(url);
                alert('Selection downloaded as WAV file.');
            }
        } catch (error) {
            console.error('Copy selection failed:', error);
            alert(`Copy failed: ${error.message}`);
        }
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

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `Trim side noise failed (${response.status})`);
            }

            const processedBlob = await response.blob();
            const arrayBuffer = await processedBlob.arrayBuffer();
            const buffer = await audioContextRef.current.decodeAudioData(arrayBuffer);

            updateAudioBuffer(buffer);
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
        if (!audioBuffer) {
            alert('No audio to send');
            return;
        }

        const fileName = audioClip?.name || 'Edited Sample';

        if (onSave) {
            // Pass the raw AudioBuffer so the caller can generate waveform/metadata
            onSave(audioBuffer, fileName);
        }

        if (onClose) {
            onClose();
        }
    };

    // Helper: Convert AudioBuffer to WAV Blob
    const audioBufferToWav = (buffer) => {
        const numChannels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        const length = buffer.length;
        const bytesPerSample = 2; // 16-bit
        const blockAlign = numChannels * bytesPerSample;
        const dataSize = length * blockAlign;
        const bufferSize = 44 + dataSize;

        const arrayBuffer = new ArrayBuffer(bufferSize);
        const view = new DataView(arrayBuffer);

        // WAV header
        const writeString = (offset, str) => {
            for (let i = 0; i < str.length; i++) {
                view.setUint8(offset + i, str.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true); // chunk size
        view.setUint16(20, 1, true); // PCM
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * blockAlign, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, 16, true); // bits per sample
        writeString(36, 'data');
        view.setUint32(40, dataSize, true);

        // Write interleaved samples
        let offset = 44;
        const channels = [];
        for (let ch = 0; ch < numChannels; ch++) {
            channels.push(buffer.getChannelData(ch));
        }

        for (let i = 0; i < length; i++) {
            for (let ch = 0; ch < numChannels; ch++) {
                const sample = Math.max(-1, Math.min(1, channels[ch][i]));
                const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                view.setInt16(offset, int16, true);
                offset += 2;
            }
        }

        return new Blob([arrayBuffer], { type: 'audio/wav' });
    };

    // Undo/Redo helpers
    const updateAudioBuffer = (newBuffer) => {
        // Push current buffer to undo stack
        if (audioBuffer) {
            undoStackRef.current = [...undoStackRef.current, audioBuffer];
            // Limit stack size to 20 to prevent memory issues
            if (undoStackRef.current.length > 20) {
                undoStackRef.current = undoStackRef.current.slice(-20);
            }
            setCanUndo(true);
        }
        // Clear redo stack on new action
        redoStackRef.current = [];
        setCanRedo(false);

        setAudioBuffer(newBuffer);
        setDuration(newBuffer.duration);
        generateWaveformData(newBuffer);
    };

    const handleUndo = () => {
        if (undoStackRef.current.length === 0) return;

        const stack = [...undoStackRef.current];
        const previousBuffer = stack.pop();
        undoStackRef.current = stack;
        setCanUndo(stack.length > 0);

        // Push current to redo
        if (audioBuffer) {
            redoStackRef.current = [...redoStackRef.current, audioBuffer];
            setCanRedo(true);
        }

        setAudioBuffer(previousBuffer);
        setDuration(previousBuffer.duration);
        generateWaveformData(previousBuffer);
    };

    const handleRedo = () => {
        if (redoStackRef.current.length === 0) return;

        const stack = [...redoStackRef.current];
        const nextBuffer = stack.pop();
        redoStackRef.current = stack;
        setCanRedo(stack.length > 0);

        // Push current to undo
        if (audioBuffer) {
            undoStackRef.current = [...undoStackRef.current, audioBuffer];
            setCanUndo(true);
        }

        setAudioBuffer(nextBuffer);
        setDuration(nextBuffer.duration);
        generateWaveformData(nextBuffer);
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
                    <button className={`toolbar-btn ${!canUndo ? 'disabled' : ''}`} onClick={handleUndo} title="Undo" disabled={!canUndo}>
                        <RotateCcw size={14} />
                    </button>
                    <button className={`toolbar-btn ${!canRedo ? 'disabled' : ''}`} onClick={handleRedo} title="Redo" disabled={!canRedo}>
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
                    <button className={`toolbar-btn ${editingEffect?.type === 'reverb' ? 'active' : ''}`} onClick={handleReverb} title="Reverb">
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

            {/* Effect Editor Modal */}
            {editingEffect && (
                <>
                    <EffectEditor
                        effect={editingEffect}
                        onClose={() => setEditingEffect(null)}
                        onUpdateParams={(params) => {
                            queueMicrotask(() => {
                                setEffectParams(prev => ({
                                    ...prev,
                                    [editingEffect.type]: { ...(prev[editingEffect.type] || {}), ...params }
                                }));
                                setEditingEffect(prev => prev ? {
                                    ...prev,
                                    params: { ...prev.params, ...params }
                                } : null);
                            });
                        }}
                        onUpdateMix={() => { }}
                        onToggleEnabled={() => {
                            setEditingEffect(prev => prev ? { ...prev, enabled: !prev.enabled } : null);
                        }}
                    />
                    <div className="effect-apply-floating" onMouseDown={(e) => e.stopPropagation()}>
                        <button className="apply-btn apply-btn-effect" onClick={handleApplyEffectEditor} disabled={isProcessing}>
                            {isProcessing ? 'Processing...' : 'Apply to Audio'}
                        </button>
                        <button className="apply-btn apply-btn-cancel" onClick={() => setEditingEffect(null)}>Cancel</button>
                    </div>
                </>
            )}

            {/* Edison-style Settings Panel (Channel & Time Stretching) */}
            <div className="sample-editor-settings">
                {/* Channel Controls */}
                <div className="settings-section channel-controls">
                    <div className="setting-item">
                        <div
                            className={`led-switch ${isOn ? 'on' : ''}`}
                            onClick={() => setIsOn(!isOn)}
                        >
                            <div className="led-indicator" />
                        </div>
                        <span className="setting-label">ON</span>
                    </div>

                    <Knob
                        label="PAN"
                        value={pan}
                        onChange={(id, val) => setPan(val)}
                        param={{ id: 'pan', min: -50, max: 50, default: 0 }}
                        color="#60a5fa"
                        size="small"
                    />

                    <Knob
                        label="VOL"
                        value={vol}
                        onChange={(id, val) => setVol(val)}
                        param={{ id: 'vol', min: 0, max: 100, default: 80 }}
                        color="#4ade80"
                        size="small"
                    />
                </div>

                <div className="settings-divider" />

                {/* Time Stretching */}
                <div className="settings-section time-stretching">
                    <div className="section-title-row">
                        <div className="section-title">Time stretching</div>
                        <button
                            className="apply-btn"
                            onClick={handleApplyTimeStretchKnob}
                            disabled={isProcessing || (mul === 100 && time === 0)}
                            title="Apply time stretch to audio (destructive)"
                        >
                            Apply
                        </button>
                    </div>

                    <div className="stretch-controls">
                        <div className="pitch-control">
                            <Knob
                                label="PITCH"
                                value={pitch}
                                onChange={(id, val) => setPitch(val)}
                                param={{ id: 'pitch', min: -1200, max: 1200, default: 0 }}
                                color="#fb923c"
                                size="small"
                            />
                            <button
                                className="apply-btn apply-btn-small"
                                onClick={handleApplyPitch}
                                disabled={isProcessing || pitch === 0}
                                title="Apply pitch shift (destructive)"
                            >
                                Apply
                            </button>
                        </div>

                        <Knob
                            label="MUL"
                            value={mul}
                            onChange={(id, val) => setMul(val)}
                            param={{ id: 'mul', min: 10, max: 200, default: 100 }}
                            color="#9ca3af"
                            size="small"
                        />

                        <Knob
                            label="TIME"
                            value={time}
                            onChange={(id, val) => setTime(val)}
                            param={{ id: 'time', min: -50, max: 50, default: 0 }}
                            color="#fb923c"
                            size="small"
                        />

                        <div className="mode-selector-container">
                            <div className="mode-label">Mode</div>
                            <div className="mode-selector">
                                <span>{stretchMode}</span>
                                <ChevronDown size={12} />
                                <select
                                    value={stretchMode}
                                    onChange={(e) => setStretchMode(e.target.value)}
                                    className="mode-select-hidden"
                                >
                                    <option>Resample</option>
                                    <option>Pro Default</option>
                                    <option>Pro Transient</option>
                                    <option>E3 Generic</option>
                                </select>
                            </div>
                        </div>
                    </div>
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
