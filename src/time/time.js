// src/time/time.js - Simplified timing system using RockSolidTiming
import { TICKS_PER_BEAT, TICKS_PER_MEASURE } from '../config/constants.js';
import { 
  getCurrentTime as getRockSolidTime, 
  resetTime as resetRockSolidTime,
  getTimingStatus as getRockSolidStatus,
  isTimingReady as isRockSolidReady,
  setTimingMode as setRockSolidTimingMode
} from './RockSolidTiming.js';

// Simple timing source constant for compatibility
export const TIMING_SOURCES = {
  ROCK_SOLID: 'rockSolid'
};

// Single timing source - no switching, no complexity
let activeTimingSource = TIMING_SOURCES.ROCK_SOLID;
let timingInitialized = true; // Always ready with RockSolidTiming

/**
 * Initialize the timing system - simplified to just return true
 * @returns {Promise<boolean>} Always resolves to true
 */
export async function initializeTime() {
  console.log('[TIMING] Using RockSolidTiming - no initialization needed');
  return true;
}

/**
 * Check if timing system is initialized
 * @returns {boolean} Always true with RockSolidTiming
 */
export function isTimingInitialized() {
  return isRockSolidReady();
}

/**
 * Get current time in seconds - always from RockSolidTiming
 * @returns {number} Current time in seconds
 */
export function getCurrentTime() {
  return getRockSolidTime();
}

/**
 * Reset the timing system to zero
 */
export function resetTime() {
  resetRockSolidTime();
}

/**
 * Get timing system status
 * @returns {Object} Status information
 */
export function getTimingStatus() {
  const status = getRockSolidStatus();
  return {
    ...status,
    activeSource: activeTimingSource,
    initialized: timingInitialized
  };
}

/**
 * Get the currently active timing source
 * @returns {string} Always returns 'rockSolid'
 */
export function getActiveTimingSource() {
  return activeTimingSource;
}

/**
 * Switch timing source - simplified to no-op since we only have one source
 * @param {string} source - Ignored, always uses RockSolidTiming
 * @returns {boolean} Always returns true
 */
export function switchTimingSource(source) {
  console.log('[TIMING] Using RockSolidTiming - no source switching needed');
  return true;
}

/**
 * Configure timing cache - stub function for compatibility
 * @param {Object} config - Cache configuration (ignored in simplified system)
 * @returns {boolean} Always returns true
 */
export function configureTimingCache(config) {
  console.log('[TIMING] RockSolidTiming doesn\'t use caching - configuration ignored');
  return true;
}

/**
 * Set timing mode for comparison purposes
 * @param {string} mode - 'webworker' or 'performance'
 */
export function setTimingMode(mode) {
  const usePerformance = mode === 'performance';
  setRockSolidTimingMode(usePerformance);
  console.log(`[TIMING] Switched to ${mode} mode`);
}

// ============================================================================
// Musical Timing Utilities (all based on RockSolidTiming)
// ============================================================================

/**
 * Convert seconds to ticks based on BPM
 * @param {number} seconds - Time in seconds
 * @param {number} bpm - Beats per minute
 * @returns {number} Time in ticks
 */
export function secondsToTicks(seconds, bpm) {
  if (bpm <= 0) {
    console.warn('[TIMING] BPM must be greater than 0, using default of 120');
    bpm = 120;
  }
  
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
  if (bpm <= 0) throw new Error('BPM must be greater than 0');
  
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
 * Get current tick count based on time and BPM
 * @param {number} bpm - Beats per minute
 * @returns {number} Current tick count
 */
export function getCurrentTicks(bpm) {
  const currentSeconds = getCurrentTime();
  return secondsToTicks(currentSeconds, bpm);
}

/**
 * Get current measure count based on time and BPM
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
  
  const subdivisionMeasures = measureCount * subdivisionValue;
  return subdivisionMeasures % 1;
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
 * @param {number} bpm - Beats per minute
 * @param {number} subdivisionValue - Time subdivision value
 * @param {boolean} useSubdivision - Whether to use time subdivision
 * @returns {number} Rotation angle in radians
 */
export function calculateRotation(bpm, subdivisionValue, useSubdivision) {
  const currentTime = getCurrentTime();
  
  // Calculate rotations per second based on BPM
  const rotationsPerSecond = bpm / 960;
  const totalRotations = currentTime * rotationsPerSecond;
  
  // Apply time subdivision
  let subdivisionRotations = totalRotations;
  if (useSubdivision && subdivisionValue) {
    subdivisionRotations = totalRotations * subdivisionValue;
  }
  
  // Get the fractional part (0-1) for one complete rotation
  const normalizedTime = subdivisionRotations % 1;
  
  return timeToRotation(normalizedTime);
}

// Make diagnostic functions available globally for debugging
if (typeof window !== 'undefined') {
  window.getTimingStatus = getTimingStatus;
  window.resetTime = resetTime;
  window.getCurrentTime = getCurrentTime;
  window.isTimingInitialized = isTimingInitialized;
}