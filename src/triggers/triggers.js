// src/triggers/triggers.js - Complete redesign for layer system
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

// Debug flag to control logging
const DEBUG_LOGGING = false;

// Debug flag for star cuts (intersection points)
const DEBUG_STAR_CUTS = false;

// Map to track triggered points and prevent re-triggering
const recentTriggers = new Map();

// Store for pending triggers when using quantization
let pendingTriggers = [];

// Enhanced trigger detection constants - optimized for ultra-high precision
const MAX_ANGLE_STEP = Math.PI / 24; // 7.5 degrees - reduced for more interpolation
const INTERPOLATION_STEPS = 32; // Increased from 8 to 32 for smoother sub-frame detection

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
 * Interpolate between two angles, handling wraparound correctly
 * @param {number} startAngle Start angle in radians
 * @param {number} endAngle End angle in radians
 * @param {number} t Interpolation factor (0-1)
 * @returns {number} Interpolated angle in radians
 */
function interpolateAngle(startAngle, endAngle, t) {
  // Normalize angles to [0, 2π]
  const normalizeAngle = (angle) => {
    while (angle < 0) angle += 2 * Math.PI;
    while (angle >= 2 * Math.PI) angle -= 2 * Math.PI;
    return angle;
  };

  const start = normalizeAngle(startAngle);
  const end = normalizeAngle(endAngle);
  
  // Calculate the shortest path between angles
  let diff = end - start;
  if (diff > Math.PI) {
    diff -= 2 * Math.PI;
  } else if (diff < -Math.PI) {
    diff += 2 * Math.PI;
  }
  
  const result = start + diff * t;
  return normalizeAngle(result);
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
    console.warn(`Invalid coordinates for frequency calculation: x=${x}, y=${y}`);
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
    console.warn(`Invalid distance calculated from coordinates: x=${x}, y=${y}, distance=${distance}`);
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
    console.warn(`Invalid frequency calculated: distance=${distance}, using default 440Hz`);
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
      console.warn(`Equal temperament calculation failed: ${e.message}, using unquantized frequency`);
    }
  }
  
  // Final safety check - if after all processing frequency is still NaN, use default
  if (isNaN(frequency)) {
    console.warn(`Frequency still invalid after processing, using default 440Hz`);
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
  const tolerance = 0.001; // Reduced to 1ms tolerance for better high BPM precision
  
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
          console.log(`[PENDING TRIGGER] Timing delta: ${(timingDelta * 1000).toFixed(2)}ms, scheduled: ${executeTime.toFixed(4)}, actual: ${currentTime.toFixed(4)}`);
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
 * Create a marker at the given coordinates with note information
 * @param {number} angle Current rotation angle in radians
 * @param {number} worldX X coordinate in world space
 * @param {number} worldY Y coordinate in world space
 * @param {THREE.Scene} scene Scene to add marker to
 * @param {Object} note Note object with frequency, duration, velocity info
 * @param {THREE.Camera} camera Camera for label positioning
 * @param {THREE.WebGLRenderer} renderer Renderer for label positioning
 * @param {boolean} isQuantized Whether this is a quantized trigger
 * @param {Object} layer The layer object this marker belongs to
 * @returns {Object} Created marker
 */
function createMarker(angle, worldX, worldY, scene, note, camera = null, renderer = null, isQuantized = false, layer = null) {
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
  // Calculate if the line segment from prev to curr crosses the X axis
  const crossesXAxis = (prevY > 0 && currY <= 0) || (prevY <= 0 && currY > 0);
  
  // Calculate if the line segment from prev to curr crosses the Y axis
  const crossesYAxis = (prevX > 0 && currX <= 0) || (prevX <= 0 && currX > 0);
  
  // If no crossing, return early
  if (!crossesXAxis && !crossesYAxis) {
    return { crossed: false };
  }
  
  // Calculate the precise intersection point
  let intersection = null;
  let axis = '';
  
  if (crossesXAxis) {
    // Calculate X coordinate where segment crosses Y=0
    const t = prevY / (prevY - currY);
    const xAtCrossing = prevX + t * (currX - prevX);
    
    intersection = { x: xAtCrossing, y: 0 };
    axis = 'x';
  }
  
  if (crossesYAxis) {
    // Calculate Y coordinate where segment crosses X=0
    const t = prevX / (prevX - currX);
    const yAtCrossing = prevY + t * (currY - prevY);
    
    // If we already found an X axis crossing, choose the closest one
    if (intersection) {
      const distX = Math.sqrt(Math.pow(intersection.x, 2));
      const distY = Math.sqrt(Math.pow(yAtCrossing, 2));
      
      if (distY < distX) {
        intersection = { x: 0, y: yAtCrossing };
        axis = 'y';
      }
    } else {
      intersection = { x: 0, y: yAtCrossing };
      axis = 'y';
    }
  }
  
  return {
    crossed: true,
    axis,
    intersection
  };
}

/**
 * Check if the angle change has crossed an axis with enhanced interpolation
 * @param {Object} layer - The layer being processed
 * @param {number} lastAngle - Previous angle in radians
 * @param {number} angle - Current angle in radians
 * @param {number} bpm - Current BPM
 * @returns {boolean} True if we should process triggers
 */
function shouldProcessTriggers(layer, lastAngle, angle, bpm) {
  // Skip if angles are invalid
  if (isNaN(lastAngle) || isNaN(angle)) return false;
  
  // Calculate the absolute angle delta
  let angleDelta = Math.abs(angle - lastAngle);
  
  // Handle wraparound cases for more accurate detection
  if (angleDelta > Math.PI) {
    angleDelta = 2 * Math.PI - angleDelta;
  }
  
  // Ultra-high precision dynamicMinDelta based on BPM
  // Reduced threshold for maximum precision across all frequencies
  const dynamicMinDelta = Math.max(0.00005, bpm / 480000); // Scale with BPM
  
  // Skip processing if angle change is too small
  if (angleDelta < dynamicMinDelta) {
    return false;
  }
  
  // Determine if we need interpolation based on angle delta
  const needsInterpolation = angleDelta > MAX_ANGLE_STEP;
  
  // Number of processing steps (more interpolation for larger angles)
  const processSteps = needsInterpolation ? INTERPOLATION_STEPS : 1;
  
  // Store in layer state for access by other functions
  layer.state.processSteps = processSteps;
  layer.state.needsInterpolation = needsInterpolation;
  
  return true;
}

/**
 * Detect intersections between the geometry's vertices and coordinate axes
 * Enhanced with interpolation for high-precision detection across all frequencies
 */
function detectIntersectionTriggers(
  copyGroup, layer, copyIndex, angle, lastAngle, tNow, audioCallback, 
  triggeredNow, triggeredPoints, inverseRotationMatrix, rotationMatrix, 
  isLerping
) {
  // Safety check to ensure we have all required objects
  if (!copyGroup || !layer || !layer.baseGeo) return;
  
  // Get a reference to the geometry
  const geometry = layer.baseGeo;
  
  // Get position attribute from buffer geometry
  const positionAttribute = geometry.getAttribute('position');
  
  // Skip if no position attribute
  if (!positionAttribute) {
    if (DEBUG_LOGGING) {
      console.warn(`[TRIGGER] No position attribute found in geometry for layer ${layer.id}`);
    }
    return;
  }
  
  // Get current BPM for dynamic threshold calculation
  const bpm = layer.bpm || 120;
  
  // Calculate a dynamic MAX_REASONABLE_MOVEMENT based on BPM
  const MAX_REASONABLE_MOVEMENT = 100 + (bpm * 2); // Higher threshold for high BPM
  
  // Process each vertex in the geometry
  const vertexCount = positionAttribute.count;
  const vertex = new THREE.Vector3();
  const worldPos = new THREE.Vector3();
  const prevWorldPos = new THREE.Vector3();
  
  for (let i = 0; i < vertexCount; i++) {
    // Get vertex position from buffer attribute
    vertex.fromBufferAttribute(positionAttribute, i);
    
    // Skip if vertex is not valid
    if (isNaN(vertex.x) || isNaN(vertex.y)) continue;
    
    // Track if this vertex was already processed in this frame to avoid duplicates
    const vertexKey = `${copyIndex}-${i}`;
    if (triggeredNow.has(vertexKey)) continue;
    
    // Get the current world position of the vertex
    worldPos.copy(vertex);
    worldPos.applyMatrix4(rotationMatrix);
    
    // Get the previous position by applying the inverse rotation
    prevWorldPos.copy(vertex);
    prevWorldPos.applyMatrix4(inverseRotationMatrix);
    
    // Calculate movement distance between frames
    const positionDistance = distanceBetweenPoints(
      prevWorldPos.x, prevWorldPos.y,
      worldPos.x, worldPos.y
    );
    
    // Skip unreasonable movements (likely due to initialization or drastic changes)
    if (positionDistance > MAX_REASONABLE_MOVEMENT) {
      if (DEBUG_LOGGING) {
        console.log(`[TRIGGER] Skipping unreasonable movement: ${positionDistance.toFixed(1)} > ${MAX_REASONABLE_MOVEMENT}`);
      }
      continue;
    }
    
    // Check for axis crossings with enhanced precision
    const crossingResult = checkEnhancedAxisCrossing(
      prevWorldPos.x, prevWorldPos.y,
      worldPos.x, worldPos.y
    );
    
    // If no crossing, skip to next vertex
    if (!crossingResult || !crossingResult.crossed) continue;
    
    // Axis crossing detected - prepare trigger information
    const { crossed, axis, intersection } = crossingResult;
    
    // Verify the intersection point exists
    if (!intersection || typeof intersection.x !== 'number' || typeof intersection.y !== 'number') continue;
    
    // Generate a unique ID for this trigger point
    const triggerKey = `${copyIndex}-${i}-${axis}-${Math.floor(tNow * 1000)}`;
    
    // Process the trigger - no cooldown check needed with optimized system
    // Get the precise intersection point
    const { x: trigX, y: trigY } = intersection;
    
    // Generate frequency information
    const frequencyInfo = getFrequency(trigX, trigY, layer.state);
    
    // Skip if frequency calculation failed
    if (!frequencyInfo || typeof frequencyInfo.frequency !== 'number') continue;
    
    // Create the note object
    const note = createNote({
      frequency: frequencyInfo.frequency,
      noteName: frequencyInfo.noteName,
      x: trigX,
      y: trigY,
      copyIndex,
      vertexIndex: i,
      isIntersection: false
    }, layer.state);
    
    // Mark this vertex as triggered in this frame
    triggeredNow.add(vertexKey);
    
    // Mark this exact position as triggered
    triggeredPoints.push({
      x: trigX,
      y: trigY,
      copyIndex,
      vertexIndex: i,
      axis,
      time: tNow
    });
    
    // Create a world coordinate for the marker
    const worldRot = new THREE.Vector2(trigX, trigY);
    
    // Check if we need to quantize this trigger
    if (layer.state.useQuantization) {
      // Handle quantization logic
      const triggerInfo = {
        note: {...note},
        worldRot: angle,
        camera: layer.group.userData.camera,
        renderer: layer.group.userData.renderer,
        isQuantized: true,
        layer
      };
      
      // Process quantization
      const { shouldTrigger, triggerTime, isQuantized } = handleQuantizedTrigger(tNow, layer.state, triggerInfo);
      
      if (shouldTrigger) {
        audioCallback(note);
        
        // Create visual marker
        if (layer.showTriggerMarkers !== false) {
          createMarker(
            angle, 
            trigX, 
            trigY, 
            layer.group.parent, 
            note,
            layer.group.userData.camera, 
            layer.group.userData.renderer,
            isQuantized,
            layer
          );
        }
      }
    } else {
      // Immediate trigger (no quantization)
      audioCallback(note);
      
      // Create visual marker
      if (layer.showTriggerMarkers !== false) {
        createMarker(
          angle, 
          trigX, 
          trigY, 
          layer.group.parent, 
          note,
          layer.group.userData.camera, 
          layer.group.userData.renderer,
          false,
          layer
        );
      }
    }
  }
}

/**
 * Detect all triggers for a single layer
 * Enhanced for ultra-high precision across all frequencies
 */
export function detectLayerTriggers(layer, tNow, audioCallback) {
  // Skip if layer is not valid or not visible
  if (!layer || !layer.visible || layer.suspended) return [];
  
  // Get the group containing the geometry
  const group = layer.group;
  if (!group) return [];
  
  // Check if layer has valid geometry
  if (!layer.baseGeo) {
    if (DEBUG_LOGGING) {
      console.warn(`[TRIGGER] Layer ${layer.id} has no baseGeo property`);
    }
    return [];
  }
  
  // Track all triggered points to prevent duplicates
  const triggeredPoints = [];
  
  // Use a Set for faster lookup of already triggered vertices in this frame
  const triggeredNow = new Set();
  
  // Get the current and previous angles
  const angle = layer.state.angle || 0;
  const lastAngle = layer.state.lastAngle || 0;
  
  // Skip if angles are the same (no rotation)
  if (angle === lastAngle) return [];
  
  // Get current BPM for dynamic calculations
  const bpm = layer.bpm || 120;
  
  // Reduce geometry grace period based on BPM for faster processing at high BPM
  const GEOMETRY_GRACE_PERIOD = Math.max(8, 500/bpm); // Adaptive grace period in ms
  
  // Skip if geometry was just created (prevents initialization triggers)
  const timeSinceCreation = tNow * 1000 - (layer.creationTime || 0);
  if (timeSinceCreation < GEOMETRY_GRACE_PERIOD) {
    return [];
  }
  
  // Check if we should process triggers based on angle change
  if (!shouldProcessTriggers(layer, lastAngle, angle, bpm)) {
    return [];
  }
  
  // If layer is using dynamic position changes (lerping),
  // optimize for high-frequency changes
  const isLerping = layer.state.isLerping === true;
  
  // Create transformation matrices for current and previous positions
  const rotationMatrix = new THREE.Matrix4().makeRotationZ(angle);
  const inverseRotationMatrix = new THREE.Matrix4().makeRotationZ(lastAngle);
  
  // Get the number of steps needed for proper interpolation
  const processSteps = layer.state.processSteps || 1;
  
  // Process each copy of the geometry
  const copies = group.children || [];
  for (let copyIndex = 0; copyIndex < copies.length; copyIndex++) {
    const copyGroup = copies[copyIndex];
    if (!copyGroup) continue;
    
    // Check for axis crossing triggers with interpolation if needed
    detectIntersectionTriggers(
      copyGroup, layer, copyIndex, angle, lastAngle, tNow, audioCallback,
      triggeredNow, triggeredPoints, inverseRotationMatrix, rotationMatrix,
      isLerping
    );
  }
  
  // Return the triggered points
  return triggeredPoints;
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
 * Legacy function for compatibility
 */
export function detectTriggers(baseGeo, lastAngle, angle, copies, group, lastTrig, tNow, audioCallback) {
  // Try to find the layer from the group
  let layer = null;
  
  // Check if we have a layer manager
  if (group.parent && group.parent._layerManager) {
    // First try to get layer by group's userData layerId
    if (group.userData && group.userData.layerId !== undefined) {
      layer = group.parent._layerManager.layers.find(l => l.id === group.userData.layerId);
    }
    
    // If that failed, use active layer
    if (!layer) {
      layer = group.parent._layerManager.getActiveLayer();
    }
    
    // If we found a layer, delegate to the new method
    if (layer) {
      // Update layer state with the provided arguments
      layer.previousAngle = lastAngle;
      layer.currentAngle = angle;
      layer.baseGeo = baseGeo;
      layer.lastTrig = lastTrig;
      
      // Call the new method
      return detectLayerTriggers(layer, tNow, audioCallback);
    }
  }
  
  // If no layer found, use legacy fallback behavior
  const triggeredNow = new Set();
  
  console.warn("Using legacy trigger detection - layer system not found");
  
  return triggeredNow;
}

/**
 * Legacy function for compatibility
 */
export function clearExpiredMarkers(scene, markers) {
  // If we have a layer manager, clear markers for all layers
  if (scene && scene._layerManager && scene._layerManager.layers) {
    for (const layer of scene._layerManager.layers) {
      clearLayerMarkers(layer);
    }
    return;
  }
  
  // Legacy fallback
  if (!markers || !Array.isArray(markers)) return;
  
  for (let j = markers.length - 1; j >= 0; j--) {
    const marker = markers[j];
    marker.life--;
    
    // Update opacity
    if (marker.mesh && marker.mesh.material) {
      const fadeProgress = marker.life / MARK_LIFE;
      const baseOpacity = marker.noteInfo ? marker.noteInfo.velocity : 0.7;
      marker.mesh.material.opacity = baseOpacity * fadeProgress;
      
      // Only change color for hit markers, preserve the original color otherwise
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

// Legacy functions for compatibility
export function getRotatedPosition(x, y, rotationAngle) {
  return {
    x: x * Math.cos(rotationAngle) - y * Math.sin(rotationAngle),
    y: x * Math.sin(rotationAngle) + y * Math.cos(rotationAngle)
  };
}

/**
 * Check for axis crossings with improved precision
 */
export function checkAxisCrossing(prevX, prevY, currX, currY) {
  const result = checkEnhancedAxisCrossing(prevX, prevY, currX, currY);
  return result.crossed;
}

export function resetGlobalSequentialIndex() {
  // Clear all recent triggers
  recentTriggers.clear();
}