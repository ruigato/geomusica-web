// src/triggers/GeometricSequencer.js - Performance-optimized geometric sequencer with sample-accurate timing

import { getCurrentTime } from '../time/time.js';

/**
 * Performance-optimized music sequencer that calculates exact crossing times for geometric points
 * and schedules musical events with sample-accurate AudioContext timing.
 */
export class GeometricSequencer {
  constructor(config = {}) {
    // ==================================================================================
    // CONFIGURATION OPTIONS
    // ==================================================================================
    
    this.config = {
      // Look-ahead buffer size in seconds (default 50ms)
      lookAheadTime: config.lookAheadTime || 0.05,
      
      // Maximum events in queue to prevent memory bloat
      maxQueueSize: config.maxQueueSize || 10000,
      
      // Precision threshold for timing in seconds (default 1ms)
      timingPrecision: config.timingPrecision || 0.001,
      
      // Enable/disable sequencer vs real-time detection
      useSequencer: config.useSequencer !== undefined ? config.useSequencer : true,
      
      // Event recycling pool size
      eventPoolSize: config.eventPoolSize || 1000,
      
      // Geometry cache size
      cacheSize: config.cacheSize || 100,
      
      // Performance profiling enabled
      enableProfiling: config.enableProfiling || false,
      
      // Batch update delay in milliseconds
      batchUpdateDelay: config.batchUpdateDelay || 16, // ~60fps
    };
    
    // ==================================================================================
    // OPTIMIZED EVENT QUEUE (Binary Search)
    // ==================================================================================
    
    // Priority queue for upcoming trigger events (maintained in sorted order)
    this.eventQueue = [];
    
    // ==================================================================================
    // EVENT RECYCLING POOL
    // ==================================================================================
    
    // Pool of reusable event objects to reduce GC pressure
    this.eventPool = [];
    this.eventPoolMaxSize = this.config.eventPoolSize;
    
    // Pre-populate the event pool
    this.initializeEventPool();
    
    // ==================================================================================
    // GEOMETRY CALCULATION CACHE
    // ==================================================================================
    
    // LRU cache for geometry crossing calculations
    this.geometryCache = new Map();
    this.cacheMaxSize = this.config.cacheSize;
    
    // ==================================================================================
    // BATCH UPDATE SYSTEM
    // ==================================================================================
    
    // Batch parameter changes to reduce recalculation overhead
    this.pendingUpdates = new Set();
    this.batchUpdateTimer = null;
    
    // ==================================================================================
    // PERFORMANCE METRICS
    // ==================================================================================
    
    this.metrics = {
      eventsScheduledPerSecond: 0,
      timingAccuracy: {
        total: 0,
        accurate: 0,
        averageError: 0,
        maxError: 0
      },
      cpuUsage: {
        sequencerTime: 0,
        realTimeDetectionTime: 0,
        lastMeasurement: 0
      },
      cacheStats: {
        hits: 0,
        misses: 0,
        hitRate: 0
      },
      queueStats: {
        averageSize: 0,
        maxSize: 0,
        insertions: 0,
        removals: 0
      },
      eventStats: {
        created: 0,
        recycled: 0,
        poolHits: 0,
        poolMisses: 0
      }
    };
    
    // Performance measurement tracking
    this.performanceWindow = [];
    this.performanceWindowSize = 100;
    
    // ==================================================================================
    // CORE SEQUENCER STATE
    // ==================================================================================
    
    // Current rotation speed in rotations per second
    this.rotationSpeed = 0;
    
    // BPM value for musical timing
    this.bpm = 120;
    
    // Current rotation offset (in radians)
    this.rotationOffset = 0;
    
    // Scheduled events for cleanup
    this.scheduledEvents = new Set();
    
    // Callback for when events should trigger
    this.onTriggerEvent = null;
    
    // Debugging/profiling hooks
    this.onProfileData = null;
    this.debugMode = false;
  }
  
  // ==================================================================================
  // EVENT POOL MANAGEMENT (GC Optimization)
  // ==================================================================================
  
  /**
   * Initialize the event object pool
   */
  initializeEventPool() {
    for (let i = 0; i < this.eventPoolMaxSize; i++) {
      this.eventPool.push(this.createEmptyEvent());
    }
  }
  
  /**
   * Create an empty event object template
   * @returns {Object} Empty event object
   */
  createEmptyEvent() {
    return {
      id: '',
      triggerTime: 0,
      point: { x: 0, y: 0 },
      angle: 0,
      crossingTime: 0,
      scheduled: false,
      layerId: 0,
      vertexIndex: 0,
      recycled: true
    };
  }
  
  /**
   * Get an event object from the pool or create a new one
   * @returns {Object} Event object
   */
  getEventFromPool() {
    if (this.eventPool.length > 0) {
      const event = this.eventPool.pop();
      event.recycled = false;
      this.metrics.eventStats.poolHits++;
      return event;
    } else {
      this.metrics.eventStats.poolMisses++;
      this.metrics.eventStats.created++;
      return this.createEmptyEvent();
    }
  }
  
  /**
   * Return an event object to the pool
   * @param {Object} event - Event object to recycle
   */
  returnEventToPool(event) {
    if (this.eventPool.length < this.eventPoolMaxSize) {
      // Reset the event object
      event.id = '';
      event.triggerTime = 0;
      event.point.x = 0;
      event.point.y = 0;
      event.angle = 0;
      event.crossingTime = 0;
      event.scheduled = false;
      event.layerId = 0;
      event.vertexIndex = 0;
      event.recycled = true;
      
      this.eventPool.push(event);
      this.metrics.eventStats.recycled++;
    }
  }
  
  // ==================================================================================
  // BINARY SEARCH OPTIMIZED EVENT QUEUE
  // ==================================================================================
  
  /**
   * Binary search to find insertion point for an event in the sorted queue
   * @param {Object} event - Event to insert
   * @returns {number} Index where event should be inserted
   */
  findInsertionIndex(event) {
    let left = 0;
    let right = this.eventQueue.length;
    
    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (this.eventQueue[mid].triggerTime <= event.triggerTime) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }
    
    return left;
  }
  
  /**
   * Insert an event into the queue using binary search
   * @param {Object} event - Event to insert
   */
  insertEventOptimized(event) {
    // Check queue size limit
    if (this.eventQueue.length >= this.config.maxQueueSize) {
      console.warn('[SEQUENCER] Event queue at capacity, dropping oldest events');
      this.trimEventQueue();
    }
    
    const insertIndex = this.findInsertionIndex(event);
    this.eventQueue.splice(insertIndex, 0, event);
    
    // Update metrics
    this.metrics.queueStats.insertions++;
    this.metrics.queueStats.maxSize = Math.max(this.metrics.queueStats.maxSize, this.eventQueue.length);
  }
  
  /**
   * Remove expired events from the front of the queue
   * @param {number} currentTime - Current time threshold
   * @returns {Array} Removed events
   */
  removeExpiredEvents(currentTime) {
    const removedEvents = [];
    
    while (this.eventQueue.length > 0 && this.eventQueue[0].triggerTime < currentTime - this.config.timingPrecision) {
      const event = this.eventQueue.shift();
      removedEvents.push(event);
      this.returnEventToPool(event);
      this.metrics.queueStats.removals++;
    }
    
    return removedEvents;
  }
  
  /**
   * Trim the event queue to prevent memory bloat
   */
  trimEventQueue() {
    const trimSize = Math.floor(this.config.maxQueueSize * 0.1); // Remove 10%
    const removedEvents = this.eventQueue.splice(0, trimSize);
    
    // Return removed events to pool
    removedEvents.forEach(event => this.returnEventToPool(event));
    
    console.log(`[SEQUENCER] Trimmed ${trimSize} events from queue`);
  }
  
  // ==================================================================================
  // GEOMETRY CALCULATION CACHE
  // ==================================================================================
  
  /**
   * Generate a cache key for geometry parameters
   * @param {Object} point - Point object
   * @param {number} rotationSpeed - Rotation speed
   * @param {number} rotationOffset - Rotation offset
   * @returns {string} Cache key
   */
  generateCacheKey(point, rotationSpeed, rotationOffset) {
    const precision = 6; // Decimal places for cache key
    return `${point.x.toFixed(precision)},${point.y.toFixed(precision)},${rotationSpeed.toFixed(precision)},${rotationOffset.toFixed(precision)}`;
  }
  
  /**
   * Get cached crossing calculation or compute and cache it
   * @param {Object} point - Point object
   * @param {number} rotationSpeed - Rotation speed
   * @param {number} rotationOffset - Rotation offset
   * @returns {number} Crossing time
   */
  getCachedCrossingTime(point, rotationSpeed, rotationOffset) {
    const cacheKey = this.generateCacheKey(point, rotationSpeed, rotationOffset);
    
    // Check cache first
    if (this.geometryCache.has(cacheKey)) {
      this.metrics.cacheStats.hits++;
      
      // Move to end for LRU
      const value = this.geometryCache.get(cacheKey);
      this.geometryCache.delete(cacheKey);
      this.geometryCache.set(cacheKey, value);
      
      return value;
    }
    
    // Cache miss - calculate and store
    this.metrics.cacheStats.misses++;
    const crossingTime = this.calculateCrossingTimeInternal(point, rotationSpeed, rotationOffset);
    
    // Implement LRU eviction
    if (this.geometryCache.size >= this.cacheMaxSize) {
      const firstKey = this.geometryCache.keys().next().value;
      this.geometryCache.delete(firstKey);
    }
    
    this.geometryCache.set(cacheKey, crossingTime);
    
    // Update cache hit rate
    const totalAccess = this.metrics.cacheStats.hits + this.metrics.cacheStats.misses;
    this.metrics.cacheStats.hitRate = this.metrics.cacheStats.hits / totalAccess;
    
    return crossingTime;
  }
  
  // ==================================================================================
  // BATCH UPDATE SYSTEM
  // ==================================================================================
  
  /**
   * Queue a parameter update for batch processing
   * @param {string} updateType - Type of update
   */
  queueBatchUpdate(updateType) {
    this.pendingUpdates.add(updateType);
    
    // Debounce the batch update
    if (this.batchUpdateTimer) {
      clearTimeout(this.batchUpdateTimer);
    }
    
    this.batchUpdateTimer = setTimeout(() => {
      this.processBatchUpdates();
    }, this.config.batchUpdateDelay);
  }
  
  /**
   * Process all pending batch updates
   */
  processBatchUpdates() {
    if (this.pendingUpdates.size === 0) return;
    
    const startTime = performance.now();
    
    // Process different types of updates
    if (this.pendingUpdates.has('timing') || this.pendingUpdates.has('offset')) {
      this.recalculateEventTimingOptimized();
    }
    
    if (this.pendingUpdates.has('geometry')) {
      // Clear geometry cache when geometry changes
      this.geometryCache.clear();
      this.metrics.cacheStats.hits = 0;
      this.metrics.cacheStats.misses = 0;
    }
    
    // Clear pending updates
    this.pendingUpdates.clear();
    this.batchUpdateTimer = null;
    
    const updateTime = performance.now() - startTime;
    this.recordPerformanceMetric('batchUpdate', updateTime);
    
    if (this.debugMode) {
      console.log(`[SEQUENCER] Batch update completed in ${updateTime.toFixed(2)}ms`);
    }
  }
  
  // ==================================================================================
  // PERFORMANCE METRICS AND PROFILING
  // ==================================================================================
  
  /**
   * Record a performance metric
   * @param {string} operation - Operation name
   * @param {number} duration - Duration in milliseconds
   */
  recordPerformanceMetric(operation, duration) {
    const metric = {
      operation,
      duration,
      timestamp: performance.now()
    };
    
    this.performanceWindow.push(metric);
    
    // Maintain window size
    if (this.performanceWindow.length > this.performanceWindowSize) {
      this.performanceWindow.shift();
    }
    
    // Update specific metrics
    if (operation === 'scheduleGeometry') {
      this.metrics.cpuUsage.sequencerTime += duration;
    } else if (operation === 'realTimeDetection') {
      this.metrics.cpuUsage.realTimeDetectionTime += duration;
    }
  }
  
  /**
   * Measure timing accuracy for an event
   * @param {Object} event - Event that was triggered
   * @param {number} actualTriggerTime - Actual trigger time
   */
  measureTimingAccuracy(event, actualTriggerTime) {
    const error = Math.abs(actualTriggerTime - event.triggerTime);
    
    this.metrics.timingAccuracy.total++;
    
    if (error <= this.config.timingPrecision) {
      this.metrics.timingAccuracy.accurate++;
    }
    
    // Update average error
    const prevAvg = this.metrics.timingAccuracy.averageError;
    const count = this.metrics.timingAccuracy.total;
    this.metrics.timingAccuracy.averageError = (prevAvg * (count - 1) + error) / count;
    
    // Update max error
    this.metrics.timingAccuracy.maxError = Math.max(this.metrics.timingAccuracy.maxError, error);
  }
  
  /**
   * Get current performance statistics
   * @returns {Object} Performance metrics
   */
  getPerformanceMetrics() {
    // Update queue average size
    if (this.metrics.queueStats.insertions > 0) {
      this.metrics.queueStats.averageSize = this.eventQueue.length;
    }
    
    // Calculate events per second
    const recentMetrics = this.performanceWindow.filter(m => 
      performance.now() - m.timestamp < 1000 && m.operation === 'triggerEvent'
    );
    this.metrics.eventsScheduledPerSecond = recentMetrics.length;
    
    return {
      ...this.metrics,
      config: this.config,
      currentQueueSize: this.eventQueue.length,
      cacheSize: this.geometryCache.size,
      eventPoolSize: this.eventPool.length,
      performanceWindow: this.performanceWindow.slice(-10) // Last 10 measurements
    };
  }
  
  /**
   * Enable debug mode for detailed logging
   * @param {boolean} enabled - Whether to enable debug mode
   */
  setDebugMode(enabled) {
    this.debugMode = enabled;
    if (enabled) {
      console.log('[SEQUENCER] Debug mode enabled');
    }
  }
  
  /**
   * Set profiling callback for external monitoring
   * @param {Function} callback - Callback function for profile data
   */
  setProfilingCallback(callback) {
    this.onProfileData = callback;
  }

  // ==================================================================================
  // OPTIMIZED CORE METHODS
  // ==================================================================================

  /**
   * Calculate the angle of a point from the center
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {number} Angle in radians
   */
  calculatePointAngle(x, y) {
    return Math.atan2(y, x);
  }

  /**
   * Internal crossing time calculation (used by cache)
   * @param {Object} point - Point object
   * @param {number} rotationSpeed - Rotation speed
   * @param {number} rotationOffset - Rotation offset
   * @returns {number} Crossing time
   */
  calculateCrossingTimeInternal(point, rotationSpeed, rotationOffset = 0) {
    if (rotationSpeed === 0) {
      return Infinity; // No rotation, no crossing
    }

    const angle = this.calculatePointAngle(point.x, point.y);
    
    // Adjust angle for current rotation offset
    const adjustedAngle = angle - rotationOffset;
    
    // Normalize angle to [0, 2π]
    const normalizedAngle = ((adjustedAngle % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
    
    // Calculate time to reach Y-axis (angle = π/2 or 3π/2)
    // For simplicity, we'll trigger on positive Y-axis crossing (π/2)
    const targetAngle = Math.PI / 2;
    
    let timeToTarget;
    if (normalizedAngle <= targetAngle) {
      // Point hasn't reached target yet in this rotation
      timeToTarget = (targetAngle - normalizedAngle) / (2 * Math.PI * rotationSpeed);
    } else {
      // Point has passed target, calculate time for next rotation
      timeToTarget = (2 * Math.PI - normalizedAngle + targetAngle) / (2 * Math.PI * rotationSpeed);
    }
    
    return timeToTarget;
  }

  /**
   * Calculate the time until a point crosses the Y-axis (optimized with caching)
   * @param {Object} point - Point object with x, y coordinates
   * @param {number} rotationSpeed - Rotation speed in rotations per second
   * @param {number} rotationOffset - Current rotation offset (radians)
   * @returns {number} Time in seconds until Y-axis crossing
   */
  calculateCrossingTime(point, rotationSpeed, rotationOffset = 0) {
    return this.getCachedCrossingTime(point, rotationSpeed, rotationOffset);
  }

  /**
   * Schedule geometry points for triggering (optimized)
   * @param {Array} points - Array of point objects with x, y coordinates
   * @param {number} rotationSpeed - Rotation speed in rotations per second
   * @param {number} startTime - Start time for scheduling (AudioContext time)
   */
  scheduleGeometry(points, rotationSpeed, startTime = null) {
    const scheduleStartTime = performance.now();
    
    if (!points || points.length === 0) {
      return;
    }

    const currentTime = startTime || getCurrentTime();
    this.rotationSpeed = rotationSpeed;
    
    // Clear existing events efficiently
    this.clearOptimized();
    
    // Calculate crossing times for all points using optimized methods
    const events = [];
    
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      const crossingTime = this.calculateCrossingTime(point, rotationSpeed, this.rotationOffset);
      
      if (crossingTime !== Infinity) {
        const triggerTime = currentTime + crossingTime;
        
        // Get event object from pool
        const event = this.getEventFromPool();
        
        // Populate event object
        event.id = `point_${i}_${Date.now()}`;
        event.triggerTime = triggerTime;
        event.point.x = point.x;
        event.point.y = point.y;
        event.angle = this.calculatePointAngle(point.x, point.y);
        event.crossingTime = crossingTime;
        event.scheduled = false;
        event.layerId = point.layerId || 0;
        event.vertexIndex = point.vertexIndex || i;
        
        events.push(event);
      }
    }
    
    // Batch insert events using optimized insertion
    for (const event of events) {
      this.insertEventOptimized(event);
    }
    
    const scheduleTime = performance.now() - scheduleStartTime;
    this.recordPerformanceMetric('scheduleGeometry', scheduleTime);
    
    if (this.debugMode) {
      console.log(`[SEQUENCER] Scheduled ${events.length} events in ${scheduleTime.toFixed(2)}ms`);
    }
  }

  /**
   * Process events that should trigger now (optimized with look-ahead)
   * @param {number} currentTime - Current AudioContext time
   */
  update(currentTime = null) {
    const updateStartTime = performance.now();
    
    const now = currentTime || getCurrentTime();
    const lookAheadTime = now + this.config.lookAheadTime;
    
    // Remove expired events first
    this.removeExpiredEvents(now - this.config.lookAheadTime);
    
    // Process all events that should trigger within the look-ahead window
    const eventsToTrigger = [];
    
    while (this.eventQueue.length > 0 && this.eventQueue[0].triggerTime <= lookAheadTime) {
      const event = this.eventQueue.shift();
      this.metrics.queueStats.removals++;
      
      if (!event.scheduled) {
        eventsToTrigger.push(event);
        event.scheduled = true;
      }
    }
    
    // Schedule events for precise timing
    for (const event of eventsToTrigger) {
      this.scheduleEventOptimized(event, now);
    }
    
    // Schedule recurring events for continuous rotation
    this.scheduleRecurringEventsOptimized(now);
    
    const updateTime = performance.now() - updateStartTime;
    this.recordPerformanceMetric('update', updateTime);
  }

  /**
   * Schedule a single event for precise timing (optimized)
   * @param {Object} event - Event to schedule
   * @param {number} currentTime - Current time for scheduling reference
   */
  scheduleEventOptimized(event, currentTime) {
    const delay = Math.max(0, event.triggerTime - currentTime);
    
    // Use setTimeout for scheduling with millisecond precision
    const timeoutId = setTimeout(() => {
      const actualTriggerTime = getCurrentTime();
      this.triggerEventOptimized(event, actualTriggerTime);
      this.scheduledEvents.delete(timeoutId);
    }, delay * 1000); // Convert to milliseconds
    
    this.scheduledEvents.add(timeoutId);
  }

  /**
   * Trigger a musical event (optimized with metrics)
   * @param {Object} event - Event to trigger
   * @param {number} actualTriggerTime - Actual trigger time
   */
  triggerEventOptimized(event, actualTriggerTime) {
    const triggerStartTime = performance.now();
    
    // Measure timing accuracy
    this.measureTimingAccuracy(event, actualTriggerTime);
    
    if (this.onTriggerEvent && typeof this.onTriggerEvent === 'function') {
      // Pass event data to callback
      this.onTriggerEvent({
        point: event.point,
        angle: event.angle,
        triggerTime: event.triggerTime,
        actualTriggerTime: actualTriggerTime,
        id: event.id,
        layerId: event.layerId,
        vertexIndex: event.vertexIndex
      });
    }
    
    // Return event to pool
    this.returnEventToPool(event);
    
    const triggerTime = performance.now() - triggerStartTime;
    this.recordPerformanceMetric('triggerEvent', triggerTime);
  }

  /**
   * Schedule recurring events for points that will cross the Y-axis multiple times (optimized)
   * @param {number} currentTime - Current time
   */
  scheduleRecurringEventsOptimized(currentTime) {
    if (this.rotationSpeed === 0) return;
    
    // Calculate the period of one full rotation
    const rotationPeriod = 1 / this.rotationSpeed;
    
    // Only process if we have fewer than a threshold of future events
    const futureEvents = this.eventQueue.filter(e => e.triggerTime > currentTime);
    const targetEventCount = Math.min(100, this.config.maxQueueSize * 0.1);
    
    if (futureEvents.length >= targetEventCount) {
      return; // Already have enough future events scheduled
    }
    
    // For performance, only schedule next rotation for existing events
    const recurringEvents = [];
    const lookAheadLimit = currentTime + (rotationPeriod * 2); // 2 rotations ahead
    
    // Look for events that need to be rescheduled for next rotation
    for (const event of this.eventQueue) {
      if (event.triggerTime < currentTime - rotationPeriod) {
        // This event is from a previous rotation, schedule it for the next one
        const nextTriggerTime = event.triggerTime + rotationPeriod;
        
        if (nextTriggerTime <= lookAheadLimit && nextTriggerTime > currentTime) {
          const newEvent = this.getEventFromPool();
          
          // Copy event data
          newEvent.id = `${event.id}_next_${Date.now()}`;
          newEvent.triggerTime = nextTriggerTime;
          newEvent.point.x = event.point.x;
          newEvent.point.y = event.point.y;
          newEvent.angle = event.angle;
          newEvent.crossingTime = event.crossingTime;
          newEvent.scheduled = false;
          newEvent.layerId = event.layerId;
          newEvent.vertexIndex = event.vertexIndex;
          
          recurringEvents.push(newEvent);
        }
      }
    }
    
    // Add recurring events to queue using optimized insertion
    for (const event of recurringEvents) {
      this.insertEventOptimized(event);
    }
  }

  /**
   * Clear all scheduled events (optimized)
   */
  clearOptimized() {
    // Return all events to pool before clearing
    for (const event of this.eventQueue) {
      this.returnEventToPool(event);
    }
    
    // Clear the event queue
    this.eventQueue.length = 0;
    
    // Cancel all scheduled timeouts
    for (const timeoutId of this.scheduledEvents) {
      clearTimeout(timeoutId);
    }
    this.scheduledEvents.clear();
  }

  /**
   * Recalculate timing for all events after parameter changes (optimized)
   */
  recalculateEventTimingOptimized() {
    if (this.eventQueue.length === 0) return;
    
    const recalcStartTime = performance.now();
    const currentTime = getCurrentTime();
    
    // Recalculate crossing times for all events using cached calculations
    for (const event of this.eventQueue) {
      if (!event.scheduled) {
        const newCrossingTime = this.calculateCrossingTime(
          event.point, 
          this.rotationSpeed, 
          this.rotationOffset
        );
        
        if (newCrossingTime !== Infinity) {
          event.triggerTime = currentTime + newCrossingTime;
          event.crossingTime = newCrossingTime;
        }
      }
    }
    
    // Re-sort the queue (events may be out of order after timing changes)
    this.eventQueue.sort((a, b) => a.triggerTime - b.triggerTime);
    
    const recalcTime = performance.now() - recalcStartTime;
    this.recordPerformanceMetric('recalculateTiming', recalcTime);
    
    if (this.debugMode) {
      console.log(`[SEQUENCER] Recalculated timing for ${this.eventQueue.length} events in ${recalcTime.toFixed(2)}ms`);
    }
  }

  // ==================================================================================
  // PUBLIC API (Maintained for Compatibility)
  // ==================================================================================

  /**
   * Clear all scheduled events
   */
  clear() {
    this.clearOptimized();
  }

  /**
   * Update rotation speed and recalculate timing
   * @param {number} bpm - Beats per minute
   */
  setRotationSpeed(bpm) {
    this.bpm = bpm;
    this.rotationSpeed = bpm / 960; // Match existing calculation
    
    // Queue batch update
    this.queueBatchUpdate('timing');
  }

  /**
   * Set rotation offset for phase adjustment
   * @param {number} offset - Rotation offset in radians
   */
  setRotationOffset(offset) {
    this.rotationOffset = offset;
    
    // Queue batch update
    this.queueBatchUpdate('offset');
  }

  /**
   * Set the callback function for trigger events
   * @param {Function} callback - Function to call when events trigger
   */
  setTriggerCallback(callback) {
    this.onTriggerEvent = callback;
  }

  /**
   * Trigger a musical event (legacy method)
   * @param {Object} event - Event to trigger
   */
  triggerEvent(event) {
    this.triggerEventOptimized(event, getCurrentTime());
  }

  /**
   * Get current sequencer status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      eventQueueLength: this.eventQueue.length,
      scheduledEventsCount: this.scheduledEvents.size,
      rotationSpeed: this.rotationSpeed,
      bpm: this.bpm,
      rotationOffset: this.rotationOffset,
      lookAheadTime: this.config.lookAheadTime,
      nextEventTime: this.eventQueue.length > 0 ? this.eventQueue[0].triggerTime : null,
      config: this.config,
      metrics: this.getPerformanceMetrics()
    };
  }

  /**
   * Clean up all scheduled events and reset the sequencer
   */
  dispose() {
    this.clearOptimized();
    this.onTriggerEvent = null;
    this.onProfileData = null;
    
    // Clear batch update timer
    if (this.batchUpdateTimer) {
      clearTimeout(this.batchUpdateTimer);
      this.batchUpdateTimer = null;
    }
    
    // Clear caches
    this.geometryCache.clear();
    this.performanceWindow.length = 0;
    
    this.rotationSpeed = 0;
  }

  // ==================================================================================
  // STATIC UTILITY FUNCTIONS (Maintained for external use)
  // ==================================================================================

  /**
   * Calculate the exact time when a point will cross the Y-axis
   * @param {Object} point - Point object with x, y coordinates
   * @param {number} rotationSpeed - Rotation speed in rotations per second
   * @param {number} currentAngle - Current rotation angle in radians
   * @param {number} startTime - Start time for calculation (AudioContext time)
   * @returns {number|null} Time when point crosses Y-axis, or null if no crossing
   */
  static calculateCrossingTime(point, rotationSpeed, currentAngle = 0, startTime = null) {
    if (!point || rotationSpeed === 0) {
      return null;
    }

    const currentTime = startTime || getCurrentTime();
    
    // Calculate point's current angle relative to center
    const pointAngle = Math.atan2(point.y, point.x);
    
    // Adjust for current rotation angle
    const adjustedAngle = pointAngle + currentAngle;
    
    // Normalize to [0, 2π] range
    const normalizedAngle = ((adjustedAngle % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
    
    // Target angle for Y-axis crossing (positive Y = π/2, negative Y = 3π/2)
    // We'll use positive Y-axis crossing for consistency
    const targetAngle = Math.PI / 2;
    
    // Handle edge case: point exactly on Y-axis
    if (Math.abs(point.x) < 1e-10) {
      // Point is on Y-axis, check if it's rotating through crossing
      if (point.y > 0) {
        // Already at positive Y-axis
        return currentTime;
      } else {
        // On negative Y-axis, will cross in half rotation
        return currentTime + (Math.PI / (2 * Math.PI * rotationSpeed));
      }
    }
    
    // Handle edge case: point never crosses Y-axis (below X-axis with no rotation)
    if (Math.abs(point.y) < 1e-10 && point.x < 0) {
      // Point on negative X-axis, will cross Y-axis in quarter rotation
      return currentTime + (Math.PI / 2) / (2 * Math.PI * rotationSpeed);
    }
    
    // Calculate angular difference to target
    let angleDifference;
    if (normalizedAngle <= targetAngle) {
      // Point hasn't reached target yet in current rotation
      angleDifference = targetAngle - normalizedAngle;
    } else {
      // Point has passed target, calculate for next rotation
      angleDifference = (2 * Math.PI) - normalizedAngle + targetAngle;
    }
    
    // Convert angular difference to time
    const timeToTarget = this.angleToTime(angleDifference, rotationSpeed);
    
    return currentTime + timeToTarget;
  }

  /**
   * Find all Y-axis crossings within the look-ahead time window
   * @param {Object} point - Point object with x, y coordinates
   * @param {number} rotationSpeed - Rotation speed in rotations per second
   * @param {number} lookAheadTime - Time window to look ahead (seconds)
   * @param {number} currentAngle - Current rotation angle in radians
   * @returns {Array} Array of crossing times within the look-ahead window
   */
  static getNextCrossings(point, rotationSpeed, lookAheadTime, currentAngle = 0) {
    if (!point || rotationSpeed === 0 || lookAheadTime <= 0) {
      return [];
    }

    const crossings = [];
    const currentTime = getCurrentTime();
    const endTime = currentTime + lookAheadTime;
    
    // Calculate rotation period (time for one full rotation)
    const rotationPeriod = 1 / rotationSpeed;
    
    // Get first crossing time
    const firstCrossing = this.calculateCrossingTime(point, rotationSpeed, currentAngle, currentTime);
    
    if (firstCrossing === null) {
      return [];
    }
    
    // Add all crossings within the look-ahead window
    let nextCrossingTime = firstCrossing;
    let crossingCount = 0;
    const maxCrossings = Math.ceil(lookAheadTime / (rotationPeriod / 2)) + 1; // Safety limit
    
    while (nextCrossingTime <= endTime && crossingCount < maxCrossings) {
      if (nextCrossingTime >= currentTime) {
        crossings.push({
          time: nextCrossingTime,
          angle: Math.PI / 2, // Y-axis crossing angle
          crossingIndex: crossingCount,
          point: { ...point }
        });
      }
      
      // Calculate next crossing (occurs every half rotation for Y-axis crossings)
      nextCrossingTime += rotationPeriod / 2;
      crossingCount++;
    }
    
    return crossings;
  }

  /**
   * Convert angular difference to time duration
   * @param {number} angleDifference - Angular difference in radians
   * @param {number} rotationSpeed - Rotation speed in rotations per second
   * @returns {number} Time duration in seconds
   */
  static angleToTime(angleDifference, rotationSpeed) {
    if (rotationSpeed === 0) {
      return Infinity;
    }
    
    // Normalize angle difference to positive value
    const normalizedAngle = ((angleDifference % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
    
    // Convert radians per second to time
    const angularVelocity = 2 * Math.PI * rotationSpeed;
    
    return normalizedAngle / angularVelocity;
  }

  /**
   * Check if a point will cross the Y-axis during rotation
   * @param {Object} point - Point object with x, y coordinates
   * @returns {boolean} True if point will cross Y-axis
   */
  static willCrossYAxis(point) {
    if (!point) return false;
    
    // Points exactly on Y-axis are considered crossing
    if (Math.abs(point.x) < 1e-10) {
      return true;
    }
    
    // All points that are not at the origin will cross Y-axis during full rotation
    const distance = Math.sqrt(point.x * point.x + point.y * point.y);
    return distance > 1e-10;
  }

  /**
   * Calculate the angle between two points relative to center
   * @param {Object} point1 - First point
   * @param {Object} point2 - Second point
   * @returns {number} Angular difference in radians
   */
  static calculateAngleBetweenPoints(point1, point2) {
    if (!point1 || !point2) return 0;
    
    const angle1 = Math.atan2(point1.y, point1.x);
    const angle2 = Math.atan2(point2.y, point2.x);
    
    let difference = angle2 - angle1;
    
    // Normalize to [-π, π] range
    while (difference > Math.PI) difference -= 2 * Math.PI;
    while (difference < -Math.PI) difference += 2 * Math.PI;
    
    return difference;
  }

  /**
   * Get the next multiple crossings for a point (positive and negative Y-axis)
   * @param {Object} point - Point object with x, y coordinates
   * @param {number} rotationSpeed - Rotation speed in rotations per second
   * @param {number} lookAheadTime - Time window to look ahead (seconds)
   * @param {number} currentAngle - Current rotation angle in radians
   * @returns {Array} Array of all Y-axis crossings (both positive and negative)
   */
  static getAllYAxisCrossings(point, rotationSpeed, lookAheadTime, currentAngle = 0) {
    if (!point || rotationSpeed === 0 || lookAheadTime <= 0) {
      return [];
    }

    const crossings = [];
    const currentTime = getCurrentTime();
    const endTime = currentTime + lookAheadTime;
    
    // Calculate point's current angle
    const pointAngle = Math.atan2(point.y, point.x);
    const adjustedAngle = pointAngle + currentAngle;
    const normalizedAngle = ((adjustedAngle % (2 * Math.PI)) + (2 * Math.PI)) % (2 * Math.PI);
    
    // Calculate rotation period
    const rotationPeriod = 1 / rotationSpeed;
    
    // Target angles for Y-axis crossings
    const targets = [
      { angle: Math.PI / 2, name: 'positive_y' },     // +Y axis
      { angle: 3 * Math.PI / 2, name: 'negative_y' }  // -Y axis
    ];
    
    // Find all crossings within time window
    for (const target of targets) {
      let angleDifference;
      if (normalizedAngle <= target.angle) {
        angleDifference = target.angle - normalizedAngle;
      } else {
        angleDifference = (2 * Math.PI) - normalizedAngle + target.angle;
      }
      
      let crossingTime = currentTime + this.angleToTime(angleDifference, rotationSpeed);
      let crossingIndex = 0;
      
      // Add all occurrences within look-ahead window
      while (crossingTime <= endTime) {
        if (crossingTime >= currentTime) {
          crossings.push({
            time: crossingTime,
            angle: target.angle,
            type: target.name,
            crossingIndex: crossingIndex,
            point: { ...point }
          });
        }
        
        crossingTime += rotationPeriod;
        crossingIndex++;
      }
    }
    
    // Sort by time
    return crossings.sort((a, b) => a.time - b.time);
  }

}

// Export a singleton instance for convenience
export const geometricSequencer = new GeometricSequencer();

// Make functions globally available for UI integration
if (typeof window !== 'undefined') {
  // Make animation functions available globally (if not already available)
  if (!window.setSequencerMode) {
    // Import animation functions dynamically
    import('../animation/animation.js').then(module => {
      window.setSequencerMode = module.setSequencerMode;
      window.isSequencerMode = module.isSequencerMode;
      console.log('[SEQUENCER] Animation functions imported');
    }).catch(error => {
      console.warn('[SEQUENCER] Could not import animation functions:', error);
    });
  }
  
  // Import geometry functions for global sequencer access
  if (!window.getGlobalSequencer) {
    import('../geometry/geometry.js').then(module => {
      window.getGlobalSequencer = module.getGlobalSequencer;
      window.initializeGlobalSequencer = module.initializeGlobalSequencer;
      window.updateGlobalSequencer = module.updateGlobalSequencer;
      console.log('[SEQUENCER] Geometry functions imported');
    }).catch(error => {
      console.warn('[SEQUENCER] Could not import geometry functions:', error);
    });
  }
}

// Default export
export default GeometricSequencer; 