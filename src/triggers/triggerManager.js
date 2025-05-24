// src/triggers/triggerManager.js - Unified trigger system management
import { detectTriggers } from './triggers.js';
import { TemporalTriggerEngine, createNoteFromCrossing } from './temporalTriggers.js';

// Default trigger manager configuration
const DEFAULT_CONFIG = {
  useTemporalTriggers: false,
  enableParallelDetection: false,
  enableLogging: true,
  enablePerformanceMonitoring: true,
  cooldownTime: 0.1, // seconds
  temporalConfig: {
    resolution: 1000,    // Hz (1ms resolution)
    maxMemory: 50,       // States to keep in history
    microSteps: 10,      // Micro steps between frames 
    useHighPrecision: true, // Use higher precision algorithms
    trackVelocity: true,    // Track velocity for vertices
    debugMode: false        // Enable detailed debugging
  }
};

// Singleton instance
let triggerManagerInstance = null;

/**
 * TriggerManager - Controls trigger detection strategies and feature flags
 */
export class TriggerManager {
  /**
   * Create a new TriggerManager
   * @param {Object} config - Configuration options
   */
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Feature flags
    this.useTemporalTriggers = this.config.useTemporalTriggers;
    this.enableParallelDetection = this.config.enableParallelDetection;
    this.enableLogging = this.config.enableLogging;
    this.enablePerformanceMonitoring = this.config.enablePerformanceMonitoring;
    
    // Create the temporal engine with configuration
    this.temporalEngine = new TemporalTriggerEngine(this.config.temporalConfig);
    
    // Trigger statistics
    this.triggerStats = {
      originalTriggerCount: 0,
      temporalTriggerCount: 0,
      matchedTriggers: 0,
      unmatchedOriginal: 0,
      unmatchedTemporal: 0,
      timingDifferences: []
    };
    
    // Performance metrics
    this.performanceMetrics = {
      original: { totalTime: 0, calls: 0, maxTime: 0 },
      temporal: { totalTime: 0, calls: 0, maxTime: 0 }
    };
    
    // Comparison logs
    this.comparisonLogs = [];
    
    // Layer state tracking
    this.layerStates = new Map();
    
    // Cooldown time for trigger detection in seconds
    this.cooldownTime = this.config.cooldownTime;
    
    // Trigger matching window (how close in time triggers need to be to be considered a match)
    this.triggerMatchingWindow = 0.1; // seconds
    
    console.log(`[TriggerManager] Initialized with config:`, {
      useTemporalTriggers: this.useTemporalTriggers,
      enableParallelDetection: this.enableParallelDetection,
      cooldownTime: this.cooldownTime
    });
  }
  
  /**
   * Reset the trigger system state
   */
  reset() {
    // Clear temporal engine state
    this.temporalEngine.clearAllHistory();
    this.temporalEngine.resetMetrics();
    
    // Reset stats
    this.triggerStats = {
      originalTriggerCount: 0,
      temporalTriggerCount: 0,
      matchedTriggers: 0,
      unmatchedOriginal: 0,
      unmatchedTemporal: 0,
      timingDifferences: []
    };
    
    // Reset performance metrics
    this.performanceMetrics = {
      original: { totalTime: 0, calls: 0, maxTime: 0 },
      temporal: { totalTime: 0, calls: 0, maxTime: 0 }
    };
    
    // Clear comparison logs
    this.comparisonLogs = [];
    
    // Clear layer states
    this.layerStates.clear();
    
    console.log('[TriggerManager] Trigger system reset');
  }
  
  /**
   * Configure the trigger manager
   * @param {Object} config - Configuration options
   */
  configure(config = {}) {
    // Update configuration
    this.config = { ...this.config, ...config };
    
    // Update feature flags
    if (config.useTemporalTriggers !== undefined) {
      this.useTemporalTriggers = config.useTemporalTriggers;
    }
    
    if (config.enableParallelDetection !== undefined) {
      this.enableParallelDetection = config.enableParallelDetection;
    }
    
    if (config.enableLogging !== undefined) {
      this.enableLogging = config.enableLogging;
    }
    
    if (config.enablePerformanceMonitoring !== undefined) {
      this.enablePerformanceMonitoring = config.enablePerformanceMonitoring;
    }
    
    if (config.cooldownTime !== undefined) {
      this.cooldownTime = config.cooldownTime;
    }
    
    // Update temporal engine configuration if provided
    if (config.temporalConfig) {
      // Create a new engine with updated configuration
      this.temporalEngine = new TemporalTriggerEngine({
        ...this.config.temporalConfig,
        ...config.temporalConfig
      });
    }
    
    console.log('[TriggerManager] Configuration updated:', {
      useTemporalTriggers: this.useTemporalTriggers,
      enableParallelDetection: this.enableParallelDetection,
      cooldownTime: this.cooldownTime
    });
  }
  
  /**
   * Record the current position of vertices for a layer
   * @param {Object} layer - GeoMusica layer
   * @param {number} timestamp - Current time in seconds
   */
  recordLayerState(layer, timestamp) {
    if (!layer || !layer.group || !layer.group.visible) {
      return;
    }
    
    // Skip if the layer doesn't have a proper structure
    if (!layer.group.children || layer.group.children.length < 2) {
      return;
    }
    
    // Get copy groups (all children except the first one)
    const copyGroups = layer.group.children.slice(1);
    
    // Process each copy group
    for (let copyIndex = 0; copyIndex < copyGroups.length; copyIndex++) {
      const copyGroup = copyGroups[copyIndex];
      
      // Skip if copy group doesn't have proper structure
      if (!copyGroup.children || copyGroup.children.length === 0) {
        continue;
      }
      
      // Find LineLoop in the copy group
      const lineLoop = copyGroup.children.find(child => child.type === 'LineLoop');
      
      if (!lineLoop || !lineLoop.geometry) {
        continue;
      }
      
      // Get position attribute
      const positionAttr = lineLoop.geometry.getAttribute('position');
      
      if (!positionAttr) {
        continue;
      }
      
      // Make sure lineLoop has its world matrix updated
      lineLoop.updateMatrixWorld();
      
      // Record each vertex position
      for (let i = 0; i < positionAttr.count; i++) {
        // Get vertex position in local space
        const vertex = new THREE.Vector3();
        vertex.fromBufferAttribute(positionAttr, i);
        
        // Transform to world space
        vertex.applyMatrix4(lineLoop.matrixWorld);
        
        // Create a unique ID for this vertex
        const vertexId = TemporalTriggerEngine.createVertexId(
          layer.id,
          copyIndex,
          i
        );
        
        // Record the position in the temporal engine
        this.temporalEngine.recordVertexPosition(
          vertexId,
          { x: vertex.x, y: vertex.y, z: vertex.z },
          timestamp
        );
      }
    }
  }
  
  /**
   * Detect triggers for a layer using the selected engine
   * @param {Object} layer - GeoMusica layer object
   * @param {number} timestamp - Current time in seconds
   * @param {Function} callback - Callback function for trigger events
   * @returns {Array} Array of detected triggers
   */
  detectLayerTriggers(layer, timestamp, callback) {
    if (!layer || !layer.group || !layer.group.visible) {
      return [];
    }
    
    // Check if we should use parallel detection
    if (this.enableParallelDetection) {
      return this._detectWithBothSystems(layer, timestamp, callback);
    }
    
    // Use selected system based on feature flag
    if (this.useTemporalTriggers) {
      return this._detectWithTemporalSystem(layer, timestamp, callback);
    } else {
      return this._detectWithOriginalSystem(layer, timestamp, callback);
    }
  }
  
  /**
   * Detect triggers using the original frame-based system
   * @param {Object} layer - GeoMusica layer
   * @param {number} timestamp - Current time in seconds
   * @param {Function} callback - Callback function for trigger events
   * @returns {Array} Array of detected triggers
   * @private
   */
  _detectWithOriginalSystem(layer, timestamp, callback) {
    if (this.enablePerformanceMonitoring) {
      const startTime = performance.now();
      
      // Run original detection
      const triggers = detectTriggers(layer, timestamp, callback);
      
      // Update performance metrics
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      this.performanceMetrics.original.totalTime += duration;
      this.performanceMetrics.original.calls++;
      this.performanceMetrics.original.maxTime = 
        Math.max(this.performanceMetrics.original.maxTime, duration);
      
      // Update trigger count
      this.triggerStats.originalTriggerCount += triggers.length;
      
      return triggers;
    } else {
      // Run without performance monitoring
      const triggers = detectTriggers(layer, timestamp, callback);
      
      // Update trigger count
      this.triggerStats.originalTriggerCount += triggers.length;
      
      return triggers;
    }
  }
  
  /**
   * Detect triggers using the enhanced temporal system
   * @param {Object} layer - GeoMusica layer
   * @param {number} timestamp - Current time in seconds
   * @param {Function} callback - Callback function for trigger events
   * @returns {Array} Array of detected triggers
   * @private
   */
  _detectWithTemporalSystem(layer, timestamp, callback) {
    if (!layer || !layer.id) {
      return [];
    }
    
    const startTime = this.enablePerformanceMonitoring ? performance.now() : 0;
    
    // Record the current state of this layer in the temporal engine
    this.recordLayerState(layer, timestamp);
    
    // Get copy groups (all children except the first one)
    const copyGroups = layer.group.children.slice(1);
    const detectedTriggers = [];
    
    // Process each copy group
    for (let copyIndex = 0; copyIndex < copyGroups.length; copyIndex++) {
      const copyGroup = copyGroups[copyIndex];
      
      // Skip if copy group doesn't have proper structure
      if (!copyGroup.children || copyGroup.children.length === 0) {
        continue;
      }
      
      // Find LineLoop in the copy group
      const lineLoop = copyGroup.children.find(child => child.type === 'LineLoop');
      
      if (!lineLoop || !lineLoop.geometry) {
        continue;
      }
      
      // Get position attribute
      const positionAttr = lineLoop.geometry.getAttribute('position');
      
      if (!positionAttr) {
        continue;
      }
      
      // Detect crossings for each vertex
      for (let i = 0; i < positionAttr.count; i++) {
        // Create a unique ID for this vertex
        const vertexId = TemporalTriggerEngine.createVertexId(
          layer.id,
          copyIndex,
          i
        );
        
        // Detect crossing for this vertex
        const crossing = this.temporalEngine.detectCrossing(
          vertexId,
          this.cooldownTime
        );
        
        // If crossing detected, create a note and trigger callback
        if (crossing.hasCrossed) {
          // Calculate the base frequency for this vertex
          const baseFrequency = this._calculateVertexFrequency(layer, i);
          
          // Create the note from crossing result
          const note = createNoteFromCrossing(crossing, {
            frequency: baseFrequency,
            noteName: this._getNoteName(baseFrequency),
            layerId: layer.id,
            vertexIndex: i,
            copyIndex: copyIndex
          }, { 
            quantizeTriggersTo: layer.state?.quantizeTriggersTo 
          });
          
          if (note && callback) {
            callback(note);
          }
          
          if (note) {
            detectedTriggers.push(note);
          }
        }
      }
    }
    
    // Update performance metrics if enabled
    if (this.enablePerformanceMonitoring) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      this.performanceMetrics.temporal.totalTime += duration;
      this.performanceMetrics.temporal.calls++;
      this.performanceMetrics.temporal.maxTime = 
        Math.max(this.performanceMetrics.temporal.maxTime, duration);
    }
    
    // Update trigger count
    this.triggerStats.temporalTriggerCount += detectedTriggers.length;
    
    return detectedTriggers;
  }
  
  /**
   * Detect triggers using both systems in parallel for comparison
   * @param {Object} layer - GeoMusica layer
   * @param {number} timestamp - Current time in seconds
   * @param {Function} callback - Callback function for trigger events
   * @returns {Array} Array of detected triggers (from active system)
   * @private
   */
  _detectWithBothSystems(layer, timestamp, callback) {
    if (!layer || !layer.id) {
      return [];
    }
    
    // Create separate callbacks for each system that also record stats
    const originalTriggers = [];
    const originalCallback = (note) => {
      note.system = 'original';
      note.systemTime = Date.now();
      originalTriggers.push(note);
      
      // Only pass to callback if original system is active
      if (!this.useTemporalTriggers && callback) {
        callback(note);
      }
    };
    
    const temporalTriggers = [];
    const temporalCallback = (note) => {
      note.system = 'temporal';
      note.systemTime = Date.now();
      temporalTriggers.push(note);
      
      // Only pass to callback if temporal system is active
      if (this.useTemporalTriggers && callback) {
        callback(note);
      }
    };
    
    // Detect with both systems
    this._detectWithOriginalSystem(layer, timestamp, originalCallback);
    this._detectWithTemporalSystem(layer, timestamp, temporalCallback);
    
    // Compare trigger results for logging and stats
    if (this.enableLogging) {
      this._compareTriggerResults(layer.id, originalTriggers, temporalTriggers, timestamp);
    }
    
    // Return triggers from the active system
    return this.useTemporalTriggers ? temporalTriggers : originalTriggers;
  }
  
  /**
   * Compare trigger results from both systems for analysis
   * @param {string} layerId - Layer ID
   * @param {Array} originalTriggers - Triggers from original system
   * @param {Array} temporalTriggers - Triggers from temporal system
   * @param {number} timestamp - Current timestamp
   * @private
   */
  _compareTriggerResults(layerId, originalTriggers, temporalTriggers, timestamp) {
    // Skip if either array is empty
    if (originalTriggers.length === 0 && temporalTriggers.length === 0) {
      return;
    }
    
    // Create copies of the arrays to work with
    const originals = [...originalTriggers];
    const temporals = [...temporalTriggers];
    
    // Find matches (triggers that appear in both systems)
    for (let i = 0; i < originals.length; i++) {
      const originalTrig = originals[i];
      
      if (!originalTrig) continue;
      
      // Try to find a matching temporal trigger
      let bestMatchIndex = -1;
      let bestTimeDiff = this.triggerMatchingWindow;
      let bestDistance = Infinity;
      
      for (let j = 0; j < temporals.length; j++) {
        const temporalTrig = temporals[j];
        
        if (!temporalTrig) continue;
        
        // Calculate time difference
        const timeDiff = Math.abs(temporalTrig.time - originalTrig.time);
        
        // Skip if time difference is too large
        if (timeDiff > this.triggerMatchingWindow) {
          continue;
        }
        
        // Calculate spatial distance
        const distance = Math.sqrt(
          Math.pow(temporalTrig.x - originalTrig.x, 2) +
          Math.pow(temporalTrig.y - originalTrig.y, 2)
        );
        
        // Update best match if this is better
        if (timeDiff < bestTimeDiff || 
            (timeDiff === bestTimeDiff && distance < bestDistance)) {
          bestMatchIndex = j;
          bestTimeDiff = timeDiff;
          bestDistance = distance;
        }
      }
      
      // If we found a match
      if (bestMatchIndex >= 0) {
        const temporalTrig = temporals[bestMatchIndex];
        
        // Increment matched count
        this.triggerStats.matchedTriggers++;
        
        // Record timing difference
        this.triggerStats.timingDifferences.push(bestTimeDiff);
        
        // Add to comparison log
        this._addToComparisonLog({
          type: 'match',
          layerId,
          time: timestamp,
          originalTrigger: originalTrig,
          temporalTrigger: temporalTrig,
          distance: bestDistance,
          timeDiff: bestTimeDiff
        });
        
        // Remove the matched trigger from the temporal array
        temporals[bestMatchIndex] = null;
        originals[i] = null;
      }
    }
    
    // Count remaining unmatched triggers
    const unmatchedOriginals = originals.filter(Boolean);
    const unmatchedTemporals = temporals.filter(Boolean);
    
    this.triggerStats.unmatchedOriginal += unmatchedOriginals.length;
    this.triggerStats.unmatchedTemporal += unmatchedTemporals.length;
    
    // Log unmatched triggers
    unmatchedOriginals.forEach(trigger => {
      this._addToComparisonLog({
        type: 'unmatched_original',
        layerId,
        time: timestamp,
        trigger
      });
    });
    
    unmatchedTemporals.forEach(trigger => {
      this._addToComparisonLog({
        type: 'unmatched_temporal',
        layerId,
        time: timestamp,
        trigger
      });
    });
  }
  
  /**
   * Add an entry to the comparison log
   * @param {Object} entry - Log entry
   * @private
   */
  _addToComparisonLog(entry) {
    if (!this.enableLogging) return;
    
    // Add timestamp if not present
    if (!entry.timestamp) {
      entry.timestamp = Date.now();
    }
    
    // Add to log
    this.comparisonLogs.push(entry);
    
    // Limit log size
    const MAX_LOG_SIZE = 1000;
    if (this.comparisonLogs.length > MAX_LOG_SIZE) {
      this.comparisonLogs.shift();
    }
  }
  
  /**
   * Calculate the frequency for a vertex based on layer settings
   * @param {Object} layer - GeoMusica layer
   * @param {number} vertexIndex - Vertex index
   * @returns {number} Frequency in Hz
   * @private
   */
  _calculateVertexFrequency(layer, vertexIndex) {
    if (!layer || !layer.state) {
      return 440; // Default A4 if no layer state
    }
    
    const { segments, useEqualTemperament, referenceFrequency } = layer.state;
    
    // Default values if not specified
    const refFreq = referenceFrequency || 440;
    const totalSegments = segments || 12;
    
    // For equal temperament, use semitone formula
    if (useEqualTemperament) {
      const semitones = (vertexIndex * 12) / totalSegments;
      return refFreq * Math.pow(2, semitones / 12);
    } else {
      // For just intonation, use harmonic ratios
      // Map vertex index to a ratio based on the harmonic series
      const ratio = (vertexIndex + 1) / totalSegments;
      return refFreq * ratio;
    }
  }
  
  /**
   * Get note name from frequency
   * @param {number} frequency - Frequency in Hz
   * @returns {string} Note name (e.g. "A4")
   * @private
   */
  _getNoteName(frequency) {
    if (!frequency) return "Unknown";
    
    // Very simple frequency to note name conversion
    // Just for debugging purposes
    const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
    const a4 = 440;
    const a4Index = 9 + 4 * 12; // A is 9th note, 4th octave
    
    // Calculate semitones from A4
    const semitones = 12 * Math.log2(frequency / a4);
    
    // Calculate note index
    const noteIndex = Math.round(semitones) + a4Index;
    
    // Calculate octave and note
    const octave = Math.floor(noteIndex / 12);
    const note = noteNames[noteIndex % 12];
    
    return `${note}${octave}`;
  }
  
  /**
   * Get current trigger statistics
   * @returns {Object} Trigger statistics with summary
   */
  getTriggerStats() {
    // Copy the stats
    const stats = { ...this.triggerStats };
    
    // Calculate additional stats
    const totalOriginal = stats.originalTriggerCount;
    const totalTemporal = stats.temporalTriggerCount;
    const matched = stats.matchedTriggers;
    const unmatchedOriginal = stats.unmatchedOriginal;
    const unmatchedTemporal = stats.unmatchedTemporal;
    
    // Calculate percentages
    const matchPercentage = totalOriginal + totalTemporal > 0 
      ? Math.round(matched * 200 / (totalOriginal + totalTemporal)) + '%'
      : '0%';
      
    const unmatchedOriginalPercentage = totalOriginal > 0
      ? Math.round(unmatchedOriginal * 100 / totalOriginal) + '%'
      : '0%';
      
    const unmatchedTemporalPercentage = totalTemporal > 0
      ? Math.round(unmatchedTemporal * 100 / totalTemporal) + '%'
      : '0%';
      
    // Calculate average timing difference
    const timingDiffs = stats.timingDifferences;
    const avgTimingDiff = timingDiffs.length > 0
      ? (timingDiffs.reduce((sum, diff) => sum + diff, 0) / timingDiffs.length).toFixed(4) + 's'
      : 'N/A';
    
    // Add summary to stats
    stats.summary = {
      matchPercentage,
      unmatchedOriginalPercentage,
      unmatchedTemporalPercentage,
      averageTimingDifference: avgTimingDiff
    };
    
    return stats;
  }
  
  /**
   * Get performance metrics for both systems
   * @returns {Object} Performance metrics with summary
   */
  getPerformanceMetrics() {
    // Calculate averages
    const origAvgTime = this.performanceMetrics.original.calls > 0
      ? this.performanceMetrics.original.totalTime / this.performanceMetrics.original.calls
      : 0;
      
    const tempAvgTime = this.performanceMetrics.temporal.calls > 0
      ? this.performanceMetrics.temporal.totalTime / this.performanceMetrics.temporal.calls
      : 0;
    
    // Create metrics object
    const metrics = {
      original: {
        avgTime: origAvgTime,
        maxTime: this.performanceMetrics.original.maxTime,
        calls: this.performanceMetrics.original.calls
      },
      temporal: {
        avgTime: tempAvgTime,
        maxTime: this.performanceMetrics.temporal.maxTime,
        calls: this.performanceMetrics.temporal.calls
      }
    };
    
    // Add summary comparing the two
    metrics.summary = {
      difference: tempAvgTime - origAvgTime,
      percentageDifference: origAvgTime > 0
        ? Math.round((tempAvgTime - origAvgTime) * 100 / origAvgTime) + '%'
        : 'N/A'
    };
    
    return metrics;
  }
  
  /**
   * Get recent comparison logs
   * @param {number} count - Number of logs to return
   * @returns {Array} Recent comparison logs
   */
  getRecentComparisonLogs(count = 10) {
    return this.comparisonLogs.slice(-count);
  }
  
  /**
   * Export all comparison logs as JSON
   * @returns {string} JSON string of all logs
   */
  exportComparisonLogs() {
    // Include trigger stats and performance metrics
    const exportData = {
      triggerStats: this.getTriggerStats(),
      performanceMetrics: this.getPerformanceMetrics(),
      logs: this.comparisonLogs
    };
    
    return JSON.stringify(exportData, null, 2);
  }
  
  /**
   * Get temporal engine metrics
   * @returns {Object} Temporal engine metrics
   */
  getTemporalEngineMetrics() {
    return this.temporalEngine.getMetrics();
  }
}

/**
 * Get the singleton instance of TriggerManager
 * @param {Object} config - Optional configuration for first initialization
 * @returns {TriggerManager} Singleton TriggerManager instance
 */
export function getTriggerManager(config) {
  if (!triggerManagerInstance) {
    triggerManagerInstance = new TriggerManager(config);
  }
  return triggerManagerInstance;
}

/**
 * Configure the TriggerManager singleton
 * @param {Object} config - Configuration options
 */
export function configureTriggerManager(config) {
  const manager = getTriggerManager();
  manager.configure(config);
}

/**
 * Reset the TriggerManager singleton
 */
export function resetTriggerSystem() {
  const manager = getTriggerManager();
  manager.reset();
} 