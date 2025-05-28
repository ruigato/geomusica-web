// src/triggers/triggers.js - Complete redesign for layer system with subframe precision
import * as THREE from 'three';
import { MARK_LIFE, OVERLAP_THRESHOLD, TICKS_PER_BEAT, TICKS_PER_MEASURE, ANIMATION_STATES, MAX_VELOCITY } from '../config/constants.js';
import { createOrUpdateLabel, createAxisLabel, removeLabel } from '../ui/domLabels.js';
import { getFrequency } from '../geometry/geometry.js';
import { quantizeToEqualTemperament, getNoteName } from '../audio/frequencyUtils.js';
import { 
  getCurrentTime, 
  ticksToSeconds, 
  secondsToTicks, 
  getMeasurePosition 
} from '../time/time.js';
import { createNote } from '../notes/notes.js';
import { TemporalTriggerEngine } from './SubframeTrigger.js';
import { calculateDeletedVertices } from '../geometry/geometry.js';

const DEBUG_PHANTOM_TRIGGERS = true;

// Debug flag to control logging
const DEBUG_LOGGING = false;

// Memory management configurations
const RECENT_TRIGGERS_MAX_AGE = 10; // Time in seconds before a trigger is considered stale
const PENDING_TRIGGERS_MAX_SIZE = 1000; // Maximum number of pending triggers to store
const CLEANUP_INTERVAL = 5000; // Milliseconds between cleanup operations

// Map to track triggered points and prevent re-triggering
const recentTriggers = new Map();

// Store for pending triggers when using quantization
let pendingTriggers = [];

// Singleton instance of the subframe trigger engine with audio timing
const subframeEngine = new TemporalTriggerEngine({
  resolution: 1000, // 1000Hz = 1ms resolution
  maxMemory: 100,
  useAudioTiming: true // Enable audio timing for subframe engine
});

// Initialize the engine
subframeEngine.initialize();

// Expose subframe engine for debugging
if (typeof window !== 'undefined') {
  window._subframeEngine = subframeEngine;
}

// Subframe timing variables - now based on audio sample rate
const POSITION_RECORD_INTERVAL = 1 / 120; // Record positions at max 120Hz for efficiency
const DEFAULT_COOLDOWN_TIME = 0.05; // 50ms default cooldown between triggers

// FIXED: Change from global lastPositionRecordTime to a map keyed by layer ID
// This ensures each layer has its own independent recording schedule
const lastPositionRecordTimes = new Map();

// Setup periodic cleanup timer using audio time
let cleanupTimerId = null;
setupCleanupTimer();

// Register cleanup on window unload to prevent memory leaks
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    disposeTriggerSystem();
  });
}

/**
 * Set up a periodic timer to clean up stale data and prevent memory leaks
 * Now uses audio time for cleanup scheduling
 */
function setupCleanupTimer() {
  // Clear any existing timer
  if (cleanupTimerId !== null) {
    clearInterval(cleanupTimerId);
  }
  
  // Create a new timer that runs periodically
  cleanupTimerId = setInterval(() => {
    const audioTime = getCurrentTime();
    cleanupRecentTriggers(audioTime);
    cleanupPendingTriggers(audioTime);
  }, CLEANUP_INTERVAL);
}

/**
 * Remove stale entries from recentTriggers map to prevent memory leaks
 * @param {number} audioTime Current audio time in seconds
 */
function cleanupRecentTriggers(audioTime) {
  // Remove entries older than RECENT_TRIGGERS_MAX_AGE
  for (const [key, data] of recentTriggers.entries()) {
    if (audioTime - data.time > RECENT_TRIGGERS_MAX_AGE) {
      recentTriggers.delete(key);
    }
  }
}

/**
 * Clean up executed or excess entries from pendingTriggers array
 * @param {number} audioTime Current audio time in seconds
 */
function cleanupPendingTriggers(audioTime) {
  // Remove already executed triggers (with some margin)
  pendingTriggers = pendingTriggers.filter(trigger => 
    trigger.executeTime > audioTime - 1 // Keep triggers from the last second in case of processing delays
  );
  
  // If still too large, keep only the most recent triggers
  if (pendingTriggers.length > PENDING_TRIGGERS_MAX_SIZE) {
    // Sort by execution time if not already sorted
    pendingTriggers.sort((a, b) => a.executeTime - b.executeTime);
    
    // Trim to maximum size
    pendingTriggers = pendingTriggers.slice(0, PENDING_TRIGGERS_MAX_SIZE);
  }
}

/**
 * Calculate distance between two points in 2D space
 * @param {number} x1 First point x coordinate
 * @param {number} y1 First point y coordinate
 * @param {number} x2 Second point x coordinate
 * @param {number} y2 Second point y coordinate
 * @returns {number} Distance between points
 */
function distanceBetweenPoints(x1, y1, x2, y2) {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

/**
 * Check if a point is too close to any existing active points
 * @param {number} x Point x coordinate
 * @param {number} y Point y coordinate
 * @param {Array<Object>} activePoints Array of already active points
 * @returns {boolean} True if point is overlapping with existing points
 */
function isPointOverlapping(x, y, activePoints) {
  if (!activePoints || activePoints.length === 0) return false;
  
  for (const point of activePoints) {
    const distance = distanceBetweenPoints(x, y, point.x, point.y);
    if (distance < OVERLAP_THRESHOLD) return true;
  }
  
  return false;
}

/**
 * Calculate a frequency based on position and state
 * @param {number} x X coordinate in local space 
 * @param {number} y Y coordinate in local space
 * @param {Object} state Application state
 * @returns {Object} Frequency data object
 */
function calculateFrequency(x, y, state) {
  // Safety check for invalid inputs
  if (isNaN(x) || isNaN(y) || x === undefined || y === undefined) {
    
    // Return a safe default
    return {
      frequency: 440, // Default to A4
      noteName: "A4",
      angle: 0,
      distance: 100
    };
  }
  
  // Calculate distance from origin (0,0)
  const distance = Math.sqrt(x*x + y*y);
  
  // If distance calculation resulted in NaN or is zero, use a safe default
  if (isNaN(distance) || distance === 0) {
    
    return {
      frequency: 440, // Default to A4
      noteName: "A4",
      angle: 0,
      distance: 100
    };
  }
  
  // Base frequency calculation (higher for points further from center)
  let frequency = distance * 2;
  
  // Calculate angle from center (for tonal variation)
  const angle = Math.atan2(y, x);
  
  // Ensure frequency is not NaN
  if (isNaN(frequency)) {
    
    frequency = 440; // Default to A4
  }
  
  // Limit to reasonable audio range (80-1000 Hz)
  frequency = Math.max(80, Math.min(1000, frequency));
  
  // Process through equal temperament if enabled (check global state)
  let noteName = null;
  const globalState = window._globalState;
  if (globalState && globalState.useEqualTemperament) {
    // Get reference frequency with safe default
    const refFreq = (globalState.referenceFrequency && !isNaN(globalState.referenceFrequency)) 
      ? globalState.referenceFrequency 
      : 440;
    
    try {
      frequency = quantizeToEqualTemperament(frequency, refFreq);
      noteName = getNoteName(frequency, refFreq);
    } catch (e) {
      // If quantization fails, use unquantized frequency
      
    }
  }
  
  // Final safety check - if after all processing frequency is still NaN, use default
  if (isNaN(frequency)) {
    
    frequency = 440;
    noteName = "A4";
  }
  
  return { 
    frequency, 
    noteName,
    angle,
    distance
  };
}

/**
 * Store a trigger for future execution when using quantization
 * @param {Object} triggerInfo - Trigger information
 * @param {number} quantizedTime - Time when trigger should execute
 */
function storePendingTrigger(triggerInfo, quantizedTime) {
  // Clean up executed triggers before adding new ones to avoid overflow
  cleanupPendingTriggers();
  
  // Check if we've reached the maximum size limit
  if (pendingTriggers.length >= PENDING_TRIGGERS_MAX_SIZE) {
    // Log warning about hitting the limit
    console.warn(`Pending triggers limit (${PENDING_TRIGGERS_MAX_SIZE}) reached. Some triggers may be lost.`);
    return; // Skip adding this trigger
  }
  
  // Create deep copy of trigger info to prevent reference issues
  const storedInfo = {
    ...triggerInfo,
    executeTime: quantizedTime,
    note: triggerInfo.note ? {...triggerInfo.note} : null
  };
  
  pendingTriggers.push(storedInfo);
  
  // Sort pending triggers by execution time
  pendingTriggers.sort((a, b) => a.executeTime - b.executeTime);
}

/**
 * Process any pending triggers that should now be executed
 * Enhanced for high BPM precision timing using AudioContext
 * @param {number} audioTime Current audio time in seconds
 * @param {Function} audioCallback Callback to execute triggers
 * @param {Object} scene Scene for creating visual markers
 */
export function processPendingTriggers(audioTime, audioCallback, scene) {
  if (pendingTriggers.length === 0) return;
  
  // Find triggers that should be executed with enhanced precision
  const triggersToExecute = [];
  const tolerance = 0.001; // Reduced to 1ms tolerance for better audio timing precision
  
  while (pendingTriggers.length > 0 && pendingTriggers[0].executeTime <= audioTime + tolerance) {
    triggersToExecute.push(pendingTriggers.shift());
  }
  
  // Execute the triggers with audio timing compensation
  for (const trigger of triggersToExecute) {
    const { note, worldRot, executeTime, camera, renderer, isQuantized, layer } = trigger;
    
    if (note) {
      // Make a deep copy of the note to ensure we're not modifying the original
      const noteCopy = { ...note };
      noteCopy.time = executeTime;
      
      // Add timing information for debugging high BPM issues
      const timingDelta = Math.abs(audioTime - executeTime);
      if (timingDelta > 0.001) { // Log if more than 1ms off
        if (DEBUG_LOGGING) {
          console.log(`[AUDIO TIMING] Trigger timing delta: ${timingDelta * 1000}ms`);
        }
      }
      
      // IMPORTANT: Send the complete note object copy with precise audio timing
      audioCallback(noteCopy);
      
      // Create a marker with visual feedback
      if (scene && worldRot !== undefined && noteCopy.frequency !== undefined) {
        createMarker(worldRot, noteCopy.x, noteCopy.y, scene, noteCopy, camera, renderer, isQuantized, layer);
      }
    }
  }
  
  // After processing, clean up any remaining stale triggers
  if (pendingTriggers.length > 0) {
    cleanupPendingTriggers(audioTime);
  }
}

/**
 * Determine if we should trigger immediately or schedule for later
 * @param {number} tNow - Current time in seconds
 * @param {Object} state - Application state
 * @param {Object} triggerInfo - Information about the trigger
 * @returns {Object} Decision object with shouldTrigger and triggerInfo
 */
function handleQuantizedTrigger(tNow, state, triggerInfo) {
  // If quantization is not enabled, trigger immediately
  if (!state || !state.useQuantization) {
    return { 
      shouldTrigger: true,
      triggerTime: tNow,
      isQuantized: false
    };
  }
  
  // Get the BPM - try from global state first, then local state
  const bpm = state.globalState?.bpm || state.bpm || 120;
  
  // Convert current time to ticks
  const currentTicks = secondsToTicks(tNow, bpm);
  
  // Get quantization settings
  const quantizationValue = state.quantizationValue || "1/4";
  const gridTicks = parseQuantizationValue(quantizationValue);
  
  // Quantize to the nearest grid point
  const quantizedTicks = quantizeToGrid(currentTicks, gridTicks);
  const quantizedTime = ticksToSeconds(quantizedTicks, bpm);
  
  // Calculate distance to quantized point in seconds
  const distanceSeconds = Math.abs(quantizedTime - tNow);
  
  // Calculate a tolerance window based on the grid size
  const gridSizeInSeconds = ticksToSeconds(gridTicks, bpm);
  const toleranceWindow = Math.min(0.03, gridSizeInSeconds * 0.1); // 10% of grid size or 30ms max
  
  // If we're very close to a quantized point, trigger now
  if (distanceSeconds < toleranceWindow) {
    return {
      shouldTrigger: true,
      triggerTime: quantizedTime,
      isQuantized: true
    };
  }
  
  // Create a deep copy of the trigger info to prevent reference issues
  const triggerInfoCopy = {
    ...triggerInfo,
    note: triggerInfo.note ? {...triggerInfo.note} : null
  };
  
  // If the quantized time is in the future
  if (quantizedTime > tNow) {
    // Schedule the trigger for the future
    storePendingTrigger(triggerInfoCopy, quantizedTime);
    
    // Don't trigger now
    return {
      shouldTrigger: false,
      triggerTime: null,
      isQuantized: true,
      scheduledFor: quantizedTime
    };
  }
  
  // If the quantized time is in the past, find the next grid point
  const nextGridTicks = quantizedTicks + gridTicks;
  const nextGridTime = ticksToSeconds(nextGridTicks, bpm);
  
  // Schedule the trigger for the next grid point
  storePendingTrigger(triggerInfoCopy, nextGridTime);
  
  // Don't trigger now
  return {
    shouldTrigger: false,
    triggerTime: null,
    isQuantized: true,
    scheduledFor: nextGridTime
  };
}

/**
 * Parse a quantization value and convert to ticks
 * @param {string} quantValue - Quantization value (e.g., "1/4", "1/8T")
 * @param {number} measureTicks - Ticks per measure
 * @returns {number} Ticks per quantization unit
 */
function parseQuantizationValue(quantValue, measureTicks = TICKS_PER_MEASURE) {
  if (!quantValue) return TICKS_PER_BEAT; // Default to quarter notes
  
  // Check if it's a triplet
  const isTriplet = quantValue.endsWith('T');
  
  // Get the denominator (4 for quarter notes, 8 for eighth notes, etc.)
  const denominator = parseInt(quantValue.replace('1/', '').replace('T', ''));
  
  if (isNaN(denominator) || denominator <= 0) {
    return TICKS_PER_BEAT; // Default to quarter notes
  }
  
  // Calculate the number of ticks
  if (isTriplet) {
    // For triplets, divide by 3 to get 3 notes where 2 would normally fit
    return Math.round((measureTicks / denominator) * (2/3));
  } else {
    return measureTicks / denominator;
  }
}

/**
 * Quantize time to nearest grid point
 * @param {number} timeTicks - Time in ticks
 * @param {number} gridTicks - Grid size in ticks
 * @returns {number} Quantized time in ticks
 */
function quantizeToGrid(timeTicks, gridTicks) {
  if (gridTicks <= 0) return timeTicks;
  
  // Find the nearest grid point
  const gridIndex = Math.round(timeTicks / gridTicks);
  return gridIndex * gridTicks;
}

/**
 * Create a visual marker at the crossing point
 * @param {number} angle Current rotation angle
 * @param {number} worldX X coordinate in world space
 * @param {number} worldY Y coordinate in world space
 * @param {THREE.Scene} scene Scene to add marker to
 * @param {Object} note Note information
 * @param {THREE.Camera} camera Camera for label positioning
 * @param {THREE.WebGLRenderer} renderer Renderer for label positioning
 * @param {boolean} isQuantized Whether the trigger was quantized
 * @param {Object} layer Layer object
 * @returns {Object} Created marker
 */
export function createMarker(angle, worldX, worldY, scene, note, camera = null, renderer = null, isQuantized = false, layer = null) {
  // Determine where to store the marker
  let markersArray = null;
  
  // First priority: use the provided layer
  if (layer && Array.isArray(layer.markers)) {
    markersArray = layer.markers;
  }
  // Second priority: get active layer from scene
  else if (scene && scene._layerManager && scene._layerManager.getActiveLayer()) {
    const activeLayer = scene._layerManager.getActiveLayer();
    if (!activeLayer.markers) {
      activeLayer.markers = [];
    }
    markersArray = activeLayer.markers;
  }
  // Last resort: use scene's userData
  else if (scene) {
    if (!scene.userData.markers) {
      scene.userData.markers = [];
    }
    markersArray = scene.userData.markers;
  }
  
  // If we couldn't find a place to store markers, log error and return
  if (!markersArray) {
    console.error("Could not find a place to store markers");
    return null;
  }
  
  const frequency = note.frequency;
  const duration = note.duration;
  const velocity = note.velocity;
  
  // Create the marker
  const markerGeom = new THREE.SphereGeometry(8, 8, 8);
  
  // Create a semi-transparent material for the marker
  // Use a different color for quantized triggers to provide visual feedback
  let markerColor;
  if (layer && layer.color) {
    // Use the layer's color, potentially brightened for quantized triggers
    if (isQuantized) {
      // Create a brighter version of the layer color for quantized triggers
      markerColor = layer.color.clone().multiplyScalar(1.5);
    } else {
      markerColor = layer.color;
    }
  } else {
    // Fallback to default colors if no layer or layer has no color
    markerColor = isQuantized ? 0x00ff00 : 0xff00ff;
  }
  
  // Scale marker size based on duration
  const baseSize = 8;
  const markerSize = baseSize * (0.5 + duration);
  
  const markerMat = new THREE.MeshBasicMaterial({
    color: markerColor,
    transparent: true,
    opacity: velocity, // Set opacity based on velocity
    depthTest: false
  });
  
  // Scale the geometry based on note duration
  markerGeom.scale(markerSize / baseSize, markerSize / baseSize, markerSize / baseSize);
  
  // Create the mesh
  const markerMesh = new THREE.Mesh(markerGeom, markerMat);
  
  // Position directly using world coordinates - no rotation needed
  markerMesh.position.set(worldX, worldY, 5); // Slightly in front
  
  // Add to scene
  scene.add(markerMesh);
  
  // Create text label if frequency is provided and axis labels are enabled
  let textLabel = null;
  if (frequency !== null && layer && layer.state && layer.state.showAxisFreqLabels !== false) {
    // Make sure we have camera and renderer for creating labels
    if (!camera || !renderer) {
      // Try to get them from scene if available
      if (scene) {
        // Try to get from scene userData
        camera = scene.userData?.camera;
        renderer = scene.userData?.renderer;
        
        // Try layer's group if not in scene
        if ((!camera || !renderer) && layer.group) {
          camera = layer.group.userData?.camera;
          renderer = layer.group.userData?.renderer;
        }
        
        // Use layer's helper method if available
        if ((!camera || !renderer) && typeof layer.ensureCameraAndRenderer === 'function') {
          const result = layer.ensureCameraAndRenderer();
          camera = result.camera;
          renderer = result.renderer;
        }
      }
    }
    
    // If we have camera and renderer, create label
    if (camera && renderer) {
      // Format frequency with appropriate display
      let displayText;
      
      // Check global state for equal temperament display
      const globalState = window._globalState;
      if (globalState && globalState.useEqualTemperament && note.noteName) {
        // Add a "Q" prefix for quantized triggers for visual feedback
        const qPrefix = isQuantized ? "Q " : "";
        displayText = `${qPrefix}${frequency.toFixed(1)}Hz (${note.noteName}) ${duration.toFixed(2)}s`;
      } else {
        // Just show frequency in free temperament mode
        // Add a "Q" prefix for quantized triggers
        const qPrefix = isQuantized ? "Q " : "";
        displayText = `${qPrefix}${frequency.toFixed(2)}Hz ${duration.toFixed(2)}s`;
      }
      
      // Create a unique ID for this temporary label
      const labelId = `axis-${Math.random().toString(36).substr(2, 9)}`;
      
      // Create axis crossing label - use world coordinates directly
      const worldPosition = new THREE.Vector3(worldX, worldY, 5);
      
      // Use the layer's color for the label if available
      const labelColor = layer && layer.color ? layer.color : null;
      
      // Create the axis label - use 1 second lifespan
      textLabel = createAxisLabel(labelId, worldPosition, displayText, camera, renderer, 1.0, labelColor);
    }
  }
  
  // Add to markers array with life value and animation state
  const marker = {
    mesh: markerMesh,
    textLabel: textLabel,
    life: MARK_LIFE,
    originalLife: MARK_LIFE,
    animState: ANIMATION_STATES.IDLE,
    isQuantized: isQuantized,
    noteInfo: {
      frequency,
      duration,
      velocity
    },
    justHit: false,
    velocity: 0,
    pan: note.pan || 0,
    frequency: frequency,
    // Store position for updating
    position: new THREE.Vector3(worldX, worldY, 5),
    // Keep track of which layer this marker belongs to
    layerId: layer ? layer.id : (scene._layerManager ? scene._layerManager.activeLayerId : null),
    createdAt: performance.now()
  };
  
  // Add the marker to the appropriate array
  markersArray.push(marker);
  
  return marker;
}

/**
 * Reset the trigger system - call when geometry changes
 */
export function resetTriggerSystem() {
  // Clear all collections completely
  recentTriggers.clear();
  pendingTriggers = [];
  
  // Also reset the subframe engine
  if (subframeEngine) {
    subframeEngine.clearAllHistory();
  }
  
  // Reset timers and restart cleanup
  if (cleanupTimerId !== null) {
    clearInterval(cleanupTimerId);
    cleanupTimerId = null;
  }
  setupCleanupTimer();
  
  // FIXED: Reset the layer-specific position record times
  lastPositionRecordTimes.clear();
}

/**
 * Completely dispose of the trigger system and free resources
 * Call this when the application is shutting down or when
 * the trigger system is no longer needed
 */
export function disposeTriggerSystem() {
  // Clear all collections
  recentTriggers.clear();
  pendingTriggers = [];
  
  // Dispose of the subframe engine
  if (subframeEngine) {
    subframeEngine.dispose();
  }
  
  // Clear any timers
  if (cleanupTimerId !== null) {
    clearInterval(cleanupTimerId);
    cleanupTimerId = null;
  }
}

/**
 * Check if axis crossing occurred between two positions, with enhanced detection for high BPM
 * @param {number} prevX Previous X position
 * @param {number} prevY Previous Y position
 * @param {number} currX Current X position
 * @param {number} currY Current Y position
 * @returns {Object} Object with hasCrossed boolean and interpolation factor
 */
function checkEnhancedAxisCrossing(prevX, prevY, currX, currY) {
  // Basic case: point crosses from right to left and is above X-axis
  if (prevX > 0 && currX <= 0 && currY > 0) {
    // Calculate the exact interpolation factor where crossing occurred
    const crossingFactor = prevX / (prevX - currX);
    return { hasCrossed: true, crossingFactor };
  }
  
  // Handle large angle changes with enhanced detection
  if (currY > 0) {
    const prevAngleFromYAxis = Math.atan2(prevX, prevY);
    const currAngleFromYAxis = Math.atan2(currX, currY);
    
    if (Math.sign(prevAngleFromYAxis) > 0 && Math.sign(currAngleFromYAxis) <= 0) {
      const angleDiff = Math.abs(prevAngleFromYAxis - currAngleFromYAxis);
      if (angleDiff < Math.PI) {
        // Calculate approximate crossing factor based on angle progression
        const crossingFactor = Math.abs(prevAngleFromYAxis) / angleDiff;
        return { hasCrossed: true, crossingFactor };
      }
    }
  }
  
  return { hasCrossed: false, crossingFactor: 0 };
}

// DEPRECATED: detectIntersectionTriggers function removed - now handled by unified trigger system

/**
 * Detect audio triggers for a layer with subframe precision
 * @param {Object} layer Layer to detect triggers for
 * @param {number} tNow Current time in seconds
 * @param {Function} audioCallback Callback function for triggered audio
 * @returns {boolean} True if any triggers were detected
 */
export function detectLayerTriggers(layer, tNow, audioCallback) {
  // Validation checks
  if (!layer) {
    return false;
  }
  
  // Get layer data
  const state = layer.state;
  const group = layer.group;
  
  // FIXED: Early return for layers with 0 copies to prevent any trigger processing
  if (!state || state.copies <= 0) {
    return false;
  }
  
  // Skip processing if group is not visible
  if (!group.visible) {
    return false;
  }
  
  // FIXED: Ensure trigger detection works properly for all layers
  // Force-set layerId in userData to ensure correct layer identification
  if (group.userData) {
    group.userData.layerId = layer.id;
    
    // Also ensure we have a stateId reference
    if (group.userData.stateId === undefined || group.userData.stateId !== layer.id) {
      group.userData.stateId = layer.id;
    }
  }
  
  // Initialize trigger rate limiting for lerping if needed
  if (!layer._triggersTimestamps) {
    layer._triggersTimestamps = new Map();
  }
  
  // Check if lerping is active
  const isLerping = state && state.isLerping && typeof state.isLerping === 'function' && state.isLerping();
  
  // Ensure lastTrig set exists
  if (!layer.lastTrig) layer.lastTrig = new Set();
  
  // Get the scene from the group's parent
  const scene = group.parent;
  if (!scene) {
    return false;
  }
  
  // Get camera and renderer from multiple possible sources
  let camera = scene?.userData?.camera;
  let renderer = scene?.userData?.renderer;
  
  // Try to get camera and renderer from layer's group if not found in scene
  if (!camera || !renderer) {
    camera = layer.group?.userData?.camera;
    renderer = layer.group?.userData?.renderer;
    
    // Try layer's ensureCameraAndRenderer method as a last resort
    if ((!camera || !renderer) && typeof layer.ensureCameraAndRenderer === 'function') {
      const result = layer.ensureCameraAndRenderer();
      camera = result.camera;
      renderer = result.renderer;
      
      // Cache the results if they were found
      if (camera && renderer) {
        scene.userData.camera = camera;
        scene.userData.renderer = renderer;
      }
    }
  }
  
  // Skip if geometry was just created (avoid false triggers)
  if (layer.baseGeo && layer.baseGeo.userData && layer.baseGeo.userData.createdAt) {
    const timeSinceCreation = Date.now() - layer.baseGeo.userData.createdAt;
    const GEOMETRY_GRACE_PERIOD = 100; // 100ms grace period
    
    if (timeSinceCreation < GEOMETRY_GRACE_PERIOD) {
      return false;
    }
  }
  
  // FRACTAL BUG FIX: Skip triggers during fractal geometry transitions
  // When fractal mode is enabled/disabled, there's a brief period where the baseGeo
  // doesn't match the current fractal state, causing phantom triggers
  if (state.useFractal && layer.baseGeo && layer.baseGeo.userData) {
    const geometryInfo = layer.baseGeo.userData.geometryInfo;
    const currentFractalLevel = state.fractalValue || 1;
    const geometryFractalLevel = geometryInfo?.fractalLevel || 1;
    
    // If fractal levels don't match, skip triggers until geometry is updated
    if (currentFractalLevel !== geometryFractalLevel) {
      return false;
    }
    
    // Also check if geometry was created very recently when fractal is involved
    const timeSinceCreation = Date.now() - layer.baseGeo.userData.createdAt;
    const FRACTAL_GRACE_PERIOD = 200; // Extended grace period for fractal transitions
    
    if (timeSinceCreation < FRACTAL_GRACE_PERIOD) {
      return false;
    }
  }
  
  // FIXED: Ensure layer's baseGeo has proper userData for correct trigger detection
  if (layer.baseGeo && (!layer.baseGeo.userData || layer.baseGeo.userData.layerId !== layer.id)) {
    layer.baseGeo.userData = layer.baseGeo.userData || {};
    layer.baseGeo.userData.layerId = layer.id;
    layer.baseGeo.userData.vertexCount = state.segments;
  }
  
  // Setup variables for tracking triggers
  const triggeredNow = new Set();
  
  // Check how many copies we have
  let copies = 0;
  if (state.copies) {
    copies = state.copies;
  } else if (group.children) {
    // Count real copies (excluding intersection marker groups)
    copies = group.children.filter(child => 
      !(child.userData && child.userData.isIntersectionGroup)
    ).length - 1; // Subtract 1 for the debug sphere
  }
  
  // Skip if no copies or zero segments
  if (copies <= 0 || state.segments <= 0) {
    return false;
  }
  
  // FIXED: Check if this is the first time processing this layer and initialize its timestamp
  if (!lastPositionRecordTimes.has(layer.id)) {
    lastPositionRecordTimes.set(layer.id, tNow - POSITION_RECORD_INTERVAL - 0.001); // Set to just before interval
  }
  
  // SUBFRAME ENHANCEMENT: Record positions at fixed intervals - layer-specific timing
  // This decouples position recording from frame rate for more consistent trigger detection
  if (tNow - lastPositionRecordTimes.get(layer.id) >= POSITION_RECORD_INTERVAL) {
    recordLayerVertexPositions(layer, tNow);
    lastPositionRecordTimes.set(layer.id, tNow);
  }
  
  // SUBFRAME ENHANCEMENT: Check for triggers with subframe precision
  const layerTriggered = detectSubframeTriggers(layer, tNow, audioCallback, camera, renderer, scene);
  
  // LAYER LINK ENHANCEMENT: Check for layer link triggers
  const linkTriggered = detectLayerLinkTriggers(layer, tNow, audioCallback, camera, renderer, scene);
  
  return layerTriggered || linkTriggered;
}

/**
 * Record all triggerable positions for a layer into the subframe engine with audio timing
 * This unified function finds all triggerable objects in the group and records their positions
 * @param {Object} layer Layer to record positions for
 * @param {number} audioTime Current audio time in seconds
 */
function recordLayerVertexPositions(layer, audioTime) {
  if (!layer || !layer.group) return;
  
  const state = layer.state;
  const group = layer.group;
  
  // Skip if group is not visible
  if (!group.visible) return;
  
  // Skip position recording during geometry transitions
  if (layer.baseGeo && layer.baseGeo.userData && layer.baseGeo.userData.createdAt) {
    const timeSinceCreation = Date.now() - layer.baseGeo.userData.createdAt;
    if (timeSinceCreation < 200) return; // 200ms stabilization period
  }

  // FRACTAL BUG FIX: Skip position recording during fractal geometry transitions
  if (state.useFractal && layer.baseGeo && layer.baseGeo.userData) {
    const geometryInfo = layer.baseGeo.userData.geometryInfo;
    const currentFractalLevel = state.fractalValue || 1;
    const geometryFractalLevel = geometryInfo?.fractalLevel || 1;
    
    // If fractal levels don't match, skip position recording until geometry is updated
    if (currentFractalLevel !== geometryFractalLevel) {
      return;
    }
  }

  // Skip if group structure is inconsistent
  if (!group.children || group.children.length === 0) return;

  // Get angle for rotation calculations
  const angle = layer.currentAngle || 0;
  
  // DEBUG: Log when rotation starts for tesselated layers
  if (state && state.useTesselation && !layer._rotationStartLogged && angle !== 0) {
    layer._rotationStartLogged = true;
  }
  
  // Create matrices for calculations
  const inverseRotationMatrix = new THREE.Matrix4().makeRotationZ(-angle);
  const rotationMatrix = new THREE.Matrix4().makeRotationZ(angle);
  
  // Temp vector for calculations
  const worldPos = new THREE.Vector3();
  
  // UNIFIED APPROACH: Scan the entire group once to find all triggerable objects
  const triggerableObjects = findAllTriggerableObjects(group, layer);
  
  // DEBUG: Log position recording for tesselated layers
  if (state && state.useTesselation && triggerableObjects.length > 0) {
  }
  
  // Record positions for all triggerable objects
  for (const triggerableObj of triggerableObjects) {
    try {
      // Get current position based on object type
      let position = null;
      
      if (triggerableObj.type === 'vertex') {
        // Handle regular vertices
        const { mesh, vertexIndex, copyIndex } = triggerableObj;
        const positions = mesh.geometry.getAttribute('position');
        
        worldPos.fromBufferAttribute(positions, vertexIndex);
        
        // Skip invalid vertices
        if (isNaN(worldPos.x) || isNaN(worldPos.y) || isNaN(worldPos.z)) {
          continue;
        }
        
        // Calculate world matrix without rotation
        const tempWorldMatrix = new THREE.Matrix4();
        mesh.updateMatrixWorld();
        
        // Get the parent world matrix (excluding this mesh's matrix)
        const parentWorldMatrix = new THREE.Matrix4();
        if (mesh.parent) {
          mesh.parent.updateMatrixWorld();
          parentWorldMatrix.copy(mesh.parent.matrixWorld);
        }
        
        // Get local matrix without rotation
        const localMatrix = new THREE.Matrix4();
        localMatrix.copy(mesh.matrix);
        
        // Decompose to remove rotation but keep position and scale
        const meshPosition = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();
        const scale = new THREE.Vector3();
        localMatrix.decompose(meshPosition, quaternion, scale);
        
        // Reconstruct local matrix with position and scale, but no rotation
        tempWorldMatrix.compose(meshPosition, new THREE.Quaternion(), scale);
        
        // Combine with parent world matrix
        tempWorldMatrix.premultiply(parentWorldMatrix);
        
        // Apply inverse rotation at world level
        tempWorldMatrix.premultiply(inverseRotationMatrix);
        
        // Apply world matrix transformation (includes position, scale, but no rotation)
        worldPos.applyMatrix4(tempWorldMatrix);
        
        position = worldPos.clone();
        
      } else if (triggerableObj.type === 'intersection') {
        // Handle intersection points (both legacy and plain)
        const { mesh } = triggerableObj;
        
        if (triggerableObj.subtype === 'plain') {
          // Plain intersection points are already in world coordinates
          worldPos.copy(mesh.position);
          position = worldPos.clone();
        } else {
          // Legacy intersection points need matrix transformation
          worldPos.copy(mesh.position);
          
          // Skip invalid positions
          if (isNaN(worldPos.x) || isNaN(worldPos.y) || isNaN(worldPos.z)) {
            continue;
          }
          
          // Apply world matrix transformation for legacy intersections
          const tempWorldMatrix = new THREE.Matrix4();
          mesh.updateMatrixWorld();
          tempWorldMatrix.copy(mesh.matrixWorld);
          tempWorldMatrix.premultiply(inverseRotationMatrix);
          
          worldPos.applyMatrix4(tempWorldMatrix);
          position = worldPos.clone();
        }
      }
      
      if (!position) continue;
      
      // Skip invalid positions
      if (isNaN(position.x) || isNaN(position.y) || isNaN(position.z)) {
        continue;
      }
      
      // Apply final rotation for trigger detection
      const rotatedPos = position.clone().applyMatrix4(rotationMatrix);
      
      // Record position in subframe engine with audio timing
      subframeEngine.recordVertexPosition(
        triggerableObj.id,
        {
          x: rotatedPos.x,
          y: rotatedPos.y,
          z: rotatedPos.z
        },
        audioTime
      );
      
      // DEBUG: Simple logging for first few tesselated vertices
      if (state && state.useTesselation && triggerableObj.type === 'vertex') {
        if (!layer._simpleDebugCount) layer._simpleDebugCount = 0;
        if (layer._simpleDebugCount < 3) {
          layer._simpleDebugCount++;
        }
      }
      
    } catch (error) {
      console.error(`Error recording position for triggerable object ${triggerableObj.id}:`, error);
    }
  }
}

/**
 * Find all triggerable objects in a layer group
 * This unified function scans the entire group to find all objects that can trigger audio
 * @param {THREE.Group} group The layer group to scan
 * @param {Object} layer The layer object
 * @returns {Array} Array of triggerable object descriptors
 */
function findAllTriggerableObjects(group, layer) {
  const triggerableObjects = [];
  const state = layer.state;
  
  // Count real copies (excluding intersection marker groups and debug objects)
  let copies = 0;
  if (state.copies) {
    copies = state.copies;
  } else if (group.children) {
    copies = group.children.filter(child => 
      !(child.userData && child.userData.isIntersectionGroup) &&
      !(child.type === 'Mesh' && child.geometry && child.geometry.type === 'SphereGeometry') &&
      child.type !== 'Line'
    ).length;
  }
  
  // Skip if no copies or zero segments
  if (copies <= 0 || state.segments <= 0) return triggerableObjects;
  
  // Check if we need to account for deleted copies in primitives mode
  let deletedCopies = new Set();
  if (state && state.useDelete && state.deleteTarget === 'primitives') {
    deletedCopies = calculateDeletedVertices(copies, state);
  }

  // 1. Find all regular vertices in copy groups
  let foundCopyCount = 0;
  let actualCopyIndex = 0; // Track the actual copy index (accounting for deleted copies)
  let tesselationLogged = false; // Flag to log tesselation info only once per call
  
  for (let i = 0; i < group.children.length; i++) {
    const child = group.children[i];
    
    // Skip debug objects and intersection groups
    if (child.userData && child.userData.isIntersectionGroup) continue;
    if (child.type === 'Mesh' && child.geometry && child.geometry.type === 'SphereGeometry') continue;
    if (child.type === 'Line') continue;
    
    // Find the next non-deleted copy index
    while (deletedCopies.has(actualCopyIndex) && actualCopyIndex < copies) {
      actualCopyIndex++;
    }
    
    // This is a valid copy group
    const copyIndex = actualCopyIndex;
    foundCopyCount++;
    actualCopyIndex++;
    
    if (copyIndex >= copies) break;
    
    // Find the LineLoop (main geometry) in this copy group
    const mesh = child.children?.find(grandchild => 
      grandchild.type === 'LineLoop' || grandchild.type === 'LineSegments'
    );
    
    if (mesh && mesh.geometry && mesh.geometry.getAttribute('position')) {
      const positions = mesh.geometry.getAttribute('position');
      const vertexCount = positions.count;
      
      // DEBUG: Log tesselation info only once per geometry change
      if (state && state.useTesselation && mesh.geometry.userData && mesh.geometry.userData.isTesselated && !tesselationLogged) {
        // Only log once per layer session
        if (!layer._tesselationDebugLogged) {
          layer._tesselationDebugLogged = true;
          tesselationLogged = true;
        }
      } else if (state && state.useTesselation && !layer._tesselationDebugLogged) {
        // Debug: Check why tesselation isn't being detected (only once)
        layer._tesselationDebugLogged = true;
      }
      
      // Add all vertices in this copy as triggerable objects
      for (let vi = 0; vi < vertexCount; vi++) {
        // Calculate global vertex index for this vertex
        const globalVertexIndex = copyIndex * vertexCount + vi;
        
        // Check if this vertex should be deleted using GLOBAL indexing (skip from triggering)
        let isDeleted = false;
        if (state && state.useDelete && state.deleteTarget === 'points') {
          // Calculate total vertices across all copies for global indexing
          const totalVertices = copies * vertexCount;
          const deletedVertices = calculateDeletedVertices(totalVertices, state);
          
          if (deletedVertices.has(globalVertexIndex)) {
            isDeleted = true;
          }
        }
        
        // Only add non-deleted vertices to triggerable objects
        if (!isDeleted) {
          // TESSELATION FIX: Create unique IDs for tesselated vertices
          let triggerableId;
          
          // Check if this is a tesselated geometry by looking for tesselation metadata
          if (mesh.geometry && mesh.geometry.userData && mesh.geometry.userData.isTesselated) {
            const originalVertexCount = mesh.geometry.userData.originalVertexCount;
            const tesselatedCopyIndex = Math.floor(vi / originalVertexCount);
            const tesselatedVertexIndex = vi % originalVertexCount;
            
            // Create unique ID that includes tesselation information
            triggerableId = `${layer.id}-${copyIndex}-${tesselatedCopyIndex}-${tesselatedVertexIndex}`;
          } else {
            // Regular vertex ID for non-tesselated geometry
            triggerableId = `${layer.id}-${copyIndex}-${vi}`;
          }
          
          triggerableObjects.push({
            type: 'vertex',
            id: triggerableId,
            mesh: mesh,
            vertexIndex: vi,
            copyIndex: copyIndex,
            layer: layer,
            globalVertexIndex: globalVertexIndex
          });
        }
      }
      
      // 2. Find legacy intersection points in this copy group
      const intersectionGroup = findIntersectionGroup(child, layer);
      if (intersectionGroup && intersectionGroup.children) {
        for (let ii = 0; ii < intersectionGroup.children.length; ii++) {
          const marker = intersectionGroup.children[ii];
          if (marker.type === 'Mesh') {
            triggerableObjects.push({
              type: 'intersection',
              subtype: 'legacy',
              id: `${layer.id}-intersection-${copyIndex}-${ii}`,
              mesh: marker,
              intersectionIndex: ii,
              copyIndex: copyIndex,
              layer: layer
            });
          }
        }
      }
    }
  }
  
  // DEBUG: Log total triggerable objects found only when tesselation is first detected
  if (state && state.useTesselation && tesselationLogged) {
    
    // Count by type
    const vertexCount = triggerableObjects.filter(obj => obj.type === 'vertex').length;
    const intersectionCount = triggerableObjects.filter(obj => obj.type === 'intersection').length;
    
    // Log a sample of the triggerable IDs to understand the pattern
    const sampleIds = triggerableObjects.slice(0, 10).map(obj => obj.id);
    
    // Log the actual positions of all tesselated vertices
    const tesselatedVertices = triggerableObjects.filter(obj => obj.type === 'vertex');
    const vertexPositions = tesselatedVertices.map(obj => {
      const mesh = obj.mesh;
      const positions = mesh.geometry.getAttribute('position');
      const vi = obj.vertexIndex;
      const x = positions.array[vi * 3];
      const y = positions.array[vi * 3 + 1];
      return {
        id: obj.id,
        position: `(${x.toFixed(1)}, ${y.toFixed(1)})`,
        copyIndex: obj.copyIndex,
        vertexIndex: obj.vertexIndex
      };
    });
    
    
    // Log each vertex position individually for better readability
    vertexPositions.forEach((vertex, index) => {
    });
  }
  
  // 3. Find plain intersection points (direct children of main group)
  let plainIntersectionIndex = 0;
  for (let i = 0; i < group.children.length; i++) {
    const child = group.children[i];
    
    // Look for vertex circles (Mesh with CircleGeometry) that are intersection points
    if (child.type === 'Mesh' && 
        child.geometry && 
        child.geometry.type === 'CircleGeometry' &&
        child.material &&
        child.material.userData &&
        child.material.userData.isIntersection === true) {
      
      triggerableObjects.push({
        type: 'intersection',
        subtype: 'plain',
        id: `${layer.id}-plain-intersection-${plainIntersectionIndex}`,
        mesh: child,
        intersectionIndex: plainIntersectionIndex,
        layer: layer
      });
      
      plainIntersectionIndex++;
    }
  }
  
  return triggerableObjects;
}

/**
 * Helper function to find intersection group in a copy group
 * @param {THREE.Group} copyGroup The copy group to search
 * @param {Object} layer The layer object
 * @returns {THREE.Group|null} The intersection group or null
 */
function findIntersectionGroup(copyGroup, layer) {
  // First, check the legacy location (per-copy group)
  if (copyGroup.userData && copyGroup.userData.intersectionMarkerGroup) {
    return copyGroup.userData.intersectionMarkerGroup;
  }
  
  // Try to find an intersection group as a direct child of the copy group (legacy)
  for (let i = 0; copyGroup.children && i < copyGroup.children.length; i++) {
    const child = copyGroup.children[i];
    if (child.userData && child.userData.isIntersectionGroup && !child.userData.isGlobalIntersectionGroup) {
      return child;
    }
  }
  
  // If not found in copy group, check for global intersection group in the main layer group
  if (layer.group && layer.group.userData && layer.group.userData.globalIntersectionMarkerGroup) {
    return layer.group.userData.globalIntersectionMarkerGroup;
  }
  
  // Try to find a global intersection group as a direct child of the main layer group
  if (layer.group) {
    for (let i = 0; layer.group.children && i < layer.group.children.length; i++) {
      const child = layer.group.children[i];
      if (child.userData && child.userData.isIntersectionGroup && child.userData.isGlobalIntersectionGroup) {
        return child;
      }
    }
  }
  
  return null;
}

/**
 * Detect triggers using subframe precision with unified object processing
 * @param {Object} layer Layer to detect triggers for
 * @param {number} audioTime Current audio time in seconds
 * @param {Function} audioCallback Callback for triggered audio
 * @param {THREE.Camera} camera Camera for visual feedback
 * @param {THREE.WebGLRenderer} renderer Renderer for visual feedback
 * @param {THREE.Scene} scene Scene for adding visual markers
 * @returns {boolean} True if any triggers were detected
 */
function detectSubframeTriggers(layer, audioTime, audioCallback, camera, renderer, scene) {
  if (!layer || !layer.group || !audioCallback) return false;
  
  const state = layer.state;
  const group = layer.group;
  
  // FIXED: Additional early return for layers with 0 copies
  if (!state || state.copies <= 0) {
    return false;
  }
  
  // Skip if group is not visible
  if (!group.visible) return false;
  
  // FIXED: Ensure we have the correct layer ID
  const layerId = layer.id;
  
  // Get cooldown time from state or use default
  const cooldownTime = state.triggerCooldown || DEFAULT_COOLDOWN_TIME;
  
  // Get angle for calculations
  const angle = layer.currentAngle || 0;
  
  // Setup variables for tracking triggers
  const triggeredNow = new Set();
  const triggeredPoints = [];
  let anyTriggers = false;
  
  // UNIFIED APPROACH: Get all triggerable objects and process them uniformly
  const triggerableObjects = findAllTriggerableObjects(group, layer);
  
  // DEBUG: Check subframe engine tracking for tesselation
  if (state && state.useTesselation && !layer._subframeDebugLogged) {
    layer._subframeDebugLogged = true;
  }
  
  // Process each triggerable object
  for (const triggerableObj of triggerableObjects) {
    try {
      // Skip if this trigger is in the recent triggers map and still in cooldown
      if (recentTriggers.has(triggerableObj.id)) {
        const triggerData = recentTriggers.get(triggerableObj.id);
        const timeSinceLastTrigger = audioTime - triggerData.time;
        
        // Skip if cooldown hasn't elapsed
        if (timeSinceLastTrigger < cooldownTime) {
          continue;
        }
      }
      
      // Check for trigger crossing with subframe precision
      const crossingResult = subframeEngine.detectCrossing(triggerableObj.id, cooldownTime);
      
      // DEBUG: Log crossings for tesselated vertices
      if (state && state.useTesselation && crossingResult.hasCrossed && triggerableObj.type === 'vertex') {
      }
      
      // Process if crossing detected
      if (crossingResult.hasCrossed) {
        // Skip if already triggered in this frame
        if (triggeredNow.has(triggerableObj.id)) continue;
        
        // Use the position from the crossing result
        const nonRotatedX = crossingResult.position.x;
        const nonRotatedY = crossingResult.position.y;
        
        // Add to recent triggers with current timestamp
        recentTriggers.set(triggerableObj.id, {
          time: audioTime,
          position: {
            x: nonRotatedX,
            y: nonRotatedY
          }
        });
        
        // Create note based on object type
        let note;
        
        // DEBUG: Log note creation attempt for tesselated vertices
        if (state && state.useTesselation && triggerableObj.type === 'vertex') {
        }
        
        try {
          if (triggerableObj.type === 'vertex') {
            // Handle regular vertex triggers
            // Get the base geometry for frequency calculation
            if (!layer.baseGeo || !layer.baseGeo.getAttribute('position') || !layer.baseGeo.getAttribute('position').array) {
              // DEBUG: Log geometry issues for tesselated vertices
              if (state && state.useTesselation) {
              }
              continue;
            }
            
            // TESSELATION FIX: For tesselated vertices, use actual position directly
            if (state && state.useTesselation && triggerableObj.mesh && triggerableObj.mesh.geometry && triggerableObj.mesh.geometry.userData && triggerableObj.mesh.geometry.userData.isTesselated) {
              // For tessellated vertices, use the actual crossing position directly
              // This ensures the frequency calculation matches the visual position
              note = createNote({
                x: crossingResult.position.x,
                y: crossingResult.position.y,
                copyIndex: triggerableObj.copyIndex,
                vertexIndex: triggerableObj.vertexIndex,
                isIntersection: false,
                angle: angle,
                isTessellated: true // Flag to indicate this is a tessellated vertex
              }, state);
              
              // DEBUG: Log successful tessellated note creation
              if (state.useTesselation) {
                // console.log(`[TESSELLATION] Created note for tessellated vertex at (${crossingResult.position.x.toFixed(2)}, ${crossingResult.position.y.toFixed(2)}) with freq ${note.frequency.toFixed(2)}Hz`);
              }
            } else {
              // Regular vertex processing for non-tessellated geometry
              // Get the base vertex index
              let baseVertexIndex;
              
              baseVertexIndex = state.useFractal ? (triggerableObj.vertexIndex % state.segments) : triggerableObj.vertexIndex;
              
              const basePositions = layer.baseGeo.getAttribute('position').array;
              
              // Check base geometry bounds
              if (baseVertexIndex * 3 + 1 >= basePositions.length) {
                continue;
              }
              
              // FRACTAL BUG FIX: Additional validation for fractal mode
              // Ensure the baseVertexIndex makes sense for the current geometry
              if (state.useFractal) {
                const geometryInfo = layer.baseGeo.userData.geometryInfo;
                const expectedBaseVertexCount = geometryInfo?.baseVertexCount || state.segments;
                
                // If the expected base vertex count doesn't match, skip this trigger
                if (expectedBaseVertexCount !== state.segments) {
                  continue;
                }
                
                // Ensure the calculated baseVertexIndex is within the original segments range
                if (baseVertexIndex >= state.segments) {
                  continue;
                }
              }
              
              // Use createNote function to ensure equal temperament is applied
              note = createNote({
                x: crossingResult.position.x,
                y: crossingResult.position.y,
                copyIndex: triggerableObj.copyIndex,
                vertexIndex: triggerableObj.vertexIndex,
                isIntersection: false,
                angle: angle
              }, state);
            }
            
          } else if (triggerableObj.type === 'intersection') {
            // Handle intersection point triggers
            let noteData = null;
            
            if (triggerableObj.subtype === 'plain') {
              // For plain intersection points, try to get note data from material userData
              const materialUserData = triggerableObj.mesh.material.userData;
              noteData = materialUserData.note ? {...materialUserData.note} : null;
            }
            
            // Create note using existing data or generate new one
            note = noteData || createNote({
              x: crossingResult.position.x,
              y: crossingResult.position.y,
              copyIndex: triggerableObj.copyIndex || -1,
              isIntersection: true,
              intersectionIndex: triggerableObj.intersectionIndex,
              angle: angle
            }, state);
          }
          
          if (!note) continue;
          
          // Add subframe-specific properties
          note.time = crossingResult.exactTime;
          note.isSubframe = true;
          note.crossingFactor = crossingResult.crossingFactor;
          note.position = crossingResult.position;
          note.layerId = layerId;
          
        } catch (e) {
          // Fallback if createNote fails - use createNote with safe defaults
          console.warn('[TRIGGERS] createNote failed, using fallback:', e);
          note = createNote({
            x: crossingResult.position.x || 0,
            y: crossingResult.position.y || 0,
            copyIndex: triggerableObj.copyIndex || 0,
            vertexIndex: triggerableObj.vertexIndex || 0,
            isIntersection: triggerableObj.type === 'intersection',
            angle: angle
          }, state || {});
          
          // Add subframe-specific properties
          note.time = crossingResult.exactTime;
          note.isSubframe = true;
          note.vertexId = triggerableObj.id;
          note.layerId = layerId;
        }
        
        // Check for overlap with previously triggered points
        if (!isPointOverlapping(crossingResult.position.x, crossingResult.position.y, triggeredPoints)) {
          // Add to triggered points
          triggeredPoints.push({ 
            x: crossingResult.position.x, 
            y: crossingResult.position.y
          });
          
          // Handle quantization if enabled
          if (state.useQuantization) {
            // Create trigger info
            const triggerInfo = {
              note: {...note},
              worldRot: angle,
              camera,
              renderer,
              isQuantized: true,
              layer
            };
            
            // Handle quantization
            const { shouldTrigger, triggerTime, isQuantized } = handleQuantizedTrigger(audioTime, state, triggerInfo);
            
            if (shouldTrigger) {
              // Trigger with precise time
              const noteCopy = {...note};
              noteCopy.time = triggerTime;
              noteCopy.layerId = layerId;
              
              // Trigger audio
              audioCallback(noteCopy);
              
              // Create visual marker
              createMarker(
                angle, 
                crossingResult.position.x, 
                crossingResult.position.y, 
                scene, 
                noteCopy, 
                camera, 
                renderer, 
                isQuantized, 
                layer
              );
              
              // Set as triggered
              anyTriggers = true;
            }
          } else {
            // Debug phantom triggers for vertices
            if (DEBUG_PHANTOM_TRIGGERS && triggerableObj.type === 'vertex') {
              const expectedFreq = Math.hypot(note.x, note.y);
              const freqDiff = Math.abs(note.frequency - expectedFreq);
              
              if (freqDiff > 1) {
                console.warn('[PHANTOM TRIGGER]', {
                  layerId, 
                  triggerableObj,
                  actualFreq: note.frequency,
                  expectedFreq,
                  position: { x: note.x, y: note.y },
                  geometryVertexCount: layer.baseGeo?.getAttribute('position')?.count
                });
              }
            }
            
            // Regular non-quantized trigger
            // FIXED: Ensure layerId is set before calling audioCallback
            if (!note.layerId) note.layerId = layerId;
            
            // DEBUG: Log audio callback for tesselated vertices
            if (state && state.useTesselation && triggerableObj.type === 'vertex') {
            }
            
            audioCallback(note);
            
            // Create visual marker
            createMarker(
              angle, 
              crossingResult.position.x, 
              crossingResult.position.y, 
              scene, 
              note, 
              camera, 
              renderer, 
              false,
              layer
            );
            
            // Set as triggered
            anyTriggers = true;
          }
          
          // Add to triggered set
          triggeredNow.add(triggerableObj.id);
        }
      }
    } catch (error) {
      console.error(`Error processing trigger for object ${triggerableObj.id}:`, error);
    }
  }
  
  return anyTriggers;
}

/**
 * Detect layer link triggers for mid-points between linked layers
 * @param {Object} layer Current layer being processed
 * @param {number} audioTime Current audio time in seconds
 * @param {Function} audioCallback Callback function for triggered notes
 * @param {THREE.Camera} camera Camera reference
 * @param {THREE.Renderer} renderer Renderer reference
 * @param {THREE.Scene} scene Scene reference
 * @returns {boolean} True if any layer link triggers were detected
 */
function detectLayerLinkTriggers(layer, audioTime, audioCallback, camera, renderer, scene) {
  // Import layer link manager dynamically to avoid circular dependencies
  try {
    // Check if layer link manager is available and enabled
    if (typeof window !== 'undefined' && window.layerLinkManager) {
      const linkManager = window.layerLinkManager;
      
      if (!linkManager.enabled) {
        return false;
      }
      
      // Get mid-point triggers from the layer link manager
      const midPointTriggers = linkManager.getMidPointTriggers();
      
      // if (Math.random() < 0.01) { // Log occasionally
      //   console.log(`[LAYER LINK] Found ${midPointTriggers ? midPointTriggers.length : 0} mid-point triggers for layer ${layer.id}`);
      // }
      
      if (!midPointTriggers || midPointTriggers.length === 0) {
        return false;
      }
      
      let anyTriggers = false;
      
      // Check each mid-point for axis crossings
      for (const triggerData of midPointTriggers) {
        if (!triggerData || !triggerData.isLinkTrigger) {
          continue;
        }
        
        const { x, y, linkIndex } = triggerData;
        
        // Validate coordinates
        if (isNaN(x) || isNaN(y) || x === undefined || y === undefined) {
          continue;
        }
        
        // Create a stable ID for this link trigger (don't include position to maintain history)
        const triggerId = `link_${linkIndex}_${layer.id}`;
        
        // Check if this trigger was recently fired
        if (recentTriggers.has(triggerId)) {
          const lastTriggerTime = recentTriggers.get(triggerId).time;
          if (audioTime - lastTriggerTime < DEFAULT_COOLDOWN_TIME) {
            continue; // Skip if within cooldown period
          }
        }
        
        // Record position in subframe engine for axis crossing detection
        subframeEngine.recordVertexPosition(triggerId, { x, y, z: 0 }, audioTime);
        
        // Check for axis crossings using the correct method
        const crossingResult = subframeEngine.detectCrossing(triggerId, DEFAULT_COOLDOWN_TIME);
        
        // Enhanced debug logging for layer link triggers - DISABLED
        // if (Math.random() < 0.005) { // Log occasionally to avoid spam
        //   console.log(`[LAYER LINK DEBUG] Link ${linkIndex}: pos(${x.toFixed(1)}, ${y.toFixed(1)}) crossing: ${crossingResult.hasCrossed} ID: ${triggerId}`);
        //   
        //   // Show precision improvement when crossing detected
        //   if (crossingResult.hasCrossed) {
        //     const preciseX = crossingResult.position.x;
        //     const preciseY = crossingResult.position.y;
        //     const positionDiff = Math.sqrt((x - preciseX) ** 2 + (y - preciseY) ** 2);
        //     console.log(`[LAYER LINK PRECISION] Raw: (${x.toFixed(2)}, ${y.toFixed(2)}) -> Precise: (${preciseX.toFixed(2)}, ${preciseY.toFixed(2)}) diff: ${positionDiff.toFixed(2)} factor: ${crossingResult.crossingFactor.toFixed(3)}`);
        //   }
        //   
        //   // Check if we're close to the Y-axis
        //   if (Math.abs(x) < 50) {
        //     console.log(`[LAYER LINK DEBUG] Near Y-axis! x=${x.toFixed(1)}, y=${y.toFixed(1)}`);
        //   }
        // }
        
        if (crossingResult && crossingResult.hasCrossed) {
          // Use the precise crossing position from subframe detection
          const preciseX = crossingResult.position.x;
          const preciseY = crossingResult.position.y;
          
          // Calculate frequency for the precise crossing position
          const frequencyData = calculateFrequency(preciseX, preciseY, layer.state);
          
          // Create note for layer link trigger using precise position
          const note = createNote({
            x: preciseX,
            y: preciseY,
            angle: frequencyData.angle,
            copyIndex: -1, // Special value for link triggers
            vertexIndex: linkIndex,
            isIntersection: false,
            isLinkTrigger: true,
            linkIndex: linkIndex
          }, layer.state);
          
          // Add subframe-specific properties like normal vertices
          note.time = crossingResult.exactTime;
          note.isSubframe = true;
          note.crossingFactor = crossingResult.crossingFactor;
          note.position = crossingResult.position;
          note.layerId = layer.id;
          
          // Override default values for link triggers
          note.velocity = 0.7;
          note.duration = 0.5;
          
          // Record this trigger to prevent immediate re-triggering
          recentTriggers.set(triggerId, { time: audioTime });
          
          // Fire the audio callback
          if (audioCallback) {
            audioCallback(note);
          }
          
          // Create visual marker for the link trigger using precise position
          if (scene && camera && renderer) {
            createMarker(
              frequencyData.angle,
              preciseX,
              preciseY,
              scene,
              note,
              camera,
              renderer,
              false,
              layer
            );
          }
          
          // if (DEBUG_LOGGING) {
          //   console.log(`[LAYER LINK] Trigger detected: raw(${x.toFixed(2)}, ${y.toFixed(2)}) -> precise(${preciseX.toFixed(2)}, ${preciseY.toFixed(2)}) link ${linkIndex} time=${crossingResult.exactTime.toFixed(4)}`);
          // }
          
          anyTriggers = true;
        }
      }
      
      return anyTriggers;
    }
  } catch (error) {
    // Log errors for debugging but don't throw to prevent cascading failures
    if (DEBUG_LOGGING) {
      console.warn('Layer link trigger detection failed:', error);
    }
  }
  
  return false;
}

/**
 * Clean up expired markers with fading
 * @param {Object} layer Layer to process markers for
 */
export function clearLayerMarkers(layer) {
  if (!layer || !Array.isArray(layer.markers)) return;
  
  const scene = layer.group?.parent;
  if (!scene) return;
  
  const markers = layer.markers;
  
  // Process each marker
  for (let j = markers.length - 1; j >= 0; j--) {
    const marker = markers[j];
    marker.life--;
    
    // Update opacity for fading
    if (marker.mesh && marker.mesh.material) {
      // Calculate fade factor
      const fadeProgress = marker.life / (marker.originalLife || MARK_LIFE);
      const baseOpacity = marker.noteInfo?.velocity || 0.7;
      
      // Apply fade
      marker.mesh.material.opacity = baseOpacity * fadeProgress;
      
      // Update color based on state, but only change color for hit markers
      if (marker.animState === ANIMATION_STATES.HIT) {
        marker.mesh.material.color.setRGB(1, 1, 0); // Yellow for hit markers
      }
    }
    
    // Remove expired markers
    if (marker.life <= 0) {
      // Clean up mesh
      if (marker.mesh) {
        scene.remove(marker.mesh);
        
        if (marker.mesh.geometry) marker.mesh.geometry.dispose();
        if (marker.mesh.material) marker.mesh.material.dispose();
      }
      
      // Clean up text label
      if (marker.textLabel && marker.textLabel.id) {
        removeLabel(marker.textLabel.id);
      }
      
      // Remove from array
      markers.splice(j, 1);
    }
  }
}

/**
 * Detect intersections for the active layer
 * @param {Object} layer The active layer
 * @returns {Array} Array of intersections
 */
export function detectIntersections(layer) {
  if (!layer) return [];
  
  // Skip if layer state doesn't exist
  if (!layer.state) return [];
  
  // IMPORTANT: Skip intersection detection if explicitly disabled
  // DEPRECATED: useIntersections functionality removed
  // const useIntersections = layer.state.useIntersections === true;
  
  // if (!useIntersections) {
  if (true) { // Always skip intersection detection since it's deprecated
    // Return empty array when intersections are disabled
    return [];
  }
  
  // Only require at least 2 copies for regular intersections
  if (layer.state.copies < 2) {
    return [];
  }
  
  // Get the current markers array or create a new one
  if (!layer.markers) {
    layer.markers = [];
  }
  
  // Process any existing markers first
  const existingMarkers = layer.markers.filter(m => 
    m.animState !== ANIMATION_STATES.EXPIRED
  );
  
  // Find intersections between elements in the layer
  let intersections = [];
  if (layer.group) {
    // DEPRECATED: findAllIntersections functionality removed
    // intersections = findAllIntersections(layer.group);
    intersections = []; // Return empty array since intersections.js is deprecated
  }
  
  // Create markers for new intersections
  for (const intersection of intersections) {
    // Skip if intersection is invalid (null or has NaN coordinates)
    if (!intersection || isNaN(intersection.x) || isNaN(intersection.y)) {
      continue;
    }
    
    // Check if this intersection already has a marker
    const exists = existingMarkers.some(m => 
      m.position && 
      intersection && 
      distanceBetweenPoints(m.position.x, m.position.y, intersection.x, intersection.y) < OVERLAP_THRESHOLD
    );
    
    if (!exists) {
      // Create a new marker for this intersection
      const marker = {
        position: intersection.clone(),
        velocity: 0,
        lifetime: MARK_LIFE,
        animState: ANIMATION_STATES.ACTIVE,
        justHit: false,
        frequency: calculateFrequency(intersection.x, intersection.y, layer.state),
        pan: calculatePanForPoint(intersection)
      };
      layer.markers.push(marker);
    }
  }
  
  return intersections;
}
