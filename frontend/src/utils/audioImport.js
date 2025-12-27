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
export const generateWaveform = (audioBuffer, samples = 2000) => {
  const rawData = audioBuffer.getChannelData(0); // Use first channel
  const dataLength = rawData.length;
  
  // Generate more samples for better accuracy - at least 2000 or based on duration
  // This ensures we have enough detail to accurately represent the audio
  const targetSamples = Math.max(samples, Math.min(2000, Math.floor(dataLength / 100)));
  const blockSize = Math.floor(dataLength / targetSamples);
  const peaks = [];

  // First pass: collect all peaks by analyzing blocks of audio data
  for (let i = 0; i < targetSamples; i++) {
    const start = blockSize * i;
    const end = Math.min(start + blockSize, dataLength);
    let min = 0;
    let max = 0;

    // Find min and max in this block
    for (let j = start; j < end; j++) {
      const sample = rawData[j];
      if (sample < min) min = sample;
      if (sample > max) max = sample;
    }

    peaks.push({ min, max });
  }

  // Normalize peaks to use full range (0-1) while preserving relative amplitudes
  // Find the maximum absolute value across all peaks
  let maxPeak = 0;
  peaks.forEach(peak => {
    const absMin = Math.abs(peak.min);
    const absMax = Math.abs(peak.max);
    if (absMin > maxPeak) maxPeak = absMin;
    if (absMax > maxPeak) maxPeak = absMax;
  });

  // Normalize all peaks relative to the maximum
  // This ensures the waveform uses the full height while maintaining relative amplitudes
  if (maxPeak > 0) {
    peaks.forEach(peak => {
      peak.min = peak.min / maxPeak;
      peak.max = peak.max / maxPeak;
    });
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

