// src/triggers/SubframeTrigger.js - Frame-rate independent temporal trigger detection engine
// Enhanced with circular arc interpolation for improved frequency precision with rotating vertices
import { getCurrentTime } from '../time/time.js';

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
   */
  constructor(hasCrossed, exactTime, crossingFactor, position, isInterpolated) {
    this.hasCrossed = hasCrossed;
    this.exactTime = exactTime;
    this.crossingFactor = crossingFactor;
    this.position = position;
    this.isInterpolated = isInterpolated;
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
    return clone;
  }
}

// Fallback to performance timing if audio timing isn't ready
function getTimestamp() {
  try {
    return getCurrentTime();
  } catch (e) {
    return performance.now() / 1000;
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
   * @param {number} options.maxVertices - Maximum number of vertices to track (default: 1000)
   * @param {number} options.cleanupInterval - Interval in ms to run automatic cleanup (default: 10000)
   * @param {boolean} options.useAudioTiming - Whether to use audio timing (default: true)
   * @param {boolean} options.enablePerformanceMonitoring - Whether to track performance stats (default: false)
   */
  constructor(options = {}) {
    // Constants for temporal engine
    const TEMPORAL_RESOLUTION = 1000; // Hz - 1ms time slices for sub-frame precision
    const DEFAULT_TEMPORAL_MEMORY = 50; // Number of temporal states to keep in history
    const DEFAULT_MAX_VERTICES = 1000; // Maximum number of vertices to track
    const DEFAULT_CLEANUP_INTERVAL = 10000; // 10 seconds between cleanup operations
    
    this.resolution = options.resolution || TEMPORAL_RESOLUTION;
    this.maxMemory = options.maxMemory || DEFAULT_TEMPORAL_MEMORY;
    this.maxVertices = options.maxVertices || DEFAULT_MAX_VERTICES;
    this.cleanupInterval = options.cleanupInterval || DEFAULT_CLEANUP_INTERVAL;
    this.timeSlice = 1 / this.resolution;
    this.useAudioTiming = options.useAudioTiming !== false; // Default to true
    this.enablePerformanceMonitoring = options.enablePerformanceMonitoring || false;
    
    // State tracking
    this.vertexStates = new Map(); // Maps vertex IDs to arrays of temporal states
    this.vertexLastAccessed = new Map(); // For LRU tracking - Maps vertex IDs to last access timestamp
    this.lastProcessedTime = 0;
    this.recentCrossings = new Map(); // Maps vertex IDs to last crossing time
    this._initialized = false;
    
    // Performance monitoring (optional)
    if (this.enablePerformanceMonitoring) {
      this.performanceStats = {
        circularInterpolations: 0,
        linearInterpolations: 0,
        circularCrossings: 0,
        linearCrossings: 0,
        totalDetections: 0,
        lastResetTime: 0
      };
    }
    
    // Setup automatic cleanup
    this.cleanupTimerId = null;
    
    // Defer audio timing setup until explicitly initialized
    this._audioTimingReady = false;
  }
  
  /**
   * Set up periodic cleanup timer using audio time
   * @private
   */
  _setupCleanupTimer() {
    // Clear any existing timer
    if (this.cleanupTimerId !== null) {
      clearInterval(this.cleanupTimerId);
    }
    
    // Create a new cleanup timer that uses audio time
    this.cleanupTimerId = setInterval(() => {
      const audioTime = this.getCurrentTime();
      this._performVertexCleanup(audioTime);
    }, this.cleanupInterval);
  }
  
  /**
   * Perform cleanup of vertex states based on LRU strategy
   * @param {number} audioTime Current audio time in seconds
   * @private
   */
  _performVertexCleanup(audioTime) {
    // Skip if not initialized
    if (!this._initialized) return;
    
    // First pass: remove old entries from each vertex's history
    for (const [id, states] of this.vertexStates.entries()) {
      // Prune states that are too old (older than 5 seconds)
      const recentStates = states.filter(state => audioTime - state.timestamp < 5);
      
      if (recentStates.length === 0) {
        // If no recent states, remove this vertex entirely
        this.vertexStates.delete(id);
        this.vertexLastAccessed.delete(id);
      } else if (recentStates.length !== states.length) {
        // Update with pruned list
        this.vertexStates.set(id, recentStates);
      }
    }
    
    // Second pass: if still too many vertices, use LRU to evict oldest accessed
    if (this.vertexStates.size > this.maxVertices) {
      // Convert to array for sorting
      const entries = Array.from(this.vertexLastAccessed.entries());
      
      // Sort by last accessed time (oldest first)
      entries.sort((a, b) => a[1] - b[1]);
      
      // Calculate how many to remove
      const removeCount = this.vertexStates.size - this.maxVertices;
      
      // Remove oldest entries
      for (let i = 0; i < removeCount; i++) {
        if (i < entries.length) {
          const idToRemove = entries[i][0];
          this.vertexStates.delete(idToRemove);
          this.vertexLastAccessed.delete(idToRemove);
        }
      }
    }
  }
  
  /**
   * Initialize the engine with audio timing
   */
  initialize() {
    // Start with performance timing
    this.lastProcessedTime = performance.now() / 1000;
    this._initialized = true;
    
    // Setup cleanup with safe timing
    this._setupCleanupTimer();
    
    // Try to switch to audio timing
    try {
      const audioTime = getCurrentTime();
      this.lastProcessedTime = audioTime;
      this._audioTimingReady = true;
    } catch (e) {
      console.warn('[TRIGGER] Audio timing not ready, using performance timing temporarily');
      // Will retry on next getCurrentTime call
    }
  }
  
  /**
   * Get current high-precision time in seconds using AudioContext when available
   * @returns {number} Current time in seconds
   */
  getCurrentTime() {
    if (!this._initialized) {
      this.initialize();
    }
    
    // Try to use audio timing, fall back to performance timing
    return getTimestamp();
  }
  
  /**
   * Record a new vertex position with audio timing
   * @param {string} id - Unique vertex identifier
   * @param {Object} position - Current position {x, y, z}
   * @param {number} timestamp - Current audio time in seconds
   */
  recordVertexPosition(id, position, timestamp) {
    if (!this._initialized) {
      this.initialize();
    }
    
    // Use provided timestamp or get current audio time
    const audioTime = timestamp || this.getCurrentTime();
    
    // Update last accessed time for LRU tracking
    this.vertexLastAccessed.set(id, audioTime);
    
    // Check if we're at capacity before adding
    if (!this.vertexStates.has(id) && this.vertexStates.size >= this.maxVertices) {
      this._evictLeastRecentlyUsed();
    }
    
    // Create state object with audio timing
    const state = new TemporalVertexState(position, audioTime, id);
    
    // Get or create the state array for this vertex
    if (!this.vertexStates.has(id)) {
      this.vertexStates.set(id, []);
    }
    
    const states = this.vertexStates.get(id);
    
    // Add new state
    states.push(state);
    
    // Prune old states if needed
    if (states.length > this.maxMemory) {
      states.shift();
    }
  }
  
  /**
   * Evict the least recently used vertex from tracking
   * @private
   */
  _evictLeastRecentlyUsed() {
    if (this.vertexLastAccessed.size === 0) return;
    
    // Find the oldest accessed vertex
    let oldestId = null;
    let oldestTime = Infinity;
    
    for (const [id, time] of this.vertexLastAccessed.entries()) {
      if (time < oldestTime) {
        oldestTime = time;
        oldestId = id;
      }
    }
    
    // Remove it from both maps
    if (oldestId !== null) {
      this.vertexStates.delete(oldestId);
      this.vertexLastAccessed.delete(oldestId);
    }
  }
  
  /**
   * Record multiple vertex positions in batch
   * @param {Array<Object>} vertices - Array of {id, position} objects
   * @param {number} timestamp - Current timestamp (in seconds)
   */
  recordVertexPositions(vertices, timestamp) {
    // If we have too many vertices, prioritize the current batch
    if (vertices.length + this.vertexStates.size > this.maxVertices) {
      // Make room for new vertices by removing least recently used
      const spaceNeeded = Math.min(vertices.length, this.maxVertices);
      
      // Clean existing states to make room
      while (this.vertexStates.size > this.maxVertices - spaceNeeded) {
        this._evictLeastRecentlyUsed();
      }
    }
    
    // Record all vertices in the batch
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
    if (this.vertexLastAccessed.has(id)) {
      this.vertexLastAccessed.delete(id);
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
    this.vertexLastAccessed.clear();
    this.recentCrossings.clear();
  }
  
  /**
   * Get performance statistics (if monitoring is enabled)
   * @returns {Object|null} Performance statistics or null if monitoring is disabled
   */
  getPerformanceStats() {
    if (!this.enablePerformanceMonitoring) {
      return null;
    }
    
    const now = this.getCurrentTime();
    const timeSinceReset = now - (this.performanceStats.lastResetTime || now);
    
    return {
      ...this.performanceStats,
      timeSinceReset,
      circularInterpolationPercentage: this.performanceStats.totalDetections > 0 ? 
        (this.performanceStats.circularInterpolations / this.performanceStats.totalDetections * 100).toFixed(1) : 0,
      circularCrossingPercentage: (this.performanceStats.circularCrossings + this.performanceStats.linearCrossings) > 0 ?
        (this.performanceStats.circularCrossings / (this.performanceStats.circularCrossings + this.performanceStats.linearCrossings) * 100).toFixed(1) : 0
    };
  }
  
  /**
   * Reset performance statistics (if monitoring is enabled)
   */
  resetPerformanceStats() {
    if (!this.enablePerformanceMonitoring) {
      return;
    }
    
    this.performanceStats = {
      circularInterpolations: 0,
      linearInterpolations: 0,
      circularCrossings: 0,
      linearCrossings: 0,
      totalDetections: 0,
      lastResetTime: this.getCurrentTime()
    };
  }
  
  /**
   * Dispose of the engine and clean up resources
   */
  dispose() {
    if (this.cleanupTimerId !== null) {
      clearInterval(this.cleanupTimerId);
      this.cleanupTimerId = null;
    }
    this.clearAllHistory();
    
    // Clean up performance monitoring
    if (this.enablePerformanceMonitoring) {
      this.performanceStats = null;
    }
    
    this._initialized = false;
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
    
    // Detect if this appears to be circular motion
    const circularMotion = this.detectCircularMotion(startState, endState);
    
    // Track performance if monitoring is enabled
    if (this.enablePerformanceMonitoring) {
      this.performanceStats.totalDetections++;
      if (circularMotion.isCircular) {
        this.performanceStats.circularInterpolations++;
      } else {
        this.performanceStats.linearInterpolations++;
      }
    }
    
    if (circularMotion.isCircular) {
      // Use circular arc interpolation for better frequency precision
      return this.interpolateCircularPosition(startState, endState, factor, circularMotion);
    } else {
      // Fall back to linear interpolation for non-circular motion
      return this.interpolateLinearPosition(startState, endState, factor);
    }
  }
  
  /**
   * Detect if motion appears to be circular/rotational around the origin
   * @param {TemporalVertexState} startState - Starting state
   * @param {TemporalVertexState} endState - Ending state
   * @returns {Object} Circular motion analysis {isCircular, center, radius, startAngle, endAngle, angleDiff}
   */
  detectCircularMotion(startState, endState) {
    const pos1 = startState.position;
    const pos2 = endState.position;
    
    // Calculate distances from origin (assuming rotation around center)
    const r1 = Math.sqrt(pos1.x * pos1.x + pos1.y * pos1.y);
    const r2 = Math.sqrt(pos2.x * pos2.x + pos2.y * pos2.y);
    
    // Check if radii are similar (within tolerance) and significant
    const radiusTolerance = 0.08; // 8% tolerance for radius variation
    const minRadius = 20; // Minimum radius to consider for circular motion
    const avgRadius = (r1 + r2) / 2;
    
    if (avgRadius < minRadius) {
      return { isCircular: false };
    }
    
    const radiusDiff = Math.abs(r1 - r2) / avgRadius;
    if (radiusDiff > radiusTolerance) {
      return { isCircular: false };
    }
    
    // Calculate angles
    const angle1 = Math.atan2(pos1.y, pos1.x);
    const angle2 = Math.atan2(pos2.y, pos2.x);
    
    // Handle angle wrapping to find the shortest angular path
    let angleDiff = angle2 - angle1;
    if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    
    // Check if angular movement is significant enough to warrant circular interpolation
    const minAngleDiff = 0.001; // ~0.06 degrees minimum
    if (Math.abs(angleDiff) < minAngleDiff) {
      return { isCircular: false };
    }
    
    return {
      isCircular: true,
      center: { x: 0, y: 0, z: 0 }, // Assuming rotation around origin
      radius: avgRadius,
      startAngle: angle1,
      endAngle: angle2,
      angleDiff: angleDiff
    };
  }
  
  /**
   * Interpolate position using circular arc (for rotational motion)
   * @param {TemporalVertexState} startState - Starting state
   * @param {TemporalVertexState} endState - Ending state
   * @param {number} t - Interpolation factor (0-1)
   * @param {Object} circularMotion - Circular motion parameters
   * @returns {Object} Interpolated position {x, y, z}
   */
  interpolateCircularPosition(startState, endState, t, circularMotion) {
    // Calculate the interpolated angle along the circular arc
    const interpolatedAngle = circularMotion.startAngle + circularMotion.angleDiff * t;
    
    // Calculate position on the circle
    const x = Math.cos(interpolatedAngle) * circularMotion.radius;
    const y = Math.sin(interpolatedAngle) * circularMotion.radius;
    
    // Linear interpolation for Z coordinate (if any)
    const z = startState.position.z + (endState.position.z - startState.position.z) * t;
    
    return { x, y, z };
  }
  
  /**
   * Linear interpolation between two positions (fallback method)
   * @param {TemporalVertexState} startState - Starting state
   * @param {TemporalVertexState} endState - Ending state
   * @param {number} t - Interpolation factor (0-1)
   * @returns {Object} Interpolated position {x, y, z}
   */
  interpolateLinearPosition(startState, endState, t) {
    return {
      x: startState.position.x + (endState.position.x - startState.position.x) * t,
      y: startState.position.y + (endState.position.y - startState.position.y) * t,
      z: startState.position.z + (endState.position.z - startState.position.z) * t
    };
  }
  
  /**
   * Check if a point crosses the Y axis (x=0, y>0) between two positions
   * Enhanced algorithm with circular motion support for precise detection
   * @param {Object} prevPos - Previous position {x, y, z}
   * @param {Object} currPos - Current position {x, y, z}
   * @param {Object} circularMotion - Optional circular motion parameters
   * @returns {Object} Crossing information {hasCrossed, crossingFactor}
   */
  checkAxisCrossing(prevPos, currPos, circularMotion = null) {
    // Skip if either point is below the X-axis (y <= 0)
    if (prevPos.y <= 0 || currPos.y <= 0) {
      return { hasCrossed: false, crossingFactor: 0 };
    }
    
    // If we have circular motion data, use analytical calculation for better precision
    if (circularMotion && circularMotion.isCircular) {
      const result = this.calculateCircularAxisCrossing(circularMotion);
      
      // Track performance if monitoring is enabled
      if (this.enablePerformanceMonitoring && result.hasCrossed) {
        this.performanceStats.circularCrossings++;
      }
      
      return result;
    }
    
    // Track performance for linear crossings if monitoring is enabled
    let linearResult = null;
    
    // For Y-axis crossing detection, we only care about X coordinate sign changes
    // when both points are above the X-axis (y > 0)
    
    // Case 1: Direct crossing from right to left (x > 0 to x <= 0)
    if (prevPos.x > 0 && currPos.x <= 0) {
      const crossingFactor = prevPos.x / (prevPos.x - currPos.x);
      linearResult = { hasCrossed: true, crossingFactor };
    }
    // Case 2: Direct crossing from left to right (x <= 0 to x > 0)
    else if (prevPos.x <= 0 && currPos.x > 0) {
      const crossingFactor = Math.abs(prevPos.x) / Math.abs(currPos.x - prevPos.x);
      linearResult = { hasCrossed: true, crossingFactor };
    }
    else {
      // Case 3: Analyze using angle changes for rotational motion
      const prevAngle = Math.atan2(prevPos.y, prevPos.x);
      const currAngle = Math.atan2(currPos.y, currPos.x);
      
      // Check if angles straddle the positive Y-axis (π/2 or 90 degrees)
      const isPrevRightQuadrant = prevAngle >= 0 && prevAngle < Math.PI/2;
      const isPrevLeftQuadrant = prevAngle > Math.PI/2 && prevAngle <= Math.PI;
      const isCurrRightQuadrant = currAngle >= 0 && currAngle < Math.PI/2;
      const isCurrLeftQuadrant = currAngle > Math.PI/2 && currAngle <= Math.PI;
      
      // Crossing from left to right quadrant
      if (isPrevLeftQuadrant && isCurrRightQuadrant) {
        const angleDiff = Math.abs(prevAngle - currAngle);
        // Only count if we're not wrapping around the back
        if (angleDiff < Math.PI) {
          const crossingFactor = (prevAngle - Math.PI/2) / (prevAngle - currAngle);
          linearResult = { hasCrossed: true, crossingFactor: Math.min(1, Math.max(0, crossingFactor)) };
        }
      }
      // Crossing from right to left quadrant
      else if (isPrevRightQuadrant && isCurrLeftQuadrant) {
        const angleDiff = Math.abs(prevAngle - currAngle);
        // Only count if we're not wrapping around the back
        if (angleDiff < Math.PI) {
          const crossingFactor = (Math.PI/2 - prevAngle) / (currAngle - prevAngle);
          linearResult = { hasCrossed: true, crossingFactor: Math.min(1, Math.max(0, crossingFactor)) };
        }
      }
    }
    
    // Default to no crossing if none of the above cases matched
    if (!linearResult) {
      linearResult = { hasCrossed: false, crossingFactor: 0 };
    }
    
    // Track performance if monitoring is enabled
    if (this.enablePerformanceMonitoring && linearResult.hasCrossed) {
      this.performanceStats.linearCrossings++;
    }
    
    return linearResult;
  }
  
  /**
   * Calculate exact Y-axis crossing for circular motion analytically
   * @param {Object} circularMotion - Circular motion parameters
   * @returns {Object} Crossing information {hasCrossed, crossingFactor, exactAngle}
   */
  calculateCircularAxisCrossing(circularMotion) {
    const { startAngle, endAngle, angleDiff, radius } = circularMotion;
    
    // Target angle for Y-axis crossing (π/2 or 90 degrees)
    const targetAngle = Math.PI / 2;
    
    // Normalize angles to handle wrapping
    let normalizedStart = startAngle;
    let normalizedEnd = endAngle;
    
    // Handle angle wrapping for continuous motion
    if (angleDiff > 0) {
      // Clockwise rotation - check if we cross π/2
      if (normalizedStart < targetAngle && normalizedEnd > targetAngle) {
        // Direct crossing
        const crossingFactor = (targetAngle - normalizedStart) / angleDiff;
        return {
          hasCrossed: true,
          crossingFactor: Math.max(0, Math.min(1, crossingFactor)),
          exactAngle: targetAngle
        };
      }
      // Check for wrapped crossing (crossing 0 and then π/2)
      if (normalizedStart > targetAngle && normalizedEnd < normalizedStart) {
        // We might have wrapped around - check if we cross π/2 after wrapping
        const wrappedEnd = normalizedEnd + 2 * Math.PI;
        const wrappedTarget = targetAngle + 2 * Math.PI;
        if (wrappedEnd > wrappedTarget) {
          const totalAngle = wrappedEnd - normalizedStart;
          const crossingFactor = (wrappedTarget - normalizedStart) / totalAngle;
          return {
            hasCrossed: true,
            crossingFactor: Math.max(0, Math.min(1, crossingFactor)),
            exactAngle: targetAngle
          };
        }
      }
    } else {
      // Counter-clockwise rotation - check if we cross π/2
      if (normalizedStart > targetAngle && normalizedEnd < targetAngle) {
        // Direct crossing
        const crossingFactor = (normalizedStart - targetAngle) / Math.abs(angleDiff);
        return {
          hasCrossed: true,
          crossingFactor: Math.max(0, Math.min(1, crossingFactor)),
          exactAngle: targetAngle
        };
      }
      // Check for wrapped crossing
      if (normalizedStart < targetAngle && normalizedEnd > normalizedStart) {
        // We might have wrapped around - check if we cross π/2 after wrapping
        const wrappedEnd = normalizedEnd - 2 * Math.PI;
        const wrappedTarget = targetAngle - 2 * Math.PI;
        if (wrappedEnd < wrappedTarget) {
          const totalAngle = Math.abs(normalizedStart - wrappedEnd);
          const crossingFactor = (normalizedStart - wrappedTarget) / totalAngle;
          return {
            hasCrossed: true,
            crossingFactor: Math.max(0, Math.min(1, crossingFactor)),
            exactAngle: targetAngle
          };
        }
      }
    }
    
    return { hasCrossed: false, crossingFactor: 0 };
  }
  
  /**
   * Sample positions along a path at high temporal resolution
   * @param {TemporalVertexState} startState - Starting state
   * @param {TemporalVertexState} endState - Ending state
   * @returns {Array} Array of sampled positions with timestamps
   */
  samplePositionsAlongPath(startState, endState) {
    const samples = [];
    const startTime = startState.timestamp;
    const endTime = endState.timestamp;
    const timeSpan = endTime - startTime;
    
    // Skip if time difference is too small
    if (timeSpan <= this.timeSlice) {
      return samples;
    }
    
    // Skip if time difference is too large (avoid excessive computation)
    const MAX_INTERPOLATION_TIME = 0.1; // 100ms
    if (timeSpan > MAX_INTERPOLATION_TIME) {
      return samples;
    }
    
    // Detect circular motion once for this path segment
    const circularMotion = this.detectCircularMotion(startState, endState);
    
    // Calculate motion speed to determine if we need adaptive sampling
    const pos1 = startState.position;
    const pos2 = endState.position;
    const distance = Math.sqrt(
      (pos2.x - pos1.x) ** 2 + 
      (pos2.y - pos1.y) ** 2 + 
      (pos2.z - pos1.z) ** 2
    );
    const speed = distance / timeSpan; // units per second
    
    // Adaptive sampling: more samples for faster motion or circular motion
    let baseSamples = Math.ceil(timeSpan / this.timeSlice);
    
    // Increase sampling for circular motion to maintain precision
    if (circularMotion.isCircular) {
      const angularSpeed = Math.abs(circularMotion.angleDiff) / timeSpan; // radians per second
      const speedMultiplier = Math.min(2, Math.max(1, angularSpeed / (Math.PI / 2))); // Scale based on angular speed
      baseSamples = Math.ceil(baseSamples * speedMultiplier);
    }
    
    // Calculate number of samples (minimum 2)
    const numSamples = Math.max(2, baseSamples);
    
    // Generate samples using enhanced interpolation
    for (let i = 0; i < numSamples; i++) {
      const t = i / (numSamples - 1);
      const timestamp = startTime + timeSpan * t;
      
      // Use the enhanced interpolation method that automatically chooses
      // between circular and linear interpolation
      const position = this.interpolatePosition(
        { position: pos1 }, 
        { position: pos2 }, 
        t
      );
      
      samples.push({
        position,
        timestamp,
        circularMotion // Include circular motion data for crossing detection
      });
    }
    
    return samples;
  }
  
  /**
   * Detect if a vertex has crossed the Y-axis
   * @param {string} vertexId - Vertex identifier
   * @param {number} cooldownTime - Cooldown time in seconds between triggers
   * @returns {TemporalCrossingResult} Crossing detection result
   */
  detectCrossing(vertexId, cooldownTime = 0) {
    if (!this._initialized) {
      this.initialize();
    }
    
    // Get vertex states
    const states = this.vertexStates.get(vertexId);
    if (!states || states.length < 2) {
      return TemporalCrossingResult.createEmpty();
    }
    
    // Get current time for cooldown check
    const now = this.getCurrentTime();
    
    // Check cooldown
    if (cooldownTime > 0) {
      const lastCrossingTime = this.recentCrossings.get(vertexId) || 0;
      if (now - lastCrossingTime < cooldownTime) {
        // Still in cooldown period
        return TemporalCrossingResult.createEmpty();
      }
    }
    
    // Get last two states
    const currentState = states[states.length - 1];
    const previousState = states[states.length - 2];
    
    // Detect circular motion for enhanced crossing detection
    const circularMotion = this.detectCircularMotion(previousState, currentState);
    
    // Check direct crossing between last two frames
    const directCrossing = this.checkAxisCrossing(
      previousState.position,
      currentState.position,
      circularMotion
    );
    
    if (directCrossing.hasCrossed) {
      // Calculate exact crossing time using interpolation
      const timeSpan = currentState.timestamp - previousState.timestamp;
      const exactTime = previousState.timestamp + timeSpan * directCrossing.crossingFactor;
      
      // Interpolate exact position using enhanced method
      const position = circularMotion.isCircular ?
        this.interpolateCircularPosition(previousState, currentState, directCrossing.crossingFactor, circularMotion) :
        this.interpolateLinearPosition(previousState, currentState, directCrossing.crossingFactor);
      
      // Record crossing time for cooldown
      this.recentCrossings.set(vertexId, now);
      
      // Return crossing result
      return new TemporalCrossingResult(
        true,
        exactTime,
        directCrossing.crossingFactor,
        position,
        false
      );
    }
    
    // If no direct crossing, check for sub-frame crossings
    // (high-resolution sampling between frames)
    const samples = this.samplePositionsAlongPath(previousState, currentState);
    
    // No need to check if insufficient samples
    if (samples.length < 2) {
      return TemporalCrossingResult.createEmpty();
    }
    
    // Check each consecutive pair of samples
    for (let i = 0; i < samples.length - 1; i++) {
      const sample1 = samples[i];
      const sample2 = samples[i + 1];
      
      // Use circular motion data if available from sampling
      const sampleCircularMotion = sample1.circularMotion || null;
      
      const subframeCrossing = this.checkAxisCrossing(
        sample1.position,
        sample2.position,
        sampleCircularMotion
      );
      
      if (subframeCrossing.hasCrossed) {
        // Calculate exact crossing time
        const sampleTimeSpan = sample2.timestamp - sample1.timestamp;
        const exactTime = sample1.timestamp + sampleTimeSpan * subframeCrossing.crossingFactor;
        
        // Interpolate exact position using enhanced method
        const position = sampleCircularMotion && sampleCircularMotion.isCircular ?
          this.interpolateCircularPosition(
            { position: sample1.position },
            { position: sample2.position },
            subframeCrossing.crossingFactor,
            sampleCircularMotion
          ) :
          this.interpolateLinearPosition(
            { position: sample1.position },
            { position: sample2.position },
            subframeCrossing.crossingFactor
          );
        
        // Record crossing time for cooldown
        this.recentCrossings.set(vertexId, now);
        
        // Return crossing result
        return new TemporalCrossingResult(
          true,
          exactTime,
          subframeCrossing.crossingFactor,
          position,
          true
        );
      }
    }
    
    // No crossing detected
    return TemporalCrossingResult.createEmpty();
  }
  
  /**
   * Process all vertices for crossings
   * @param {number} cooldownTime - Cooldown time in seconds
   * @returns {Array} Array of crossing results for all vertices
   */
  processAllVertices(cooldownTime = 0) {
    const results = [];
    
    // Process each vertex
    for (const [vertexId, states] of this.vertexStates.entries()) {
      const result = this.detectCrossing(vertexId, cooldownTime);
      if (result.hasCrossed) {
        results.push({
          vertexId,
          result
        });
      }
    }
    
    return results;
  }
} 