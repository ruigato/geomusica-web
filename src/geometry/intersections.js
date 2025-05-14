// src/geometry/intersections.js - Optimized version
import * as THREE from 'three';
import { INTERSECTION_MERGE_THRESHOLD, INTERSECTION_POINT_COLOR, INTERSECTION_POINT_OPACITY, INTERSECTION_POINT_SIZE } from '../config/constants.js';

// Reusable Vector3 objects to reduce garbage collection
const _vec1 = new THREE.Vector3();
const _vec2 = new THREE.Vector3();

/**
 * Find intersection between two line segments
 * @param {THREE.Vector3} p1 First point of first line segment
 * @param {THREE.Vector3} p2 Second point of first line segment
 * @param {THREE.Vector3} p3 First point of second line segment
 * @param {THREE.Vector3} p4 Second point of second line segment
 * @returns {THREE.Vector3|null} Intersection point or null if no intersection
 */
export function findIntersection(p1, p2, p3, p4) {
  // Extract coordinates
  const x1 = p1.x, y1 = p1.y;
  const x2 = p2.x, y2 = p2.y;
  const x3 = p3.x, y3 = p3.y;
  const x4 = p4.x, y4 = p4.y;
  
  // Calculate denominator
  const denominator = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
  
  // If denominator is close to 0, lines are parallel or collinear
  if (Math.abs(denominator) < 1e-10) {
    return null;
  }
  
  // Calculate parameters
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

/**
 * Calculate distance between two points
 * @param {THREE.Vector3} p1 First point
 * @param {THREE.Vector3} p2 Second point
 * @returns {number} Distance between points
 */
function distanceBetweenPoints(p1, p2) {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

/**
 * Check if a point is too close to any existing points
 * @param {THREE.Vector3} point The point to check
 * @param {Array<THREE.Vector3>} existingPoints Array of existing points
 * @param {number} threshold Distance threshold
 * @returns {boolean} True if point is too close to any existing point
 */
function isPointTooClose(point, existingPoints, threshold = INTERSECTION_MERGE_THRESHOLD) {
  for (const existing of existingPoints) {
    if (distanceBetweenPoints(point, existing) < threshold) {
      return true;
    }
  }
  return false;
}

/**
 * Helper function to calculate Greatest Common Divisor
 * Copied from geometry.js to ensure consistent calculation
 * @param {number} a First number
 * @param {number} b Second number
 * @returns {number} Greatest common divisor
 */
function calculateGCD(a, b) {
  while (b) {
    const temp = b;
    b = a % b;
    a = temp;
  }
  return a;
}

/**
 * Generate vertices for a star polygon
 * @param {number} n Number of points
 * @param {number} k Skip value
 * @param {number} radius Radius
 * @returns {Array<THREE.Vector3>} Array of vertices
 */
function generateStarPolygonVertices(n, k, radius) {
  const vertices = [];
  const baseVertices = [];
  
  // First generate all vertices on the circle
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    baseVertices.push(new THREE.Vector3(x, y, 0));
  }
  
  // Now connect them according to the star pattern
  let visited = new Set();
  let currentIndex = 0;
  
  // Continue until we've visited all vertices or completed a cycle
  while (visited.size < n && !visited.has(currentIndex)) {
    visited.add(currentIndex);
    vertices.push(baseVertices[currentIndex]);
    
    // Calculate next vertex based on skip pattern
    currentIndex = (currentIndex + k) % n;
  }
  
  return vertices;
}

/**
 * Find all intersections between polygon copies
 * @param {THREE.Group} group Group containing polygon copies
 * @returns {Array<THREE.Vector3>} Array of intersection points
 */
export function findAllIntersections(group) {
  const intersectionPoints = [];
  
  // Get state object from group's userData
  const state = group.userData.state;
  
  if (!state) {
    console.warn("No state found in group userData, cannot calculate intersections");
    return intersectionPoints;
  }
  
  // Count real copy count (excluding intersection marker groups)
  const actualCopies = [];
  for (let i = 0; i < group.children.length; i++) {
    const child = group.children[i];
    if (!(child.userData && child.userData.isIntersectionGroup)) {
      actualCopies.push(child);
    }
  }
  
  const copies = actualCopies.length;
  
  // Skip if not enough copies for intersections
  if (copies < 2) {
    return intersectionPoints;
  }
  
  // Generate base polygon vertices based on whether stars are enabled
  let vertices = [];
  
  if (state.useStars && state.starSkip > 1) {
    // Calculate GCD to determine if this creates a proper star
    const gcd = calculateGCD(state.segments, state.starSkip);
    
    // Only use star pattern when gcd=1 (ensures a single connected path)
    if (gcd === 1) {
      console.log(`Creating star polygon for intersections: n=${state.segments}, k=${state.starSkip}`);
      vertices = generateStarPolygonVertices(state.segments, state.starSkip, state.radius);
    } else {
      console.log(`Star pattern would create multiple disconnected shapes (gcd=${gcd}), using regular polygon for intersections`);
      // Fall back to regular polygon
      vertices = [];
      const step = (Math.PI * 2) / state.segments;
      for (let i = 0; i < state.segments; i++) {
        const ang = i * step;
        vertices.push(new THREE.Vector3(
          state.radius * Math.cos(ang),
          state.radius * Math.sin(ang),
          0
        ));
      }
    }
  } else {
    // Standard polygon vertices
    const step = (Math.PI * 2) / state.segments;
    for (let i = 0; i < state.segments; i++) {
      const ang = i * step;
      vertices.push(new THREE.Vector3(
        state.radius * Math.cos(ang),
        state.radius * Math.sin(ang),
        0
      ));
    }
  }
  
  // Calculate polygon copies with proper scaling and rotation
  const polygons = [];
  
  for (let i = 0; i < copies; i++) {
    // Skip intersection marker groups
    if (actualCopies[i].userData && actualCopies[i].userData.isIntersectionGroup) {
      continue;
    }
    
    // Calculate scale factor based on modulus and step scale
    let modulusScale = 1.0;
    let stepScaleFactor = Math.pow(state.stepScale, i);
    
    if (state.useModulus) {
      modulusScale = state.getScaleFactorForCopy(i);
    }
    
    // Apply both modulus scale and step scale if modulus is enabled
    // Otherwise just use step scale
    const finalScale = state.useModulus 
      ? modulusScale * stepScaleFactor  // IMPORTANT: Both modulus and step scale apply
      : stepScaleFactor;
    
    // Calculate rotation
    const rotationRad = (i * state.angle * Math.PI) / 180;
    const cos = Math.cos(rotationRad);
    const sin = Math.sin(rotationRad);
    
    // Create scaled and rotated vertices
    const polyVertices = [];
    
    for (const vertex of vertices) {
      // Scale vertex
      _vec1.copy(vertex).multiplyScalar(finalScale);
      
      // Rotate vertex
      _vec2.set(
        _vec1.x * cos - _vec1.y * sin,
        _vec1.x * sin + _vec1.y * cos,
        0
      );
      
      polyVertices.push(_vec2.clone()); // Must clone to avoid reference issues
    }
    
    polygons.push(polyVertices);
  }
  
  // Check all polygon pairs for intersections
  for (let i = 0; i < polygons.length; i++) {
    const polyA = polygons[i];
    
    for (let j = i + 1; j < polygons.length; j++) {
      const polyB = polygons[j];
      
      // Check each edge pair
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

/**
 * Process intersections and update state
 * @param {Object} state Application state
 * @param {THREE.BufferGeometry} baseGeo Base geometry
 * @param {THREE.Group} group Group containing polygon copies
 * @returns {THREE.BufferGeometry} Updated geometry
 */
export function processIntersections(state, baseGeo, group) {
  if (!state || !state.useIntersections || !state.needsIntersectionUpdate || !baseGeo || !group) {
    return baseGeo;
  }
  
  // Make sure group has access to state
  group.userData.state = state;
  
  // Find intersections
  const intersectionPoints = findAllIntersections(group);
  
  if (intersectionPoints.length === 0) {
    state.needsIntersectionUpdate = false;
    state.intersectionPoints = [];
    return baseGeo;
  }
  
  // Update state
  state.intersectionPoints = intersectionPoints;
  state.needsIntersectionUpdate = false;
  
  // Return the original geometry
  return baseGeo;
}

/**
 * Create visualization markers for intersection points
 * @param {THREE.Scene} scene The scene
 * @param {Array<THREE.Vector3>} intersectionPoints Array of intersection points
 * @param {THREE.Group} group Group to add markers to
 */
export function createIntersectionMarkers(scene, intersectionPoints, group) {
  if (!scene || !intersectionPoints || intersectionPoints.length === 0) {
    return;
  }
  
  // Clean up existing markers first
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
  
  // Initialize marker array
  if (!scene.userData.intersectionMarkers) {
    scene.userData.intersectionMarkers = [];
  }
  
  // Create shared resources
  const circleGeometry = new THREE.CircleGeometry(INTERSECTION_POINT_SIZE, 16);
  const intersectionMaterial = new THREE.MeshBasicMaterial({
    color: INTERSECTION_POINT_COLOR,
    transparent: true,
    opacity: INTERSECTION_POINT_OPACITY,
    depthTest: false
  });
  
  // Create marker group
  const markersGroup = new THREE.Group();
  markersGroup.userData.isIntersectionGroup = true;
  
  // Add to scene or group
  if (group) {
    group.add(markersGroup);
  } else {
    scene.add(markersGroup);
  }
  
  // Store reference
  scene.userData.intersectionMarkerGroup = markersGroup;
  
  // Create markers
  for (const point of intersectionPoints) {
    const marker = new THREE.Mesh(circleGeometry, intersectionMaterial.clone());
    marker.position.copy(point);
    markersGroup.add(marker);
    scene.userData.intersectionMarkers.push(marker);
  }
}