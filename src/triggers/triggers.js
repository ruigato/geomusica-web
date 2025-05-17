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
    const { note, worldRot, executeTime, camera, renderer, isQuantized } = trigger;
    
    if (note) {
      // Make a deep copy of the note to ensure we're not modifying the original
      const noteCopy = { ...note };
      noteCopy.time = executeTime;
      

      // IMPORTANT: Send the complete note object copy
      audioCallback(noteCopy);
      
      // Create a marker with visual feedback
      if (scene && worldRot !== undefined && noteCopy.frequency !== undefined) {
        createMarker(worldRot, noteCopy.coordinates.x, noteCopy.coordinates.y, scene, noteCopy, camera, renderer, isQuantized);
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
 * @param {Object} gState - Global application state
 * @param {Object} triggerInfo - Information about the trigger
 * @returns {Object} Decision object with shouldTrigger and triggerInfo
 */
function handleQuantizedTrigger(tNow, gState, triggerInfo) {
  if (!gState || !gState.useQuantization) {
    return { shouldTrigger: true, triggerTime: tNow, isQuantized: false };
  }
  const bpm = gState.bpm || 120;
  const currentTicks = secondsToTicks(tNow, bpm);
  const quantizationValue = gState.quantizationValue || "1/4";
  const gridTicks = parseQuantizationValue(quantizationValue);
  const quantizedTicks = quantizeToGrid(currentTicks, gridTicks);
  const quantizedTime = ticksToSeconds(quantizedTicks, bpm);
  const distanceSeconds = Math.abs(quantizedTime - tNow);
  const gridSizeInSeconds = ticksToSeconds(gridTicks, bpm);
  const toleranceWindow = Math.min(0.03, gridSizeInSeconds * 0.1);

  if (distanceSeconds < toleranceWindow) {
    return { shouldTrigger: true, triggerTime: quantizedTime, isQuantized: true };
  }
  const triggerInfoCopy = { ...triggerInfo, note: triggerInfo.note ? {...triggerInfo.note} : null };
  if (quantizedTime > tNow) {
    storePendingTrigger(triggerInfoCopy, quantizedTime);
    return { shouldTrigger: false, triggerTime: null, isQuantized: true, scheduledFor: quantizedTime };
  }
  const nextGridTicks = quantizedTicks + gridTicks;
  const nextGridTime = ticksToSeconds(nextGridTicks, bpm);
  storePendingTrigger(triggerInfoCopy, nextGridTime);
  return { shouldTrigger: false, triggerTime: null, isQuantized: true, scheduledFor: nextGridTime };
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
 * @returns {Object} Created marker
 */
function createMarker(worldRot, x, y, scene, note, camera, renderer, isQuantized) {
  // Check if the scene's userData contains our markers array
  if (!scene.userData.markers) {
    scene.userData.markers = [];
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
  
  // Position in world space - rotate the point
  const worldX = x * Math.cos(worldRot) - y * Math.sin(worldRot);
  const worldY = x * Math.sin(worldRot) + y * Math.cos(worldRot);
  
  markerMesh.position.set(worldX, worldY, 5); // Slightly in front
  
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
    
    // Create axis crossing label
    const worldPosition = new THREE.Vector3(worldX, worldY, 5);
    textLabel = createAxisLabel(labelId, worldPosition, displayText, camera, renderer);
  }
  
  // Add to our markers array with life value
  const marker = {
    mesh: markerMesh,
    textLabel: textLabel,
    life: MARK_LIFE,
    isQuantized: isQuantized,
    noteInfo: {
      frequency,
      duration,
      velocity
    }
  };
  
  if (scene.userData.state && scene.userData.state.markers) {
    scene.userData.state.markers.push(marker);
  } else {
    // Fall back to scene's userData if state is not available
    scene.userData.markers.push(marker);
  }
  
  return marker;
}

/**
 * Detects audio triggers for a specific layer based on geometry crossing a trigger line (typically y-axis).
 * @param {THREE.Group} layerGroup - The THREE.Group for the layer.
 * @param {THREE.Camera} camera - Main camera.
 * @param {Object} layerState - State object for the layer.
 * @param {Object} globalState - Global application state.
 * @param {number} currentLayerAngle - Current rotation of layerGroup (radians).
 * @param {number} lastLayerAngle - Previous rotation of layerGroup (radians).
 * @param {number} tNow - Current time in seconds.
 * @param {Function} audioCallback - Function to call for triggering audio.
 * @param {THREE.Scene} scene - Main scene.
 */
export function detectTriggers(
    layerGroup, 
    camera, 
    layerState, 
    globalState, 
    currentLayerAngle, 
    lastLayerAngle, 
    tNow, 
    audioCallback,
    scene
) {
    if (!layerGroup || !layerState || !globalState || !audioCallback) {
        console.warn("detectTriggers: Missing critical arguments.");
        return;
    }

    const { copies, useIntersections, intersectionPoints, id: layerId } = layerState;
    if (copies === 0) return; // No copies, no triggers

    const triggeredNotesForLayer = [];

    // Iterate through the children of the layerGroup (these are the `singleCopyGroup`s from updateLayerVisuals)
    layerGroup.children.forEach(singleCopyGroup => {
        if (!singleCopyGroup.visible) return; // Skip invisible copy groups

        // Each singleCopyGroup contains a LineLoop and vertex/intersection markers (Meshes)
        singleCopyGroup.children.forEach(childMesh => {
            if (!(childMesh instanceof THREE.Mesh) || !childMesh.visible) return; // Only check visible meshes

            // We need to get the original triggerData stored on these meshes by updateLayerVisuals
            // Assuming updateLayerVisuals stores `triggerData` (or `note.triggerData`) in childMesh.userData
            const originalTriggerData = childMesh.userData.triggerData; 
            if (!originalTriggerData || originalTriggerData.layerId !== layerId) return; // Not for this layer or no data

            const localX = originalTriggerData.x; // Position relative to the singleCopyGroup's center BEFORE singleCopyGroup rotation
            const localY = originalTriggerData.y;

            // Calculate previous and current world positions of the point
            // considering the singleCopyGroup's own rotation AND the layerGroup's rotation
            const prevWorldPos = getRotatedPosition(localX, localY, singleCopyGroup.rotation.z + lastLayerAngle);
            const currWorldPos = getRotatedPosition(localX, localY, singleCopyGroup.rotation.z + currentLayerAngle);

            // Check for Y-axis crossing (from negative X to positive X, or vice-versa if rotation is reversed)
            // This assumes trigger line is Y-axis at X=0.
            if (checkAxisCrossing(prevWorldPos.x, prevWorldPos.y, currWorldPos.x, currWorldPos.y)) {
                // Create note using layerState
                const note = createNote(originalTriggerData, layerState); 
                if (!note) return; // Could not create note

                note.time = tNow; // Tentative time, might be quantized
                note.triggeredAtAngle = currentLayerAngle;
                note.coordinates = { x: currWorldPos.x, y: currWorldPos.y }; // Store world coords at trigger

                const triggerHandlingResult = handleQuantizedTrigger(tNow, globalState, { 
                    note: note, 
                    worldRot: currentLayerAngle, // Pass angle for marker orientation
                    camera: camera, // For createMarker if it adds labels directly
                    renderer: scene.userData.renderer, // For createMarker
                    scene: scene // For createMarker itself
                });

                if (triggerHandlingResult.shouldTrigger) {
                    const finalNote = { ...note, time: triggerHandlingResult.triggerTime, isQuantized: triggerHandlingResult.isQuantized };
                    audioCallback(finalNote);
                    
                    // Create a marker only if triggered immediately (queued triggers create markers when processed)
                    if (scene) {
                         createMarker(
                            currentLayerAngle, 
                            currWorldPos.x, currWorldPos.y, 
                            scene, 
                            finalNote, 
                            camera, 
                            scene.userData.renderer, 
                            triggerHandlingResult.isQuantized
                        );
                    }
                    triggeredNotesForLayer.push(finalNote);
                }
            }
        });
    });

    // The old function returned lastTrig, which was an array of triggered notes.
    // For now, this function doesn't explicitly return them, as they are handled by audioCallback or queued.
    // If a return value is needed for other logic (e.g., external tracking), it can be added.
    // return triggeredNotesForLayer;
}

/**
 * Clean up expired markers
 * @param {THREE.Scene} scene Scene containing markers
 * @param {Array} markers Array of markers to clean up
 */
export function clearExpiredMarkers(scene, markers) {
  if (!markers || !Array.isArray(markers)) return;
  
  for (let j = markers.length - 1; j >= 0; j--) {
    const marker = markers[j];
    marker.life--;
    
    // Update opacity
    if (marker.mesh && marker.mesh.material) {
      const baseOpacity = marker.noteInfo ? marker.noteInfo.velocity : 0.7;
      marker.mesh.material.opacity = baseOpacity * (marker.life / MARK_LIFE);
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
 * Get position of a point after rotation
 * @param {number} x X coordinate in local space
 * @param {number} y Y coordinate in local space
 * @param {number} rotationAngle Rotation angle in radians
 * @returns {Object} Rotated position {x, y}
 */
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