// src/geometry/geometry.js - Optimized version with proper modulus, alt scale, and step scale handling
import * as THREE from 'three';
import { 
  OVERLAP_THRESHOLD, 
  VERTEX_CIRCLE_SIZE, 
  VERTEX_CIRCLE_OPACITY, 
  VERTEX_CIRCLE_COLOR,
  INTERSECTION_POINT_SIZE,
  INTERSECTION_POINT_COLOR,
  INTERSECTION_POINT_OPACITY
} from '../config/constants.js';
import { findAllIntersections } from './intersections.js';
import { createOrUpdateLabel, createAxisLabel } from '../ui/domLabels.js';

// Function to create a regular polygon outline
export function createPolygonGeometry(radius, segments) {
  // Create a BufferGeometry to hold our vertices
  const geometry = new THREE.BufferGeometry();
  
  // Generate vertices for the outline only - no central vertex
  const vertices = [];
  const step = (Math.PI * 2) / segments;
  
  // Create vertices in a circular pattern
  for (let i = 0; i < segments; i++) {
    const angle = i * step;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    vertices.push(x, y, 0);
  }
  
  // Create indices for line segments
  const indices = [];
  for (let i = 0; i < segments; i++) {
    indices.push(i, (i + 1) % segments); // Connect each vertex to the next, looping back to start
  }
  
  // Set attributes
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  
  return geometry;
}

// Function to create the vertical axis
export function createAxis(scene) {
  const axisGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 2048, 0),
  ]);
  scene.add(new THREE.Line(axisGeo, new THREE.LineBasicMaterial({ color: 0xffffff })));
}

/**
 * Calculate the bounding sphere radius for all visible geometry
 * @param {THREE.Group} group Group containing all polygon copies
 * @param {Object} state Application state
 * @returns {number} Radius needed to contain all geometry
 */
export function calculateBoundingSphere(group, state) {
  if (!state) return 2000; // Default value if no state
  
  let maxDistance = state.radius || 500; // Start with base radius
  
  // Consider copies and scale factor
  if (state.copies > 0) {
    // If using modulus
    if (state.useModulus) {
      // Calculate based on modulus pattern
      let maxScale = 1.0;
      for (let i = 0; i < state.copies; i++) {
        const scaleFactor = state.getScaleFactorForCopy(i);
        const stepScale = Math.pow(state.stepScale, i);
        const totalScale = scaleFactor * stepScale;
        maxScale = Math.max(maxScale, totalScale);
      }
      maxDistance = state.radius * maxScale * 1.2; // Add 20% margin
    } else if (state.useAltScale) {
      // Consider alt scale pattern
      let maxScale = 1.0;
      for (let i = 0; i < state.copies; i++) {
        let scale = Math.pow(state.stepScale, i);
        // Apply alt scale if needed
        if ((i + 1) % state.altStepN === 0) {
          scale *= state.altScale;
        }
        maxScale = Math.max(maxScale, scale);
      }
      maxDistance = state.radius * maxScale * 1.2;
    } else {
      // Simple step scale formula
      const maxScale = Math.pow(state.stepScale, state.copies - 1);
      maxDistance = state.radius * maxScale * 1.2; // Add 20% margin
    }
  }
  
  // Account for intersection points if needed
  if (state.useIntersections && state.intersectionPoints && state.intersectionPoints.length > 0) {
    for (const point of state.intersectionPoints) {
      const dist = Math.hypot(point.x, point.y);
      maxDistance = Math.max(maxDistance, dist * 1.1); // Add 10% margin
    }
  }
  
  // Never go below minimum visible distance
  return Math.max(maxDistance, 500);
}

// Create a circle geometry for vertices
function createVertexCircleGeometry() {
  // Use a circle geometry for vertices
  return new THREE.CircleGeometry(VERTEX_CIRCLE_SIZE, 16);
}

// Create a circle geometry for intersection points
function createIntersectionPointGeometry() {
  // Use a circle geometry for intersection points with a different size
  return new THREE.CircleGeometry(INTERSECTION_POINT_SIZE, 16);
}

// Create a frequency label using the DOM approach
export function createTextLabel(text, position, parent, isAxisLabel = true, camera = null, renderer = null) {
  // For DOM-based labels, we don't actually create a Three.js object
  // Instead, we return an info object that can be used to update the DOM label
  return {
    text,
    position: position.clone ? position.clone() : new THREE.Vector3(position.x, position.y, position.z || 0),
    isAxisLabel,
    id: `label-${Math.random().toString(36).substr(2, 9)}`,
    domElement: null,
    update: function(camera, renderer) {
      // Create or update the DOM label
      if (isAxisLabel) {
        this.domElement = createAxisLabel(this.id, this.position, this.text, camera, renderer);
      } else {
        this.domElement = createOrUpdateLabel(this.id, this.position, this.text, camera, renderer);
      }
      return this;
    }
  };
}

// Function to update the group of copies
export function updateGroup(group, copies, stepScale, baseGeo, mat, segments, angle = 0, state = null, isLerping = false, justCalculatedIntersections = false) {
  // Clean up existing point frequency labels if they exist
  if (state && state.pointFreqLabels) {
    state.cleanupPointFreqLabels();
  }
  
  group.clear();
  
  // Cache the base radius once to use for all modulus calculations
  const baseRadius = state ? state.radius : 0;
  
  // Only create markers if we have multiple copies
  const hasEnoughCopiesForIntersections = copies > 1;

  // Create vertex circle geometry (reuse for all vertices)
  const vertexCircleGeometry = createVertexCircleGeometry();
  
  // Create vertex circle material (reuse for all vertices)
  const vertexCircleMaterial = new THREE.MeshBasicMaterial({ 
    color: VERTEX_CIRCLE_COLOR,
    transparent: true,
    opacity: VERTEX_CIRCLE_OPACITY,
    depthTest: false
  });
  
  // For intersection detection, we'll need to create a temporary group to calculate intersections
  // before they're added to the actual group
  let tempGroup = null;
  let intersectionPoints = [];
  
  // Check if we need to find intersections and have multiple copies
  if (state && state.useIntersections && copies > 1) {
    tempGroup = new THREE.Group();
    tempGroup.position.copy(group.position);
    tempGroup.rotation.copy(group.rotation);
    tempGroup.scale.copy(group.scale);
  }
  
  // First create all the polygon copies (either in the main group or temp group)
  const targetGroup = tempGroup || group;
  
  for (let i = 0; i < copies; i++) {
    // Base scale factor from step scale
    let stepScaleFactor = Math.pow(stepScale, i);
    
    // Initialize final scale variables
    let finalScale = stepScaleFactor;
    
    // Determine scale based on different features
    if (state) {
      if (state.useModulus) {
        // Get the sequence value (increasing from 1/modulus to 1.0)
        const modulusScale = state.getScaleFactorForCopy(i);
        finalScale = modulusScale * stepScaleFactor;  // Apply both modulus scale and step scale
      } else if (state.useAltScale) {
        // Apply alt scale multiplier if this is an Nth copy (without modulus)
        if ((i + 1) % state.altStepN === 0) {
          finalScale = stepScaleFactor * state.altScale;
        }
      }
    }
    
    // Each copy gets a cumulative angle (i * angle) in degrees
    const cumulativeAngleDegrees = i * angle;
    
    // Convert to radians only when setting the actual Three.js rotation
    const cumulativeAngleRadians = (cumulativeAngleDegrees * Math.PI) / 180;
    
    // Create a group for this copy to hold both the lines and vertex circles
    const copyGroup = new THREE.Group();
    
    // Create line for the polygon outline - use the original geometry here
    const lines = new THREE.LineLoop(baseGeo, mat.clone());
    lines.scale.set(finalScale, finalScale, 1);
    copyGroup.add(lines);
    
    // Apply rotation to the copy group
    copyGroup.rotation.z = cumulativeAngleRadians;
    
    // Add the whole copy group to the target group
    targetGroup.add(copyGroup);
  }
  
  // If we're using intersections and need an update, find and apply intersections
  if (state && state.useIntersections && state.needsIntersectionUpdate && copies > 1) {
    // Find all intersection points between the copies in the temp group
    intersectionPoints = findAllIntersections(tempGroup);
    
    // Update the geometry with intersections before creating the real group
    if (intersectionPoints.length > 0) {
      // Store intersection points in state
      state.intersectionPoints = intersectionPoints;
      
      // Reset the flag since we've updated the intersections
      state.needsIntersectionUpdate = false;
    }
  }
  
  // Create point frequency labels if enabled
  const shouldCreatePointLabels = state && 
                                 state.showPointsFreqLabels && 
                                 !isLerping;
  
  // If we should create point labels, initialize the array
  if (shouldCreatePointLabels) {
    state.pointFreqLabels = [];
  }
  
  // Get camera and renderer from scene's userData (assuming they're stored there)
  const camera = group.parent?.userData?.camera;
  const renderer = group.parent?.userData?.renderer;
  
  // Now create the actual group based on the updated geometry
  for (let i = 0; i < copies; i++) {
    // Base scale factor from step scale
    let stepScaleFactor = Math.pow(stepScale, i);
    
    // Initialize final scale variables
    let finalScale = stepScaleFactor;
    
    // Determine scale based on different features
    if (state) {
      if (state.useModulus) {
        // Get the sequence value (increasing from 1/modulus to 1.0)
        const modulusScale = state.getScaleFactorForCopy(i);
        finalScale = modulusScale * stepScaleFactor;  // Apply both modulus scale and step scale
      } else if (state.useAltScale) {
        // Apply alt scale multiplier if this is an Nth copy (without modulus)
        if ((i + 1) % state.altStepN === 0) {
          finalScale = stepScaleFactor * state.altScale;
        }
      }
    }
    
    // Each copy gets a cumulative angle (i * angle) in degrees
    const cumulativeAngleDegrees = i * angle;
    
    // Convert to radians only when setting the actual Three.js rotation
    const cumulativeAngleRadians = (cumulativeAngleDegrees * Math.PI) / 180;
    
    // Create a group for this copy to hold both the lines and vertex circles
    const copyGroup = new THREE.Group();
    
    // Use the current geometry (may have been updated with intersections)
    const lines = new THREE.LineLoop(baseGeo, mat.clone());
    lines.scale.set(finalScale, finalScale, 1);
    copyGroup.add(lines);
    
    // Get the positions from the geometry
    const positions = baseGeo.getAttribute('position').array;
    const count = baseGeo.getAttribute('position').count;
    
    // Add circles at each vertex
    for (let v = 0; v < count; v++) {
      const x = positions[v * 3] * finalScale;
      const y = positions[v * 3 + 1] * finalScale;
      
      // Create a circle at this vertex
      const vertexCircle = new THREE.Mesh(vertexCircleGeometry, vertexCircleMaterial.clone());
      
      // Position the circle at the vertex
      vertexCircle.position.set(x, y, 0);
      
      // Add to the copy group
      copyGroup.add(vertexCircle);
      
      // Add persistent frequency label if enabled
      if (shouldCreatePointLabels && camera && renderer) {
        // Calculate frequency for this vertex
        const freq = Math.hypot(x, y);
        
        // Format frequency with 2 decimal places
        const freqText = `${freq.toFixed(2)}`;
        
        // Create a world position for this vertex in the copy
        const worldPos = new THREE.Vector3(x, y, 0);
        
        // Apply the copy's rotation
        const rotatedPos = worldPos.clone();
        rotatedPos.applyAxisAngle(new THREE.Vector3(0, 0, 1), cumulativeAngleRadians);
        
        // Create a text label for this vertex
        const textLabel = createTextLabel(
          freqText, 
          rotatedPos, 
          copyGroup, // Parent is not really used for DOM labels
          false, // Not an axis label
          camera,
          renderer
        );
        
        // Update the label immediately
        textLabel.update(camera, renderer);
        
        // Store reference for cleanup
        state.pointFreqLabels.push({
          label: textLabel,
          copyIndex: i,
          vertexIndex: v,
          position: rotatedPos.clone()
        });
      }
    }
    
    // Apply rotation to the copy group
    copyGroup.rotation.z = cumulativeAngleRadians;
    
    // Add the whole copy group to the main group
    group.add(copyGroup);
  }
  
  // Clean up temporary group if it exists
  if (tempGroup) {
    tempGroup.traverse(child => {
      if (child.geometry && child !== baseGeo) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
    tempGroup = null;
  }
  
  // Finally, add the intersection point markers to the group (so they rotate with everything)
  // Only create/update markers if:
  // 1. We're using intersections AND
  // 2. We have intersection points AND
  // 3. We're not currently lerping AND
  // 4. Either we just calculated new intersections OR we don't have markers yet
  const needToCreateMarkers = state && 
                             state.useIntersections && 
                             hasEnoughCopiesForIntersections && // Only if we have enough copies
                             state.intersectionPoints && 
                             state.intersectionPoints.length > 0 && 
                             !isLerping &&
                             (justCalculatedIntersections || !group.userData.intersectionMarkerGroup);
                             
  if (needToCreateMarkers) {
    // Clean up any existing marker group on this group
    if (group.userData && group.userData.intersectionMarkerGroup) {
      group.remove(group.userData.intersectionMarkerGroup);
      group.userData.intersectionMarkerGroup.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
      group.userData.intersectionMarkerGroup = null;
    }
    
    // Create a group to hold the intersection markers
    const intersectionMarkerGroup = new THREE.Group();
    
    // Tag this group for identification during audio triggers
    intersectionMarkerGroup.userData.isIntersectionGroup = true;
    
    // Create a material for intersection points
    const intersectionMaterial = new THREE.MeshBasicMaterial({
      color: INTERSECTION_POINT_COLOR,
      transparent: true,
      opacity: INTERSECTION_POINT_OPACITY,
      depthTest: false
    });
    
    // Create a geometry for intersection points
    const intersectionGeometry = createIntersectionPointGeometry();
    
    // Add visual representation for each intersection point
    for (const point of state.intersectionPoints) {
      const pointMesh = new THREE.Mesh(intersectionGeometry, intersectionMaterial.clone());
      pointMesh.position.copy(point);
      
      // Add to the intersection marker group
      intersectionMarkerGroup.add(pointMesh);
      
      // Add persistent frequency label for intersection point if enabled
      if (shouldCreatePointLabels && camera && renderer) {
        // Calculate frequency for this intersection point
        const freq = Math.hypot(point.x, point.y);
        
        // Format frequency with 2 decimal places
        const freqText = `${freq.toFixed(2)}`;
        
        // Create a text label for this intersection point
        const textLabel = createTextLabel(
          freqText, 
          point, 
          intersectionMarkerGroup, // Parent is not really used for DOM labels
          false, // Not an axis label
          camera,
          renderer
        );
        
        // Update the label immediately
        textLabel.update(camera, renderer);
        
        // Store reference for cleanup
        state.pointFreqLabels.push({
          label: textLabel,
          isIntersection: true,
          position: point.clone()
        });
      }
    }
    
    // Add the whole marker group to the main group
    group.add(intersectionMarkerGroup);
    
    // Store reference to the intersection marker group
    group.userData.intersectionMarkerGroup = intersectionMarkerGroup;
  }
}

// Calculate the distance between two points in 2D space
function distanceBetweenPoints(x1, y1, x2, y2) {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

// Check if a point at (x, y) is too close to any existing active points
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

// Function to detect crossings and trigger audio
export function detectCrossings(baseGeo, lastAngle, angle, copies, group, lastTrig, tNow, audioCallback) {
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
    
    const worldRot = angle + copyGroup.rotation.z;
    const worldScale = mesh.scale.x;
    
    // Process each vertex in this copy
    for (let vi = 0; vi < count; vi++) {
      const x0 = positions[vi * 3];
      const y0 = positions[vi * 3 + 1];
      
      const x1 = x0 * worldScale;
      const y1 = y0 * worldScale;
      
      const prevX = x1 * Math.cos(lastAngle + copyGroup.rotation.z) - y1 * Math.sin(lastAngle + copyGroup.rotation.z);
      const currX = x1 * Math.cos(worldRot) - y1 * Math.sin(worldRot);
      const currY = x1 * Math.sin(worldRot) + y1 * Math.cos(worldRot);
      
      // Calculate the world position of the vertex
      const worldX = x1 * Math.cos(worldRot) - y1 * Math.sin(worldRot);
      const worldY = x1 * Math.sin(worldRot) + y1 * Math.cos(worldRot);
      
      const key = `${ci}-${vi}`;
      
      if (prevX > 0 && currX <= 0 && currY > 0 && !lastTrig.has(key)) {
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
      const currX = localPos.x * Math.cos(angle) - localPos.y * Math.sin(angle);
      const currY = localPos.x * Math.sin(angle) + localPos.y * Math.cos(angle);
      
      // Calculate world position
      const worldX = localPos.x * Math.cos(angle) - localPos.y * Math.sin(angle);
      const worldY = localPos.x * Math.sin(angle) + localPos.y * Math.cos(angle);
      
      // Create a unique key for this intersection point
      const key = `intersection-${i}`;
      
      // Check if this point crossed the Y axis from right to left
      if (prevX > 0 && currX <= 0 && currY > 0 && !lastTrig.has(key)) {
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

// Function to create a marker at the given coordinates with frequency label
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
    // Format frequency with 2 decimal places
    const freqText = `${frequency.toFixed(2)}`;
    
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
    life: 30 // MARK_LIFE value
  };
  
  if (scene.userData.state && scene.userData.state.markers) {
    scene.userData.state.markers.push(marker);
  } else {
    // Fall back to scene's userData if state is not available
    scene.userData.markers.push(marker);
  }
  
  return marker;
}