// src/time/time.js
import { TICKS_PER_BEAT, TICKS_PER_MEASURE } from '../config/constants.js';

// Time constants
const SECONDS_PER_BEAT_AT_120BPM = 0.5; // 120 BPM = 2 beats per second
const SECONDS_PER_MEASURE_AT_120BPM = 2; // 4/4 time at 120 BPM = 2 seconds per measure

// Module state
let audioContext = null;
let startTime = 0;
let lastCsoundTime = 0;
let isUsingCsoundTiming = false;
let csoundInstance = null;

// Time channel name for Csound communication
const TIME_CHANNEL_NAME = "currentTime";

/**
 * Initialize time module with Csound instance
 * @param {Object} instance - Csound instance
 * @param {AudioContext} context - Audio context
 */
export function initializeTime(instance, context) {
  csoundInstance = instance;
  audioContext = context;
  
  // Reset tracking variables
  startTime = 0;
  lastCsoundTime = 0;
  
  // Attempt to enable Csound timing if instance is provided
  if (instance) {
    enableCsoundTiming().catch(err => {
      console.warn("Could not enable Csound timing:", err);
      isUsingCsoundTiming = false;
    });
  }
}

/**
 * Enable Csound timing
 * @returns {Promise<boolean>} Promise resolving to success status
 */
export async function enableCsoundTiming() {
  if (!csoundInstance) return false;
  
  try {
    // Initialize the time channel
    await csoundInstance.setControlChannel(TIME_CHANNEL_NAME, 0);
    
    // Check if we can read from the channel
    const initialTime = await csoundInstance.getControlChannel(TIME_CHANNEL_NAME);
    
    if (typeof initialTime === 'number' && !isNaN(initialTime)) {
      isUsingCsoundTiming = true;
      return true;
    }
    
    return false;
  } catch (error) {
    console.error("Error enabling Csound timing:", error);
    isUsingCsoundTiming = false;
    return false;
  }
}

/**
 * Get current time in seconds
 * @returns {number} Current time in seconds
 */
export function getCurrentTime() {
  if (csoundInstance && isUsingCsoundTiming) {
    try {
      const csoundTime = csoundInstance.getControlChannel(TIME_CHANNEL_NAME);
      if (typeof csoundTime === 'number' && !isNaN(csoundTime)) {
        lastCsoundTime = csoundTime;
        return csoundTime;
      }
    } catch (error) {
      // Fall back to audio context time
    }
  }
  
  return getAudioContextTime();
}

/**
 * Helper for consistently getting audio context time
 * @returns {number} Current time in seconds
 */
function getAudioContextTime() {
  if (audioContext) {
    const currentTime = audioContext.currentTime;
    if (startTime === 0) {
      startTime = currentTime;
    }
    return currentTime - startTime;
  }
  return performance.now() / 1000;
}

/**
 * Convert seconds to ticks based on BPM
 * @param {number} seconds - Time in seconds
 * @param {number} bpm - Beats per minute
 * @returns {number} Time in ticks
 */
export function secondsToTicks(seconds, bpm) {
  // At 120 BPM, 1 beat = 0.5 seconds and 1 beat = 480 ticks
  // So at 120 BPM, we have 480 ticks / 0.5 seconds = 960 ticks per second
  // For any BPM, ticks per second = (480 * bpm) / 60
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
 * Convert ticks to measures
 * @param {number} ticks - Time in ticks
 * @returns {number} Time in measures
 */
export function ticksToMeasures(ticks) {
  return ticks / TICKS_PER_MEASURE;
}

/**
 * Convert measures to ticks
 * @param {number} measures - Time in measures
 * @returns {number} Time in ticks
 */
export function measuresToTicks(measures) {
  return measures * TICKS_PER_MEASURE;
}

/**
 * Get current tick count based on time and BPM
 * @param {number} seconds - Current time in seconds
 * @param {number} bpm - Beats per minute
 * @returns {number} Current tick count
 */
export function getCurrentTicks(seconds, bpm) {
  return secondsToTicks(seconds, bpm);
}

/**
 * Get current measure count based on time and BPM
 * @param {number} seconds - Current time in seconds
 * @param {number} bpm - Beats per minute
 * @returns {number} Current measure count
 */
export function getCurrentMeasures(seconds, bpm) {
  const ticks = getCurrentTicks(seconds, bpm);
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
    // Return position within current measure if subdivision is disabled
    return measureCount % 1;
  }
  
  // Apply modulo operation based on subdivision value
  const moduloResult = measureCount % subdivisionValue;
  
  // Normalize to 0-1 range
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
 * Calculate rotation based on current time, BPM and subdivision
 * @param {number} currentTime - Current time in seconds
 * @param {number} bpm - Beats per minute
 * @param {number} subdivisionValue - Time subdivision value
 * @param {boolean} useSubdivision - Whether to use time subdivision
 * @returns {number} Rotation angle in radians
 */
export function calculateRotation(currentTime, bpm, subdivisionValue, useSubdivision) {
  // Get measure count
  const measureCount = getCurrentMeasures(currentTime, bpm);
  
  // Apply time subdivision
  const normalizedTime = applyTimeSubdivision(measureCount, subdivisionValue, useSubdivision);
  
  // Convert to rotation angle
  return timeToRotation(normalizedTime);
}