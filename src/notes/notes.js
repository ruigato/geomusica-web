// src/notes/notes.js

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
  const { x, y, copyIndex, vertexIndex, isIntersection, angle, lastAngle } = triggerData;
  
  // Calculate base frequency from coordinates
  let frequency = Math.hypot(x, y);
  let noteName = null;
  
  // Apply equal temperament if enabled
  if (state && state.useEqualTemperament) {
    const refFreq = state.referenceFrequency || 440;
    frequency = quantizeToEqualTemperament(frequency, refFreq);
    noteName = getNoteName(frequency, refFreq);
  }
  
  // Determine point index for parameter calculations
  let pointIndex = 0;
  
  if (isIntersection) {
    // For intersection points, use point index from intersection array
    const intersectionIndex = triggerData.intersectionIndex || 0;
    const totalRegularPoints = state.copies * state.segments;
    pointIndex = totalRegularPoints + intersectionIndex;
  } else if (copyIndex !== undefined && vertexIndex !== undefined) {
    // For regular vertices, combine copy index and vertex index
    pointIndex = (copyIndex * state.segments) + vertexIndex;
  }
  
  // Calculate duration based on selected mode and parameters
  const duration = calculateDuration(pointIndex, state);
  
  // Calculate velocity based on selected mode and parameters
  const velocity = calculateVelocity(pointIndex, state);
  
  // Calculate pan (stereo position) based on angle
  const angRad = angle % (2 * Math.PI);
  const pan = Math.sin(angRad);
  
  // Create note object with all parameters
  return {
    frequency,
    duration,
    velocity,
    pan,
    pointIndex,
    copyIndex,
    vertexIndex,
    isIntersection,
    coordinates: { x, y },
    time: Date.now(), // Current time in ms
    noteName,
    
    // For visualization/debugging
    parameterInfo: {
      durationType: state.durationMode,
      velocityType: state.velocityMode,
      durationModulo: state.durationModulo,
      velocityModulo: state.velocityModulo
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
  const min = state.minDuration || 0.1;
  const max = state.maxDuration || 0.5;
  const modulo = state.durationModulo || 3;
  const mode = state.durationMode || ParameterMode.MODULO;
  
  switch (mode) {
    case ParameterMode.MODULO:
      return calculateModuloValue(pointIndex, modulo, min, max);
    
    case ParameterMode.RANDOM:
      return calculateRandomValue(pointIndex, min, max);
    
    case ParameterMode.INTERPOLATION:
      return calculateInterpolatedValue(pointIndex, modulo, min, max);
      
    default:
      return (min + max) / 2;
  }
}

/**
 * Calculate note velocity based on point index and state parameters
 * @param {number} pointIndex - Index of the point
 * @param {Object} state - Application state
 * @returns {number} Velocity (0-1)
 */
function calculateVelocity(pointIndex, state) {
  const min = state.minVelocity || 0.3;
  const max = state.maxVelocity || 0.9;
  const modulo = state.velocityModulo || 4;
  const mode = state.velocityMode || ParameterMode.MODULO;
  
  switch (mode) {
    case ParameterMode.MODULO:
      return calculateModuloValue(pointIndex, modulo, min, max);
    
    case ParameterMode.RANDOM:
      return calculateRandomValue(pointIndex, min, max);
    
    case ParameterMode.INTERPOLATION:
      return calculateInterpolatedValue(pointIndex, modulo, min, max);
      
    default:
      return (min + max) / 2;
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
    return max;
  }
  
  // If pointIndex is divisible by modulo, use max value, otherwise min
  return (pointIndex % modulo === 0) ? max : min;
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
  
  // Scale random value to the range [min, max]
  return min + random * (max - min);
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
    return max;
  }
  
  // Find the position within the current modulo cycle
  const cycle = Math.floor(pointIndex / modulo);
  const position = pointIndex - (cycle * modulo);
  
  // Calculate normalized position (0 to 1)
  const normalizedPosition = position / modulo;
  
  // Using a sine wave pattern for smooth oscillation between min and max
  // sin ranges from -1 to 1, so adjust to range 0 to 1
  const oscillation = (Math.sin(normalizedPosition * Math.PI * 2) + 1) / 2;
  
  // Interpolate between min and max based on oscillation value
  return min + oscillation * (max - min);
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