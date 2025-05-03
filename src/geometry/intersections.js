// src/geometry/intersections.js
import * as THREE from 'three';
import { INTERSECTION_MERGE_THRESHOLD, INTERSECTION_POINT_COLOR, INTERSECTION_POINT_OPACITY, INTERSECTION_POINT_SIZE } from '../config/constants.js';

// Line segment intersection calculation
// Based on the algorithm from: https://en.wikipedia.org/wiki/Line–line_intersection
export function findIntersection(p1, p2, p3, p4) {
  // Ensure all points are Vector3 objects
  const v1 = p1 instanceof THREE.Vector3 ? p1 : new THREE.Vector3(p1.x, p1.y, p1.z || 0);
  const v2 = p2 instanceof THREE.Vector3 ? p2 : new THREE.Vector3(p2.x, p2.y, p2.z || 0);
  const v3 = p3 instanceof THREE.Vector3 ? p3 : new THREE.Vector3(p3.x, p3.y, p3.z || 0);
  const v4 = p4 instanceof THREE.Vector3 ? p4 : new THREE.Vector3(p4.x, p4.y, p4.z || 0);
  
  // Line 1 represented as: v1 + t * (v2 - v1)
  // Line 2 represented as: v3 + s * (v4 - v3)
  
  const x1 = v1.x, y1 = v1.y;
  const x2 = v2.x, y2 = v2.y;
  const x3 = v3.x, y3 = v3.y;
  const x4 = v4.x, y4 = v4.y;
  
  // Calculate denominators
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
  
  // Temporary matrix to store world transformations
  const tempMatrix = new THREE.Matrix4();
  
  // Loop through all pairs of polygon copies
  for (let i = 0; i < children.length; i++) {
    const copyA = children[i];
    
    // Get the line segments from the first child (LineLoop) of each copy
    const linesA = copyA.children[0];
    const positionsA = linesA.geometry.getAttribute('position');
    const indexA = linesA.geometry.index;
    
    // Skip if no valid geometry
    if (!positionsA || !indexA) continue;
    
    // Calculate the world matrix for this copy
    tempMatrix.identity();
    copyA.updateMatrixWorld(true);
    linesA.updateMatrixWorld(true);
    tempMatrix.multiplyMatrices(copyA.matrixWorld, linesA.matrixWorld);
    
    for (let j = i + 1; j < children.length; j++) {
      const copyB = children[j];
      
      // Get the line segments from the first child of the second copy
      const linesB = copyB.children[0];
      const positionsB = linesB.geometry.getAttribute('position');
      const indexB = linesB.geometry.index;
      
      // Skip if no valid geometry
      if (!positionsB || !indexB) continue;
      
      // Calculate the world matrix for this copy
      const matrixB = new THREE.Matrix4();
      copyB.updateMatrixWorld(true);
      linesB.updateMatrixWorld(true);
      matrixB.multiplyMatrices(copyB.matrixWorld, linesB.matrixWorld);
      
      // Check each line segment pair for intersections
      for (let segA = 0; segA < indexA.count; segA += 2) {
        // Get vertex indices for the line segment
        let idx1A = indexA.getX(segA);
        let idx2A = indexA.getX(segA + 1);
        
        // If second index is missing, connect back to the first vertex in the loop
        if (idx2A === undefined) {
          idx2A = indexA.getX(0);
        }
        
        // Extract vertices
        const v1A = new THREE.Vector3(
          positionsA.getX(idx1A), 
          positionsA.getY(idx1A), 
          positionsA.getZ(idx1A) || 0
        ).applyMatrix4(tempMatrix);
        
        const v2A = new THREE.Vector3(
          positionsA.getX(idx2A), 
          positionsA.getY(idx2A), 
          positionsA.getZ(idx2A) || 0
        ).applyMatrix4(tempMatrix);
        
        for (let segB = 0; segB < indexB.count; segB += 2) {
          // Get vertex indices for the line segment
          let idx1B = indexB.getX(segB);
          let idx2B = indexB.getX(segB + 1);
          
          // If second index is missing, connect back to the first vertex in the loop
          if (idx2B === undefined) {
            idx2B = indexB.getX(0);
          }
          
          // Extract vertices
          const v1B = new THREE.Vector3(
            positionsB.getX(idx1B), 
            positionsB.getY(idx1B), 
            positionsB.getZ(idx1B) || 0
          ).applyMatrix4(matrixB);
          
          const v2B = new THREE.Vector3(
            positionsB.getX(idx2B), 
            positionsB.getY(idx2B), 
            positionsB.getZ(idx2B) || 0
          ).applyMatrix4(matrixB);
          
          // Find intersection between these two line segments
          const intersection = findIntersection(v1A, v2A, v1B, v2B);
          
          if (intersection && !isPointTooClose(intersection, intersectionPoints)) {
            intersectionPoints.push(intersection);
          }
        }
      }
    }
  }
  
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
export function createIntersectionMarkers(scene, intersectionPoints) {
  if (!scene || !intersectionPoints || intersectionPoints.length === 0) {
    return;
  }
  
  // Clean up any existing markers first
  if (scene.userData.intersectionMarkers) {
    for (const marker of scene.userData.intersectionMarkers) {
      scene.remove(marker);
      if (marker.geometry) marker.geometry.dispose();
      if (marker.material) marker.material.dispose();
    }
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
  
  // Create and add a marker for each intersection point
  for (const point of intersectionPoints) {
    const marker = new THREE.Mesh(circleGeometry, intersectionMaterial.clone());
    marker.position.copy(point);
    
    scene.add(marker);
    
    // Store reference for later cleanup
    if (!scene.userData.intersectionMarkers) {
      scene.userData.intersectionMarkers = [];
    }
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
  
  // Apply the intersections to create a new geometry
  const newGeometry = applyIntersectionsToGeometry(baseGeo.clone(), intersectionPoints);
  
  // Update state
  state.intersectionPoints = intersectionPoints;
  state.needsIntersectionUpdate = false;
  
  // Return the new geometry with intersections added
  return newGeometry;
}