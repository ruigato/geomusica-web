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

// Debug flag to control logging
const DEBUG_LOGGING = false;

// Debug flag for star cuts (intersection points)
const DEBUG_STAR_CUTS = false;

// Memory management configurations
const RECENT_TRIGGERS_MAX_AGE = 10; // Time in seconds before a trigger is considered stale
const PENDING_TRIGGERS_MAX_SIZE = 1000; // Maximum number of pending triggers to store
const CLEANUP_INTERVAL = 5000; // Milliseconds between cleanup operations

// Map to track triggered points and prevent re-triggering
const recentTriggers = new Map();

// Store for pending triggers when using quantization
let pendingTriggers = [];

// Singleton instance of the subframe trigger engine
const subframeEngine = new TemporalTriggerEngine({
  resolution: 1000, // 1000Hz = 1ms resolution
  maxMemory: 100
});

// Initialize the engine
subframeEngine.initialize();

// Subframe timing variables
const POSITION_RECORD_INTERVAL = 1 / 120; // Record positions at max 120Hz for efficiency
const DEFAULT_COOLDOWN_TIME = 0.05; // 50ms default cooldown between triggers

// FIXED: Change from global lastPositionRecordTime to a map keyed by layer ID
// This ensures each layer has its own independent recording schedule
const lastPositionRecordTimes = new Map();

// Setup periodic cleanup timer
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
 */
function setupCleanupTimer() {
  // Clear any existing timer
  if (cleanupTimerId !== null) {
    clearInterval(cleanupTimerId);
  }
  
  // Create a new timer that runs periodically
  cleanupTimerId = setInterval(() => {
    cleanupRecentTriggers();
    cleanupPendingTriggers();
  }, CLEANUP_INTERVAL);
}

/**
 * Remove stale entries from recentTriggers map to prevent memory leaks
 */
function cleanupRecentTriggers() {
  const now = getCurrentTime();
  
  // Remove entries older than RECENT_TRIGGERS_MAX_AGE
  for (const [key, data] of recentTriggers.entries()) {
    if (now - data.time > RECENT_TRIGGERS_MAX_AGE) {
      recentTriggers.delete(key);
    }
  }
}

/**
 * Clean up executed or excess entries from pendingTriggers array
 */
function cleanupPendingTriggers() {
  const now = getCurrentTime();
  
  // Remove already executed triggers (with some margin)
  pendingTriggers = pendingTriggers.filter(trigger => 
    trigger.executeTime > now - 1 // Keep triggers from the last second in case of processing delays
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
    console.warn("Invalid coordinates in calculateFrequency:", x, y);
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
    console.warn("Invalid distance in calculateFrequency:", distance);
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
    console.warn("NaN frequency calculated in calculateFrequency");
    frequency = 440; // Default to A4
  }
  
  // Limit to reasonable audio range (80-1000 Hz)
  frequency = Math.max(80, Math.min(1000, frequency));
  
  // Process through equal temperament if enabled
  let noteName = null;
  if (state && state.useEqualTemperament) {
    // Get reference frequency with safe default
    const refFreq = (state.referenceFrequency && !isNaN(state.referenceFrequency)) 
      ? state.referenceFrequency 
      : 440;
    
    try {
      frequency = quantizeToEqualTemperament(frequency, refFreq);
      noteName = getNoteName(frequency, refFreq);
    } catch (e) {
      // If quantization fails, use unquantized frequency
      console.error("Error in frequency quantization:", e);
    }
  }
  
  // Final safety check - if after all processing frequency is still NaN, use default
  if (isNaN(frequency)) {
    console.error("After processing, frequency is still NaN");
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
 * Enhanced for high BPM precision timing
 * @param {number} currentTime - Current time in seconds
 * @param {Function} audioCallback - Callback to execute triggers
 * @param {Object} scene - Scene for creating visual markers
 */
export function processPendingTriggers(currentTime, audioCallback, scene) {
  if (pendingTriggers.length === 0) return;
  
  // Find triggers that should be executed with enhanced precision
  const triggersToExecute = [];
  const tolerance = 0.002; // Reduced to 2ms tolerance for better high BPM precision
  
  while (pendingTriggers.length > 0 && pendingTriggers[0].executeTime <= currentTime + tolerance) {
    triggersToExecute.push(pendingTriggers.shift());
  }
  
  // Execute the triggers with timing compensation
  for (const trigger of triggersToExecute) {
    const { note, worldRot, executeTime, camera, renderer, isQuantized, layer } = trigger;
    
    if (note) {
      // Make a deep copy of the note to ensure we're not modifying the original
      const noteCopy = { ...note };
      noteCopy.time = executeTime;
      
      // Add timing information for debugging high BPM issues
      const timingDelta = Math.abs(currentTime - executeTime);
      if (timingDelta > 0.001) { // Log if more than 1ms off
        if (DEBUG_LOGGING) {
          console.log(`Trigger timing delta: ${timingDelta.toFixed(5)}s`);
        }
      }
      
      // IMPORTANT: Send the complete note object copy
      audioCallback(noteCopy);
      
      // Create a marker with visual feedback
      if (scene && worldRot !== undefined && noteCopy.frequency !== undefined) {
        createMarker(worldRot, noteCopy.x, noteCopy.y, scene, noteCopy, camera, renderer, isQuantized, layer);
      }
    }
  }
  
  // After processing, clean up any remaining stale triggers
  if (pendingTriggers.length > 0) {
    cleanupPendingTriggers();
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
 * Create a visual marker for a triggered point
 * @param {number} angle Rotation angle
 * @param {number} worldX X coordinate in world space
 * @param {number} worldY Y coordinate in world space
 * @param {THREE.Scene} scene Scene to add marker to
 * @param {Object} note Note object with frequency and duration
 * @param {THREE.Camera} camera Camera for positioning labels
 * @param {THREE.WebGLRenderer} renderer Renderer for positioning labels
 * @param {boolean} isQuantized Whether this is a quantized trigger
 * @param {Layer} layer Layer this marker belongs to
 * @returns {Object} Created marker object
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
  
  // Limit the maximum number of markers to prevent memory issues
  const MAX_MARKERS = 100;
  if (markersArray.length >= MAX_MARKERS) {
    // Remove oldest markers if we exceed the limit
    const markersToRemove = markersArray.length - MAX_MARKERS + 1;
    
    for (let i = 0; i < markersToRemove; i++) {
      const oldMarker = markersArray.shift(); // Remove from the beginning (oldest)
      
      if (oldMarker) {
        // Remove label if it exists
        if (oldMarker.userData && oldMarker.userData.label) {
          removeLabel(oldMarker.userData.label.id);
        }
        
        // Remove from scene
        scene.remove(oldMarker);
        
        // Dispose geometry and material
        if (oldMarker.geometry) oldMarker.geometry.dispose();
        if (oldMarker.material) oldMarker.material.dispose();
      }
    }
  }
  
  const frequency = note.frequency;
  const duration = note.duration;
  const velocity = note.velocity;
  
  // Create the marker
  const markerGeom = new THREE.SphereGeometry(8, 8, 8);
  
  // Determine the color to use for this marker
  let markerColor;
  
  // Use layer-specific color if available
  if (layer && layer.color) {
    if (isQuantized) {
      // Create a brighter version of the layer color for quantized triggers
      markerColor = layer.color.clone().multiplyScalar(1.5);
    } else {
      // Use layer color for regular markers
      markerColor = layer.color;
    }
  } else {
    // Fallback colors if no layer or layer has no color
    if (isQuantized) {
      markerColor = 0x00ff00; // Green for quantized
    } else {
      markerColor = 0xff0000; // Red for regular
    }
  }
  
  // Create material with optional transparency
  const markerMaterial = new THREE.MeshBasicMaterial({
    color: markerColor,
    transparent: true,
    opacity: Math.min(1.0, velocity * 1.5), // Scale opacity by velocity with a cap at 1.0
  });
  
  // Create mesh
  const marker = new THREE.Mesh(markerGeom, markerMaterial);
  marker.position.set(worldX, worldY, 10);
  
  // Set render order to ensure marker appears on top
  marker.renderOrder = 1000;
  
  // Store metadata about this marker
  marker.userData = {
    isMarker: true,
    creationTime: getCurrentTime(),
    duration: duration,
    frequency: frequency,
    angle: angle,
    layerId: layer ? layer.id : null,
    note: { ...note } // Store a copy of the note
  };
  
  // Add to markers array
  markersArray.push(marker);
  
  // Add to scene for rendering
  scene.add(marker);
  
  // Create frequency label if camera and renderer are provided
  if (camera && renderer) {
    let labelText;
    
    // Format based on whether this is a quantized note and its properties
    if (note.noteName) {
      if (isQuantized) {
        labelText = `${note.noteName} (Q)`;
      } else {
        labelText = note.noteName;
      }
    } else {
      if (isQuantized) {
        labelText = `${frequency.toFixed(1)}Hz (Q)`;
      } else {
        labelText = `${frequency.toFixed(1)}Hz`;
      }
    }
    
    // Create label object
    const label = createOrUpdateLabel(
      `marker-${markersArray.length}-${Math.random().toString(36).substr(2, 9)}`,
      new THREE.Vector3(worldX, worldY, 10),
      labelText,
      camera,
      renderer
    );
    
    // Store label reference in marker userData
    marker.userData.label = label;
  }
  
  // Check if we need to create an axis label (only when showAxisFreqLabels is true)
  if (layer && layer.state && layer.state.showAxisFreqLabels === true) {
    // If this is an axis crossing, create a label
    const isXAxisCrossing = Math.abs(worldY) < 5; // Close to X-axis
    const isYAxisCrossing = Math.abs(worldX) < 5; // Close to Y-axis
    
    if (isXAxisCrossing || isYAxisCrossing) {
      const axis = isXAxisCrossing ? 'x' : 'y';
      
      // Create a more specific ID to prevent ID conflicts
      // Include timestamp to ensure uniqueness
      const labelId = `axis-${layer.id}-${note.copyIndex || 0}-${note.vertexIndex || 0}-${Date.now()}`;
      
      const labelPos = new THREE.Vector3(worldX, worldY, 0);
      const labelText = isQuantized ? 
        `${note.noteName || note.frequency.toFixed(1) + 'Hz'} Q` : 
        note.noteName || note.frequency.toFixed(1) + 'Hz';
      
      // Use layer color for the label
      const labelColor = layer.color;
      
      // Use a shorter lifespan for better UI responsiveness (0.8 seconds)
      // This matches the marker fade time better
      createAxisLabel(labelId, labelPos, labelText, camera, renderer, 0.8, labelColor);
    }
  }
  
  // Set up animation for marker fading with improved memory management
  const animateMarker = () => {
    // Check if marker is still in the DOM/scene
    if (!marker.parent) {
      // Marker was removed, don't continue animation
      return;
    }
    
    const now = getCurrentTime();
    const age = now - marker.userData.creationTime;
    
    // Calculate fade based on age and duration
    const normalizedAge = age / MARK_LIFE;
    
    if (normalizedAge >= 1.0) {
      // Get reference to the marker's scene before removing it
      const markerScene = marker.parent;
      
      // Remove marker from scene
      if (markerScene) {
        markerScene.remove(marker);
      }
      
      // Remove from markers array
      if (markersArray) {
        const index = markersArray.indexOf(marker);
        if (index !== -1) {
          markersArray.splice(index, 1);
        }
      }
      
      // Dispose of geometry and material to prevent memory leaks
      if (marker.geometry) {
        marker.geometry.dispose();
      }
      
      if (marker.material) {
        if (Array.isArray(marker.material)) {
          marker.material.forEach(mat => mat.dispose());
        } else {
          marker.material.dispose();
        }
      }
      
      // Remove label if it exists
      if (marker.userData.label) {
        removeLabel(marker.userData.label.id);
      }
      
      return;
    }
    
    // Scale and fade the marker
    const scale = Math.max(0.1, 1.0 - normalizedAge);
    marker.scale.set(scale, scale, scale);
    marker.material.opacity = Math.max(0, 1.0 - normalizedAge) * Math.min(1.0, velocity * 1.5);
    
    // Request next animation frame
    requestAnimationFrame(animateMarker);
  };
  
  // Start animation
  animateMarker();
  
  return marker;
}

/**
 * Reset the trigger system state
 */
export function resetTriggerSystem() {
  // Clear all maps and arrays
  recentTriggers.clear();
  pendingTriggers = [];
  lastPositionRecordTimes.clear();
  
  // Reset the subframe engine
  if (subframeEngine) {
    subframeEngine.clearAllHistory();
  }
  
  // Reset cleanup timer
  if (cleanupTimerId !== null) {
    clearInterval(cleanupTimerId);
    cleanupTimerId = null;
  }
  
  // Set up a new cleanup timer
  setupCleanupTimer();
  
  if (DEBUG_LOGGING) {
    console.log("Trigger system reset complete");
  }
}

/**
 * Dispose of all resources used by the trigger system
 */
export function disposeTriggerSystem() {
  // Clear data structures
  recentTriggers.clear();
  pendingTriggers = [];
  lastPositionRecordTimes.clear();
  
  // Dispose of the subframe engine
  if (subframeEngine) {
    subframeEngine.dispose();
  }
  
  // Clear timers
  if (cleanupTimerId !== null) {
    clearInterval(cleanupTimerId);
    cleanupTimerId = null;
  }
  
  if (DEBUG_LOGGING) {
    console.log("Trigger system disposed");
  }
}

/**
 * Check if a line segment crosses the axes in an enhanced way
 * that properly detects crossings in all quadrants
 * @param {number} prevX Previous x coordinate
 * @param {number} prevY Previous y coordinate
 * @param {number} currX Current x coordinate
 * @param {number} currY Current y coordinate
 * @returns {Object} Crossing information
 */
function checkEnhancedAxisCrossing(prevX, prevY, currX, currY) {
  // Check if segment crosses the y-axis (x = 0)
  const crossesYAxis = (prevX < 0 && currX >= 0) || (prevX >= 0 && currX < 0);
  
  // Check if segment crosses the x-axis (y = 0)
  const crossesXAxis = (prevY < 0 && currY >= 0) || (prevY >= 0 && currY < 0);
  
  // Calculate the precise crossing point if needed
  let crossingPoint = null;
  let axis = null;
  
  if (crossesYAxis) {
    // Calculate where the line segment crosses the y-axis
    const t = -prevX / (currX - prevX);
    const yAtCrossing = prevY + t * (currY - prevY);
    
    // Store crossing info
    crossingPoint = { x: 0, y: yAtCrossing };
    axis = 'y';
  } else if (crossesXAxis) {
    // Calculate where the line segment crosses the x-axis
    const t = -prevY / (currY - prevY);
    const xAtCrossing = prevX + t * (currX - prevX);
    
    // Store crossing info
    crossingPoint = { x: xAtCrossing, y: 0 };
    axis = 'x';
  }
  
  return {
    crossesYAxis,
    crossesXAxis,
    crossingPoint,
    axis
  };
}

/**
 * Detect triggers for a layer
 * @param {Layer} layer Layer to detect triggers for
 * @param {number} tNow Current time
 * @param {Function} audioCallback Callback to play audio
 * @returns {Array} Array of triggered points
 */
export function detectLayerTriggers(layer, tNow, audioCallback) {
  // Skip if layer doesn't exist or isn't active
  if (!layer || !layer.active) {
    return [];
  }

  // Get copy group from layer
  const copyGroup = layer.group;
  if (!copyGroup) {
    return [];
  }

  // Get camera and renderer from layer or scene
  const camera = layer.camera || (copyGroup.parent && copyGroup.parent.userData && copyGroup.parent.userData.camera);
  const renderer = layer.renderer || (copyGroup.parent && copyGroup.parent.userData && copyGroup.parent.userData.renderer);

  // Layer ID for trigger tracking
  const layerId = layer.id;

  // Skip if layer isn't active or angle hasn't changed
  if (!layer.active || (layer.currentAngle === layer.previousAngle && !layer.state.isLerping)) {
    return [];
  }

  // Make sure lastPositionRecordTimes has an entry for this layer
  if (!lastPositionRecordTimes.has(layerId)) {
    lastPositionRecordTimes.set(layerId, 0);
  }

  // Get state from layer
  const state = layer.state;
  
  // Check if we need to record new vertex positions for subframe detection
  const timeSinceLastRecording = tNow - lastPositionRecordTimes.get(layerId);
  
  if (timeSinceLastRecording >= POSITION_RECORD_INTERVAL) {
    // Record positions for all vertices in all copies
    recordLayerVertexPositions(layer, tNow);
    
    // Update last record time
    lastPositionRecordTimes.set(layerId, tNow);
  }
  
  // Set a lower cooldown time when lerping for smoother triggering
  const LERPING_TRIGGER_COOLDOWN = state.isLerping ? 0.01 : DEFAULT_COOLDOWN_TIME;
  
  // Array to track all triggered points in this frame
  const triggeredNow = [];
  
  // Track triggered points to avoid duplicates
  const triggeredPoints = [];
  
  // Get rotation matrices for detection
  const angle = layer.currentAngle;
  const lastAngle = layer.previousAngle;
  const rotationMatrix = new THREE.Matrix4().makeRotationZ(angle);
  const inverseRotationMatrix = new THREE.Matrix4().makeRotationZ(-angle);
  
  // Let the subframe trigger system handle the actual detection
  // with much higher precision
  const subframeTriggered = detectSubframeTriggers(
    layer, tNow, audioCallback, camera, renderer, copyGroup.parent
  );
  
  // Return all triggered points
  return [...triggeredNow, ...subframeTriggered];
}

/**
 * Record vertex positions for a layer
 * @param {Layer} layer Layer to record positions for
 * @param {number} timestamp Current timestamp
 */
function recordLayerVertexPositions(layer, timestamp) {
  // Skip if layer doesn't exist or isn't active
  if (!layer || !layer.active) {
    return;
  }
  
  // Get copy group from layer
  const copyGroup = layer.group;
  if (!copyGroup) {
    return;
  }
  
  // Current rotation angle
  const angle = layer.currentAngle || 0;
  
  // Create rotation matrices
  const rotationMatrix = new THREE.Matrix4().makeRotationZ(angle);
  const inverseRotationMatrix = new THREE.Matrix4().makeRotationZ(-angle);
  
  // Process each child in the copy group
  const children = Array.from(copyGroup.children);
  
  for (let ci = 0; ci < children.length; ci++) {
    const child = children[ci];
    
    // Skip non-polygon objects
    if (child.userData && (
      child.userData.isMarker || 
      child.userData.isAxisLabel
    )) {
      continue;
    }
    
    // Skip objects that aren't Lines or LineLoops
    if (child.type !== 'Line' && child.type !== 'LineLoop' && child.type !== 'LineSegments') {
      // If this is a Group, we need to check its children
      if (child.type === 'Group') {
        const lineChildren = child.children.filter(c => 
          c.type === 'Line' || c.type === 'LineLoop' || c.type === 'LineSegments'
        );
        
        // Process each line child
        for (const lineChild of lineChildren) {
          // Record positions for this line
          recordLineVertexPositions(lineChild, ci, layer, timestamp, rotationMatrix, inverseRotationMatrix);
        }
        
        continue;
      } else {
        continue;
      }
    }
    
    // Record positions for this line
    recordLineVertexPositions(child, ci, layer, timestamp, rotationMatrix, inverseRotationMatrix);
  }
}

/**
 * Record vertex positions for a single line object
 * @param {THREE.Line} line Line object to record positions for
 * @param {number} copyIndex Index of the copy
 * @param {Layer} layer Layer the line belongs to
 * @param {number} timestamp Current timestamp
 * @param {THREE.Matrix4} rotationMatrix Current rotation matrix
 * @param {THREE.Matrix4} inverseRotationMatrix Inverse rotation matrix
 */
function recordLineVertexPositions(line, copyIndex, layer, timestamp, rotationMatrix, inverseRotationMatrix) {
  // Skip if line doesn't have geometry or position attribute
  if (!line.geometry || !line.geometry.attributes.position) {
    return;
  }
  
  // Get position attribute
  const posAttr = line.geometry.attributes.position;
  
  // Get transformation matrices
  const lineWorldMatrix = new THREE.Matrix4();
  line.updateMatrixWorld();
  lineWorldMatrix.copy(line.matrixWorld);
  
  // Temporary vectors for calculations
  const tempVec = new THREE.Vector3();
  const worldPos = new THREE.Vector3();
  
  // Process each vertex in the line
  for (let vi = 0; vi < posAttr.count; vi++) {
    // Get vertex position
    tempVec.fromBufferAttribute(posAttr, vi);
    
    // Transform to world space
    worldPos.copy(tempVec).applyMatrix4(lineWorldMatrix);
    
    // Create unique vertex ID
    const vertexId = `${layer.id}-${copyIndex}-${vi}`;
    
    // Add position to subframe engine
    subframeEngine.recordVertexPosition(
      vertexId,
      copyIndex,
      vi,
      timestamp,
      worldPos.x,
      worldPos.y,
      worldPos.z
    );
  }
}

/**
 * Detect triggers using the subframe system
 * @param {Layer} layer Layer to detect triggers for
 * @param {number} timestamp Current timestamp
 * @param {Function} audioCallback Callback to play audio
 * @param {THREE.Camera} camera Camera for positioning
 * @param {THREE.WebGLRenderer} renderer Renderer for positioning
 * @param {THREE.Scene} scene Scene to add markers to
 * @returns {Array} Array of triggered points
 */
function detectSubframeTriggers(layer, timestamp, audioCallback, camera, renderer, scene) {
  // Skip if layer doesn't exist or isn't active
  if (!layer || !layer.active) {
    return [];
  }
  
  // Set cooldown time based on whether we're lerping
  const cooldownTime = layer.state.isLerping ? 0.01 : DEFAULT_COOLDOWN_TIME;
  
  // Get all triggered vertices from the subframe engine
  const triggeredVertices = subframeEngine.detectTriggers(
    layer.id, 
    timestamp, 
    layer.currentAngle, 
    layer.previousAngle,
    cooldownTime
  );
  
  // Array to store all triggered points
  const triggeredPoints = [];
  
  // Process triggered vertices
  for (const trigger of triggeredVertices) {
    // Create unique ID for this trigger
    const triggerId = `${layer.id}-${trigger.copyIndex}-${trigger.vertexIndex}-${Math.floor(timestamp * 10)}`;
    
    // Skip if this was recently triggered
    if (recentTriggers.has(triggerId)) {
      continue;
    }
    
    // Mark as recently triggered
    recentTriggers.set(triggerId, {
      time: timestamp,
      position: { x: trigger.x, y: trigger.y, z: trigger.z }
    });
    
    // Calculate frequency for this point
    const x = trigger.x;
    const y = trigger.y;
    
    // Get frequency from position
    let frequency = getFrequency(x, y);
    let noteName = null;
    
    // Apply equal temperament if enabled
    if (layer.state.useEqualTemperament) {
      const refFreq = layer.state.referenceFrequency || 440;
      try {
        frequency = quantizeToEqualTemperament(frequency, refFreq);
        noteName = getNoteName(frequency, refFreq);
      } catch (e) {
        // Use unquantized frequency if quantization fails
      }
    }
    
    // Calculate pan position (-1 to 1 based on x position)
    const pan = Math.max(-1, Math.min(1, x / 300));
    
    // Create note object
    const note = createNote({
      x,
      y,
      copyIndex: trigger.copyIndex,
      vertexIndex: trigger.vertexIndex,
      globalIndex: trigger.vertexIndex + (trigger.copyIndex * 100) // Simple global index calculation
    }, layer.state);
    
    // Store note name if available
    if (noteName) {
      note.noteName = noteName;
    }
    
    // Calculate trigger angle (in degrees for display)
    const triggerAngle = (trigger.angle * 180 / Math.PI) % 360;
    
    // Add trigger information to note
    note.copyIndex = trigger.copyIndex;
    note.vertexIndex = trigger.vertexIndex;
    note.triggerAngle = triggerAngle;
    note.layerId = layer.id;
    note.x = x;
    note.y = y;
    
    // Apply quantization if enabled
    if (layer.state.useQuantization) {
      handleQuantizedTrigger(timestamp, layer.state, {
        note,
        x: trigger.x,
        y: trigger.y,
        angle: triggerAngle,
        worldX: trigger.x,
        worldY: trigger.y,
        layerId: layer.id,
        isSubframe: true,
        camera,
        renderer
      });
    } else {
      // Play note immediately
      if (audioCallback) {
        audioCallback(note);
      }
      
      // Create visual marker
      createMarker(
        triggerAngle,
        trigger.x,
        trigger.y,
        scene,
        note,
        camera,
        renderer,
        false,
        layer
      );
    }
    
    // Add to triggered points
    triggeredPoints.push({
      x: trigger.x,
      y: trigger.y,
      z: trigger.z,
      note,
      angle: triggerAngle,
      copyIndex: trigger.copyIndex,
      vertexIndex: trigger.vertexIndex,
      layerId: layer.id
    });
  }
  
  return triggeredPoints;
}

/**
 * Clear all markers for a layer
 * @param {Layer} layer Layer to clear markers for
 */
export function clearLayerMarkers(layer) {
  // Skip if layer doesn't exist
  if (!layer) {
    return;
  }
  
  // If layer has markers array, properly dispose of each marker
  if (layer.markers && Array.isArray(layer.markers)) {
    // Get a reference to the scene from the first marker, if available
    const scene = layer.markers.length > 0 && layer.markers[0].parent ? 
      layer.markers[0].parent : null;
    
    // Process each marker
    for (const marker of layer.markers) {
      // Remove from scene if still attached
      if (marker.parent) {
        marker.parent.remove(marker);
      } else if (scene) {
        scene.remove(marker);
      }
      
      // Remove any associated label
      if (marker.userData && marker.userData.label) {
        removeLabel(marker.userData.label.id);
      }
      
      // Dispose of geometry
      if (marker.geometry) {
        marker.geometry.dispose();
      }
      
      // Dispose of material(s)
      if (marker.material) {
        if (Array.isArray(marker.material)) {
          marker.material.forEach(mat => {
            if (mat) mat.dispose();
          });
        } else {
          marker.material.dispose();
        }
      }
    }
    
    // Clear the markers array
    layer.markers = [];
  } else {
    // Initialize empty markers array if not exists
    layer.markers = [];
  }
  
  // Also clean up any stored trigger state for this layer
  if (layer.id) {
    // Clean vertex positions for this layer in the subframe engine
    if (subframeEngine) {
      // Delete all vertexStates that start with this layer's ID
      for (const [id, states] of subframeEngine.vertexStates.entries()) {
        if (id.startsWith(`${layer.id}-`)) {
          subframeEngine.vertexStates.delete(id);
          subframeEngine.vertexLastAccessed.delete(id);
          subframeEngine.recentCrossings.delete(id);
        }
      }
    }
    
    // Clean recent triggers for this layer
    for (const [key, value] of recentTriggers.entries()) {
      if (key.startsWith(`${layer.id}-`)) {
        recentTriggers.delete(key);
      }
    }
  }
}