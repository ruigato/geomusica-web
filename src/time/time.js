// src/time/time.js - Simplified timing using browser performance API
import { TICKS_PER_BEAT, TICKS_PER_MEASURE } from '../config/constants.js';

// Time constants
const SECONDS_PER_BEAT_AT_120BPM = 0.5; // 120 BPM = 2 beats per second
const SECONDS_PER_MEASURE_AT_120BPM = 2; // 4/4 time at 120 BPM = 2 seconds per measure

// Module state
let timingDiagnosticCount = 0;
let lastTimingSourceLog = 0;

// Simple timing system - just use browser performance API
let timeStartedAt = 0; // When the timer was started
let timeSystemInitialized = false;

/**
 * Initialize the time module
 */
export function initializeTime() {
  // Initialize browser-based timing
  if (!timeSystemInitialized) {
    timeStartedAt = performance.now();
    timeSystemInitialized = true;
    
  }
  
  return true;
}

/**
 * Get current time in seconds
 * @returns {number} Current time in seconds
 */
export function getCurrentTime() {
  if (!timeSystemInitialized) {
    initializeTime();
  }
  
  const now = performance.now();
  const timeInSeconds = (now - timeStartedAt) / 1000.0;
  
  // Log time source periodically (not too often)
  const currentTimeMs = Date.now();
  if (currentTimeMs - lastTimingSourceLog > 10000) { // Every 10 seconds
    
    lastTimingSourceLog = currentTimeMs;
  }
  
  return timeInSeconds;
}

/**
 * Reset the timer to zero
 */
export function resetTime() {
  timeStartedAt = performance.now();
  
}

/**
 * Diagnose timing issues
 */
export async function diagnoseTiming() {
  return {
    usingBrowserTiming: true,
    timeStartedAt: timeStartedAt,
    timeSystemInitialized: timeSystemInitialized,
    currentTime: getCurrentTime(),
    diagnostic: "Using browser performance timing"
  };
}

// Provide empty implementations of Csound functions for compatibility
export function updateCsoundInstance() { return true; }
export async function enableCsoundTiming() { 
  
  return true; 
}
export async function diagnoseCsoundTiming() { 
  return await diagnoseTiming();
}
export async function startCsoundTimer() { return true; }

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

/**
 * Parse a quantization value and convert to ticks
 * @param {string} quantValue - Quantization value (e.g., "1/4", "1/8T")
 * @param {number} measureTicks - Ticks per measure (default: TICKS_PER_MEASURE)
 * @returns {number} Ticks per quantization unit
 */
export function parseQuantizationValue(quantValue, measureTicks = TICKS_PER_MEASURE) {
  if (!quantValue) return TICKS_PER_BEAT; // Default to quarter notes
  
  // Check if it's a triplet
  const isTriplet = quantValue.endsWith('T');
  
  // Get the denominator (4 for quarter notes, 8 for eighth notes, etc.)
  const denominator = parseInt(quantValue.replace('1/', '').replace('T', ''));
  
  if (isNaN(denominator) || denominator <= 0) {
    return TICKS_PER_BEAT; // Default to quarter notes
  }
  
  // Calculate ticks per unit
  let ticksPerUnit = measureTicks / denominator;
  
  // Adjust for triplets
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
 * Calculate quantized rotation based on current time, BPM and quantization
 * @param {number} currentTime - Current time in seconds
 * @param {number} bpm - Beats per minute
 * @param {string} quantizationValue - Quantization value (e.g., "1/4", "1/8T")
 * @param {boolean} useQuantization - Whether to use quantization
 * @returns {number} Rotation angle in radians
 */
export function calculateQuantizedRotation(currentTime, bpm, quantizationValue, useQuantization) {
  if (!useQuantization) {
    // If quantization is disabled, just return regular rotation
    return calculateRotation(currentTime, bpm, 1, false);
  }
  
  // Get current ticks based on time and BPM
  const currentTicks = getCurrentTicks(currentTime, bpm);
  
  // Parse quantization value to get grid size in ticks
  const quantizationTicks = parseQuantizationValue(quantizationValue);
  
  // Get quantized position within measure
  const normalizedTime = getQuantizedMeasurePosition(currentTicks, quantizationTicks);
  
  // Convert to rotation angle
  return timeToRotation(normalizedTime);
}

// Make diagnostic function available globally
if (typeof window !== 'undefined') {
  window.diagnoseTiming = diagnoseTiming;
  window.resetTime = resetTime;
}