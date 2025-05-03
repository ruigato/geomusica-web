// src/geometry/intersections.js
import * as THREE from 'three';
import { INTERSECTION_MERGE_THRESHOLD, INTERSECTION_POINT_COLOR, INTERSECTION_POINT_OPACITY, INTERSECTION_POINT_SIZE } from '../config/constants.js';

// A more precise line-line intersection function
export function findIntersection(p1, p2, p3, p4) {
  // Extract coordinates
  const x1 = p1.x, y1 = p1.y;
  const x2 = p2.x, y2 = p2.y;
  const x3 = p3.x, y3 = p3.y;
  const x4 = p4.x, y4 = p4.y;
  
  // Calculate determinants
  const denominator = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
  
  // If denominator is 0, lines are parallel or collinear
  if (Math.abs(denominator) < 1e-10) {
    return null;
  }
  
  const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denominator;
  const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denominator;
  
  // Check if intersection is within both line segments
  if (ua < 0 || ua > 1 || ub < 0 || ub > 1) {
    return null;
  }
  
  // Calculate intersection point
  const x = x1 + ua * (x2 - x1);
  const y = y1 + ua * (y2 - y1);
  
  return new THREE.Vector3(x, y, 0);
}

// Calculate distance between two points
function distanceBetweenPoints(p1, p2) {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

// Check if a point is too close to any existing points (to avoid duplicates)
function isPointTooClose(point, existingPoints, threshold = INTERSECTION_MERGE_THRESHOLD) {
  for (const existing of existingPoints) {
    if (distanceBetweenPoints(point, existing) < threshold) {
      return true;
    }
  }
  return false;
}

// Find all intersections between polygon copies
export function findAllIntersections(group) {
  const intersectionPoints = [];
  const children = group.children;
  
  // Skip if there are fewer than 2 copies (no intersections possible)
  if (children.length < 2) {
    return intersectionPoints;
  }
  
  // Create a temporary group to calculate intersections in an unrotated state
  const tempGroup = new THREE.Group();
  
  // Clone each polygon to the temp group, preserving its individual rotation and scale
  for (let i = 0; i < children.length; i++) {
    const originalCopy = children[i];
    const clonedCopy = originalCopy.clone();
    
    // Apply only the rotation of each copy, not the group's rotation
    clonedCopy.rotation.copy(originalCopy.rotation);
    
    // Add to temp group
    tempGroup.add(clonedCopy);
  }
  
  // For each pair of polygons
  for (let i = 0; i < tempGroup.children.length; i++) {
    const copyA = tempGroup.children[i];
    
    // Get the line segments
    // LineLoop is typically the first child
    const linesA = copyA.children[0];
    
    if (!linesA || !linesA.geometry) continue;
    
    const positionsA = linesA.geometry.getAttribute('position');
    const countA = positionsA.count;
    
    for (let j = i + 1; j < tempGroup.children.length; j++) {
      const copyB = tempGroup.children[j];
      
      // Get the line segments
      const linesB = copyB.children[0];
      
      if (!linesB || !linesB.geometry) continue;
      
      const positionsB = linesB.geometry.getAttribute('position');
      const countB = positionsB.count;
      
      // Check each line segment pair for intersections
      for (let a = 0; a < countA; a++) {
        // Get vertices for the line segment from A
        const a1 = a;
        const a2 = (a + 1) % countA;
        
        // Get vertex coordinates in world space
        const v1A = new THREE.Vector3();
        const v2A = new THREE.Vector3();
        
        v1A.fromBufferAttribute(positionsA, a1);
        v2A.fromBufferAttribute(positionsA, a2);
        
        // Apply scaling
        v1A.multiply(linesA.scale);
        v2A.multiply(linesA.scale);
        
        // Apply rotation
        v1A.applyQuaternion(copyA.quaternion);
        v2A.applyQuaternion(copyA.quaternion);
        
        for (let b = 0; b < countB; b++) {
          // Get vertices for the line segment from B
          const b1 = b;
          const b2 = (b + 1) % countB;
          
          // Get vertex coordinates in world space
          const v1B = new THREE.Vector3();
          const v2B = new THREE.Vector3();
          
          v1B.fromBufferAttribute(positionsB, b1);
          v2B.fromBufferAttribute(positionsB, b2);
          
          // Apply scaling
          v1B.multiply(linesB.scale);
          v2B.multiply(linesB.scale);
          
          // Apply rotation
          v1B.applyQuaternion(copyB.quaternion);
          v2B.applyQuaternion(copyB.quaternion);
          
          // Find intersection between these two line segments
          const intersection = findIntersection(v1A, v2A, v1B, v2B);
          
          if (intersection && !isPointTooClose(intersection, intersectionPoints)) {
            intersectionPoints.push(intersection);
          }
        }
      }
    }
  }
  
  // Clean up temporary objects
  tempGroup.traverse(child => {
    if (child.geometry && child !== tempGroup) child.geometry.dispose();
    if (child.material) child.material.dispose();
  });
  
  return intersectionPoints;
}

// Apply intersection points to the geometry
export function applyIntersectionsToGeometry(baseGeo, intersectionPoints) {
  if (!baseGeo || !intersectionPoints || intersectionPoints.length === 0) {
    return baseGeo;
  }
  
  // Get the current positions and indices
  const positions = baseGeo.getAttribute('position').array;
  const count = baseGeo.getAttribute('position').count;
  const originalIndices = baseGeo.index.array;
  
  // Create a new array to hold all vertices (existing + intersections)
  const newPositions = [];
  
  // Add existing vertices first
  for (let i = 0; i < count; i++) {
    newPositions.push(
      positions[i * 3],     // x
      positions[i * 3 + 1], // y
      positions[i * 3 + 2]  // z
    );
  }
  
  // Then add intersection points
  for (const point of intersectionPoints) {
    newPositions.push(
      point.x,
      point.y,
      point.z || 0
    );
  }
  
  // Create a new BufferGeometry
  const newGeometry = new THREE.BufferGeometry();
  
  // Set positions attribute
  newGeometry.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
  
  // Copy original indices to maintain the original shape
  // Important: we're not adding new lines for the intersection points
  // they will just be added as vertices in the geometry
  newGeometry.setIndex([...originalIndices]);
  
  // Dispose of the old geometry to free memory
  baseGeo.dispose();
  
  return newGeometry;
}

// Create visualization markers for intersection points
export function createIntersectionMarkers(scene, intersectionPoints, group) {
  if (!scene || !intersectionPoints || intersectionPoints.length === 0) {
    return;
  }
  
  // Clean up any existing markers first
  if (scene.userData.intersectionMarkers) {
    for (const marker of scene.userData.intersectionMarkers) {
      if (marker.parent) {
        marker.parent.remove(marker);
      } else {
        scene.remove(marker);
      }
      if (marker.geometry) marker.geometry.dispose();
      if (marker.material) marker.material.dispose();
    }
    scene.userData.intersectionMarkers = [];
  }
  
  // Clean up marker group if it exists
  if (scene.userData.intersectionMarkerGroup) {
    if (scene.userData.intersectionMarkerGroup.parent) {
      scene.userData.intersectionMarkerGroup.parent.remove(scene.userData.intersectionMarkerGroup);
    } else {
      scene.remove(scene.userData.intersectionMarkerGroup);
    }
    scene.userData.intersectionMarkerGroup = null;
  }
  
  // Store markers in userData for cleanup later
  if (!scene.userData.intersectionMarkers) {
    scene.userData.intersectionMarkers = [];
  }
  
  // Create a material for intersection points
  const intersectionMaterial = new THREE.MeshBasicMaterial({
    color: INTERSECTION_POINT_COLOR,
    transparent: true,
    opacity: INTERSECTION_POINT_OPACITY,
    depthTest: false
  });
  
  // Create a geometry for intersection points
  const circleGeometry = new THREE.CircleGeometry(INTERSECTION_POINT_SIZE, 16);
  
  // Create a group specifically for intersection markers
  const markersGroup = new THREE.Group();
  
  // Add the markers group to the main rotation group (for proper rotation)
  if (group) {
    group.add(markersGroup);
  } else {
    scene.add(markersGroup);
  }
  
  // Store for later cleanup
  scene.userData.intersectionMarkerGroup = markersGroup;
  
  // Create and add a marker for each intersection point
  for (const point of intersectionPoints) {
    const marker = new THREE.Mesh(circleGeometry, intersectionMaterial.clone());
    marker.position.copy(point);
    
    // Add to the markers group
    markersGroup.add(marker);
    
    // Also store references for later cleanup
    scene.userData.intersectionMarkers.push(marker);
  }
}

// Process intersections and update the base geometry
export function processIntersections(state, baseGeo, group) {
    if (!state || !state.useIntersections || !state.needsIntersectionUpdate || !baseGeo || !group) {
      return baseGeo;
    }
    
    // Find all intersections between polygons
    const intersectionPoints = findAllIntersections(group);
    
    if (intersectionPoints.length === 0) {
      state.needsIntersectionUpdate = false;
      return baseGeo;
    }
    
    // Update state with intersection points
    state.intersectionPoints = intersectionPoints;
    state.needsIntersectionUpdate = false;
    
    // NOTE: We've removed the call to applyIntersectionsToGeometry
    // so we no longer add intersection points to the base geometry
    
    // Return the original geometry unchanged
    return baseGeo;
  }