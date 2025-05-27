// src/triggers/SubframeTrigger.js - Frame-rate independent temporal trigger detection engine
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
    
    // State tracking
    this.vertexStates = new Map(); // Maps vertex IDs to arrays of temporal states
    this.vertexLastAccessed = new Map(); // For LRU tracking - Maps vertex IDs to last access timestamp
    this.lastProcessedTime = 0;
    this.recentCrossings = new Map(); // Maps vertex IDs to last crossing time
    this._initialized = false;
    
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
   * Dispose of the engine and clean up resources
   */
  dispose() {
    if (this.cleanupTimerId !== null) {
      clearInterval(this.cleanupTimerId);
      this.cleanupTimerId = null;
    }
    this.clearAllHistory();
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
    
    // Linear interpolation between positions
    return {
      x: startState.position.x + (endState.position.x - startState.position.x) * factor,
      y: startState.position.y + (endState.position.y - startState.position.y) * factor,
      z: startState.position.z + (endState.position.z - startState.position.z) * factor
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
    
    // For Y-axis crossing detection, we only care about X coordinate sign changes
    // when both points are above the X-axis (y > 0)
    
    // Case 1: Direct crossing from right to left (x > 0 to x <= 0)
    if (prevPos.x > 0 && currPos.x <= 0) {
      const crossingFactor = prevPos.x / (prevPos.x - currPos.x);
      return { hasCrossed: true, crossingFactor };
    }
    
    // Case 2: Direct crossing from left to right (x <= 0 to x > 0)
    if (prevPos.x <= 0 && currPos.x > 0) {
      const crossingFactor = Math.abs(prevPos.x) / Math.abs(currPos.x - prevPos.x);
      return { hasCrossed: true, crossingFactor };
    }
    
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
        return { hasCrossed: true, crossingFactor: Math.min(1, Math.max(0, crossingFactor)) };
      }
    }
    
    // Crossing from right to left quadrant
    if (isPrevRightQuadrant && isCurrLeftQuadrant) {
      const angleDiff = Math.abs(prevAngle - currAngle);
      // Only count if we're not wrapping around the back
      if (angleDiff < Math.PI) {
        const crossingFactor = (Math.PI/2 - prevAngle) / (currAngle - prevAngle);
        return { hasCrossed: true, crossingFactor: Math.min(1, Math.max(0, crossingFactor)) };
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
    
    // Calculate number of samples (minimum 2)
    const numSamples = Math.max(2, Math.ceil(timeSpan / this.timeSlice));
    
    // Generate samples
    for (let i = 0; i < numSamples; i++) {
      const t = i / (numSamples - 1);
      const timestamp = startTime + timeSpan * t;
      const position = this.interpolatePosition(startState, endState, t);
      
      samples.push({
        position,
        timestamp
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
    
    // Check direct crossing between last two frames
    const directCrossing = this.checkAxisCrossing(
      previousState.position,
      currentState.position
    );
    
    if (directCrossing.hasCrossed) {
      // Calculate exact crossing time using interpolation
      const timeSpan = currentState.timestamp - previousState.timestamp;
      const exactTime = previousState.timestamp + timeSpan * directCrossing.crossingFactor;
      
      // Interpolate exact position
      const position = this.interpolatePosition(
        previousState,
        currentState,
        directCrossing.crossingFactor
      );
      
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
      
      const subframeCrossing = this.checkAxisCrossing(
        sample1.position,
        sample2.position
      );
      
      if (subframeCrossing.hasCrossed) {
        // Calculate exact crossing time
        const sampleTimeSpan = sample2.timestamp - sample1.timestamp;
        const exactTime = sample1.timestamp + sampleTimeSpan * subframeCrossing.crossingFactor;
        
        // Interpolate exact position
        const position = this.interpolatePosition(
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