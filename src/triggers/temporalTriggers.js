// src/triggers/temporalTriggers.js - Frame-rate independent temporal trigger detection engine
import * as THREE from 'three';
import { getCurrentTime, secondsToTicks } from '../time/time.js';

// Constants for temporal engine
const TEMPORAL_RESOLUTION = 1000; // Hz - 1ms time slices for sub-frame precision
const MIN_TIME_SLICE = 1 / TEMPORAL_RESOLUTION; // Minimum time slice in seconds (1ms)
const MAX_INTERPOLATION_TIME = 0.1; // Maximum time gap to interpolate (100ms)
const DEFAULT_TEMPORAL_MEMORY = 50; // Number of temporal states to keep in history
const DEFAULT_MICRO_STEPS = 10; // Default number of micro steps between frames
const EPSILON = 1e-6; // Small value for floating point comparisons

/**
 * Represents a high-precision trigger crossing result
 */
export class TemporalCrossingResult {
  /**
   * Create a new temporal crossing result
   * @param {boolean} hasCrossed - Whether a crossing was detected
   * @param {number} exactTime - The exact crossing time in seconds
   * @param {number} crossingFactor - Interpolation factor (0-1) where crossing occurred
   * @param {Object} position - Interpolated position at crossing point
   * @param {boolean} isInterpolated - Whether this was detected through interpolation
   * @param {Object} additionalInfo - Additional information about the crossing
   */
  constructor(hasCrossed, exactTime, crossingFactor, position, isInterpolated, additionalInfo = {}) {
    this.hasCrossed = hasCrossed;
    this.exactTime = exactTime;
    this.crossingFactor = crossingFactor;
    this.position = position;
    this.isInterpolated = isInterpolated;
    this.additionalInfo = additionalInfo;
  }
  
  /**
   * Create an empty (no crossing) result
   * @returns {TemporalCrossingResult} Empty result
   */
  static createEmpty() {
    return new TemporalCrossingResult(
      false, 0, 0, 
      { x: 0, y: 0, z: 0 }, 
      false
    );
  }
}

/**
 * Class representing a temporal vertex state
 */
class TemporalVertexState {
  /**
   * Create a new temporal vertex state
   * @param {Object} position - The vertex position (x,y,z)
   * @param {number} timestamp - High precision timestamp when this position was recorded
   * @param {string} id - Unique identifier for this vertex
   */
  constructor(position, timestamp, id) {
    this.position = { ...position };
    this.timestamp = timestamp;
    this.id = id;
    this.hasTriggered = false;
    this.velocityVector = null; // Added to track velocity
    this.accelerationVector = null; // Added to track acceleration
  }
  
  /**
   * Clone this temporal vertex state
   * @returns {TemporalVertexState} A copy of this state
   */
  clone() {
    const clone = new TemporalVertexState(
      { ...this.position },
      this.timestamp,
      this.id
    );
    clone.hasTriggered = this.hasTriggered;
    
    // Clone velocity and acceleration vectors if they exist
    if (this.velocityVector) {
      clone.velocityVector = { ...this.velocityVector };
    }
    if (this.accelerationVector) {
      clone.accelerationVector = { ...this.accelerationVector };
    }
    
    return clone;
  }
  
  /**
   * Calculate velocity based on a previous state
   * @param {TemporalVertexState} prevState - Previous vertex state
   */
  calculateVelocity(prevState) {
    if (!prevState) return;
    
    const dt = this.timestamp - prevState.timestamp;
    if (dt <= 0) return;
    
    this.velocityVector = {
      x: (this.position.x - prevState.position.x) / dt,
      y: (this.position.y - prevState.position.y) / dt,
      z: (this.position.z - prevState.position.z) / dt
    };
  }
  
  /**
   * Calculate acceleration based on a previous state with velocity
   * @param {TemporalVertexState} prevState - Previous vertex state with velocity
   */
  calculateAcceleration(prevState) {
    if (!prevState || !this.velocityVector || !prevState.velocityVector) return;
    
    const dt = this.timestamp - prevState.timestamp;
    if (dt <= 0) return;
    
    this.accelerationVector = {
      x: (this.velocityVector.x - prevState.velocityVector.x) / dt,
      y: (this.velocityVector.y - prevState.velocityVector.y) / dt,
      z: (this.velocityVector.z - prevState.velocityVector.z) / dt
    };
  }
}

/**
 * Main temporal trigger engine for frame-rate independent trigger detection
 */
export class TemporalTriggerEngine {
  /**
   * Create a new temporal trigger engine
   * @param {Object} options - Configuration options
   * @param {number} options.resolution - Temporal resolution in Hz (default: 1000)
   * @param {number} options.maxMemory - Maximum memory states to keep (default: 50)
   * @param {number} options.microSteps - Micro steps between frames (default: 10)
   * @param {boolean} options.useHighPrecision - Use higher precision algorithms (default: true)
   * @param {boolean} options.trackVelocity - Track velocity for vertices (default: true)
   * @param {boolean} options.debugMode - Enable detailed debugging (default: false)
   */
  constructor(options = {}) {
    this.resolution = options.resolution || TEMPORAL_RESOLUTION;
    this.maxMemory = options.maxMemory || DEFAULT_TEMPORAL_MEMORY;
    this.microSteps = options.microSteps || DEFAULT_MICRO_STEPS;
    this.useHighPrecision = options.useHighPrecision !== false; // Default true
    this.trackVelocity = options.trackVelocity !== false; // Default true
    this.debugMode = options.debugMode || false;
    this.timeSlice = 1 / this.resolution;
    
    // State tracking
    this.vertexStates = new Map(); // Maps vertex IDs to arrays of temporal states
    this.lastProcessedTime = 0;
    this.recentCrossings = new Map(); // Maps vertex IDs to last crossing time
    this.missedTriggers = []; // Track potentially missed triggers for debugging
    this._initialized = false;
    
    // Debugging metrics
    this.metrics = {
      totalDetections: 0,
      microStepDetections: 0,
      preciseDetections: 0,
      avgProcessingTime: 0,
      processingCalls: 0
    };
  }
  
  /**
   * Initialize the engine
   */
  initialize() {
    this.lastProcessedTime = getCurrentTime();
    this._initialized = true;
    console.log(`[TemporalTrigger] Initialized engine with ${this.resolution}Hz resolution`);
  }
  
  /**
   * Record a new vertex position
   * @param {string} id - Unique vertex identifier
   * @param {Object} position - Current position {x, y, z}
   * @param {number} timestamp - Current timestamp (in seconds)
   */
  recordVertexPosition(id, position, timestamp) {
    if (!this._initialized) {
      this.initialize();
    }
    
    // Create state object
    const state = new TemporalVertexState(position, timestamp, id);
    
    // Get or create the state array for this vertex
    if (!this.vertexStates.has(id)) {
      this.vertexStates.set(id, []);
    }
    
    const states = this.vertexStates.get(id);
    
    // Calculate velocity and acceleration if tracking is enabled
    if (this.trackVelocity && states.length > 0) {
      const prevState = states[states.length - 1];
      state.calculateVelocity(prevState);
      
      if (states.length > 1) {
        state.calculateAcceleration(prevState);
      }
    }
    
    // Add new state
    states.push(state);
    
    // Prune old states if needed
    if (states.length > this.maxMemory) {
      states.shift();
    }
  }
  
  /**
   * Record multiple vertex positions in batch
   * @param {Array<Object>} vertices - Array of {id, position} objects
   * @param {number} timestamp - Current timestamp (in seconds)
   */
  recordVertexPositions(vertices, timestamp) {
    vertices.forEach(vertex => {
      this.recordVertexPosition(vertex.id, vertex.position, timestamp);
    });
  }
  
  /**
   * Clear history for a specific vertex
   * @param {string} id - Vertex identifier
   */
  clearVertexHistory(id) {
    if (this.vertexStates.has(id)) {
      this.vertexStates.delete(id);
    }
    if (this.recentCrossings.has(id)) {
      this.recentCrossings.delete(id);
    }
  }
  
  /**
   * Clear all vertex history
   */
  clearAllHistory() {
    this.vertexStates.clear();
    this.recentCrossings.clear();
    this.missedTriggers = [];
  }
  
  /**
   * Interpolate position between two states
   * @param {TemporalVertexState} startState - Starting state
   * @param {TemporalVertexState} endState - Ending state
   * @param {number} t - Interpolation factor (0-1)
   * @returns {Object} Interpolated position {x, y, z}
   */
  interpolatePosition(startState, endState, t) {
    // Clamp t to valid range
    const factor = Math.max(0, Math.min(1, t));
    
    // If high precision mode is enabled and velocity data is available, use Hermite interpolation
    if (this.useHighPrecision && 
        startState.velocityVector && 
        endState.velocityVector) {
      return this.hermiteInterpolation(startState, endState, factor);
    }
    
    // Fall back to linear interpolation
    return {
      x: startState.position.x + (endState.position.x - startState.position.x) * factor,
      y: startState.position.y + (endState.position.y - startState.position.y) * factor,
      z: startState.position.z + (endState.position.z - startState.position.z) * factor
    };
  }
  
  /**
   * Use Hermite interpolation for smoother paths using velocity data
   * @param {TemporalVertexState} startState - Starting state
   * @param {TemporalVertexState} endState - Ending state
   * @param {number} t - Interpolation factor (0-1)
   * @returns {Object} Interpolated position {x, y, z}
   */
  hermiteInterpolation(startState, endState, t) {
    // Hermite basis functions
    const h00 = 2*t*t*t - 3*t*t + 1;
    const h10 = t*t*t - 2*t*t + t;
    const h01 = -2*t*t*t + 3*t*t;
    const h11 = t*t*t - t*t;
    
    // Time difference for velocity scaling
    const dt = endState.timestamp - startState.timestamp;
    
    // Interpolate each component
    return {
      x: h00 * startState.position.x + 
         h10 * startState.velocityVector.x * dt + 
         h01 * endState.position.x + 
         h11 * endState.velocityVector.x * dt,
      y: h00 * startState.position.y + 
         h10 * startState.velocityVector.y * dt + 
         h01 * endState.position.y + 
         h11 * endState.velocityVector.y * dt,
      z: h00 * startState.position.z + 
         h10 * startState.velocityVector.z * dt + 
         h01 * endState.position.z + 
         h11 * endState.velocityVector.z * dt
    };
  }
  
  /**
   * Check if a point crosses the Y axis (x=0, y>0) between two positions
   * Enhanced Bresenham-inspired algorithm for precise detection
   * @param {Object} prevPos - Previous position {x, y, z}
   * @param {Object} currPos - Current position {x, y, z}
   * @returns {Object} Crossing information {hasCrossed, crossingFactor}
   */
  checkAxisCrossing(prevPos, currPos) {
    // Skip if either point is below the X-axis (y <= 0)
    if (prevPos.y <= 0 || currPos.y <= 0) {
      return { hasCrossed: false, crossingFactor: 0 };
    }
    
    // Check if we're crossing the Y axis (x=0) from either direction
    const crossingLeftToRight = prevPos.x <= 0 && currPos.x > 0;
    const crossingRightToLeft = prevPos.x >= 0 && currPos.x < 0;
    
    if (!crossingLeftToRight && !crossingRightToLeft) {
      return { hasCrossed: false, crossingFactor: 0 };
    }
    
    // Calculate the interpolation factor where the crossing occurs
    // This is the point where x = 0, using linear interpolation
    // x = prevPos.x + (currPos.x - prevPos.x) * t, solve for t where x = 0
    const crossingFactor = Math.abs(prevPos.x) / Math.abs(currPos.x - prevPos.x);
    
    // Clamp the factor to the valid range [0,1]
    const clampedFactor = Math.max(0, Math.min(1, crossingFactor));
    
    return { 
      hasCrossed: true, 
      crossingFactor: clampedFactor 
    };
  }
  
  /**
   * Enhanced function that samples points along a path to detect crossings with micro-timesteps
   * This implements a high-resolution path sampling algorithm
   * @param {TemporalVertexState} startState - Starting state
   * @param {TemporalVertexState} endState - Ending state
   * @returns {Array<Object>} Array of sampled positions with timestamps
   */
  samplePositionsAlongPath(startState, endState) {
    // Calculate how many samples to take based on the time difference
    const timeDiff = endState.timestamp - startState.timestamp;
    
    // Determine the number of steps to take
    let steps = Math.max(2, Math.ceil(timeDiff * this.resolution));
    
    // Cap steps to a reasonable maximum based on microSteps
    steps = Math.min(steps, this.microSteps);
    
    // Create array of sampled positions
    const samples = [];
    
    // Add the start position
    samples.push({
      position: { ...startState.position },
      timestamp: startState.timestamp
    });
    
    // Add intermediate positions
    for (let i = 1; i < steps - 1; i++) {
      const t = i / (steps - 1);
      const timestamp = startState.timestamp + timeDiff * t;
      const position = this.interpolatePosition(startState, endState, t);
      
      samples.push({
        position,
        timestamp
      });
    }
    
    // Add the end position
    samples.push({
      position: { ...endState.position },
      timestamp: endState.timestamp
    });
    
    return samples;
  }
  
  /**
   * Find the exact crossing time using root-finding methods
   * @param {TemporalVertexState} startState - Starting state
   * @param {TemporalVertexState} endState - Ending state
   * @param {number} initialGuess - Initial guess for the crossing factor
   * @returns {Object} Precise crossing information
   */
  findExactCrossingTime(startState, endState, initialGuess) {
    // Use Newton-Raphson method to find more precise crossing time
    let t = initialGuess;
    let iterations = 0;
    const MAX_ITERATIONS = 10;
    const TOLERANCE = 1e-10;
    
    // Function to evaluate x-position at time t
    const evaluateX = (t) => {
      const pos = this.interpolatePosition(startState, endState, t);
      return pos.x;
    };
    
    // Approximate derivative using central difference
    const evaluateDerivative = (t) => {
      const h = 1e-6;
      const x1 = evaluateX(t - h);
      const x2 = evaluateX(t + h);
      return (x2 - x1) / (2 * h);
    };
    
    // Newton-Raphson iteration
    while (iterations < MAX_ITERATIONS) {
      const x = evaluateX(t);
      
      // Check if we've converged
      if (Math.abs(x) < TOLERANCE) {
        break;
      }
      
      const derivative = evaluateDerivative(t);
      
      // Avoid division by very small numbers
      if (Math.abs(derivative) < EPSILON) {
        break;
      }
      
      // Update t
      const delta = x / derivative;
      t = t - delta;
      
      // Keep t in valid range
      t = Math.max(0, Math.min(1, t));
      
      iterations++;
    }
    
    // Calculate the exact timestamp
    const timeDiff = endState.timestamp - startState.timestamp;
    const exactTime = startState.timestamp + timeDiff * t;
    
    // Calculate the exact position
    const exactPosition = this.interpolatePosition(startState, endState, t);
    
    return {
      crossingFactor: t,
      exactTime,
      position: exactPosition,
      iterations
    };
  }
  
  /**
   * Enhanced detection of crossings with sub-frame precision
   * @param {string} vertexId - Vertex identifier
   * @param {number} cooldownTime - Cooldown time in seconds (default: 0)
   * @returns {TemporalCrossingResult} Crossing result with precise timing information
   */
  detectCrossing(vertexId, cooldownTime = 0) {
    // Get the state history for this vertex
    if (!this.vertexStates.has(vertexId)) {
      return TemporalCrossingResult.createEmpty();
    }
    
    const states = this.vertexStates.get(vertexId);
    
    // Need at least two states to detect a crossing
    if (states.length < 2) {
      return TemporalCrossingResult.createEmpty();
    }
    
    // Get the last recorded crossing time
    const lastCrossingTime = this.recentCrossings.get(vertexId) || 0;
    
    // Start processing time for metrics
    const processingStartTime = performance.now();
    
    // Track if we found a crossing
    let foundCrossing = false;
    let bestCrossing = null;
    
    // Examine pairs of consecutive states to detect crossings
    for (let i = 0; i < states.length - 1; i++) {
      const startState = states[i];
      const endState = states[i + 1];
      
      // Skip if either state has already triggered
      if (startState.hasTriggered || endState.hasTriggered) {
        continue;
      }
      
      // Enhanced approach: Sample intermediate positions for micro-timestep detection
      const sampledPositions = this.samplePositionsAlongPath(startState, endState);
      
      // Check each adjacent pair of sampled positions for crossings
      for (let j = 0; j < sampledPositions.length - 1; j++) {
        const prevSample = sampledPositions[j];
        const currSample = sampledPositions[j + 1];
        
        // Check for crossing
        const { hasCrossed, crossingFactor } = this.checkAxisCrossing(
          prevSample.position, 
          currSample.position
        );
        
        if (hasCrossed) {
          // Calculate the exact timestamp for this micro-crossing
          const sampleTimeDiff = currSample.timestamp - prevSample.timestamp;
          const microCrossingTime = prevSample.timestamp + sampleTimeDiff * crossingFactor;
          
          // Skip if we're still in cooldown period
          if (microCrossingTime - lastCrossingTime < cooldownTime) {
            if (this.debugMode) {
              this.missedTriggers.push({
                type: 'cooldown',
                vertexId,
                crossingTime: microCrossingTime,
                lastCrossingTime,
                cooldownTime
              });
            }
            continue;
          }
          
          // Find the exact crossing time with high precision
          const sampleStartState = new TemporalVertexState(
            prevSample.position, 
            prevSample.timestamp, 
            vertexId
          );
          
          const sampleEndState = new TemporalVertexState(
            currSample.position, 
            currSample.timestamp, 
            vertexId
          );
          
          const preciseCrossing = this.findExactCrossingTime(
            sampleStartState, 
            sampleEndState, 
            crossingFactor
          );
          
          // Check if this is the earliest crossing we've found
          if (!bestCrossing || preciseCrossing.exactTime < bestCrossing.exactTime) {
            bestCrossing = preciseCrossing;
            foundCrossing = true;
            
            // Increment metrics
            this.metrics.microStepDetections++;
          }
        }
      }
      
      // Also check the original pair directly (as a fallback)
      if (!foundCrossing) {
        const { hasCrossed, crossingFactor } = this.checkAxisCrossing(
          startState.position, 
          endState.position
        );
        
        if (hasCrossed) {
          // Find exact crossing with high precision
          const preciseCrossing = this.findExactCrossingTime(
            startState, 
            endState, 
            crossingFactor
          );
          
          // Calculate the exact timestamp
          const exactTime = preciseCrossing.exactTime;
          
          // Skip if we're still in cooldown period
          if (exactTime - lastCrossingTime < cooldownTime) {
            if (this.debugMode) {
              this.missedTriggers.push({
                type: 'cooldown',
                vertexId,
                crossingTime: exactTime,
                lastCrossingTime,
                cooldownTime
              });
            }
            continue;
          }
          
          bestCrossing = preciseCrossing;
          foundCrossing = true;
          
          // Increment metrics
          this.metrics.preciseDetections++;
        }
      }
    }
    
    // End processing time and update metrics
    const processingEndTime = performance.now();
    const processingTime = processingEndTime - processingStartTime;
    
    this.metrics.processingCalls++;
    this.metrics.avgProcessingTime = 
      (this.metrics.avgProcessingTime * (this.metrics.processingCalls - 1) + processingTime) / 
      this.metrics.processingCalls;
    
    // If we found a crossing, create the result
    if (foundCrossing && bestCrossing) {
      // Mark states as triggered
      for (const state of states) {
        if (state.timestamp <= bestCrossing.exactTime) {
          state.hasTriggered = true;
        }
      }
      
      // Update the last crossing time
      this.recentCrossings.set(vertexId, bestCrossing.exactTime);
      
      // Increment metrics
      this.metrics.totalDetections++;
      
      // Create the result
      return new TemporalCrossingResult(
        true,
        bestCrossing.exactTime,
        bestCrossing.crossingFactor,
        bestCrossing.position,
        true, // This is an interpolated position
        {
          processingTime,
          iterations: bestCrossing.iterations
        }
      );
    }
    
    // No crossing found
    return TemporalCrossingResult.createEmpty();
  }
  
  /**
   * Enhanced detection of rotational motion
   * Detects when a vertex moves around the origin in a circular path
   * @param {Array<TemporalVertexState>} states - Array of vertex states
   * @returns {boolean} True if rotational motion detected
   */
  detectRotationalMotion(states) {
    // Need at least 3 states to detect rotation
    if (states.length < 3) {
      return false;
    }
    
    // Calculate angles for each state
    const angles = states.map(state => {
      return Math.atan2(state.position.y, state.position.x);
    });
    
    // Look for angle changes that indicate rotation
    let totalAngleChange = 0;
    for (let i = 1; i < angles.length; i++) {
      // Calculate the angle difference, handling wraparound correctly
      let angleDiff = angles[i] - angles[i-1];
      
      // Normalize to [-π, π]
      if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
      if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
      
      totalAngleChange += Math.abs(angleDiff);
    }
    
    // If the total angle change is significant, we detect rotation
    const ROTATION_THRESHOLD = Math.PI / 2; // 90 degrees
    return totalAngleChange > ROTATION_THRESHOLD;
  }
  
  /**
   * Enhanced detection of crossings for all vertices
   * @param {number} cooldownTime - Cooldown time in seconds
   * @returns {Map<string, TemporalCrossingResult>} Map of vertex IDs to crossing results
   */
  processAllVertices(cooldownTime = 0) {
    if (!this._initialized) {
      this.initialize();
    }
    
    const results = new Map();
    
    // Process each vertex
    for (const [vertexId, _] of this.vertexStates) {
      const result = this.detectCrossing(vertexId, cooldownTime);
      
      if (result.hasCrossed) {
        results.set(vertexId, result);
      }
    }
    
    return results;
  }
  
  /**
   * Get debugging metrics
   * @returns {Object} Debugging metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      missedTriggers: this.missedTriggers.length,
      lastMissedTriggers: this.missedTriggers.slice(-10) // Last 10 missed triggers
    };
  }
  
  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      totalDetections: 0,
      microStepDetections: 0,
      preciseDetections: 0,
      avgProcessingTime: 0,
      processingCalls: 0
    };
    this.missedTriggers = [];
  }
  
  /**
   * Create a unique vertex ID from layer, copy, and vertex indices
   * @param {string} layerId - Layer identifier
   * @param {number} copyIndex - Copy index
   * @param {number} vertexIndex - Vertex index
   * @returns {string} Unique vertex ID
   * @static
   */
  static createVertexId(layerId, copyIndex, vertexIndex) {
    return `${layerId}-${copyIndex}-${vertexIndex}`;
  }
  
  /**
   * Create a unique intersection ID
   * @param {string} layerId - Layer identifier
   * @param {number} copyIndex - Copy index
   * @param {number} intersectionIndex - Intersection index
   * @returns {string} Unique intersection ID
   * @static
   */
  static createIntersectionId(layerId, copyIndex, intersectionIndex) {
    return `${layerId}-i-${copyIndex}-${intersectionIndex}`;
  }
}

/**
 * Create a note object from a temporal crossing result
 * @param {TemporalCrossingResult} crossingResult - The crossing result
 * @param {Object} baseNote - Base note properties
 * @param {Object} state - App state for additional properties
 * @returns {Object} Note object with timing information
 */
export function createNoteFromCrossing(crossingResult, baseNote, state) {
  if (!crossingResult.hasCrossed) {
    return null;
  }
  
  // Create the note with the exact timing information
  const note = {
    ...baseNote,
    time: crossingResult.exactTime,
    triggerTime: Date.now(), // Current time for UI feedback
    isTemporalTrigger: true,
    x: crossingResult.position.x,
    y: crossingResult.position.y,
    z: crossingResult.position.z || 0
  };
  
  // Add additional timing information for quantization
  if (state && state.quantizeTriggersTo) {
    note.quantizationInfo = {
      exactTime: crossingResult.exactTime,
      quantizeMode: state.quantizeTriggersTo
    };
  }
  
  return note;
} 