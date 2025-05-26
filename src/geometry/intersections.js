/**
 * DEPRECATED: intersections.js - This module is deprecated and will be removed in a future version
 * 
 * All intersection functionality has been moved to:
 * - Star cuts: src/geometry/starCuts.js (for star polygon self-intersections)
 * - Future: A new intersection system will be implemented
 * 
 * This file is kept for reference only and all functions return empty/default values.
 * 
 * @deprecated Use starCuts.js for star polygon intersections
 */

import * as THREE from 'three';
import { 
  ANIMATION_STATES,
  INTERSECTION_MERGE_THRESHOLD, 
  INTERSECTION_POINT_COLOR, 
  INTERSECTION_POINT_OPACITY, 
  INTERSECTION_POINT_SIZE,
  MARK_LIFE,
  MAX_VELOCITY
} from '../config/constants.js';

// DEPRECATED: Star cuts logic moved to geometry pipeline
// Set to true to debug star cuts intersection issues
const DEBUG_STAR_CUTS = false; // Changed to false to disable all debug output

// Reusable Vector3 objects to reduce garbage collection
const _vec1 = new THREE.Vector3();
const _vec2 = new THREE.Vector3();

// DEPRECATED: All constants moved to starCuts.js or will be part of new intersection system
const DEPRECATED_WARNING = 'intersections.js is deprecated. Use starCuts.js for star polygon intersections.';

/**
 * @deprecated This function is deprecated and returns null
 */
export function findIntersection(p1, p2, p3, p4) {
  console.warn(DEPRECATED_WARNING);
  return null;
}

/**
 * Calculate distance between two points
 * @param {THREE.Vector3} p1 First point
 * @param {THREE.Vector3} p2 Second point
 * @returns {number} Distance between points
 */
function distanceBetweenPoints(p1, p2) {
  // Safety check for null/undefined values
  if (!p1 || !p2 || 
      typeof p1.x !== 'number' || 
      typeof p1.y !== 'number' || 
      typeof p2.x !== 'number' || 
      typeof p2.y !== 'number') {
    return Infinity; // Return large distance to avoid considering these points
  }
  
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
  if (DEBUG_STAR_CUTS) {
    
  }
  
  const vertices = [];
  
  // First generate all vertices on the circle
  const baseVertices = [];
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    baseVertices.push(new THREE.Vector3(x, y, 0));
  }
  
  // Now connect them according to the star pattern
  let currentIndex = 0;
  const visited = new Set();
  
  // Continue until we've visited all vertices or completed a cycle
  while (!visited.has(currentIndex)) {
    visited.add(currentIndex);
    vertices.push(baseVertices[currentIndex]);
    
    // Calculate next vertex based on skip pattern
    currentIndex = (currentIndex + k) % n;
  }
  
  if (DEBUG_STAR_CUTS) {
    
  }
  
  return vertices;
}

/**
 * Find self-intersections in a star polygon
 * @param {Array<THREE.Vector3>} vertices Array of vertices forming a star polygon
 * @param {number} scale Scale factor to apply to intersection points
 * @returns {Array<THREE.Vector3>} Array of intersection points
 */
function findStarSelfIntersections(vertices, scale = 1.0) {
  const intersectionPoints = [];
  
  // Skip if not enough vertices for intersections
  if (vertices.length < 4) {
    if (DEBUG_STAR_CUTS) {
      
    }
    return intersectionPoints;
  }
  
  // Always enable debug for star cuts to diagnose the issue
  const debug = DEBUG_STAR_CUTS;
  if (debug) {
    
    // Output the vertices for debugging
    vertices.forEach((v, i) => {
      
    });
  }
  
  // Check all pairs of non-adjacent line segments for intersections
  let intersectionCount = 0;
  
  // Important: We need to check ALL possible pairs of line segments
  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 2; j < vertices.length; j++) {
      // Skip adjacent segments (including wraparound)
      if (i === j || 
          (i + 1) % vertices.length === j || 
          (j + 1) % vertices.length === i) {
        continue;
      }
      
      // Define the two line segments
      const segment1Start = vertices[i];
      const segment1End = vertices[(i + 1) % vertices.length];
      const segment2Start = vertices[j];
      const segment2End = vertices[(j + 1) % vertices.length];
      
      // Skip degenerate segments
      if (distanceBetweenPoints(segment1Start, segment1End) < INTERSECTION_MERGE_THRESHOLD ||
          distanceBetweenPoints(segment2Start, segment2End) < INTERSECTION_MERGE_THRESHOLD) {
        continue;
      }
      
      if (debug) {
        
      }
      
      // Find intersection
      const intersection = findIntersection(
        segment1Start, 
        segment1End, 
        segment2Start, 
        segment2End
      );
      
      if (intersection) {
        intersectionCount++;
        
        if (debug) {
          
        }
        
        // Scale intersection if needed
        if (scale !== 1.0) {
          intersection.multiplyScalar(scale);
        }
        
        // Only add if not too close to any existing intersection point
        if (!isPointTooClose(intersection, intersectionPoints)) {
          // Only add if not too close to any existing vertex
          let tooCloseToVertex = false;
          for (const v of vertices) {
            if (distanceBetweenPoints(intersection, v) < INTERSECTION_MERGE_THRESHOLD) {
              tooCloseToVertex = true;
              break;
            }
          }
          
          if (!tooCloseToVertex) {
            intersectionPoints.push(intersection);
            if (debug) {
              
            }
          } else if (debug) {
            
          }
        } else if (debug) {
          
        }
      }
    }
  }
  
  if (debug) {
    
    // Output the intersection points for debugging
    intersectionPoints.forEach((p, i) => {
      
    });
  }
  
  return intersectionPoints;
}

/**
 * @deprecated This function is deprecated and returns empty array
 */
export function findAllIntersections(group) {
  console.warn(DEPRECATED_WARNING);
  return [];
}

/**
 * @deprecated This function is deprecated and returns the original geometry unchanged
 */
export function processIntersections(state, baseGeo, group) {
  console.warn(DEPRECATED_WARNING);
  return baseGeo;
}

/**
 * @deprecated This function is deprecated and does nothing
 */
export function createIntersectionMarkers(scene, intersectionPoints, group) {
  console.warn(DEPRECATED_WARNING);
  // Do nothing
}

/**
 * @deprecated This function is deprecated and returns empty array
 */
export function detectIntersections(layer) {
  console.warn(DEPRECATED_WARNING);
  return [];
}

/**
 * @deprecated This function is deprecated and does nothing
 */
export function applyVelocityToMarkers(layer, deltaTime) {
  console.warn(DEPRECATED_WARNING);
  // Do nothing
}