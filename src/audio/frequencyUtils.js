// src/audio/frequencyUtils.js - Utilities for frequency calculations

/**
 * Quantize a frequency to the nearest equal temperament note
 * @param {number} frequency - Input frequency in Hz
 * @param {number} referenceFrequency - Reference frequency for A4 (default: 440Hz)
 * @returns {number} - Quantized frequency in Hz
 */
export function quantizeToEqualTemperament(frequency, referenceFrequency = 440) {
    // Skip quantization for very low or invalid frequencies
    if (frequency <= 0 || !isFinite(frequency)) {
      return frequency;
    }
    
    // Calculate semitones from reference frequency (A4 = 440Hz)
    // Formula: n = 12 * log2(f / fref)
    const semitones = 12 * Math.log2(frequency / referenceFrequency);
    
    // Round to nearest semitone
    const roundedSemitones = Math.round(semitones);
    
    // Convert back to frequency
    // Formula: f = fref * 2^(n/12)
    const quantizedFrequency = referenceFrequency * Math.pow(2, roundedSemitones / 12);
    
    return quantizedFrequency;
  }
  
  /**
   * Get note name for a frequency
   * @param {number} frequency - Frequency in Hz
   * @param {number} referenceFrequency - Reference frequency for A4 (default: 440Hz)
   * @returns {string} - Note name with octave (e.g., "A4", "C#5")
   */
  export function getNoteName(frequency, referenceFrequency = 440) {
    // Skip invalid frequencies
    if (frequency <= 0 || !isFinite(frequency)) {
      return "N/A";
    }
    
    const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    
    // Calculate semitones from A4
    const semitones = 12 * Math.log2(frequency / referenceFrequency);
    const roundedSemitones = Math.round(semitones);
    
    // A4 is the reference note (index 9 in zero-based noteNames, octave 4)
    // Calculate how many semitones from C0
    const semitonesFromC0 = roundedSemitones + 9 + (4 * 12);
    
    // Calculate octave and note index
    const octave = Math.floor(semitonesFromC0 / 12);
    const noteIndex = ((semitonesFromC0 % 12) + 12) % 12; // Ensure positive index
    
    return noteNames[noteIndex] + octave;
  }
  
  /**
   * Format frequency display with optional note name
   * @param {number} frequency - Frequency in Hz
   * @param {boolean} includeNoteName - Whether to include note name
   * @param {number} referenceFrequency - Reference frequency for A4
   * @returns {string} - Formatted frequency string
   */
  export function formatFrequency(frequency, includeNoteName = false, referenceFrequency = 440) {
    const freqText = frequency.toFixed(2) + " Hz";
    
    if (includeNoteName) {
      const noteName = getNoteName(frequency, referenceFrequency);
      return `${freqText} (${noteName})`;
    }
    
    return freqText;
  }