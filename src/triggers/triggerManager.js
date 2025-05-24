// src/triggers/triggerManager.js - Manager for coordinating different trigger detection systems
import * as THREE from 'three';
import { detectTemporalLayerTriggers, resetTemporalEngine, getTemporalEngine } from './temporalTriggerIntegration.js';
import { detectLayerTriggers as originalDetectLayerTriggers, resetTriggerSystem as originalResetTriggerSystem } from './triggers.js';
import { getCurrentTime } from '../time/time.js';

/**
 * TriggerManager - Manages different trigger detection systems and provides
 * A/B testing, performance monitoring, and comparison logging
 */
export class TriggerManager {
  /**
   * Create a new TriggerManager
   * @param {Object} options - Configuration options
   * @param {boolean} options.useTemporalTriggers - Whether to use temporal trigger engine (default: false)
   * @param {boolean} options.enableParallelDetection - Run both systems in parallel for comparison (default: false)
   * @param {boolean} options.enableLogging - Enable trigger comparison logging (default: false)
   * @param {boolean} options.enablePerformanceMonitoring - Track performance metrics (default: false)
   */
  constructor(options = {}) {
    // Feature flags
    this.useTemporalTriggers = options.useTemporalTriggers || false;
    this.enableParallelDetection = options.enableParallelDetection || false;
    this.enableLogging = options.enableLogging || false;
    this.enablePerformanceMonitoring = options.enablePerformanceMonitoring || false;
    
    // Initialize performance metrics
    this.performanceMetrics = {
      original: {
        totalTime: 0,
        calls: 0,
        avgTime: 0,
        maxTime: 0
      },
      temporal: {
        totalTime: 0,
        calls: 0,
        avgTime: 0,
        maxTime: 0
      }
    };
    
    // Initialize trigger comparison logs
    this.triggerComparisonLogs = [];
    this.maxLogEntries = options.maxLogEntries || 1000;
    
    // Map to track triggered points for comparison
    this.originalTriggeredPoints = new Map();
    this.temporalTriggeredPoints = new Map();
    
    // Statistics
    this.triggerStats = {
      originalTriggerCount: 0,
      temporalTriggerCount: 0,
      matchedTriggers: 0,
      unmatchedOriginal: 0,
      unmatchedTemporal: 0,
      timingDifferences: []
    };
    
    // Initialize the temporal engine if we're using it
    if (this.useTemporalTriggers || this.enableParallelDetection) {
      getTemporalEngine();
    }
    
    console.log(`[TriggerManager] Initialized with mode: ${this.useTemporalTriggers ? 'Temporal' : 'Original'}`);
    if (this.enableParallelDetection) {
      console.log('[TriggerManager] Parallel detection enabled - both systems will run');
    }
  }
  
  /**
   * Enable or disable the temporal trigger system
   * @param {boolean} enabled - Whether to enable temporal triggers
   */
  setTemporalTriggersEnabled(enabled) {
    this.useTemporalTriggers = enabled;
    console.log(`[TriggerManager] ${enabled ? 'Enabled' : 'Disabled'} temporal trigger detection engine`);
  }
  
  /**
   * Check if temporal triggers are enabled
   * @returns {boolean} Whether temporal triggers are enabled
   */
  isTemporalTriggersEnabled() {
    return this.useTemporalTriggers;
  }
  
  /**
   * Enable or disable parallel detection for comparison
   * @param {boolean} enabled - Whether to enable parallel detection
   */
  setParallelDetectionEnabled(enabled) {
    this.enableParallelDetection = enabled;
    console.log(`[TriggerManager] Parallel detection ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Enable or disable trigger comparison logging
   * @param {boolean} enabled - Whether to enable logging
   */
  setLoggingEnabled(enabled) {
    this.enableLogging = enabled;
    console.log(`[TriggerManager] Logging ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Enable or disable performance monitoring
   * @param {boolean} enabled - Whether to enable performance monitoring
   */
  setPerformanceMonitoringEnabled(enabled) {
    this.enablePerformanceMonitoring = enabled;
    console.log(`[TriggerManager] Performance monitoring ${enabled ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Main trigger detection method that routes to appropriate system
   * @param {Object} layer - Layer to detect triggers for
   * @param {number} tNow - Current time
   * @param {Function} audioCallback - Callback function for triggered audio
   * @returns {boolean} True if any triggers were detected
   */
  detectLayerTriggers(layer, tNow, audioCallback) {
    if (this.enableParallelDetection) {
      return this._detectWithBothSystems(layer, tNow, audioCallback);
    }
    
    if (this.useTemporalTriggers) {
      return this._detectWithTemporalSystem(layer, tNow, audioCallback);
    }
    
    return this._detectWithOriginalSystem(layer, tNow, audioCallback);
  }
  
  /**
   * Detect triggers using only the original system
   * @param {Object} layer - Layer to detect triggers for
   * @param {number} tNow - Current time
   * @param {Function} audioCallback - Callback function for triggered audio
   * @returns {boolean} True if any triggers were detected
   * @private
   */
  _detectWithOriginalSystem(layer, tNow, audioCallback) {
    if (this.enablePerformanceMonitoring) {
      const startTime = performance.now();
      
      // Use the original trigger detection system
      const result = originalDetectLayerTriggers(layer, tNow, audioCallback);
      
      const endTime = performance.now();
      this._updatePerformanceMetrics('original', endTime - startTime);
      
      return result;
    }
    
    // Standard call without performance monitoring
    return originalDetectLayerTriggers(layer, tNow, audioCallback);
  }
  
  /**
   * Detect triggers using only the temporal system
   * @param {Object} layer - Layer to detect triggers for
   * @param {number} tNow - Current time
   * @param {Function} audioCallback - Callback function for triggered audio
   * @returns {boolean} True if any triggers were detected
   * @private
   */
  _detectWithTemporalSystem(layer, tNow, audioCallback) {
    if (this.enablePerformanceMonitoring) {
      const startTime = performance.now();
      
      // Use the temporal trigger detection system
      const result = detectTemporalLayerTriggers(layer, tNow, audioCallback);
      
      const endTime = performance.now();
      this._updatePerformanceMetrics('temporal', endTime - startTime);
      
      return result;
    }
    
    // Standard call without performance monitoring
    return detectTemporalLayerTriggers(layer, tNow, audioCallback);
  }
  
  /**
   * Run both trigger detection systems in parallel and compare results
   * Only the system specified by useTemporalTriggers will actually trigger audio
   * @param {Object} layer - Layer to detect triggers for
   * @param {number} tNow - Current time
   * @param {Function} audioCallback - Callback function for triggered audio
   * @returns {boolean} True if any triggers were detected by the active system
   * @private
   */
  _detectWithBothSystems(layer, tNow, audioCallback) {
    // Create wrapper callbacks to track triggered points
    const originalTriggeredPoints = [];
    const temporalTriggeredPoints = [];
    
    const originalWrapperCallback = (note) => {
      // Store this trigger for comparison
      originalTriggeredPoints.push({
        time: tNow,
        exactTime: note.time || tNow,
        x: note.x,
        y: note.y,
        frequency: note.frequency,
        note: { ...note }
      });
      
      this.triggerStats.originalTriggerCount++;
      
      // Only call the actual audio callback if the original system is active
      if (!this.useTemporalTriggers) {
        audioCallback(note);
      }
    };
    
    const temporalWrapperCallback = (note) => {
      // Store this trigger for comparison
      temporalTriggeredPoints.push({
        time: tNow,
        exactTime: note.time || tNow,
        x: note.x,
        y: note.y,
        frequency: note.frequency,
        note: { ...note }
      });
      
      this.triggerStats.temporalTriggerCount++;
      
      // Only call the actual audio callback if the temporal system is active
      if (this.useTemporalTriggers) {
        audioCallback(note);
      }
    };
    
    // Run both systems with performance monitoring if enabled
    let originalResult = false;
    let temporalResult = false;
    
    if (this.enablePerformanceMonitoring) {
      // Measure original system
      const originalStartTime = performance.now();
      originalResult = originalDetectLayerTriggers(layer, tNow, originalWrapperCallback);
      const originalEndTime = performance.now();
      this._updatePerformanceMetrics('original', originalEndTime - originalStartTime);
      
      // Measure temporal system
      const temporalStartTime = performance.now();
      temporalResult = detectTemporalLayerTriggers(layer, tNow, temporalWrapperCallback);
      const temporalEndTime = performance.now();
      this._updatePerformanceMetrics('temporal', temporalEndTime - temporalStartTime);
    } else {
      // Run without performance monitoring
      originalResult = originalDetectLayerTriggers(layer, tNow, originalWrapperCallback);
      temporalResult = detectTemporalLayerTriggers(layer, tNow, temporalWrapperCallback);
    }
    
    // Compare trigger results if logging is enabled
    if (this.enableLogging) {
      this._compareTriggerResults(originalTriggeredPoints, temporalTriggeredPoints, tNow, layer.id);
    }
    
    // Return the result from the active system
    return this.useTemporalTriggers ? temporalResult : originalResult;
  }
  
  /**
   * Compare trigger results between the two systems
   * @param {Array} originalTriggers - Triggers from the original system
   * @param {Array} temporalTriggers - Triggers from the temporal system
   * @param {number} tNow - Current time
   * @param {string} layerId - Layer identifier
   * @private
   */
  _compareTriggerResults(originalTriggers, temporalTriggers, tNow, layerId) {
    const MATCH_THRESHOLD = 20; // Distance threshold for considering triggers as matching
    const TIME_THRESHOLD = 0.1; // Time threshold for considering triggers as matching (100ms)
    
    // Map of matched indices
    const matchedOriginalIndices = new Set();
    const matchedTemporalIndices = new Set();
    
    // Find matching triggers
    for (let i = 0; i < originalTriggers.length; i++) {
      const origTrigger = originalTriggers[i];
      
      for (let j = 0; j < temporalTriggers.length; j++) {
        if (matchedTemporalIndices.has(j)) continue; // Skip already matched temporal triggers
        
        const tempTrigger = temporalTriggers[j];
        
        // Calculate spatial distance
        const distance = Math.sqrt(
          Math.pow(origTrigger.x - tempTrigger.x, 2) + 
          Math.pow(origTrigger.y - tempTrigger.y, 2)
        );
        
        // Calculate time difference
        const timeDiff = Math.abs(
          (tempTrigger.exactTime || tempTrigger.time) - 
          (origTrigger.exactTime || origTrigger.time)
        );
        
        // If they match in position and are reasonably close in time
        if (distance < MATCH_THRESHOLD && timeDiff < TIME_THRESHOLD) {
          matchedOriginalIndices.add(i);
          matchedTemporalIndices.add(j);
          
          this.triggerStats.matchedTriggers++;
          this.triggerStats.timingDifferences.push(timeDiff);
          
          // Only keep the last 1000 timing differences
          if (this.triggerStats.timingDifferences.length > 1000) {
            this.triggerStats.timingDifferences.shift();
          }
          
          // Add to comparison log
          this._addToComparisonLog({
            type: 'match',
            layerId,
            time: tNow,
            originalTrigger: origTrigger,
            temporalTrigger: tempTrigger,
            distance,
            timeDiff
          });
          
          break;
        }
      }
    }
    
    // Log unmatched original triggers
    for (let i = 0; i < originalTriggers.length; i++) {
      if (!matchedOriginalIndices.has(i)) {
        this.triggerStats.unmatchedOriginal++;
        
        this._addToComparisonLog({
          type: 'unmatched_original',
          layerId,
          time: tNow,
          trigger: originalTriggers[i]
        });
      }
    }
    
    // Log unmatched temporal triggers
    for (let j = 0; j < temporalTriggers.length; j++) {
      if (!matchedTemporalIndices.has(j)) {
        this.triggerStats.unmatchedTemporal++;
        
        this._addToComparisonLog({
          type: 'unmatched_temporal',
          layerId,
          time: tNow,
          trigger: temporalTriggers[j]
        });
      }
    }
  }
  
  /**
   * Add an entry to the comparison log
   * @param {Object} entry - Log entry
   * @private
   */
  _addToComparisonLog(entry) {
    this.triggerComparisonLogs.push({
      ...entry,
      timestamp: Date.now()
    });
    
    // Limit log size
    if (this.triggerComparisonLogs.length > this.maxLogEntries) {
      this.triggerComparisonLogs.shift();
    }
  }
  
  /**
   * Update performance metrics for a system
   * @param {string} system - System name ('original' or 'temporal')
   * @param {number} executionTime - Execution time in milliseconds
   * @private
   */
  _updatePerformanceMetrics(system, executionTime) {
    const metrics = this.performanceMetrics[system];
    
    metrics.totalTime += executionTime;
    metrics.calls++;
    metrics.avgTime = metrics.totalTime / metrics.calls;
    metrics.maxTime = Math.max(metrics.maxTime, executionTime);
  }
  
  /**
   * Reset the trigger system
   */
  resetTriggerSystem() {
    // Reset original system
    originalResetTriggerSystem();
    
    // Reset temporal engine
    resetTemporalEngine();
    
    // Reset comparison logs and stats
    if (this.enableLogging) {
      this.triggerComparisonLogs = [];
      this.triggerStats = {
        originalTriggerCount: 0,
        temporalTriggerCount: 0,
        matchedTriggers: 0,
        unmatchedOriginal: 0,
        unmatchedTemporal: 0,
        timingDifferences: []
      };
    }
  }
  
  /**
   * Get performance metrics
   * @returns {Object} Performance metrics for both systems
   */
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      summary: {
        originalAvgTime: this.performanceMetrics.original.avgTime,
        temporalAvgTime: this.performanceMetrics.temporal.avgTime,
        difference: this.performanceMetrics.temporal.avgTime - this.performanceMetrics.original.avgTime,
        percentageDifference: (
          (this.performanceMetrics.temporal.avgTime - this.performanceMetrics.original.avgTime) / 
          this.performanceMetrics.original.avgTime * 100
        ).toFixed(2) + '%'
      }
    };
  }
  
  /**
   * Get trigger comparison statistics
   * @returns {Object} Trigger comparison statistics
   */
  getTriggerStats() {
    const timingDiffs = this.triggerStats.timingDifferences;
    const avgTimingDiff = timingDiffs.length > 0 
      ? timingDiffs.reduce((sum, diff) => sum + diff, 0) / timingDiffs.length 
      : 0;
    
    return {
      ...this.triggerStats,
      summary: {
        totalOriginalTriggers: this.triggerStats.originalTriggerCount,
        totalTemporalTriggers: this.triggerStats.temporalTriggerCount,
        triggerCountDifference: this.triggerStats.temporalTriggerCount - this.triggerStats.originalTriggerCount,
        matchPercentage: this.triggerStats.originalTriggerCount > 0 
          ? (this.triggerStats.matchedTriggers / this.triggerStats.originalTriggerCount * 100).toFixed(2) + '%'
          : '0%',
        averageTimingDifference: avgTimingDiff.toFixed(4) + 's',
        unmatchedOriginalPercentage: this.triggerStats.originalTriggerCount > 0
          ? (this.triggerStats.unmatchedOriginal / this.triggerStats.originalTriggerCount * 100).toFixed(2) + '%'
          : '0%',
        unmatchedTemporalPercentage: this.triggerStats.temporalTriggerCount > 0
          ? (this.triggerStats.unmatchedTemporal / this.triggerStats.temporalTriggerCount * 100).toFixed(2) + '%'
          : '0%'
      }
    };
  }
  
  /**
   * Get recent comparison logs
   * @param {number} count - Number of entries to return (default: 10)
   * @returns {Array} Recent comparison logs
   */
  getRecentComparisonLogs(count = 10) {
    return this.triggerComparisonLogs.slice(-count);
  }
  
  /**
   * Export comparison logs to JSON
   * @returns {string} JSON string containing comparison logs
   */
  exportComparisonLogs() {
    return JSON.stringify({
      timestamp: Date.now(),
      stats: this.getTriggerStats(),
      performance: this.getPerformanceMetrics(),
      logs: this.triggerComparisonLogs
    }, null, 2);
  }
}

// Create a singleton instance
let triggerManagerInstance = null;

/**
 * Get the global TriggerManager instance
 * @param {Object} options - Configuration options
 * @returns {TriggerManager} The TriggerManager instance
 */
export function getTriggerManager(options = {}) {
  if (!triggerManagerInstance) {
    triggerManagerInstance = new TriggerManager(options);
  }
  return triggerManagerInstance;
}

/**
 * Main trigger detection function that routes through TriggerManager
 * @param {Object} layer - Layer to detect triggers for
 * @param {number} tNow - Current time
 * @param {Function} audioCallback - Callback function for triggered audio
 * @returns {boolean} True if any triggers were detected
 */
export function detectLayerTriggers(layer, tNow, audioCallback) {
  const manager = getTriggerManager();
  return manager.detectLayerTriggers(layer, tNow, audioCallback);
}

/**
 * Reset the trigger system through TriggerManager
 */
export function resetTriggerSystem() {
  const manager = getTriggerManager();
  manager.resetTriggerSystem();
}

/**
 * Enable or disable temporal triggers
 * @param {boolean} enabled - Whether to enable temporal triggers
 */
export function setTemporalTriggersEnabled(enabled) {
  const manager = getTriggerManager();
  manager.setTemporalTriggersEnabled(enabled);
}

/**
 * Check if temporal triggers are enabled
 * @returns {boolean} Whether temporal triggers are enabled
 */
export function isTemporalTriggersEnabled() {
  const manager = getTriggerManager();
  return manager.isTemporalTriggersEnabled();
}

/**
 * Configure the TriggerManager with options
 * @param {Object} options - Configuration options
 */
export function configureTriggerManager(options = {}) {
  const manager = getTriggerManager();
  
  if (options.useTemporalTriggers !== undefined) {
    manager.setTemporalTriggersEnabled(options.useTemporalTriggers);
  }
  
  if (options.enableParallelDetection !== undefined) {
    manager.setParallelDetectionEnabled(options.enableParallelDetection);
  }
  
  if (options.enableLogging !== undefined) {
    manager.setLoggingEnabled(options.enableLogging);
  }
  
  if (options.enablePerformanceMonitoring !== undefined) {
    manager.setPerformanceMonitoringEnabled(options.enablePerformanceMonitoring);
  }
} 