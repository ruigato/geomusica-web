// src/geometry/intersections.js
import * as THREE from 'three';
import { INTERSECTION_MERGE_THRESHOLD, INTERSECTION_POINT_COLOR, INTERSECTION_POINT_OPACITY, INTERSECTION_POINT_SIZE } from '../config/constants.js';

// Line segment intersection calculation
export function findIntersection(p1, p2, p3, p4) {
  // Extract coordinates
  const x1 = p1.x, y1 = p1.y;
  const x2 = p2.x, y2 = p2.y;
  const x3 = p3.x, y3 = p3.y;
  const x4 = p4.x, y4 = p4.y;
  
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
  
  // Get state object from group's userData
  const state = group.userData.state;
  
  if (!state) {
    console.warn("No state found in group userData, cannot calculate intersections");
    return intersectionPoints;
  }
  
  // Extract necessary parameters from state
  const useModulus = state.useModulus;
  const modulusValue = state.modulusValue;
  const stepScale = state.stepScale;
  const angle = state.angle;
  const radius = state.radius;
  const segments = state.segments;
  const copies = group.children.length;
  
  // Create a geometry that will be used for all calculations
  const geo = new THREE.BufferGeometry();
  
  // Generate vertices for the polygon outline
  const vertices = [];
  const step = (Math.PI * 2) / segments;
  
  for (let i = 0; i < segments; i++) {
    const ang = i * step;
    const x = radius * Math.cos(ang);
    const y = radius * Math.sin(ang);
    vertices.push(new THREE.Vector3(x, y, 0));
  }
  
  // Create line segments for each copy directly using the state parameters
  const polygons = [];
  
  for (let i = 0; i < copies; i++) {
    // Skip intersection marker groups
    if (i < group.children.length && 
        group.children[i].userData && 
        group.children[i].userData.isIntersectionGroup) {
      continue;
    }
    
    // Calculate scale factor based on modulus and step scale
    let scaleFactor;
    if (useModulus) {
      // Get modulus scale factor using the same formula as in state.getScaleFactorForCopy
      const modStep = 1.0 / modulusValue;
      const modIndex = i % modulusValue;
      const modulusScale = (modIndex + 1) * modStep;
      
      // Also apply step scale
      const stepFactor = Math.pow(stepScale, i);
      
      // Combine both scale factors
      scaleFactor = modulusScale * stepFactor;
    } else {
      // Just use step scale
      scaleFactor = Math.pow(stepScale, i);
    }
    
    // Calculate rotation for this copy in radians
    const rotationRad = (i * angle * Math.PI) / 180;
    
    // Create scaled and rotated vertices for this polygon
    const polyVertices = [];
    for (let j = 0; j < vertices.length; j++) {
      // Clone the original vertex
      const originalVertex = vertices[j].clone();
      
      // Apply scaling
      originalVertex.multiplyScalar(scaleFactor);
      
      // Apply rotation
      const x = originalVertex.x;
      const y = originalVertex.y;
      const rotX = x * Math.cos(rotationRad) - y * Math.sin(rotationRad);
      const rotY = x * Math.sin(rotationRad) + y * Math.cos(rotationRad);
      
      polyVertices.push(new THREE.Vector3(rotX, rotY, 0));
    }
    
    // Add to polygons list
    polygons.push(polyVertices);
  }
  
  // Check all polygon pairs for intersections
  for (let i = 0; i < polygons.length; i++) {
    const polyA = polygons[i];
    
    for (let j = i + 1; j < polygons.length; j++) {
      const polyB = polygons[j];
      
      // Check each edge pair for intersections
      for (let a = 0; a < polyA.length; a++) {
        const a1 = polyA[a];
        const a2 = polyA[(a + 1) % polyA.length];
        
        for (let b = 0; b < polyB.length; b++) {
          const b1 = polyB[b];
          const b2 = polyB[(b + 1) % polyB.length];
          
          const intersection = findIntersection(a1, a2, b1, b2);
          
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
  // We no longer add intersection points to the geometry
  // Just return the original geometry unchanged
  return baseGeo;
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
      if (marker.material) {
        if (Array.isArray(marker.material)) {
          marker.material.forEach(m => m.dispose());
        } else {
          marker.material.dispose();
        }
      }
    }
    scene.userData.intersectionMarkers = [];
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
  markersGroup.userData.isIntersectionGroup = true;
  
  // Add the markers group to the main rotation group if provided (for proper rotation)
  if (group) {
    group.add(markersGroup);
  } else {
    scene.add(markersGroup);
  }
  
  // Add this group to the scene's userData for later cleanup
  scene.userData.intersectionMarkerGroup = markersGroup;
  
  // Create and add a marker for each intersection point
  for (const point of intersectionPoints) {
    const marker = new THREE.Mesh(circleGeometry, intersectionMaterial.clone());
    marker.position.copy(point);
    
    // Add to the markers group rather than directly to the scene
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
  
  // Make sure the group has access to the state
  group.userData.state = state;
  
  // Find all intersections between polygons
  const intersectionPoints = findAllIntersections(group);
  
  if (intersectionPoints.length === 0) {
    state.needsIntersectionUpdate = false;
    state.intersectionPoints = [];
    return baseGeo;
  }
  
  // Update state with intersection points
  state.intersectionPoints = intersectionPoints;
  state.needsIntersectionUpdate = false;
  
  // Return the original geometry unchanged
  return baseGeo;
}