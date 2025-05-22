// src/triggers/triggers.js - Updated to use global sequential index approach
import * as THREE from 'three';
import { MARK_LIFE, OVERLAP_THRESHOLD, TICKS_PER_BEAT, TICKS_PER_MEASURE } from '../config/constants.js';
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

// Store for pending triggers
let pendingTriggers = [];

// Global sequential index counter for trigger events
let globalSequentialIndex = 0;

// Track active markers per layer
const layerMarkers = new Map();

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
  if (!activePoints || activePoints.length === 0) {
    return false;
  }
  
  for (const point of activePoints) {
    const distance = distanceBetweenPoints(x, y, point.x, point.y);
    if (distance < OVERLAP_THRESHOLD) {
      return true; // Point is too close to an existing active point
    }
  }
  
  return false; // No overlap detected
}

/**
 * Store a trigger for future execution
 * @param {Object} triggerInfo - Trigger information
 * @param {number} quantizedTime - Time when trigger should execute
 */
function storePendingTrigger(triggerInfo, quantizedTime) {
  // Create deep copy of trigger info to prevent reference issues
  const storedInfo = {
    ...triggerInfo,
    executeTime: quantizedTime,
    note: triggerInfo.note ? {...triggerInfo.note} : null // Make a copy of the note object
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
    const { note, worldRot, executeTime, camera, renderer, isQuantized, layerId } = trigger;
    
    if (note) {
      // Make a deep copy of the note to ensure we're not modifying the original
      const noteCopy = { ...note };
      noteCopy.time = executeTime;
      noteCopy.layerId = layerId; // Ensure layer ID is preserved
      
      // IMPORTANT: Send the complete note object copy
      audioCallback(noteCopy);
      
      // Create a marker with visual feedback
      if (scene && worldRot !== undefined && noteCopy.frequency !== undefined) {
        createMarker(worldRot, noteCopy.coordinates.x, noteCopy.coordinates.y, scene, noteCopy, camera, renderer, isQuantized, layerId);
      }
    }
  }
}

/**
 * Parse a quantization value and convert to ticks
 * @param {string} quantValue - Quantization value (e.g., "1-4", "1-8T")
 * @param {number} measureTicks - Ticks per measure (default: TICKS_PER_MEASURE)
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
  
  // Get the BPM
  const bpm = state.bpm || 120;
  
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
 * Create a marker at the given coordinates with note information
 * @param {number} worldRot Rotation angle in radians
 * @param {number} x X coordinate in local space
 * @param {number} y Y coordinate in local space
 * @param {THREE.Scene} scene Scene to add marker to
 * @param {Object} note Note object with frequency, duration, velocity info
 * @param {THREE.Camera} camera Camera for label positioning
 * @param {THREE.WebGLRenderer} renderer Renderer for label positioning
 * @param {boolean} isQuantized Whether this is a quantized trigger
 * @param {number} layerId The layer ID this marker belongs to
 * @returns {Object} Created marker
 */
function createMarker(worldRot, x, y, scene, note, camera = null, renderer = null, isQuantized = false, layerId = 0) {
  // Check if the scene's userData contains our markers array
  if (!scene.userData.markers) {
    scene.userData.markers = [];
  }
  
  // Initialize layer markers if needed
  if (!layerMarkers.has(layerId)) {
    layerMarkers.set(layerId, []);
  }
  
  // Get frequency from note object or calculate it
  const frequency = note.frequency;
  
  // Skip if frequency is invalid
  if (!frequency || isNaN(frequency)) {
    return null;
  }
  
  // Create a marker for this trigger point
  const markerRadius = 6; // Fixed size for better visibility
  const markerGeometry = new THREE.CircleGeometry(markerRadius, 16);
  
  // Use a color that matches the layer's color
  let markerColor;
  if (layerId === 0) {
    markerColor = new THREE.Color(0x00ffff); // Cyan for layer 0
  } else if (layerId === 1) {
    markerColor = new THREE.Color(0xff00ff); // Magenta for layer 1
  } else if (layerId === 2) {
    markerColor = new THREE.Color(0xffff00); // Yellow for layer 2
  } else {
    markerColor = new THREE.Color(0x00ff00); // Green for layer 3+
  }
  
  // Create material with the layer color
  const markerMaterial = new THREE.MeshBasicMaterial({
    color: markerColor,
    transparent: true,
    opacity: isQuantized ? 0.8 : 0.6,
    side: THREE.DoubleSide
  });
  
  // Create the marker mesh
  const marker = new THREE.Mesh(markerGeometry, markerMaterial);
  
  // Calculate position in world coordinates
  const angle = worldRot;
  const worldX = x * Math.cos(angle) - y * Math.sin(angle);
  const worldY = x * Math.sin(angle) + y * Math.cos(angle);
  const worldZ = 1; // Slightly above the plane
  
  // Set marker position
  marker.position.set(worldX, worldY, worldZ);
  
  // Set marker userData for reference
  marker.userData = {
    isMarker: true,
    creationTime: getCurrentTime(),
    frequency: frequency,
    duration: note.duration || 0.5,
    layerId: layerId,
    coordinates: {
      x: x,
      y: y,
      angle: angle
    }
  };
  
  // Add marker to the scene
  scene.add(marker);
  
  // Store the marker in scene userData for tracking
  scene.userData.markers.push(marker);
  
  // Also store in layer-specific markers
  layerMarkers.get(layerId).push(marker);
  
  // Generate a unique ID for this trigger for DOM label reference
  const triggerId = `trigger-${globalSequentialIndex++}`;
  marker.userData.triggerId = triggerId;
  
  // Create or update the DOM label if we have camera and renderer
  if (camera && renderer) {
    // Get note name from frequency
    const noteName = getNoteName(frequency);
    
    // Create label content
    const labelContent = `
      <div class="note-name layer-${layerId}">${noteName}</div>
      <div class="frequency layer-${layerId}">${Math.round(frequency)} Hz</div>
    `;
    
    // Create or update the label
    createOrUpdateLabel(
      triggerId,
      marker.position,
      labelContent,
      camera,
      renderer,
      {
        className: `trigger-label layer-${layerId}`,
        trackedObject: marker,
        alwaysVisible: true
      }
    );
  }
  
  return marker;
}

/**
 * Reset the global sequential index for triggers
 */
export function resetGlobalSequentialIndex() {
  globalSequentialIndex = 0;
}

/**
 * Detect trigger points and execute callbacks
 * @param {THREE.BufferGeometry} baseGeo - Base geometry of the shape
 * @param {number} lastAngle - Last rotation angle
 * @param {number} angle - Current rotation angle
 * @param {number} copies - Number of copies/rings
 * @param {THREE.Object3D} group - Group containing all copies
 * @param {Set} lastTrig - Set of previously triggered points
 * @param {number} tNow - Current time
 * @param {Function} audioCallback - Callback to trigger audio
 * @returns {Set} Set of triggered points in this call
 */
export function detectTriggers(baseGeo, lastAngle, angle, copies, group, lastTrig, tNow, audioCallback) {
  // Initialize variables
  const triggeredNow = new Set();
  const triggeredPoints = [];
  
  // Ensure we have valid base geometry with position attribute
  if (!baseGeo || !baseGeo.getAttribute || !baseGeo.getAttribute('position')) {
    console.warn("Invalid or missing geometry for trigger detection");
    return triggeredNow;
  }
  
  // Make sure group exists and has a parent
  if (!group || !group.parent) {
    console.warn("Invalid or missing group for trigger detection");
    return triggeredNow;
  }
  
  // Get state from group or its parent
  const state = group.userData?.state || group.parent.userData?.state;
  
  // Make sure we have a valid state object
  if (!state) {
    console.warn("No valid state found for trigger detection");
    return triggeredNow;
  }
  
  // Get layer ID from group userData or state
  const layerId = group.userData?.layerId !== undefined ? group.userData.layerId : 
                 (state.layerId !== undefined ? state.layerId : 0);
                 
  // Debug log for layer ID
  if (Math.random() < 0.005) {
    console.log(`[TRIGGER LAYER] Processing layer ${layerId}, group.userData.layerId=${group.userData?.layerId}, state.layerId=${state?.layerId}`);
  }
  
  // Get the current and previous rotation directly from the group's userData or use passed values
  // This ensures we're using the same rotation that's applied to the entire layer group
  const currentGroupRotation = group.rotation.z;
  
  // For previous rotation, we need to track the delta from the last frame
  // Since group.rotation.z only has the current value, we use the passed lastAngle parameter
  // Convert lastAngle from degrees to radians if needed
  const previousGroupRotation = typeof lastAngle === 'number' ? 
                              (Math.abs(lastAngle) > Math.PI ? lastAngle : (lastAngle * Math.PI / 180)) : 
                              (currentGroupRotation - 0.05); // Small delta as fallback
  
  // Debug log for rotation
  if (Math.random() < 0.01) {
    console.log(`[TRIGGER ROTATION] Layer ${layerId}: Using group rotation - Current: ${currentGroupRotation.toFixed(3)}, Previous: ${previousGroupRotation.toFixed(3)}`);
  }
  
  // Get vertices from buffer geometry
  const positions = baseGeo.getAttribute('position').array;
  const count = baseGeo.getAttribute('position').count;
  
  // Get camera and renderer for axis labels
  const camera = group.parent.userData?.camera || null;
  const renderer = group.parent.userData?.renderer || null;
  
  // Ensure lastTrig is a Set
  if (!lastTrig || !(lastTrig instanceof Set)) {
    lastTrig = new Set();
  }
  
  // Debug log
  if (Math.random() < 0.01) { // Occasionally log
    console.log(`[TRIGGER DETAIL] Layer ${layerId}: Checking ${count} vertices across ${copies} copies, rotation=${currentGroupRotation.toFixed(3)}`);
    // If we have a few vertices, log their positions
    if (count <= 10) {
      console.log(`[VERTEX POSITIONS] Layer ${layerId}:`);
      for (let vi = 0; vi < count; vi++) {
        console.log(`  Vertex ${vi}: (${positions[vi*3].toFixed(2)}, ${positions[vi*3+1].toFixed(2)})`);
      }
    }
  }
  
  // For easier debugging, add visual marker at (0,0) - this is where the Y axis is
  if (Math.random() < 0.001) { // Very rarely
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(5, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffff00 })
    );
    marker.position.set(0, 0, 3); // Set slightly above the plane
    group.parent.add(marker);
    
    // Remove after 2 seconds
    setTimeout(() => {
      group.parent.remove(marker);
      marker.geometry.dispose();
      marker.material.dispose();
    }, 2000);
  }
  
  // Process each copy/ring
  for (let ci = 0; ci < copies; ci++) {
    // Get the copy object - using an improved approach to find all polygon copies
    let copyObject = null;
    
    // Log copy search debugging info (rarely)
    if (Math.random() < 0.002) {
      console.log(`[COPY SEARCH] Layer ${layerId}: Looking for copy ${ci} of ${copies} copies`);
      console.log(`[GROUP DEBUG] Group children count: ${group.children.length}`);
      
      // Print the first few children types
      group.children.slice(0, 3).forEach((child, idx) => {
        console.log(`  Child ${idx}: type=${child.type}, name=${child.name || 'unnamed'}, userData:`, child.userData);
      });
    }
    
    // SIMPLER APPROACH: Just try to find the object by name pattern or direct index
    if (group.children && group.children.length > 0) {
      // First try to find by name pattern "copy-X"
      copyObject = group.children.find(child => 
        child.name === `copy-${ci}` || 
        child.userData?.copyIndex === ci
      );
      
      // If not found but we're within range, just use the array index
      if (!copyObject && ci < group.children.length) {
        const candidate = group.children[ci];
        
        // Avoid using non-geometry objects
        if (candidate && 
            candidate.type !== 'AxesHelper' && 
            !candidate.userData?.isAxis &&
            !candidate.userData?.isHelper) {
          copyObject = candidate;
          
          // Tag it for future reference if needed
          if (copyObject && !copyObject.userData?.copyIndex) {
            copyObject.userData = copyObject.userData || {};
            copyObject.userData.copyIndex = ci;
            
            // Log this action occasionally
            if (Math.random() < 0.01) {
              console.log(`[COPY FOUND] Layer ${layerId}: Tagged copy ${ci} by array position`);
            }
          }
        }
      }
    }
    
    // If we still couldn't find it, log and skip
    if (!copyObject) {
      if (Math.random() < 0.01) {  // Reduced frequency to avoid spam
        console.warn(`[TRIGGER WARN] Layer ${layerId}: Could not find copy ${ci} out of ${copies} copies`);
      }
      continue;
    }
    
    // Debug log about this copy (only occasionally)
    if (Math.random() < 0.005) {
      console.log(`[COPY INFO] Layer ${layerId}, Copy ${ci}: Found copy object:`, 
        {
          name: copyObject.name,
          type: copyObject.type,
          position: copyObject.position ? 
            `(${copyObject.position.x.toFixed(2)}, ${copyObject.position.y.toFixed(2)})` : 'N/A',
          userData: copyObject.userData
        }
      );
    }
    
    // Get the world rotation - use the actual rotation applied to the layer group
    const worldRot = group.rotation.z;
    
    // Debug log about this copy and angle (only occasionally)
    if (Math.random() < 0.002) { // Very rare to avoid console spam
      console.log(`[ROTATION DEBUG] Layer ${layerId}, Copy ${ci}: worldRot=${worldRot.toFixed(3)}, group rotation=${group.rotation.z?.toFixed(3) || 'N/A'}`);
    }
    
    // Process each vertex in the base geometry
    for (let vi = 0; vi < count; vi++) {
      // Get vertex coordinates
      const x1 = positions[vi * 3];
      const y1 = positions[vi * 3 + 1];
      
      // Skip vertices at origin
      if (Math.abs(x1) < 0.001 && Math.abs(y1) < 0.001) continue;
      
      // Get the copy object's scale
      const scaleX = copyObject.scale.x || 1;
      const scaleY = copyObject.scale.y || 1;
      
      // Calculate the vertex position in the copy's local space (with scale)
      const scaledX = x1 * scaleX;
      const scaledY = y1 * scaleY;
      
      // Apply previous group rotation directly to the scaled coordinates
      // Previous frame position
      const prevRotX = scaledX * Math.cos(previousGroupRotation) - scaledY * Math.sin(previousGroupRotation);
      const prevRotY = scaledX * Math.sin(previousGroupRotation) + scaledY * Math.cos(previousGroupRotation);
      
      // Current frame position
      const currRotX = scaledX * Math.cos(currentGroupRotation) - scaledY * Math.sin(currentGroupRotation);
      const currRotY = scaledX * Math.sin(currentGroupRotation) + scaledY * Math.cos(currentGroupRotation);
      
      // Calculate the world position of the vertex (for overlap detection)
      const worldX = currRotX;
      const worldY = currRotY;
      
      // Create a unique key for this vertex in this copy
      // Include layer ID to prevent cross-layer tracking
      const key = `v${vi}-c${ci}-l${layerId}`;
      
      // Check if this vertex has crossed the Y axis
      let hasCrossed = false;
      
      // Debug vertex positions occasionally
      if (Math.random() < 0.005) {
        console.log(`[VERTEX] Layer ${layerId}, Copy ${ci}, Vertex ${vi}: prevPos=(${prevRotX.toFixed(2)}, ${prevRotY.toFixed(2)}), currPos=(${currRotX.toFixed(2)}, ${currRotY.toFixed(2)})`);
      }
      
      // Enhanced crossing detection with more logging for debugging
      // Case 1: Basic right-to-left crossing with positive Y
      if (prevRotX > 0 && currRotX <= 0 && currRotY > 0) {
        hasCrossed = true;
        console.log(`[CROSSING BASIC] Layer ${layerId}, Copy ${ci}, Vertex ${vi}: Basic Y-axis crossing! prevX=${prevRotX.toFixed(2)}, currX=${currRotX.toFixed(2)}, currY=${currRotY.toFixed(2)}`);
      }
      // Case 2: Angular crossing for large rotation changes
      else if (currRotY > 0) {
        // Calculate angular positions relative to Y-axis
        const prevAngleFromYAxis = Math.atan2(prevRotX, prevRotY);
        const currAngleFromYAxis = Math.atan2(currRotX, currRotY);
        
        // If angles are on opposite sides of Y-axis
        if (Math.sign(prevAngleFromYAxis) > 0 && Math.sign(currAngleFromYAxis) <= 0) {
          const angleDiff = Math.abs(prevAngleFromYAxis - currAngleFromYAxis);
          // Only count if angle change is reasonable to avoid false positives
          if (angleDiff < Math.PI) {
            hasCrossed = true;
            console.log(`[CROSSING ANGLE] Layer ${layerId}, Copy ${ci}, Vertex ${vi}: Angular Y-axis crossing! prevAngle=${prevAngleFromYAxis.toFixed(2)}, currAngle=${currAngleFromYAxis.toFixed(2)}, diff=${angleDiff.toFixed(2)}`);
          }
        }
      }
      // Case 3: Check if this point is exactly on the Y-axis
      else if (Math.abs(currRotX) < 0.001 && currRotY > 0) {
        // Point is right on the Y-axis, so if the previous X was positive, count it as crossed
        if (prevRotX > 0) {
          hasCrossed = true;
          console.log(`[CROSSING EXACT] Layer ${layerId}, Copy ${ci}, Vertex ${vi}: Exact Y-axis position! prevX=${prevRotX.toFixed(2)}, currX=${currRotX.toFixed(2)}, currY=${currRotY.toFixed(2)}`);
        }
      }
      
      // Only consider the crossing if we haven't already triggered this point recently
      if (hasCrossed && !lastTrig.has(key)) {
        // Check if this point overlaps with any previously triggered points
        if (!isPointOverlapping(worldX, worldY, triggeredPoints)) {
          // Add this point to the list of triggered points
          triggeredPoints.push({ x: worldX, y: worldY });
          
          // Calculate global sequential index
          const globalIndex = (ci * count) + vi;
          
          // Prepare trigger data for note creation
          const triggerData = {
            x: x1,
            y: y1,
            copyIndex: ci,
            vertexIndex: vi,
            isIntersection: false,
            angle,
            lastAngle,
            globalIndex, // Pass the global sequential index
            layerId     // Include layer ID in trigger data
          };
          
          // Create note object with modulo parameters
          const note = createNote(triggerData, state);
          
          // Add pan calculation to the note (based on angle)
          note.pan = Math.sin(worldRot);
          
          // Add layer ID to the note
          note.layerId = layerId;
          
          // Enhanced quantization logic
          if (state && state.useQuantization) {
            // Create trigger info object with all needed data - use a copy of the note
            const triggerInfo = {
              note: {...note}, // Create a copy to avoid reference issues
              worldRot,
              camera,
              renderer,
              isQuantized: true,
              layerId      // Include layer ID in trigger info
            };
            
            // Handle quantized trigger (may schedule for later)
            const { shouldTrigger, triggerTime, isQuantized } = 
              handleQuantizedTrigger(tNow, state, triggerInfo);
            
            if (shouldTrigger) {
              // Set the precise trigger time
              const noteCopy = {...note};
              noteCopy.time = triggerTime;
              
              // Log layer-specific trigger
              console.log(`[TRIGGER] Layer ${layerId} triggered at ${triggerTime}`);
              
              // IMPORTANT: We need to pass a copy of the entire note object here
              audioCallback(noteCopy);
              
              // Create a marker with visual feedback for quantization
              createMarker(worldRot, x1, y1, group.parent, noteCopy, camera, renderer, isQuantized, layerId);
            }
            
            // Always add to triggered set to prevent re-triggering
            triggeredNow.add(key);
          } else {
            // Regular non-quantized trigger - use a copy
            const noteCopy = {...note};
            
            // Log layer-specific trigger
            console.log(`[TRIGGER] Layer ${layerId} triggered immediately`);
            
            audioCallback(noteCopy);
            createMarker(worldRot, x1, y1, group.parent, noteCopy, camera, renderer, false, layerId);
            triggeredNow.add(key);
          }
        } else {
          // Point is overlapping, still add to triggered set but don't trigger audio
          triggeredNow.add(key);
        }
      }
    }
  }
  
  // Now check intersection points if they exist
  const intersectionGroup = group.children.find(child => 
    child.userData && child.userData.isIntersectionGroup
  );
  
  if (intersectionGroup && intersectionGroup.children && intersectionGroup.children.length > 0) {
    // Process each intersection point for possible triggers
    for (let i = 0; i < intersectionGroup.children.length; i++) {
      const pointMesh = intersectionGroup.children[i];
      
      // Skip if this is a frequency label or a Group
      if (pointMesh.userData && pointMesh.userData.isFrequencyLabel) {
        continue;
      }
      
      // Skip if this is a Group (like a text label group)
      if (pointMesh.type === 'Group') {
        continue;
      }
      
      const localPos = pointMesh.position.clone();
      
      // Calculate previous and current positions using the same rotation values
      // that we used for vertex detection
      const prevX = localPos.x * Math.cos(previousGroupRotation) - localPos.y * Math.sin(previousGroupRotation);
      const prevY = localPos.x * Math.sin(previousGroupRotation) + localPos.y * Math.cos(previousGroupRotation);
      
      const currX = localPos.x * Math.cos(currentGroupRotation) - localPos.y * Math.sin(currentGroupRotation);
      const currY = localPos.x * Math.sin(currentGroupRotation) + localPos.y * Math.cos(currentGroupRotation);
      
      // Calculate world position
      const worldX = currX;
      const worldY = currY;
      
      // Create a unique key for this intersection point, including layer ID
      const key = `intersection-${i}-l${layerId}`;
      
      // Similar improved crossing detection logic for intersection points
      let hasCrossed = false;
      
      // Basic case: point crosses from right to left
      if (prevX > 0 && currX <= 0 && currY > 0 && !lastTrig.has(key)) {
        hasCrossed = true;
      }
      // Handle the case where angle change is so large that traditional crossing detection fails
      else if (!lastTrig.has(key) && currY > 0) {
        // Calculate angular displacement relative to Y-axis
        const prevAngleFromYAxis = Math.atan2(prevX, prevY);
        const currAngleFromYAxis = Math.atan2(currX, currY);
        
        // If the angles are on opposite sides of the Y-axis, and we've moved enough
        // to cross it, mark as a crossing
        if (Math.sign(prevAngleFromYAxis) > 0 && Math.sign(currAngleFromYAxis) <= 0) {
          const angleDiff = Math.abs(prevAngleFromYAxis - currAngleFromYAxis);
          // Only count it if the angle difference is reasonable (to avoid false positives)
          if (angleDiff < Math.PI) {
            hasCrossed = true;
            // Debug logging for angle-based crossings
            if (Math.random() < 0.3) {
              console.log(`[CROSSING ALT] Layer ${layerId}, Copy ${ci}, Vertex ${vi}: Crossed Y-axis via angle change! prevAngle=${prevAngleFromYAxis.toFixed(2)}, currAngle=${currAngleFromYAxis.toFixed(2)}, diff=${angleDiff.toFixed(2)}`);
            }
          }
        }
      }
      
      if (hasCrossed) {
        // Check if this point overlaps with any previously triggered points
        if (!isPointOverlapping(worldX, worldY, triggeredPoints)) {
          // Add this point to the list of triggered points
          triggeredPoints.push({ x: worldX, y: worldY });
          
          // Calculate global sequential index
          const globalIndex = (ci * count) + vi;
          
          // Prepare trigger data for note creation
          const triggerData = {
            x: x1,
            y: y1,
            copyIndex: ci,
            vertexIndex: vi,
            isIntersection: false,
            angle,
            lastAngle,
            globalIndex, // Pass the global sequential index
            layerId     // Include layer ID in trigger data
          };
          
          // Create note object with modulo parameters
          const note = createNote(triggerData, state);
          
          // Add pan calculation to the note (based on angle)
          note.pan = Math.sin(worldRot);
          
          // Add layer ID to the note
          note.layerId = layerId;
          
          // Enhanced quantization logic
          if (state && state.useQuantization) {
            // Create trigger info object with all needed data - use a copy of the note
            const triggerInfo = {
              note: {...note}, // Create a copy to avoid reference issues
              worldRot,
              camera,
              renderer,
              isQuantized: true,
              layerId      // Include layer ID in trigger info
            };
            
            // Handle quantized trigger (may schedule for later)
            const { shouldTrigger, triggerTime, isQuantized } = 
              handleQuantizedTrigger(tNow, state, triggerInfo);
            
            if (shouldTrigger) {
              // Set the precise trigger time
              const noteCopy = {...note};
              noteCopy.time = triggerTime;
              
              // Log layer-specific trigger
              console.log(`[TRIGGER] Layer ${layerId} triggered at ${triggerTime}`);
              
              // IMPORTANT: We need to pass a copy of the entire note object here
              audioCallback(noteCopy);
              
              // Create a marker with visual feedback for quantization
              createMarker(worldRot, x1, y1, group.parent, noteCopy, camera, renderer, isQuantized, layerId);
            }
            
            // Always add to triggered set to prevent re-triggering
            triggeredNow.add(key);
          } else {
            // Regular non-quantized trigger - use a copy
            const noteCopy = {...note};
            
            // Log layer-specific trigger
            console.log(`[TRIGGER] Layer ${layerId} triggered immediately`);
            
            audioCallback(noteCopy);
            createMarker(worldRot, x1, y1, group.parent, noteCopy, camera, renderer, false, layerId);
            triggeredNow.add(key);
          }
        } else {
          // Point is overlapping, still add to triggered set but don't trigger audio
          triggeredNow.add(key);
        }
      }
    }
  }
  
  return triggeredNow;
}

// Get position of a point after rotation
export function getRotatedPosition(x, y, rotationAngle) {
  return {
    x: x * Math.cos(rotationAngle) - y * Math.sin(rotationAngle),
    y: x * Math.sin(rotationAngle) + y * Math.cos(rotationAngle)
  };
}

/**
 * Check if a point crosses the Y-axis during rotation
 * @param {number} prevX Previous X coordinate
 * @param {number} prevY Previous Y coordinate 
 * @param {number} currX Current X coordinate
 * @param {number} currY Current Y coordinate
 * @returns {boolean} True if point crosses the Y-axis
 */
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

/**
 * Clear expired markers from the scene
 * @param {THREE.Scene} scene Scene containing markers
 */
export function clearExpiredMarkers(scene) {
  // Skip if no scene
  if (!scene) {
    return;
  }
  
  // Get the markers array from scene userData
  const markers = scene.userData.markers || [];
  if (!markers.length) {
    return;
  }
  
  const currentTime = getCurrentTime();
  const markersToRemove = [];
  
  // Check each marker to see if it's expired
  for (let i = markers.length - 1; i >= 0; i--) {
    const marker = markers[i];
    
    // Skip if this isn't a valid marker
    if (!marker || !marker.userData || !marker.userData.creationTime) {
      continue;
    }
    
    const age = currentTime - marker.userData.creationTime;
    
    // If the marker has expired, add it to the removal list
    if (age > MARK_LIFE) {
      markersToRemove.push(marker);
      markers.splice(i, 1);
    } else {
      // Fade out the marker as it ages
      const normalizedAge = age / MARK_LIFE;
      const fadeStart = 0.7; // Start fading at 70% of lifetime
      
      if (normalizedAge > fadeStart && marker.material) {
        const opacity = 1.0 - ((normalizedAge - fadeStart) / (1.0 - fadeStart));
        marker.material.opacity = Math.max(0.1, opacity);
        marker.material.needsUpdate = true;
      }
    }
  }
  
  // Remove all expired markers from the scene
  for (const marker of markersToRemove) {
    // Get the marker's layer ID
    const layerId = marker.userData?.layerId || 0;
    
    // Remove from layer-specific marker tracking
    if (layerMarkers.has(layerId)) {
      const layerMarkerArray = layerMarkers.get(layerId);
      const markerIndex = layerMarkerArray.indexOf(marker);
      if (markerIndex !== -1) {
        layerMarkerArray.splice(markerIndex, 1);
      }
    }
    
    // Remove the DOM label if it exists
    if (marker.userData.triggerId) {
      removeLabel(marker.userData.triggerId);
    }
    
    // Remove the marker geometry
    if (marker.geometry) {
      marker.geometry.dispose();
    }
    
    // Remove the marker material
    if (marker.material) {
      marker.material.dispose();
    }
    
    // Remove the marker from the scene
    scene.remove(marker);
  }
}