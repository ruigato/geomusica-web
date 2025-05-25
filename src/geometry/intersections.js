// src/geometry/intersections.js - Optimized version
import * as THREE from 'three';
import { 
  INTERSECTION_MERGE_THRESHOLD,
  MAX_VELOCITY
} from '../config/constants.js';

// Set to true to debug star cuts intersection issues
const DEBUG_STAR_CUTS = true;

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
  
  // Return the intersection point with a z-offset to ensure visibility
  const intersection = new THREE.Vector3(x, y, 0.5);
  return intersection;
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
  // Use a larger threshold for duplicate detection
  const effectiveThreshold = threshold * 2;
  
  // Special case for first point
  if (existingPoints.length === 0) {
    return false;
  }
  
  // Check distance to each existing point
  for (const existing of existingPoints) {
    if (!existing || !point) continue;
    
    // Calculate distance in 2D space (ignore z-component)
    const dx = existing.x - point.x;
    const dy = existing.y - point.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < effectiveThreshold) {
      return true;
    }
  }
  
  return false;
}

/**
 * Helper function to calculate Greatest Common Divisor
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
    return intersectionPoints;
  }
  
  // Check all pairs of non-adjacent line segments for intersections
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
      
      // Find intersection
      const intersection = findIntersection(
        segment1Start, 
        segment1End, 
        segment2Start, 
        segment2End
      );
      
      if (intersection && !isPointTooClose(intersection, intersectionPoints)) {
        intersectionPoints.push(intersection);
      }
    }
  }
  
  return intersectionPoints;
}

/**
 * Find all intersections for a given layer's geometry
 * @param {Object} layer Layer object containing geometry and copies
 * @returns {Array<THREE.Vector3>} Array of all intersection points
 */
export function findAllIntersections(layer) {
  if (!layer || !layer.group) {
    return [];
  }
  
  const allIntersections = [];
  
  // Get all line objects from the layer's group
  const lines = [];
  layer.group.traverse(object => {
    if (object.type === 'Line') {
      lines.push(object);
    }
  });
  
  // If we don't have enough lines, return empty array
  if (lines.length < 2) {
    return allIntersections;
  }
  
  // Check intersections between all pairs of lines
  for (let i = 0; i < lines.length; i++) {
    const line1 = lines[i];
    
    // Skip if no geometry or position attribute
    if (!line1.geometry || !line1.geometry.attributes.position) {
      continue;
    }
    
    const positions1 = line1.geometry.attributes.position.array;
    
    for (let j = i + 1; j < lines.length; j++) {
      const line2 = lines[j];
      
      // Skip if no geometry or position attribute
      if (!line2.geometry || !line2.geometry.attributes.position) {
        continue;
      }
      
      const positions2 = line2.geometry.attributes.position.array;
      
      // Check all segment pairs between the two lines
      for (let s1 = 0; s1 < positions1.length - 3; s1 += 3) {
        const p1 = new THREE.Vector3(positions1[s1], positions1[s1 + 1], positions1[s1 + 2]);
        const p2 = new THREE.Vector3(positions1[s1 + 3], positions1[s1 + 4], positions1[s1 + 5]);
        
        for (let s2 = 0; s2 < positions2.length - 3; s2 += 3) {
          const p3 = new THREE.Vector3(positions2[s2], positions2[s2 + 1], positions2[s2 + 2]);
          const p4 = new THREE.Vector3(positions2[s2 + 3], positions2[s2 + 4], positions2[s2 + 5]);
          
          const intersection = findIntersection(p1, p2, p3, p4);
          
          if (intersection && !isPointTooClose(intersection, allIntersections)) {
            allIntersections.push(intersection);
          }
        }
      }
    }
  }
  
  return allIntersections;
}

/**
 * Check self-intersections in a single polygon
 * @param {Object} line THREE.js Line object with geometry
 * @returns {Array<THREE.Vector3>} Array of self-intersection points
 */
function findSelfIntersections(line) {
  if (!line.geometry || !line.geometry.attributes.position) {
    return [];
  }
  
  const positions = line.geometry.attributes.position.array;
  const vertices = [];
  
  // Extract vertices from position array
  for (let i = 0; i < positions.length; i += 3) {
    vertices.push(new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]));
  }
  
  const selfIntersections = [];
  
  // Check all non-adjacent segments for intersections
  for (let i = 0; i < vertices.length; i++) {
    const p1 = vertices[i];
    const p2 = vertices[(i + 1) % vertices.length];
    
    for (let j = i + 2; j < vertices.length; j++) {
      if ((j + 1) % vertices.length === i) continue; // Skip if segments share an endpoint
      
      const p3 = vertices[j];
      const p4 = vertices[(j + 1) % vertices.length];
      
      const intersection = findIntersection(p1, p2, p3, p4);
      
      if (intersection && !isPointTooClose(intersection, selfIntersections)) {
        selfIntersections.push(intersection);
      }
    }
  }
  
  return selfIntersections;
}