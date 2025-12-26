/**
 * Audio Import Utility
 * Handles file picking, audio decoding, and waveform generation
 */

/**
 * Open file picker for audio files
 * @returns {Promise<File|null>}
 */
export const pickAudioFile = () => {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/mp3,audio/wav,audio/flac,audio/mpeg,.mp3,.wav,.flac,.m4a';
    input.onchange = (e) => {
      const file = e.target.files?.[0] || null;
      resolve(file);
    };
    input.click();
  });
};

/**
 * Decode audio file to AudioBuffer
 * @param {File} file
 * @returns {Promise<AudioBuffer>}
 */
export const decodeAudioFile = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  return await audioContext.decodeAudioData(arrayBuffer);
};

/**
 * Generate waveform peaks from AudioBuffer
 * @param {AudioBuffer} audioBuffer
 * @param {number} samples - Number of peaks to generate (width in pixels)
 * @returns {Array<{min: number, max: number}>}
 */
export const generateWaveform = (audioBuffer, samples = 1000) => {
  const rawData = audioBuffer.getChannelData(0); // Use first channel
  const blockSize = Math.floor(rawData.length / samples);
  const peaks = [];

  for (let i = 0; i < samples; i++) {
    const start = blockSize * i;
    const end = start + blockSize;
    let min = 0;
    let max = 0;

    for (let j = start; j < end && j < rawData.length; j++) {
      const sample = rawData[j];
      if (sample < min) min = sample;
      if (sample > max) max = sample;
    }

    peaks.push({ min, max });
  }

  return peaks;
};

/**
 * Convert AudioBuffer duration to beats based on BPM
 * @param {AudioBuffer} audioBuffer
 * @param {number} bpm
 * @returns {number}
 */
export const audioDurationToBeats = (audioBuffer, bpm) => {
  const durationSeconds = audioBuffer.duration;
  const beatsPerSecond = bpm / 60;
  return durationSeconds * beatsPerSecond;
};

/**
 * Create a data URL from audio buffer for caching
 * @param {AudioBuffer} audioBuffer
 * @returns {Promise<string>}
 */
export const audioBufferToDataUrl = async (audioBuffer) => {
  // For now, we'll store the file reference
  // In a full implementation, you might want to convert to WAV and create a blob URL
  return null;
};

