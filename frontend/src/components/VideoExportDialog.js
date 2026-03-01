import React, { useState, useRef, useEffect, useCallback } from 'react';
import './VideoExportDialog.css';

const BACKEND_URL = 'http://localhost:8000';

/**
 * VideoExportDialog - Opens the Geometric Resonance visualizer with the project's
 * rendered audio pre-loaded. Users customize the visualizer, then click Export MP4
 * to record the full playback and convert to MP4 via the backend.
 *
 * Props:
 *   isOpen       – boolean controlling visibility
 *   onClose      – callback to close the dialog
 *   audioBlob    – Blob of the rendered project audio (WAV)
 */
function VideoExportDialog({ isOpen, onClose, audioBlob }) {
  const iframeRef = useRef(null);
  const [status, setStatus] = useState('loading');
  // loading | ready | recording | converting | done
  const [iframeReady, setIframeReady] = useState(false);
  const [progress, setProgress] = useState('');

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      setStatus('loading');
      setIframeReady(false);
      setProgress('');
    }
  }, [isOpen]);

  /** Save a blob via Electron save dialog or browser download */
  const saveBlob = useCallback(async (blob, defaultName) => {
    if (window.electronAPI?.saveAudioFile) {
      const ext = defaultName.split('.').pop();
      const result = await window.electronAPI.saveAudioFile(ext);
      if (result.canceled || !result.filePath) return;

      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const chunkSize = 32768;
      let binary = '';
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
        binary += String.fromCharCode.apply(null, chunk);
      }
      const base64Data = btoa(binary);
      await window.electronAPI.saveAudioBuffer(result.filePath, base64Data);
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultName;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, []);

  /** Send WebM to backend → get MP4 back → save */
  const convertAndSave = useCallback(async (webmBlob) => {
    // Check if backend is available
    let backendAvailable = false;
    try {
      const healthCheck = await fetch(`${BACKEND_URL}/audio/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000)
      });
      backendAvailable = healthCheck.ok;
    } catch {
      backendAvailable = false;
    }

    if (!backendAvailable) {
      // Fallback: save as WebM directly
      console.warn('Backend unavailable, saving as WebM');
      await saveBlob(webmBlob, 'reson_studio_export.webm');
      return;
    }

    const formData = new FormData();
    formData.append('file', webmBlob, 'export.webm');

    const response = await fetch(`${BACKEND_URL}/audio/convert-video-to-mp4`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Conversion failed: ${errText}`);
    }

    const mp4Blob = await response.blob();
    await saveBlob(mp4Blob, 'reson_studio_export.mp4');
  }, [saveBlob]);

  // Listen for messages from the visualizer iframe
  useEffect(() => {
    if (!isOpen) return;

    const handleMessage = async (e) => {
      if (!e.data || typeof e.data !== 'object') return;

      switch (e.data.type) {
        case 'visualizer-ready':
          setIframeReady(true);
          break;
        case 'recording-started':
          setStatus('recording');
          setProgress('Recording visualizer... (plays through entire track)');
          break;
        case 'recording-stopped':
          break;
        case 'recording-complete': {
          setStatus('converting');
          setProgress('Converting to MP4...');
          try {
            const webmBlob = new Blob([e.data.videoData], { type: 'video/webm' });
            await convertAndSave(webmBlob);
            setStatus('done');
            setProgress('Export complete!');
            setTimeout(() => {
              setStatus('ready');
              setProgress('');
            }, 3000);
          } catch (err) {
            console.error('MP4 conversion error:', err);
            setStatus('ready');
            setProgress('');
            alert('Video conversion failed: ' + err.message);
          }
          break;
        }
        case 'audio-loaded':
          setStatus('ready');
          setProgress('');
          break;
        default:
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isOpen, convertAndSave]);

  // Send audio blob to iframe once it's ready
  useEffect(() => {
    if (!iframeReady || !audioBlob || !iframeRef.current) return;

    setStatus('loading');
    setProgress('Sending audio to visualizer...');
    audioBlob.arrayBuffer().then((buffer) => {
      iframeRef.current.contentWindow.postMessage(
        { type: 'load-audio', audioData: buffer },
        '*'
      );
    });
  }, [iframeReady, audioBlob]);

  /** Tell iframe to rewind, record, and play the entire track */
  const handleExportVideo = useCallback(() => {
    if (!iframeRef.current) return;
    iframeRef.current.contentWindow.postMessage({ type: 'export-video' }, '*');
  }, []);

  const handlePlayPause = useCallback(() => {
    if (!iframeRef.current) return;
    iframeRef.current.contentWindow.postMessage({ type: 'toggle-play' }, '*');
  }, []);

  // Close on Escape key (only when not busy)
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape' && status !== 'recording' && status !== 'converting') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose, status]);

  if (!isOpen) return null;

  const isBusy = status === 'recording' || status === 'converting';

  return (
    <div className="video-export-overlay">
      <div className="video-export-header">
        <h2>Video Export</h2>
        <div className="video-export-header-actions">
          {progress && (
            <span className={`video-export-status ${status}`}>
              {status === 'recording' && '● '}
              {status === 'done' && '✓ '}
              {progress}
            </span>
          )}
          <button
            className="video-export-btn preview"
            onClick={handlePlayPause}
            disabled={status !== 'ready'}
            title="Preview: Play / Pause"
          >
            ▶ Preview
          </button>
          <button
            className={`video-export-btn export-mp4 ${isBusy ? 'busy' : ''}`}
            onClick={handleExportVideo}
            disabled={status !== 'ready'}
            title="Export: Record the visualizer and save as MP4"
          >
            {status === 'recording'
              ? '● Recording...'
              : status === 'converting'
                ? '⟳ Converting...'
                : '⬇ Export MP4'}
          </button>
          <button
            className="video-export-btn close"
            onClick={onClose}
            disabled={isBusy}
            title="Close video export"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="video-export-iframe-container">
        {status === 'loading' && !iframeReady && (
          <div className="video-export-loading">
            <div className="spinner" />
            <div className="loading-text">Loading Visualizer...</div>
            <div className="loading-sub">
              The project audio is being rendered and sent to the visualizer
            </div>
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={`${process.env.PUBLIC_URL}/visualizer.html`}
          title="Video Export Visualizer"
          allow="autoplay"
          style={{ opacity: iframeReady ? 1 : 0 }}
        />
      </div>

      <div className="video-export-footer">
        <span className="video-export-hint">
          Customize the visualizer settings above, then click <b>Export MP4</b> to record the full track as video.
          Use <b>Preview</b> to audition before exporting.
        </span>
      </div>
    </div>
  );
}

export default VideoExportDialog;
