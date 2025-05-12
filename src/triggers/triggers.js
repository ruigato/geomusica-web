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
 * @returns {Object} Created marker
 */
function createMarker(worldRot, x, y, scene, note, camera = null, renderer = null, isQuantized = false) {
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
 * Reset the global sequential index
 * This should be called when significant changes happen to the geometry
 */
export function resetGlobalSequentialIndex() {
  globalSequentialIndex = 0;
}

/**
 * Detect axis crossings and trigger audio
 * @param {THREE.BufferGeometry} baseGeo Base geometry
 * @param {number} lastAngle Previous rotation angle
 * @param {number} angle Current rotation angle
 * @param {number} copies Number of polygon copies
 * @param {THREE.Group} group Group containing polygon copies
 * @param {Set} lastTrig Set of triggers from last frame
 * @param {number} tNow Current time
 * @param {Function} audioCallback Function to call when trigger occurs
 * @returns {Set} Set of current triggers
 */
export function detectTriggers(baseGeo, lastAngle, angle, copies, group, lastTrig, tNow, audioCallback) {
  const triggeredNow = new Set();
  const triggeredPoints = []; // Store positions of triggered points
  
  // Get application state from group's parent (scene)
  const state = group.parent?.userData?.state;
  
  // Get vertices from buffer geometry
  const positions = baseGeo.getAttribute('position').array;
  const count = baseGeo.getAttribute('position').count;
  
  // Get camera and renderer for axis labels
  const camera = group.parent?.userData?.camera;
  const renderer = group.parent?.userData?.renderer;
  
  // Check if geometry has changed significantly (reset sequential index)
  if (state && state.parameterChanges && 
      (state.parameterChanges.segments || 
       state.parameterChanges.copies || 
       state.parameterChanges.modulus || 
       state.parameterChanges.useModulus)) {
    resetGlobalSequentialIndex();
  }
  
  // First detect crossings for regular vertices
  for (let ci = 0; ci < copies; ci++) {
    // Check that we have enough children in the group
    if (ci >= group.children.length) continue;
    
    // Each copy is a Group containing the LineLoop and vertex circles
    const copyGroup = group.children[ci];
    
    // Skip the intersection marker group if we encounter it
    if (copyGroup.userData && copyGroup.userData.isIntersectionGroup) {
      continue;
    }
    
    // Make sure the copy group has children
    if (!copyGroup.children || copyGroup.children.length === 0) continue;
    
    // The first child is the LineLoop
    const mesh = copyGroup.children[0];
    
    // Use the copy group's local rotation plus the current group rotation for world rotation
    const localRotation = copyGroup.rotation.z || 0;
    const lastWorldRot = lastAngle + localRotation;
    const worldRot = angle + localRotation;
    
    const worldScale = mesh.scale.x;
    
    // Process each vertex in this copy
    for (let vi = 0; vi < count; vi++) {
      const x0 = positions[vi * 3];
      const y0 = positions[vi * 3 + 1];
      
      const x1 = x0 * worldScale;
      const y1 = y0 * worldScale;
      
      // Calculate vertex positions at previous and current angles
      const prevX = x1 * Math.cos(lastWorldRot) - y1 * Math.sin(lastWorldRot);
      const prevY = x1 * Math.sin(lastWorldRot) + y1 * Math.cos(lastWorldRot);
      
      const currX = x1 * Math.cos(worldRot) - y1 * Math.sin(worldRot);
      const currY = x1 * Math.sin(worldRot) + y1 * Math.cos(worldRot);
      
      // Calculate the world position of the vertex at current angle
      const worldX = currX;
      const worldY = currY;
      
      const key = `${ci}-${vi}`;
      
      // To detect a crossing:
      // 1. The point must have crossed from right to left (positive X to negative X)
      // 2. The point must be above the X-axis (positive Y)
      // 3. The point must not have been triggered last frame
      
      // Improved crossing detection handling jumps in angle
      let hasCrossed = false;
      
      // Basic case: point crosses from right to left
      if (prevX > 0 && currX <= 0 && currY > 0 && !lastTrig.has(key)) {
        hasCrossed = true;
      } 
      // Handle the case where angle change is so large that traditional crossing detection fails
      // Check if the point's path would have crossed the Y-axis
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
            globalIndex // Pass the global sequential index
          };
          
          // Create note object with modulo parameters
          const note = createNote(triggerData, state);
          
          // Add pan calculation to the note (based on angle)
          note.pan = Math.sin(worldRot);
          
          // Enhanced quantization logic
          if (state && state.useQuantization) {
            // Create trigger info object with all needed data - use a copy of the note
            const triggerInfo = {
              note: {...note}, // Create a copy to avoid reference issues
              worldRot,
              camera,
              renderer,
              isQuantized: true
            };
            
            // Handle quantized trigger (may schedule for later)
            const { shouldTrigger, triggerTime, isQuantized } = 
              handleQuantizedTrigger(tNow, state, triggerInfo);
            
            if (shouldTrigger) {
              // Set the precise trigger time
              const noteCopy = {...note};
              noteCopy.time = triggerTime;
              
              // IMPORTANT: We need to pass a copy of the entire note object here
              audioCallback(noteCopy);
              
              // Create a marker with visual feedback for quantization
              createMarker(worldRot, x1, y1, group.parent, noteCopy, camera, renderer, isQuantized);
            }
            
            // Always add to triggered set to prevent re-triggering
            triggeredNow.add(key);
          } else {
            // Regular non-quantized trigger - use a copy
            const noteCopy = {...note};
            audioCallback(noteCopy);
            createMarker(worldRot, x1, y1, group.parent, noteCopy, camera, renderer, false);
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
      
      // Calculate previous and current positions
      const prevX = localPos.x * Math.cos(lastAngle) - localPos.y * Math.sin(lastAngle);
      const prevY = localPos.x * Math.sin(lastAngle) + localPos.y * Math.cos(lastAngle);
      
      const currX = localPos.x * Math.cos(angle) - localPos.y * Math.sin(angle);
      const currY = localPos.x * Math.sin(angle) + localPos.y * Math.cos(angle);
      
      // Calculate world position
      const worldX = localPos.x * Math.cos(angle) - localPos.y * Math.sin(angle);
      const worldY = localPos.x * Math.sin(angle) + localPos.y * Math.cos(angle);
      
      // Create a unique key for this intersection point
      const key = `intersection-${i}`;
      
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
          }
        }
      }
      
      if (hasCrossed) {
        // Check for overlap with already triggered points
        if (!isPointOverlapping(worldX, worldY, triggeredPoints)) {
          // Add to triggered points
          triggeredPoints.push({ x: worldX, y: worldY });
          
          // Calculate global sequential index for intersection point
          // Comes after all regular vertices
          const globalIndex = (copies * count) + i;
          
          // Prepare trigger data for note creation
          const triggerData = {
            x: localPos.x,
            y: localPos.y,
            isIntersection: true,
            intersectionIndex: i,
            angle,
            lastAngle,
            globalIndex // Pass the global sequential index
          };
          
          // Create note object with modulo parameters
          const note = createNote(triggerData, state);
          
          // Add pan calculation to the note (based on angle)
          note.pan = Math.sin(angle);
          
          // Enhanced quantization logic for intersection points
          if (state && state.useQuantization) {
            // Create trigger info object with note and visualization parameters - use a copy
            const triggerInfo = {
              note: {...note}, // Create a copy to avoid reference issues
              worldRot: angle, // Use global angle since this is not in a copy group
              camera,
              renderer,
              isQuantized: true
            };
            
            // Handle quantized trigger (may schedule for later)
            const { shouldTrigger, triggerTime, isQuantized } = 
              handleQuantizedTrigger(tNow, state, triggerInfo);
            
            if (shouldTrigger) {
              // Set the precise trigger time
              const noteCopy = {...note};
              noteCopy.time = triggerTime;
              
              // Trigger audio now with the complete note copy
              audioCallback(noteCopy);
              
              // Create a marker with visual feedback for quantization
              createMarker(angle, localPos.x, localPos.y, group.parent, noteCopy, camera, renderer, isQuantized);
            }
            
            // Always add to triggered set to prevent re-triggering
            triggeredNow.add(key);
          } else {
            // Regular non-quantized trigger - use a copy
            const noteCopy = {...note};
            audioCallback(noteCopy);
            createMarker(angle, localPos.x, localPos.y, group.parent, noteCopy, camera, renderer, false);
            triggeredNow.add(key);
          }
        } else {
          // Point is overlapping, just add to triggered set
          triggeredNow.add(key);
        }
      }
    }
  }
  
  return triggeredNow;
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