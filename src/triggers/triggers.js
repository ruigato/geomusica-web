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
import { TemporalTriggerEngine } from '../SubframeTrigger.js';

// Debug flag to control logging
const DEBUG_LOGGING = false;

// Debug flag for star cuts (intersection points)
const DEBUG_STAR_CUTS = false;

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
let lastPositionRecordTime = 0;

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
      
      // If equal temperament is enabled, show both the original frequency and the note name
      if (layer.state.useEqualTemperament && note.noteName) {
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
  recentTriggers.clear();
  pendingTriggers = [];
  
  // Also reset the subframe engine
  if (subframeEngine) {
    subframeEngine.clearAllHistory();
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

/**
 * Detect triggers for intersection points (including star cuts)
 * This function processes the intersection markers in each copy group
 * @param {Object} copyGroup - The copy group containing intersection markers
 * @param {Object} layer - The layer object
 * @param {number} copyIndex - The index of the current copy
 * @param {number} angle - Current rotation angle
 * @param {number} lastAngle - Previous rotation angle
 * @param {number} tNow - Current time
 * @param {Function} audioCallback - Callback function for triggered audio
 * @param {Set} triggeredNow - Set of already triggered points
 * @param {Array} triggeredPoints - Array of triggered point positions
 * @param {THREE.Matrix4} inverseRotationMatrix - Matrix to remove rotation
 * @param {THREE.Matrix4} rotationMatrix - Matrix to apply rotation
 * @param {boolean} isLerping - Whether values are currently being lerped
 * @param {number} LERPING_TRIGGER_COOLDOWN - Cooldown time for triggers during lerping
 * @returns {boolean} True if any triggers were detected
 */
function detectIntersectionTriggers(
  copyGroup, layer, copyIndex, angle, lastAngle, tNow, audioCallback, 
  triggeredNow, triggeredPoints, inverseRotationMatrix, rotationMatrix, 
  isLerping, LERPING_TRIGGER_COOLDOWN
) {
  // Debug when this function is called
  if (DEBUG_STAR_CUTS) {
    
  }
  
  // Check if this copy group has intersection markers
  if (!copyGroup || !copyGroup.userData) {
    if (DEBUG_STAR_CUTS) {
      
    }
    return false;
  }
  
  // Improved detection of intersection marker group
  let intersectionGroup = null;
  
  // First, check the standard location
  if (copyGroup.userData.intersectionMarkerGroup) {
    intersectionGroup = copyGroup.userData.intersectionMarkerGroup;
  } else {
    // Try to find an intersection group as a direct child
    for (let i = 0; copyGroup.children && i < copyGroup.children.length; i++) {
      const child = copyGroup.children[i];
      if (child.userData && child.userData.isIntersectionGroup) {
        intersectionGroup = child;
        break;
      }
    }
  }
  
  if (!intersectionGroup || !intersectionGroup.children) {
    if (DEBUG_STAR_CUTS) {
      
    }
    return false;
  }
  
  if (DEBUG_STAR_CUTS) {
    
  }
  
  // Get layer data
  const state = layer.state;
  const scene = layer.group?.parent;
  
  // Skip if no scene or state
  if (!scene || !state) {
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
  
  // Determine if these are star cut intersections
  const isStarCuts = state.useStars && state.useCuts && state.starSkip > 1;
  
  if (isStarCuts && DEBUG_STAR_CUTS) {
    
  }
  
  // Create a map for vertices that have already been checked
  if (!layer.prevIntersectionVertices) {
    layer.prevIntersectionVertices = new Map();
  }
  
  // Temp vectors for calculations
  const worldPos = new THREE.Vector3();
  const prevWorldPos = new THREE.Vector3();
  
  // Get the current world matrix of the copy group
  const tempWorldMatrix = new THREE.Matrix4();
  intersectionGroup.updateMatrixWorld();
  tempWorldMatrix.copy(intersectionGroup.matrixWorld);
  
  // Apply the inverse rotation to get the unrotated world positions
  tempWorldMatrix.premultiply(inverseRotationMatrix);
  
  // Track if any triggers occurred
  let anyTriggers = false;
  let triggersCount = 0;
  
  // Process each intersection marker (point)
  for (let i = 0; i < intersectionGroup.children.length; i++) {
    const marker = intersectionGroup.children[i];
    
    // Skip non-mesh objects
    if (marker.type !== 'Mesh') {
      continue;
    }
    
    // Create a unique key for this intersection point
    const key = `${layer.id}-intersection-${copyIndex}-${i}`;
    
    // Skip if already triggered in this frame
    if (triggeredNow.has(key)) {
      if (DEBUG_STAR_CUTS) {
        
      }
      continue;
    }
    
    try {
      // Get current marker world position (unrotated)
      worldPos.copy(marker.position);
      
      // Skip invalid positions
      if (isNaN(worldPos.x) || isNaN(worldPos.y) || isNaN(worldPos.z)) {
        continue;
      }
      
      // Apply unrotated world matrix to get position in world space
      worldPos.applyMatrix4(tempWorldMatrix);
      
      // Store original non-rotated position for frequency calculation
      const nonRotatedPos = worldPos.clone();
      
      // Apply rotation manually for trigger detection
      worldPos.applyMatrix4(rotationMatrix);
      
      // Get previous vertex world position
      let hasPrevPos = false;
      if (layer.prevIntersectionVertices.has(key)) {
        prevWorldPos.copy(layer.prevIntersectionVertices.get(key));
        hasPrevPos = true;
      } else {
        // For first frame, use current position
        prevWorldPos.copy(worldPos);
      }
      
      // Store current position for next frame (with rotation)
      layer.prevIntersectionVertices.set(key, worldPos.clone());
      
      // Skip trigger detection if we don't have previous positions
      if (!hasPrevPos) {
        continue;
      }
      
      // Check for large position changes (likely due to geometry changes)
      const positionDistance = prevWorldPos.distanceTo(worldPos);
      const MAX_REASONABLE_MOVEMENT = 50; // Maximum reasonable movement between frames
      
      if (positionDistance > MAX_REASONABLE_MOVEMENT) {
        if (DEBUG_STAR_CUTS) {
          
        }
        continue;
      }
      
      // Unwrap position values
      const currX = worldPos.x;
      const currY = worldPos.y;
      const prevX = prevWorldPos.x;
      const prevY = prevWorldPos.y;
      
      // Enhanced crossing detection with interpolation support
      const { hasCrossed, crossingFactor } = checkEnhancedAxisCrossing(prevX, prevY, currX, currY);
      
      // Skip if not triggered this frame
      if (hasCrossed && !layer.lastTrig.has(key)) {
        // Only apply rate limiting during lerping
        if (isLerping) {
          // Check if this intersection is in cooldown period
          const now = performance.now();
          const lastTriggerTime = layer._triggersTimestamps.get(key) || 0;
          const timeSinceLastTrigger = now - lastTriggerTime;
          
          // Skip if we're still in the cooldown period
          if (timeSinceLastTrigger < LERPING_TRIGGER_COOLDOWN) {
            continue;
          }
          
          // Update the timestamp for this intersection
          layer._triggersTimestamps.set(key, now);
        }
        
        // Check for overlap with previously triggered points
        if (!isPointOverlapping(currX, currY, triggeredPoints)) {
          // Add to triggered points
          triggeredPoints.push({ x: currX, y: currY });
          
          // Use the non-rotated position from the transformed geometry
          // This already has all scaling factors applied (including modulus)
          const nonRotatedX = nonRotatedPos.x;
          const nonRotatedY = nonRotatedPos.y;
          
          // Calculate frequency directly from the transformed coordinates
          const frequency = Math.hypot(nonRotatedX, nonRotatedY);
          
          // Calculate more accurate timing based on crossing factor
          const adjustedTime = tNow - (1 - crossingFactor) * (1000 / 120);
          
          // Create a note object for this intersection point
          const note = createNote({
            x: nonRotatedX,
            y: nonRotatedY,
            isIntersection: true,
            isStarCut: isStarCuts, // Set isStarCut flag based on the state
            intersectionIndex: i,
            copyIndex: copyIndex,
            frequency: frequency,
          }, state);
          
          // Update time information
          note.time = adjustedTime;
          
          // Handle quantization
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
            const { shouldTrigger, triggerTime, isQuantized } = handleQuantizedTrigger(tNow, state, triggerInfo);
            
            if (shouldTrigger) {
              // Trigger with precise time
              const noteCopy = {...note};
              noteCopy.time = triggerTime;
              
              // Trigger audio
              audioCallback(noteCopy);
              
              // Create marker
              createMarker(angle, currX, currY, scene, noteCopy, camera, renderer, isQuantized, layer);
              
              if (DEBUG_STAR_CUTS) {
                
              }
              
              // Increment counter
              triggersCount++;
              anyTriggers = true;
            }
          } else {
            // Regular non-quantized trigger
            audioCallback(note);
            
            // Create marker
            createMarker(angle, currX, currY, scene, note, camera, renderer, false, layer);
            
            if (DEBUG_STAR_CUTS) {
              
            }
            
            // Increment counter
            triggersCount++;
            anyTriggers = true;
          }
          
          // Add to triggered set
          triggeredNow.add(key);
        }
      }
    } catch (error) {
      console.error(`Error in intersection trigger detection for layer ${layer.id}, intersection ${i}:`, error);
    }
  }
  
  // Log summary if any triggers occurred
  if (anyTriggers && DEBUG_STAR_CUTS) {
    
  }
  
  return anyTriggers;
}

/**
 * Detect triggers for a layer using subframe precision
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
  
  // Skip processing if group is not visible
  if (!group.visible) {
    return false;
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
  
  // SUBFRAME ENHANCEMENT: Record positions at fixed intervals
  // This decouples position recording from frame rate for more consistent trigger detection
  if (tNow - lastPositionRecordTime >= POSITION_RECORD_INTERVAL) {
    recordLayerVertexPositions(layer, tNow);
    lastPositionRecordTime = tNow;
  }
  
  // SUBFRAME ENHANCEMENT: Check for triggers with subframe precision
  return detectSubframeTriggers(layer, tNow, audioCallback, camera, renderer, scene);
}

/**
 * Record vertex positions for a layer into the subframe engine
 * @param {Object} layer Layer to record positions for
 * @param {number} timestamp Current time in seconds
 */
function recordLayerVertexPositions(layer, timestamp) {
  if (!layer || !layer.group) return;
  
  const state = layer.state;
  const group = layer.group;
  
  // Skip if group is not visible
  if (!group.visible) return;
  
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
  if (copies <= 0 || state.segments <= 0) return;
  
  // Get angle for rotation calculations
  const angle = layer.currentAngle || 0;
  
  // Create matrices for calculations
  const inverseRotationMatrix = new THREE.Matrix4().makeRotationZ(-angle);
  const rotationMatrix = new THREE.Matrix4().makeRotationZ(angle);
  
  // Process each copy
  for (let ci = 0; ci < copies; ci++) {
    // Find the correct copy group
    let copyIndex = ci;
    let copyGroup = null;
    let foundCopyCount = 0;
    
    // Find the copy group, skipping non-copy groups
    for (let i = 0; i < group.children.length; i++) {
      const child = group.children[i];
      // Skip debug objects and intersection groups
      if (child.userData && child.userData.isIntersectionGroup) continue;
      if (child.type === 'Mesh' && child.geometry && child.geometry.type === 'SphereGeometry') continue;
      if (child.type === 'Line') continue;
      
      // Count this as a valid copy group
      if (foundCopyCount === ci) {
        copyGroup = child;
        break;
      }
      
      // Otherwise, increment our counter and continue
      foundCopyCount++;
    }
    
    // Skip if we couldn't find a valid copy group
    if (!copyGroup || !copyGroup.children || copyGroup.children.length === 0) {
      continue;
    }
    
    // Find the LineLoop (main geometry)
    const mesh = copyGroup.children.find(child => child.type === 'LineLoop');
    if (!mesh) {
      continue;
    }
    
    // Validate geometry and attributes
    if (!mesh.geometry || !mesh.geometry.getAttribute('position')) {
      continue;
    }
    
    const positions = mesh.geometry.getAttribute('position');
    if (!positions || !positions.count) {
      continue;
    }
    
    const count = positions.count;
    
    // Calculate world matrix without rotation
    const tempWorldMatrix = new THREE.Matrix4();
    mesh.updateMatrixWorld();
    tempWorldMatrix.copy(mesh.matrixWorld);
    tempWorldMatrix.premultiply(inverseRotationMatrix);
    
    // Temp vector for calculations
    const worldPos = new THREE.Vector3();
    
    // Process each vertex in this copy
    for (let vi = 0; vi < count; vi++) {
      // Create a unique vertex ID
      const vertexId = `${layer.id}-${ci}-${vi}`;
      
      try {
        // Get current vertex world position (unrotated)
        worldPos.fromBufferAttribute(positions, vi);
        
        // Skip invalid vertices
        if (isNaN(worldPos.x) || isNaN(worldPos.y) || isNaN(worldPos.z)) {
          continue;
        }
        
        // Apply unrotated world matrix to get position in world space
        worldPos.applyMatrix4(tempWorldMatrix);
        
        // Apply rotation for trigger detection
        const rotatedPos = worldPos.clone().applyMatrix4(rotationMatrix);
        
        // Record position in subframe engine
        subframeEngine.recordVertexPosition(
          vertexId,
          {
            x: rotatedPos.x,
            y: rotatedPos.y,
            z: rotatedPos.z
          },
          timestamp
        );
      } catch (error) {
        console.error(`Error recording vertex position for layer ${layer.id}, copy ${ci}, vertex ${vi}:`, error);
      }
    }
    
    // Also record intersection points
    recordIntersectionPoints(copyGroup, layer, ci, angle, timestamp, inverseRotationMatrix, rotationMatrix);
  }
}

/**
 * Record intersection points for subframe detection
 * @param {Object} copyGroup Copy group containing intersections
 * @param {Object} layer Layer object
 * @param {number} ci Copy index
 * @param {number} angle Current rotation angle
 * @param {number} timestamp Current time
 * @param {THREE.Matrix4} inverseRotationMatrix Matrix to remove rotation
 * @param {THREE.Matrix4} rotationMatrix Matrix to apply rotation
 */
function recordIntersectionPoints(copyGroup, layer, ci, angle, timestamp, inverseRotationMatrix, rotationMatrix) {
  // Improved detection of intersection marker group
  let intersectionGroup = null;
  
  // First, check the standard location
  if (copyGroup.userData && copyGroup.userData.intersectionMarkerGroup) {
    intersectionGroup = copyGroup.userData.intersectionMarkerGroup;
  } else {
    // Try to find an intersection group as a direct child
    for (let i = 0; copyGroup.children && i < copyGroup.children.length; i++) {
      const child = copyGroup.children[i];
      if (child.userData && child.userData.isIntersectionGroup) {
        intersectionGroup = child;
        break;
      }
    }
  }
  
  if (!intersectionGroup || !intersectionGroup.children) {
    return;
  }
  
  // Get the current world matrix of the copy group
  const tempWorldMatrix = new THREE.Matrix4();
  intersectionGroup.updateMatrixWorld();
  tempWorldMatrix.copy(intersectionGroup.matrixWorld);
  
  // Apply the inverse rotation to get the unrotated world positions
  tempWorldMatrix.premultiply(inverseRotationMatrix);
  
  // Temp vector for calculations
  const worldPos = new THREE.Vector3();
  
  // Process each intersection marker
  for (let i = 0; i < intersectionGroup.children.length; i++) {
    const marker = intersectionGroup.children[i];
    
    // Skip non-mesh objects
    if (marker.type !== 'Mesh') {
      continue;
    }
    
    // Create a unique key for this intersection point
    const vertexId = `${layer.id}-intersection-${ci}-${i}`;
    
    try {
      // Get current marker world position (unrotated)
      worldPos.copy(marker.position);
      
      // Skip invalid positions
      if (isNaN(worldPos.x) || isNaN(worldPos.y) || isNaN(worldPos.z)) {
        continue;
      }
      
      // Apply unrotated world matrix to get position in world space
      worldPos.applyMatrix4(tempWorldMatrix);
      
      // Apply rotation for trigger detection
      const rotatedPos = worldPos.clone().applyMatrix4(rotationMatrix);
      
      // Record position in subframe engine
      subframeEngine.recordVertexPosition(
        vertexId,
        {
          x: rotatedPos.x,
          y: rotatedPos.y,
          z: rotatedPos.z
        },
        timestamp
      );
    } catch (error) {
      console.error(`Error recording intersection position for layer ${layer.id}, copy ${ci}, intersection ${i}:`, error);
    }
  }
}

/**
 * Detect triggers using subframe precision
 * @param {Object} layer Layer to detect triggers for
 * @param {number} timestamp Current time in seconds
 * @param {Function} audioCallback Callback for triggered audio
 * @param {THREE.Camera} camera Camera for visual feedback
 * @param {THREE.WebGLRenderer} renderer Renderer for visual feedback
 * @param {THREE.Scene} scene Scene for adding visual markers
 * @returns {boolean} True if any triggers were detected
 */
function detectSubframeTriggers(layer, timestamp, audioCallback, camera, renderer, scene) {
  if (!layer || !layer.group || !audioCallback) return false;
  
  const state = layer.state;
  const group = layer.group;
  
  // Skip if group is not visible
  if (!group.visible) return false;
  
  // Get cooldown time from state or use default
  const cooldownTime = state.triggerCooldown || DEFAULT_COOLDOWN_TIME;
  
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
  if (copies <= 0 || state.segments <= 0) return false;
  
  // Get angle for calculations
  const angle = layer.currentAngle || 0;
  
  // Setup variables for tracking triggers
  const triggeredNow = new Set();
  const triggeredPoints = [];
  let anyTriggers = false;
  
  // Process each copy
  for (let ci = 0; ci < copies; ci++) {
    // Process each vertex in this copy
    for (let vi = 0; vi < state.segments; vi++) {
      // Create a unique vertex ID
      const vertexId = `${layer.id}-${ci}-${vi}`;
      
      try {
        // Check for trigger crossing with subframe precision
        const crossingResult = subframeEngine.detectCrossing(vertexId, cooldownTime);
        
        // Process if crossing detected
        if (crossingResult.hasCrossed) {
          // Get the base geometry for frequency calculation
          if (!layer.baseGeo || !layer.baseGeo.getAttribute('position') || !layer.baseGeo.getAttribute('position').array) {
            continue;
          }
          
          const basePositions = layer.baseGeo.getAttribute('position').array;
          
          // Check base geometry bounds
          if (vi * 3 + 1 >= basePositions.length) {
            continue;
          }
          
          // Use the position from the crossing result
          const nonRotatedX = crossingResult.position.x;
          const nonRotatedY = crossingResult.position.y;
          
          // Create note based on existing system
          let note;
          
          // Try to use createNote from original system if available
          try {
            note = createNote({
              x: nonRotatedX,
              y: nonRotatedY,
              copyIndex: ci,
              vertexIndex: vi,
              isIntersection: false,
              layerId: layer.id
            }, state);
            
            // Add subframe-specific properties
            note.time = crossingResult.exactTime;
            note.isSubframe = true;
            note.crossingFactor = crossingResult.crossingFactor;
            note.position = crossingResult.position;
          } catch (e) {
            // Fallback if createNote fails
            const frequency = Math.hypot(nonRotatedX, nonRotatedY) * 2;
            note = {
              frequency: frequency,
              noteName: state.useEqualTemperament ? getNoteName(frequency, state.referenceFrequency || 440) : null,
              duration: state.maxDuration || 0.5,
              velocity: state.maxVelocity || 0.8,
              pan: Math.sin(angle),
              x: crossingResult.position.x,
              y: crossingResult.position.y,
              z: crossingResult.position.z,
              time: crossingResult.exactTime,
              isSubframe: true,
              vertexId: vertexId
            };
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
              const { shouldTrigger, triggerTime, isQuantized } = handleQuantizedTrigger(timestamp, state, triggerInfo);
              
              if (shouldTrigger) {
                // Trigger with precise time
                const noteCopy = {...note};
                noteCopy.time = triggerTime;
                
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
              // Regular non-quantized trigger
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
                false, // not quantized
                layer
              );
              
              // Set as triggered
              anyTriggers = true;
            }
            
            // Add to triggered set
            triggeredNow.add(vertexId);
          }
        }
      } catch (error) {
        console.error(`Error in subframe trigger detection for layer ${layer.id}, copy ${ci}, vertex ${vi}:`, error);
      }
    }
    
    // Process intersection points
    detectIntersectionSubframeTriggers(
      layer, ci, angle, timestamp, audioCallback, 
      triggeredNow, triggeredPoints, camera, renderer, scene, cooldownTime
    );
  }
  
  // Update the layer's last triggered set
  layer.lastTrig = triggeredNow;
  
  return anyTriggers;
}

/**
 * Detect intersection triggers using subframe precision
 * @param {Object} layer Layer object
 * @param {number} ci Copy index
 * @param {number} angle Current rotation angle
 * @param {number} timestamp Current time
 * @param {Function} audioCallback Audio callback function
 * @param {Set} triggeredNow Set of already triggered points
 * @param {Array} triggeredPoints Array of triggered point positions
 * @param {THREE.Camera} camera Camera for visual feedback
 * @param {THREE.WebGLRenderer} renderer Renderer for visual feedback
 * @param {THREE.Scene} scene Scene for adding visual markers
 * @param {number} cooldownTime Cooldown time between triggers
 * @returns {boolean} True if any triggers were detected
 */
function detectIntersectionSubframeTriggers(
  layer, ci, angle, timestamp, audioCallback, 
  triggeredNow, triggeredPoints, camera, renderer, scene, cooldownTime
) {
  if (!layer || !layer.group) return false;
  
  const state = layer.state;
  
  // Determine if these are star cut intersections
  const isStarCuts = state.useStars && state.useCuts && state.starSkip > 1;
  
  let anyTriggers = false;
  
  // Process each intersection point
  for (let i = 0; i < 100; i++) { // Use a reasonable upper limit
    // Create a unique vertex ID for the intersection point
    const vertexId = `${layer.id}-intersection-${ci}-${i}`;
    
    try {
      // Check for trigger crossing with subframe precision
      const crossingResult = subframeEngine.detectCrossing(vertexId, cooldownTime);
      
      // Process if crossing detected
      if (crossingResult.hasCrossed) {
        // Skip if already triggered in this frame
        if (triggeredNow.has(vertexId)) continue;
        
        // Check for overlap with previously triggered points
        if (!isPointOverlapping(crossingResult.position.x, crossingResult.position.y, triggeredPoints)) {
          // Add to triggered points
          triggeredPoints.push({ 
            x: crossingResult.position.x, 
            y: crossingResult.position.y 
          });
          
          // Create note based on intersection properties
          const note = createNote({
            x: crossingResult.position.x,
            y: crossingResult.position.y,
            isIntersection: true,
            isStarCut: isStarCuts,
            intersectionIndex: i,
            copyIndex: ci,
            frequency: Math.hypot(crossingResult.position.x, crossingResult.position.y) * 2,
          }, state);
          
          // Add subframe-specific properties
          note.time = crossingResult.exactTime;
          note.isSubframe = true;
          note.crossingFactor = crossingResult.crossingFactor;
          note.position = crossingResult.position;
          
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
            const { shouldTrigger, triggerTime, isQuantized } = handleQuantizedTrigger(timestamp, state, triggerInfo);
            
            if (shouldTrigger) {
              // Trigger with precise time
              const noteCopy = {...note};
              noteCopy.time = triggerTime;
              
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
            // Regular non-quantized trigger
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
              false, // not quantized
              layer
            );
            
            // Set as triggered
            anyTriggers = true;
          }
          
          // Add to triggered set
          triggeredNow.add(vertexId);
        }
      }
    } catch (error) {
      // If we get an error, likely we've reached the end of intersection points
      // No need to process further
      break;
    }
  }
  
  return anyTriggers;
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