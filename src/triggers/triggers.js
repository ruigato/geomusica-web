// src/triggers/triggers.js - New module for trigger detection and management
import * as THREE from 'three';
import { MARK_LIFE, OVERLAP_THRESHOLD } from '../config/constants.js';
import { createOrUpdateLabel, createAxisLabel, removeLabel } from '../ui/domLabels.js';
import { getFrequency } from '../geometry/geometry.js';
import { quantizeToEqualTemperament, getNoteName } from '../audio/frequencyUtils.js';

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
 * Create a marker at the given coordinates with frequency label
 * @param {number} worldRot Rotation angle in radians
 * @param {number} x X coordinate in local space
 * @param {number} y Y coordinate in local space
 * @param {THREE.Scene} scene Scene to add marker to
 * @param {number} frequency Frequency value for label
 * @param {THREE.Camera} camera Camera for label positioning
 * @param {THREE.WebGLRenderer} renderer Renderer for label positioning
 * @returns {Object} Created marker
 */
function createMarker(worldRot, x, y, scene, frequency = null, camera = null, renderer = null) {
  // Check if the scene's userData contains our markers array
  if (!scene.userData.markers) {
    scene.userData.markers = [];
  }
  
  // Create the marker
  const markerGeom = new THREE.SphereGeometry(8, 8, 8);
  
  // Create a semi-transparent material for the marker
  const markerMat = new THREE.MeshBasicMaterial({
    color: 0xff00ff,
    transparent: true,
    opacity: 1.0,
    depthTest: false
  });
  
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
    let freqText;
    
    // If equal temperament is enabled, show both the original frequency and the note name
    if (scene.userData.state.useEqualTemperament) {
      const refFreq = scene.userData.state.referenceFrequency || 440;
      const quantizedFreq = quantizeToEqualTemperament(frequency, refFreq);
      const noteName = getNoteName(quantizedFreq, refFreq);
      freqText = `${frequency.toFixed(1)}Hz (${noteName})`;
    } else {
      // Just show frequency in free temperament mode
      freqText = `${frequency.toFixed(2)}Hz`;
    }
    
    // Create a unique ID for this temporary label
    const labelId = `axis-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create axis crossing label
    const worldPosition = new THREE.Vector3(worldX, worldY, 5);
    textLabel = createAxisLabel(labelId, worldPosition, freqText, camera, renderer);
  }
  
  // Add to our markers array with life value
  const marker = {
    mesh: markerMesh,
    textLabel: textLabel,
    life: MARK_LIFE
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
  
  // Get vertices from buffer geometry
  const positions = baseGeo.getAttribute('position').array;
  const count = baseGeo.getAttribute('position').count;
  
  // Get camera and renderer for axis labels
  const camera = group.parent?.userData?.camera;
  const renderer = group.parent?.userData?.renderer;
  
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
        // Calculate frequency for this point
        const freq = Math.hypot(x1, y1);
        
        // Check if this point overlaps with any previously triggered points
        if (!isPointOverlapping(worldX, worldY, triggeredPoints)) {
          // No overlap, trigger audio and create marker
          audioCallback(x1, y1, lastAngle, angle, tNow);
          triggeredNow.add(key);
          
          // Add this point to the list of triggered points
          triggeredPoints.push({ x: worldX, y: worldY });
          
          // Create a marker at the current vertex position (in world space)
          createMarker(worldRot, x1, y1, group.parent, freq, camera, renderer);
        } else {
          // Point is overlapping, still add to triggered set but don't trigger audio
          triggeredNow.add(key);
          
          // Still create visual marker to maintain visual consistency
          createMarker(worldRot, x1, y1, group.parent, freq, camera, renderer);
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
        // Calculate frequency for this point
        const freq = Math.hypot(localPos.x, localPos.y);
        
        // Check for overlap with already triggered points
        if (!isPointOverlapping(worldX, worldY, triggeredPoints)) {
          // No overlap, trigger audio and create marker
          audioCallback(localPos.x, localPos.y, lastAngle, angle, tNow);
          triggeredNow.add(key);
          
          // Add to triggered points
          triggeredPoints.push({ x: worldX, y: worldY });
          
          // Create visual marker with frequency label
          createMarker(angle, localPos.x, localPos.y, group.parent, freq, camera, renderer);
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
      marker.mesh.material.opacity = marker.life / MARK_LIFE;
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