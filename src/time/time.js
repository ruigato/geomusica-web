// src/time/time.js - Rock-solid AudioContext-only timing system
import { TICKS_PER_BEAT, TICKS_PER_MEASURE } from '../config/constants.js';

// Timing system configuration
const TIMING_SOURCES = {
  AUDIO_CONTEXT: 'audioContext',
  PERFORMANCE_NOW: 'performanceNow'
};

// Single source of truth: AudioContext timing
let sharedAudioContext = null;
let audioStartTime = 0;
let timingInitialized = false;

// Performance timing variables
let performanceStartTime = 0;

// Active timing configuration
let activeTimingSource = TIMING_SOURCES.AUDIO_CONTEXT;

// Error handling
class TimingError extends Error {
  constructor(message) {
    super(`[AUDIO TIMING] ${message}`);
    this.name = 'TimingError';
  }
}

/**
 * Initialize the timing system with AudioContext
 * This MUST be called with a valid AudioContext before any other timing functions
 * @param {AudioContext} audioContext - The shared AudioContext instance
 * @returns {boolean} True if initialization successful
 */
export function initializeTime(audioContext) {
  if (!audioContext) {
    throw new TimingError('AudioContext is required for timing initialization');
  }
  
  if (!(audioContext instanceof AudioContext) && !(audioContext instanceof webkitAudioContext)) {
    throw new TimingError('Invalid AudioContext provided');
  }
  
  sharedAudioContext = audioContext;
  audioStartTime = audioContext.currentTime;
  performanceStartTime = performance.now() / 1000;
  timingInitialized = true;
  
  // Ensure AudioContext is running
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(error => {
      throw new TimingError(`Failed to resume AudioContext: ${error.message}`);
    });
  }
  
  console.log('[AUDIO TIMING] Initialized with sample-accurate timing');
  console.log(`[AUDIO TIMING] Audio context sample rate: ${audioContext.sampleRate}Hz`);
  console.log(`[AUDIO TIMING] Start time: ${audioStartTime}`);
  
  return true;
}

/**
 * Switch between timing sources
 * @param {string} source - The timing source to use (AUDIO_CONTEXT or PERFORMANCE_NOW)
 * @returns {boolean} True if switch successful
 */
export function switchTimingSource(source) {
  if (!timingInitialized) {
    throw new TimingError('Timing system not initialized. Call initializeTime() first.');
  }
  
  if (!Object.values(TIMING_SOURCES).includes(source)) {
    throw new TimingError(`Invalid timing source: ${source}`);
  }
  
  // Store current time before switching
  const currentTime = getCurrentTime();
  
  // Switch to new source
  activeTimingSource = source;
  
  // Reset start times to ensure seamless transition
  if (source === TIMING_SOURCES.AUDIO_CONTEXT) {
    audioStartTime = sharedAudioContext.currentTime - currentTime;
    console.log('[TIMING] Switched to AudioContext timing');
  } else {
    performanceStartTime = performance.now() / 1000 - currentTime;
    console.log('[TIMING] Switched to performance.now() timing');
  }
  
  return true;
}

/**
 * Get current time in seconds with sample-accurate precision
 * This is the master clock for the entire application
 * @returns {number} Current time in seconds since timing initialization
 */
export function getCurrentTime() {
  if (!timingInitialized || !sharedAudioContext) {
    throw new TimingError('Timing system not initialized. Call initializeTime() first.');
  }
  
  if (activeTimingSource === TIMING_SOURCES.AUDIO_CONTEXT) {
    // Critical: Ensure AudioContext is never suspended
    if (sharedAudioContext.state === 'suspended') {
      console.warn('[AUDIO TIMING] AudioContext was suspended, resuming immediately');
      sharedAudioContext.resume();
    }
    
    if (sharedAudioContext.state === 'closed') {
      throw new TimingError('AudioContext is closed - this is a fatal timing error');
    }
    
    // This is our rock-solid timing source - never changes, never falls back
    const currentTime = sharedAudioContext.currentTime - audioStartTime;
    
    // Sanity check: time should never go backwards
    if (currentTime < 0) {
      throw new TimingError(`Time went backwards: ${currentTime}`);
    }
    
    return currentTime;
  } else {
    // Use performance.now() as timing source
    return performance.now() / 1000 - performanceStartTime;
  }
}

/**
 * Reset the timing system to zero
 * Resets the reference point but keeps using the same timing source
 */
export function resetTime() {
  if (!timingInitialized || !sharedAudioContext) {
    throw new TimingError('Cannot reset time - timing system not initialized');
  }
  
  if (activeTimingSource === TIMING_SOURCES.AUDIO_CONTEXT) {
    audioStartTime = sharedAudioContext.currentTime;
  } else {
    performanceStartTime = performance.now() / 1000;
  }
  
  console.log('[AUDIO TIMING] Time reset to zero');
}

/**
 * Get the AudioContext sample rate for precise timing calculations
 * @returns {number} Sample rate in Hz
 */
export function getSampleRate() {
  if (!sharedAudioContext) {
    throw new TimingError('AudioContext not available');
  }
  return sharedAudioContext.sampleRate;
}

/**
 * Get timing system status for debugging
 * @returns {Object} Status information
 */
export function getTimingStatus() {
  return {
    initialized: timingInitialized,
    activeSource: activeTimingSource,
    audioContextState: sharedAudioContext?.state || 'not available',
    sampleRate: sharedAudioContext?.sampleRate || 0,
    currentTime: timingInitialized ? getCurrentTime() : 0,
    audioStartTime: audioStartTime,
    performanceStartTime: performanceStartTime
  };
}

/**
 * Get the currently active timing source
 * @returns {string} The active timing source
 */
export function getActiveTimingSource() {
  return activeTimingSource;
}

// Export timing sources for external use
export { TIMING_SOURCES };

// ============================================================================
// Musical Timing Utilities (all based on AudioContext timing)
// ============================================================================

/**
 * Convert seconds to ticks based on BPM
 * @param {number} seconds - Time in seconds
 * @param {number} bpm - Beats per minute
 * @returns {number} Time in ticks
 */
export function secondsToTicks(seconds, bpm) {
  if (bpm <= 0) throw new TimingError('BPM must be greater than 0');
  
  // At any BPM: ticks per second = (TICKS_PER_BEAT * BPM) / 60
  const ticksPerSecond = (TICKS_PER_BEAT * bpm) / 60;
  return seconds * ticksPerSecond;
}

/**
 * Convert ticks to seconds based on BPM
 * @param {number} ticks - Time in ticks
 * @param {number} bpm - Beats per minute
 * @returns {number} Time in seconds
 */
export function ticksToSeconds(ticks, bpm) {
  if (bpm <= 0) throw new TimingError('BPM must be greater than 0');
  
  const secondsPerTick = 60 / (TICKS_PER_BEAT * bpm);
  return ticks * secondsPerTick;
}

/**
 * Convert ticks to beats
 * @param {number} ticks - Time in ticks
 * @returns {number} Time in beats
 */
export function ticksToBeats(ticks) {
  return ticks / TICKS_PER_BEAT;
}

/**
 * Convert beats to ticks
 * @param {number} beats - Time in beats
 * @returns {number} Time in ticks
 */
export function beatsToTicks(beats) {
  return beats * TICKS_PER_BEAT;
}

/**
 * Convert ticks to measures (assuming 4/4 time)
 * @param {number} ticks - Time in ticks
 * @returns {number} Time in measures
 */
export function ticksToMeasures(ticks) {
  return ticks / TICKS_PER_MEASURE;
}

/**
 * Convert measures to ticks (assuming 4/4 time)
 * @param {number} measures - Time in measures
 * @returns {number} Time in ticks
 */
export function measuresToTicks(measures) {
  return measures * TICKS_PER_MEASURE;
}

/**
 * Get current tick count based on audio time and BPM
 * @param {number} bpm - Beats per minute
 * @returns {number} Current tick count
 */
export function getCurrentTicks(bpm) {
  const currentSeconds = getCurrentTime();
  return secondsToTicks(currentSeconds, bpm);
}

/**
 * Get current measure count based on audio time and BPM
 * @param {number} bpm - Beats per minute
 * @returns {number} Current measure count
 */
export function getCurrentMeasures(bpm) {
  const ticks = getCurrentTicks(bpm);
  return ticksToMeasures(ticks);
}

/**
 * Get position within current measure (0-1)
 * @param {number} ticks - Current tick count
 * @returns {number} Position within current measure (0-1)
 */
export function getMeasurePosition(ticks) {
  return (ticks % TICKS_PER_MEASURE) / TICKS_PER_MEASURE;
}

/**
 * Apply time subdivision to measure count
 * @param {number} measureCount - Current measure count
 * @param {number} subdivisionValue - Subdivision value
 * @param {boolean} useSubdivision - Whether to use subdivision
 * @returns {number} Normalized time value (0-1)
 */
export function applyTimeSubdivision(measureCount, subdivisionValue, useSubdivision) {
  if (!useSubdivision) {
    return measureCount % 1;
  }
  
  const moduloResult = measureCount % subdivisionValue;
  return moduloResult / subdivisionValue;
}

/**
 * Convert normalized time to rotation angle
 * @param {number} normalizedTime - Normalized time (0-1)
 * @returns {number} Rotation angle in radians
 */
export function timeToRotation(normalizedTime) {
  return normalizedTime * 2 * Math.PI;
}

/**
 * Calculate rotation based on current audio time, BPM and subdivision
 * @param {number} bpm - Beats per minute
 * @param {number} subdivisionValue - Time subdivision value
 * @param {boolean} useSubdivision - Whether to use time subdivision
 * @returns {number} Rotation angle in radians
 */
export function calculateRotation(bpm, subdivisionValue, useSubdivision) {
  const currentTime = getCurrentTime();
  const measureCount = getCurrentMeasures(bpm);
  const normalizedTime = applyTimeSubdivision(measureCount, subdivisionValue, useSubdivision);
  return timeToRotation(normalizedTime);
}

/**
 * Parse a quantization value and convert to ticks
 * @param {string} quantValue - Quantization value (e.g., "1/4", "1/8T")
 * @param {number} measureTicks - Ticks per measure (default: TICKS_PER_MEASURE)
 * @returns {number} Ticks per quantization unit
 */
export function parseQuantizationValue(quantValue, measureTicks = TICKS_PER_MEASURE) {
  if (!quantValue) return TICKS_PER_BEAT;
  
  const isTriplet = quantValue.endsWith('T');
  const denominator = parseInt(quantValue.replace('1/', '').replace('T', ''));
  
  if (isNaN(denominator) || denominator <= 0) {
    return TICKS_PER_BEAT;
  }
  
  let ticksPerUnit = measureTicks / denominator;
  
  if (isTriplet) {
    ticksPerUnit = ticksPerUnit * 2 / 3;
  }
  
  return ticksPerUnit;
}

/**
 * Quantize a time value in ticks to the nearest grid position
 * @param {number} timeTicks - Time in ticks
 * @param {number} gridTicks - Grid size in ticks
 * @returns {number} Quantized time in ticks
 */
export function quantizeToGrid(timeTicks, gridTicks) {
  if (gridTicks <= 0) return timeTicks;
  
  const remainder = timeTicks % gridTicks;
  const nearestGrid = remainder < gridTicks / 2 
    ? timeTicks - remainder 
    : timeTicks + (gridTicks - remainder);
  
  return nearestGrid;
}

/**
 * Get quantized position within measure (0-1)
 * @param {number} ticks - Current tick count
 * @param {number} quantizationTicks - Quantization grid size in ticks
 * @returns {number} Quantized position within measure (0-1)
 */
export function getQuantizedMeasurePosition(ticks, quantizationTicks) {
  if (quantizationTicks <= 0) return getMeasurePosition(ticks);
  
  const ticksInMeasure = ticks % TICKS_PER_MEASURE;
  const quantizedTicksInMeasure = quantizeToGrid(ticksInMeasure, quantizationTicks);
  
  return quantizedTicksInMeasure / TICKS_PER_MEASURE;
}

/**
 * Calculate quantized rotation based on current audio time, BPM and quantization
 * @param {number} bpm - Beats per minute
 * @param {string} quantizationValue - Quantization value (e.g., "1/4", "1/8T")
 * @param {boolean} useQuantization - Whether to use quantization
 * @returns {number} Rotation angle in radians
 */
export function calculateQuantizedRotation(bpm, quantizationValue, useQuantization) {
  if (!useQuantization) {
    return calculateRotation(bpm, 1, false);
  }
  
  const currentTicks = getCurrentTicks(bpm);
  const quantizationTicks = parseQuantizationValue(quantizationValue);
  const normalizedTime = getQuantizedMeasurePosition(currentTicks, quantizationTicks);
  
  return timeToRotation(normalizedTime);
}

/**
 * Schedule a callback to run at a specific audio time
 * This provides sample-accurate scheduling like professional audio software
 * @param {Function} callback - Function to call
 * @param {number} audioTime - Absolute audio time to schedule (in AudioContext time)
 * @returns {number} Timeout ID for cancellation
 */
export function scheduleAtAudioTime(callback, audioTime) {
  if (!sharedAudioContext) {
    throw new TimingError('Cannot schedule - AudioContext not available');
  }
  
  const currentAudioTime = sharedAudioContext.currentTime;
  const delaySeconds = audioTime - currentAudioTime;
  const delayMs = Math.max(0, delaySeconds * 1000);
  
  return setTimeout(callback, delayMs);
}

/**
 * Get absolute audio time (AudioContext.currentTime)
 * This is useful for scheduling audio events
 * @returns {number} Absolute audio time in seconds
 */
export function getAbsoluteAudioTime() {
  if (!sharedAudioContext) {
    throw new TimingError('AudioContext not available');
  }
  return sharedAudioContext.currentTime;
}

// Export for compatibility with existing code that might call these
export function updateCsoundInstance() {
  // No-op - we don't use Csound timing anymore
}

export async function enableCsoundTiming() {
  // No-op - we use pure AudioContext timing
  return true;
}

export async function diagnoseCsoundTiming() {
  return getTimingStatus();
}

export async function startCsoundTimer() {
  // No-op - AudioContext timing is always running
  return true;
}

// Make diagnostic functions available globally for debugging
if (typeof window !== 'undefined') {
  window.getTimingStatus = getTimingStatus;
  window.resetTime = resetTime;
  window.getCurrentTime = getCurrentTime;
}