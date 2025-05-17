// src/notes/notes.js - Updated with phase shifting and min/max independence

import { quantizeToEqualTemperament, getNoteName } from '../audio/frequencyUtils.js';

/**
 * Parameter generation modes
 */
export const ParameterMode = {
  MODULO: 'modulo',
  RANDOM: 'random',
  INTERPOLATION: 'interpolation'
};

/**
 * Create a note object based on trigger data and state parameters
 * @param {Object} triggerData - Data from the trigger event
 * @param {Object} layerState - Application state
 * @returns {Object} Complete note object
 */
export function createNote(triggerData, layerState) {
  const { 
    x, y, 
    copyIndex, vertexIndex, // Still useful for context if needed, but pointIdInLayer is primary for sequence
    isIntersection, 
    // angle, lastAngle, // These were from old triggerData, not directly used for note properties other than pan maybe
    // globalIndex, // Replaced by pointIdInLayer
    pointIdInLayer, // This is the new sequential ID within the layer
    layerId // For context, if note needs to know its layer source explicitly beyond layerState
  } = triggerData;
  
  let frequency = Math.hypot(x, y);
  let noteName = null;
  
  if (layerState && layerState.useEqualTemperament) {
    const refFreq = layerState.referenceFrequency || 440;
    frequency = quantizeToEqualTemperament(frequency, refFreq);
    noteName = getNoteName(frequency, refFreq);
  }
  
  // Use pointIdInLayer directly as the pointIndex for parameter calculations
  const pointIndex = pointIdInLayer !== undefined ? pointIdInLayer : 0;
  
  const duration = calculateDuration(pointIndex, layerState);
  const velocity = calculateVelocity(pointIndex, layerState);
  
  // Pan calculation could use a current angle if available in triggerData or layerState
  // For now, keeping it simple or assuming it might be set later if dynamic pan is needed.
  // const angRad = (layerState.angle || 0) % (2 * Math.PI); // Example using layerState static angle
  const pan = 0; // Default to center pan; dynamic pan might need more context
  
  return {
    frequency,
    duration,
    velocity,
    pan,
    pointIndex, // This is now the sequential pointIdInLayer
    copyIndex, // Keep for context if needed
    vertexIndex, // Keep for context if needed
    isIntersection,
    coordinates: { x, y },
    time: 0, // Will be set by trigger logic (tNow or quantizedTime)
    noteName,
    layerId: layerState.id || layerId, // Ensure layerId is on the note
    triggerPointId: pointIdInLayer, // Explicitly store the unique ID from the layer's geometry generation
    
    parameterInfo: {
      durationType: layerState.durationMode,
      velocityType: layerState.velocityMode,
      durationModulo: layerState.durationModulo,
      velocityModulo: layerState.velocityModulo
    }
  };
}

/**
 * Calculate note duration based on point index and state parameters
 * @param {number} pointIndex - Index of the point
 * @param {Object} state - Application state
 * @returns {number} Duration in seconds
 */
function calculateDuration(pointIndex, state) {
  const min = state.minDuration || 0.01;
  const max = state.maxDuration || 0.5;
  const modulo = state.durationModulo || 3;
  const mode = state.durationMode || ParameterMode.MODULO;
  const phase = state.durationPhase || 0;
  
  // Apply phase shift - shift the index by phase * modulo (scaled to index space)
  let phaseShiftedIndex = pointIndex;
  if (phase > 0) {
    const phaseOffset = Math.floor(phase * modulo);
    phaseShiftedIndex = (pointIndex + phaseOffset) % Number.MAX_SAFE_INTEGER;
  }
  
  switch (mode) {
    case ParameterMode.MODULO:
      return calculateModuloValue(phaseShiftedIndex, modulo, min, max);
    
    case ParameterMode.RANDOM:
      return calculateRandomValue(phaseShiftedIndex, min, max);
    
    case ParameterMode.INTERPOLATION:
      return calculateInterpolatedValue(phaseShiftedIndex, modulo, min, max);
      
    default:
      return Math.min(min, max) + Math.abs(max - min) / 2;
  }
}

/**
 * Calculate note velocity based on point index and state parameters
 * @param {number} pointIndex - Index of the point
 * @param {Object} state - Application state
 * @returns {number} Velocity (0-1)
 */
function calculateVelocity(pointIndex, state) {
  const min = state.minVelocity != undefined ? state.minVelocity : 0.3;
  const max = state.maxVelocity != undefined ? state.maxVelocity : 0.9;
  const modulo = state.velocityModulo || 4;
  const mode = state.velocityMode || ParameterMode.MODULO;
  const phase = state.velocityPhase || 0;
  
  // Apply phase shift - shift the index by phase * modulo (scaled to index space)
  let phaseShiftedIndex = pointIndex;
  if (phase > 0) {
    const phaseOffset = Math.floor(phase * modulo);
    phaseShiftedIndex = (pointIndex + phaseOffset) % Number.MAX_SAFE_INTEGER;
  }
  
  switch (mode) {
    case ParameterMode.MODULO:
      return calculateModuloValue(phaseShiftedIndex, modulo, min, max);
    
    case ParameterMode.RANDOM:
      return calculateRandomValue(phaseShiftedIndex, min, max);
    
    case ParameterMode.INTERPOLATION:
      return calculateInterpolatedValue(phaseShiftedIndex, modulo, min, max);
      
    default:
      return Math.min(min, max) + Math.abs(max - min) / 2;
  }
}

/**
 * Calculate parameter value using modulo approach
 * @param {number} pointIndex - Index of the point
 * @param {number} modulo - Modulo value (N)
 * @param {number} min - Minimum parameter value
 * @param {number} max - Maximum parameter value
 * @returns {number} Calculated parameter value
 */
function calculateModuloValue(pointIndex, modulo, min, max) {
  // Handle special case for index 0
  if (pointIndex === 0) {
    return Math.max(min, max);
  }
  
  // Support for min > max (swapping) by calculating actual low/high values
  const actualMin = Math.min(min, max);
  const actualMax = Math.max(min, max);
  
  // Determine if we need to invert (when min > max)
  const invert = min > max;
  
  // Modified modulo calculation to be more intuitive
  // Use the pattern [max, min, min, ...] that repeats every 'modulo' points
  const patternValue = (pointIndex % modulo === 0) ? actualMax : actualMin;
  
  // Invert if min > max
  return invert ? (actualMin + actualMax - patternValue) : patternValue;
}

/**
 * Calculate parameter value using random approach (deterministic)
 * @param {number} pointIndex - Index of the point
 * @param {number} min - Minimum parameter value
 * @param {number} max - Maximum parameter value
 * @returns {number} Calculated parameter value
 */
function calculateRandomValue(pointIndex, min, max) {
  // Use seeded random based on point index for deterministic results
  const random = seededRandom(pointIndex);
  
  // Support for min > max (swapping) by calculating actual low/high values
  const actualMin = Math.min(min, max);
  const actualMax = Math.max(min, max);
  const range = actualMax - actualMin;
  
  // If min > max, invert the mapping
  if (min > max) {
    return actualMax - (random * range);
  } else {
    return actualMin + (random * range);
  }
}

/**
 * Calculate parameter value using interpolation approach
 * @param {number} pointIndex - Index of the point
 * @param {number} modulo - Modulo value (N)
 * @param {number} min - Minimum parameter value
 * @param {number} max - Maximum parameter value
 * @returns {number} Calculated parameter value
 */
function calculateInterpolatedValue(pointIndex, modulo, min, max) {
  // Handle special case for index 0
  if (pointIndex === 0) {
    return Math.max(min, max);
  }
  
  // Support for min > max (swapping) by calculating actual low/high values
  const actualMin = Math.min(min, max);
  const actualMax = Math.max(min, max);
  const range = actualMax - actualMin;
  
  // Find the position within the current modulo cycle
  const cycle = Math.floor(pointIndex / modulo);
  const position = pointIndex - (cycle * modulo);
  
  // Calculate normalized position (0 to 1)
  const normalizedPosition = position / modulo;
  
  // Using a sine wave pattern for smooth oscillation between min and max
  // sin ranges from -1 to 1, so adjust to range 0 to 1
  const oscillation = (Math.sin(normalizedPosition * Math.PI * 2) + 1) / 2;
  
  // Calculate the base value
  const baseValue = actualMin + oscillation * range;
  
  // If min > max, invert the mapping
  if (min > max) {
    return actualMin + actualMax - baseValue;
  } else {
    return baseValue;
  }
}

/**
 * Generate a deterministic random value based on a seed
 * @param {number} seed - Seed value
 * @returns {number} Pseudo-random value between 0 and 1
 */
function seededRandom(seed) {
  // Simple deterministic random function
  // Using a Linear Congruential Generator algorithm
  const a = 1664525;
  const c = 1013904223;
  const m = Math.pow(2, 32);
  
  // Calculate next value
  const next = (a * (seed + 1) + c) % m;
  
  // Normalize to [0, 1]
  return next / m;
}