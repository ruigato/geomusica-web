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

// Map to track triggered points and prevent re-triggering
const recentTriggers = new Map();

// Store for pending triggers when using quantization
let pendingTriggers = [];

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
 * @param {number} currentTime - Current time in seconds
 * @param {Function} audioCallback - Callback to execute triggers
 * @param {Object} scene - Scene for creating visual markers
 */
export function processPendingTriggers(currentTime, audioCallback, scene) {
  if (pendingTriggers.length === 0) return;
  
  // Find triggers that should be executed
  const triggersToExecute = [];
  const tolerance = 0.005; // 5ms tolerance
  
  while (pendingTriggers.length > 0 && pendingTriggers[0].executeTime <= currentTime + tolerance) {
    triggersToExecute.push(pendingTriggers.shift());
  }
  
  // Execute the triggers
  for (const trigger of triggersToExecute) {
    const { note, worldRot, executeTime, camera, renderer, isQuantized, layer } = trigger;
    
    if (note) {
      // Make a deep copy of the note to ensure we're not modifying the original
      const noteCopy = { ...note };
      noteCopy.time = executeTime;
      
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
  const markerColor = isQuantized ? 0x00ff00 : 0xff00ff; // Green for quantized, pink for normal
  
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
  if (frequency !== null && scene.userData.state && scene.userData.state.showAxisFreqLabels && camera && renderer) {
    // Format frequency with appropriate display
    let displayText;
    
    // If equal temperament is enabled, show both the original frequency and the note name
    if (scene.userData.state.useEqualTemperament && note.noteName) {
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
    textLabel = createAxisLabel(labelId, worldPosition, displayText, camera, renderer);
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
 * Detect triggers for a specific layer
 * @param {Object} layer Layer to process triggers for
 * @param {number} tNow Current time for trigger timing
 * @param {Function} audioCallback Callback function for triggered audio
 * @returns {boolean} True if any triggers were detected
 */
export function detectLayerTriggers(layer, tNow, audioCallback) {
  // Validation checks
  if (!layer) {
    if (DEBUG_LOGGING) console.warn("No layer provided for trigger detection");
    return false;
  }
  
  // Get layer data
  const state = layer.state;
  const group = layer.group;
  
  // Skip processing if group is not visible
  if (!group.visible) {
    return false;
  }
  
  // Ensure lastTrig set exists
  if (!layer.lastTrig) layer.lastTrig = new Set();
  
  // Get the scene from the group's parent
  const scene = group.parent;
  if (!scene) {
    if (DEBUG_LOGGING) console.warn("Cannot find scene for layer:", layer.id);
    return false;
  }
  
  // Get camera and renderer from scene's userData
  const camera = scene?.userData?.camera;
  const renderer = scene?.userData?.renderer;
  
  // FIXED: Check if geometry was recently recreated to prevent false triggers
  // Allow a brief grace period after geometry recreation to let vertex positions stabilize
  if (layer.baseGeo && layer.baseGeo.userData && layer.baseGeo.userData.createdAt) {
    const timeSinceCreation = Date.now() - layer.baseGeo.userData.createdAt;
    const GEOMETRY_GRACE_PERIOD = 100; // 100ms grace period
    
    if (timeSinceCreation < GEOMETRY_GRACE_PERIOD) {
      if (DEBUG_LOGGING) {
        console.log(`Layer ${layer.id}: Skipping trigger detection during geometry grace period (${timeSinceCreation}ms)`);
      }
      return false;
    }
  }
  
  // Setup variables for tracking triggers
  const triggeredNow = new Set();
  const triggeredPoints = [];
  
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
    if (DEBUG_LOGGING) console.log(`Layer ${layer.id}: Skipping trigger detection (copies=${copies}, segments=${state.segments})`);
    return false;
  }
  
  // Skip detection if angle hasn't changed enough
  const lastAngle = layer.previousAngle || 0;
  const angle = layer.currentAngle || 0;
  
  // For radians, a small value is appropriate (0.001 ~ 0.057 degrees)
  const minAngleDelta = 0.0005; 
  
  if (Math.abs(angle - lastAngle) < minAngleDelta) {
    return false;
  }
  
  // FIXED: Debouncing to prevent race conditions during rapid operations
  // Check if we're in a processing state and skip if needed
  if (layer._triggerProcessing) {
    if (DEBUG_LOGGING) console.log(`Layer ${layer.id}: Skipping trigger detection - already processing`);
    return false;
  }
  
  // Set processing flag
  layer._triggerProcessing = true;
  
  try {
    // FIXED: Instead of modifying the actual group rotation, use matrix calculations
    // Store the current rotation state of the group (but don't modify it)
    const originalRotation = group.rotation.z;
    
    // Create transformation matrices for calculations without modifying the actual group
    const inverseRotationMatrix = new THREE.Matrix4().makeRotationZ(-originalRotation);
    const rotationMatrix = new THREE.Matrix4().makeRotationZ(angle);
    
    // Store the previous frame vertices' world positions if not available
    if (!layer.prevWorldVertices) {
      layer.prevWorldVertices = new Map();
    }
    
    // Track if we've triggered anything in this update
    let anyTriggers = false;
    
    // Process each copy
    for (let ci = 0; ci < copies; ci++) {
      // Find the correct child for this copy
      let copyIndex = ci;
      let copyGroup = null;
      
      // Find the copy group, skipping non-copy groups
      for (let i = 0; i < group.children.length; i++) {
        const child = group.children[i];
        // Skip debug objects and intersection groups
        if (child.userData && child.userData.isIntersectionGroup) continue;
        if (child.type === 'Mesh' && child.geometry && child.geometry.type === 'SphereGeometry') continue;
        if (child.type === 'Line') continue;
        
        // If we've found enough real copy groups to match our target, use this one
        if (copyIndex === 0) {
          copyGroup = child;
          break;
        }
        
        // Otherwise, decrement our counter and continue
        copyIndex--;
      }
      
      // Skip if we couldn't find a valid copy group
      if (!copyGroup || !copyGroup.children || copyGroup.children.length === 0) {
        if (DEBUG_LOGGING) console.warn(`Could not find copy group ${ci} for layer ${layer.id}`);
        continue;
      }
      
      // The first child should be the LineLoop
      const mesh = copyGroup.children.find(child => child.type === 'LineLoop');
      if (!mesh) {
        if (DEBUG_LOGGING) console.warn(`Could not find LineLoop in copy group ${ci} for layer ${layer.id}`);
        continue;
      }
      
      // FIXED: Get world matrix without modifying the actual group rotation
      // Calculate the world matrix as if the group had no rotation applied
      const tempWorldMatrix = new THREE.Matrix4();
      mesh.updateMatrixWorld();
      tempWorldMatrix.copy(mesh.matrixWorld);
      
      // Apply the inverse rotation to get the unrotated world positions
      tempWorldMatrix.premultiply(inverseRotationMatrix);
      
      // Validate geometry and attributes
      if (!mesh.geometry || !mesh.geometry.getAttribute('position')) {
        if (DEBUG_LOGGING) console.warn(`Invalid geometry for copy ${ci} of layer ${layer.id}`);
        continue;
      }
      
      const positions = mesh.geometry.getAttribute('position');
      if (!positions || !positions.count) {
        if (DEBUG_LOGGING) console.warn(`Invalid position attribute for copy ${ci} of layer ${layer.id}`);
        continue;
      }
      
      const count = positions.count;
      
      // Validate base geometry
      if (!layer.baseGeo || !layer.baseGeo.getAttribute('position') || !layer.baseGeo.getAttribute('position').array) {
        if (DEBUG_LOGGING) console.warn(`Invalid base geometry for layer ${layer.id}`);
        continue;
      }
      
      const basePositions = layer.baseGeo.getAttribute('position').array;
      
      // Temp vectors for calculations
      const worldPos = new THREE.Vector3();
      const prevWorldPos = new THREE.Vector3();
      
      // Track triggers per copy to detect anomalies
      let triggersInCopy = 0;
      
      // Process each vertex in this copy
      for (let vi = 0; vi < count; vi++) {
        // Create a unique key for this vertex
        const key = `${layer.id}-${ci}-${vi}`;
        
        // Skip if already triggered in this frame
        if (triggeredNow.has(key)) continue;
        
        try {
          // Get current vertex world position (unrotated)
          worldPos.fromBufferAttribute(positions, vi);
          
          // Skip invalid vertices
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
          if (layer.prevWorldVertices.has(key)) {
            prevWorldPos.copy(layer.prevWorldVertices.get(key));
            hasPrevPos = true;
          } else {
            // For first frame, use current position
            prevWorldPos.copy(worldPos);
          }
          
          // Store current position for next frame (with rotation)
          layer.prevWorldVertices.set(key, worldPos.clone());
          
          // FIXED: Skip trigger detection if we don't have previous positions OR if positions are too similar
          // This prevents false triggers when geometry has just been recreated
          if (!hasPrevPos) {
            continue;
          }
          
          // FIXED: Additional check - if the distance between previous and current position is too large,
          // it's likely due to a geometry change, so skip this frame
          const positionDistance = prevWorldPos.distanceTo(worldPos);
          const MAX_REASONABLE_MOVEMENT = 50; // Maximum reasonable movement between frames
          
          if (positionDistance > MAX_REASONABLE_MOVEMENT) {
            if (DEBUG_LOGGING) {
              console.log(`Layer ${layer.id}: Skipping vertex ${vi} due to large position change (${positionDistance.toFixed(2)})`);
            }
            continue;
          }
          
          // Unwrap position values
          const currX = worldPos.x;
          const currY = worldPos.y;
          const prevX = prevWorldPos.x;
          const prevY = prevWorldPos.y;
          
          // STRICT CROSSING DETECTION: 
          // 1. Point must be above X-axis (Y > 0)
          // 2. Must cross from right side to left side (X > 0 to X <= 0)
          // 3. Not triggered last frame
          const hasCrossed = prevX > 0 && currX <= 0 && currY > 0 && !layer.lastTrig.has(key);
          
          if (hasCrossed) {
            // Check for overlap with previously triggered points
            if (!isPointOverlapping(currX, currY, triggeredPoints)) {
              // Add to triggered points
              triggeredPoints.push({ x: currX, y: currY });
              
              // Check base geometry bounds
              if (vi * 3 + 1 >= basePositions.length) {
                console.warn(`Vertex index out of range: ${vi} for layer ${layer.id}`);
                continue;
              }
              
              // Get original local coordinates from the baseGeo for frequency calculation
              const x0 = basePositions[vi * 3];
              const y0 = basePositions[vi * 3 + 1];
              
              // Validate coordinates
              if (x0 === undefined || y0 === undefined || isNaN(x0) || isNaN(y0)) {
                console.warn(`Invalid base coordinates at ${vi} for layer ${layer.id}: x=${x0}, y=${y0}`);
                continue;
              }
              
              // Use the non-rotated position from the transformed geometry
              // This already has all scaling factors applied (including modulus)
              const nonRotatedX = nonRotatedPos.x;
              const nonRotatedY = nonRotatedPos.y;
              
              // Calculate frequency directly from the transformed coordinates
              // This ensures it matches exactly with the visual representation
              const frequency = Math.hypot(nonRotatedX, nonRotatedY);
              
              // Create note with the frequency from transformed geometry
              const note = {
                frequency: frequency,
                noteName: state.useEqualTemperament ? getNoteName(frequency, state.referenceFrequency || 440) : null,
                duration: state.maxDuration || 0.5,
                velocity: state.maxVelocity || 0.8,
                pan: Math.sin(angle),  // Use current angle for pan
                x: nonRotatedX,  // Store transformed coordinates
                y: nonRotatedY,
                worldX: currX,  // Store world coordinates
                worldY: currY,
                copyIndex: ci,
                vertexIndex: vi,
                layerId: layer.id,
                time: tNow
              };
              
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
                  
                  // IMPORTANT: angle is already in radians here, pass directly to createMarker
                  createMarker(angle, currX, currY, scene, noteCopy, camera, renderer, isQuantized, layer);
                  
                  if (DEBUG_LOGGING) {
                    console.log(`Layer ${layer.id}: Triggered vertex ${vi} in copy ${ci}`);
                  }
                  
                  // Increment counter
                  triggersInCopy++;
                  anyTriggers = true;
                }
              } else {
                // Regular non-quantized trigger
                audioCallback(note);
                
                // IMPORTANT: angle is already in radians here, pass directly to createMarker
                createMarker(angle, currX, currY, scene, note, camera, renderer, false, layer);
                
                if (DEBUG_LOGGING) {
                  console.log(`Layer ${layer.id}: Triggered vertex ${vi} in copy ${ci}`);
                }
                
                // Increment counter
                triggersInCopy++;
                anyTriggers = true;
              }
              
              // Add to triggered set
              triggeredNow.add(key);
            }
          }
        } catch (error) {
          console.error(`Error in trigger detection for layer ${layer.id}, copy ${ci}, vertex ${vi}:`, error);
        }
      }
      
      // Detect anomalies - too many triggers at once may indicate a problem
      if (triggersInCopy > 3) {
        console.warn(`Potential anomaly: ${triggersInCopy} triggers in one frame for layer ${layer.id}, copy ${ci}`);
      }
    }
    
    // FIXED: No need to restore rotation since we never modified it
    
    // Update the layer's last triggered set
    layer.lastTrig = triggeredNow;
    
    // Return true if we triggered anything
    return anyTriggers;
  } finally {
    // Clear processing flag
    layer._triggerProcessing = false;
  }
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
      
      // Update color based on state
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

export function checkAxisCrossing(prevX, prevY, currX, currY) {
  // Basic case: point crosses from right to left and is above X-axis
  if (prevX > 0 && currX <= 0 && currY > 0) {
    return true;
  }
  
  // Handle large angle changes
  if (currY > 0) {
    const prevAngleFromYAxis = Math.atan2(prevX, prevY);
    const currAngleFromYAxis = Math.atan2(currX, currY);
    
    if (Math.sign(prevAngleFromYAxis) > 0 && Math.sign(currAngleFromYAxis) <= 0) {
      const angleDiff = Math.abs(prevAngleFromYAxis - currAngleFromYAxis);
      if (angleDiff < Math.PI) {
        return true;
      }
    }
  }
  
  return false;
}

export function resetGlobalSequentialIndex() {
  // Clear all recent triggers
  recentTriggers.clear();
}