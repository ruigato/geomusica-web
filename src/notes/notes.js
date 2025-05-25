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
 * @param {Object} state - Application state
 * @returns {Object} Complete note object
 */
export function createNote(triggerData, state) {
  // Ensure triggerData is not null/undefined
  if (!triggerData) {
    triggerData = {};
  }
  
  const { 
    x = 0, 
    y = 0, 
    copyIndex, 
    vertexIndex, 
    angle = 0,
    lastAngle = 0,
    globalIndex 
  } = triggerData;
  
  // Calculate base frequency from coordinates
  let frequency = Math.hypot(x, y);
  let noteName = null;
  
  // Check if state is valid
  if (state) {
    // Apply equal temperament if enabled
    if (state.useEqualTemperament) {
      const refFreq = state.referenceFrequency || 440;
      frequency = quantizeToEqualTemperament(frequency, refFreq);
      noteName = getNoteName(frequency, refFreq);
    }
  }
  
  // Determine point index for parameter calculations
  let pointIndex = 0;
  
  // Use globalIndex if provided (new sequential approach)
  if (globalIndex !== undefined) {
    pointIndex = globalIndex;
  } else if (copyIndex !== undefined && vertexIndex !== undefined) {
    // For regular vertices, combine copy index and vertex index
    const copies = state ? state.copies : 1;
    const segments = state ? state.segments : 2;
    pointIndex = (copyIndex * segments) + vertexIndex;
  }
  
  // Calculate duration based on selected mode and parameters
  const duration = calculateDuration(pointIndex, state);
  
  // Calculate velocity based on selected mode and parameters
  const velocity = calculateVelocity(pointIndex, state);
  
  // Calculate pan (stereo position) based on angle
  const angRad = angle % (2 * Math.PI);
  const pan = Math.sin(angRad);
  
  // Create parameter info object with safe defaults
  const parameterInfo = {
    durationType: state?.durationMode || ParameterMode.MODULO,
    velocityType: state?.velocityMode || ParameterMode.MODULO,
    durationModulo: state?.durationModulo || 3,
    velocityModulo: state?.velocityModulo || 4
  };
  
  // Create note object with all parameters
  return {
    frequency,
    duration,
    velocity,
    pan,
    pointIndex,
    copyIndex: copyIndex || 0,
    vertexIndex: vertexIndex || 0,
    coordinates: { x, y },
    time: Date.now(), // Current time in ms
    noteName,
    
    // For visualization/debugging
    parameterInfo
  };
}

/**
 * Calculate note duration based on point index and state parameters
 * @param {number} pointIndex - Index of the point
 * @param {Object} state - Application state
 * @returns {number} Duration in seconds
 */
function calculateDuration(pointIndex, state) {
  // Make sure state exists, otherwise use defaults
  if (!state) {
    return 0.3; // Default duration if state is undefined
  }
  
  const min = state.minDuration !== undefined ? state.minDuration : 0.1;
  const max = state.maxDuration !== undefined ? state.maxDuration : 0.5;
  const modulo = state.durationModulo !== undefined ? state.durationModulo : 3;
  const mode = state.durationMode || ParameterMode.MODULO;
  const phase = state.durationPhase !== undefined ? state.durationPhase : 0;
  
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
  // Make sure state exists, otherwise use defaults
  if (!state) {
    return 0.7; // Default velocity if state is undefined
  }
  
  const min = state.minVelocity !== undefined ? state.minVelocity : 0.3;
  const max = state.maxVelocity !== undefined ? state.maxVelocity : 0.9;
  const modulo = state.velocityModulo !== undefined ? state.velocityModulo : 4;
  const mode = state.velocityMode || ParameterMode.MODULO;
  const phase = state.velocityPhase !== undefined ? state.velocityPhase : 0;
  
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
  
  // Determine if we need to invert (when min > max)
  const invert = min > max;
  
  // Calculate where we are in the current cycle
  const cyclePosition = (pointIndex % modulo) / modulo;
  
  // Use sine wave interpolation for smooth values
  const normalizedValue = 0.5 + 0.5 * Math.sin(cyclePosition * Math.PI * 2 - Math.PI/2);
  
  // Map to our range
  const interpolatedValue = actualMin + normalizedValue * (actualMax - actualMin);
  
  // Invert if min > max
  return invert ? (actualMin + actualMax - interpolatedValue) : interpolatedValue;
}

/**
 * Generate a deterministic random number from a seed
 * @param {number} seed - Seed value
 * @returns {number} Random number between 0-1
 */
function seededRandom(seed) {
  // Simple but effective seeded random function
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}