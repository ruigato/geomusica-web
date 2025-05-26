/**
 * starCuts.js - Pure module for star polygon self-intersection calculations
 * 
 * This module provides utilities for computing intersections in star polygons.
 * It operates on pure geometry without dependencies on Three.js scene objects,
 * state management, or UI components.
 */

import * as THREE from 'three';

// Threshold for considering points as coincident (to avoid duplicate intersections)
const INTERSECTION_MERGE_THRESHOLD = 0.001;

// Debug flag to control detailed logging
const DEBUG_ENABLED = false;

/**
 * Check if a star polygon with n points and skip value k has self-intersections
 * @param {number} n - Number of points in the star polygon
 * @param {number} k - Skip value (step between connected vertices)
 * @returns {boolean} - True if the star polygon has self-intersections
 */
export function hasStarSelfIntersections(n, k) {
  // Basic validation
  if (!Number.isInteger(n) || !Number.isInteger(k) || n <= 0 || k <= 0) {
    console.warn("Invalid parameters for star polygon: n and k must be positive integers");
    return false;
  }
  
  // A star polygon {n/k} has self-intersections if n and k are coprime
  // and 1 < k < n/2
  
  // Calculate GCD
  const gcd = calculateGCD(n, k);
  
  // Coprime check (gcd = 1) and k range check
  return gcd === 1 && k > 1 && k < n/2;
}

/**
 * Calculate the Greatest Common Divisor (GCD) of two numbers
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} - GCD of a and b
 */
function calculateGCD(a, b) {
  a = Math.abs(a);
  b = Math.abs(b);
  
  while (b > 0) {
    const temp = b;
    b = a % b;
    a = temp;
  }
  
  return a;
}

/**
 * Calculate intersection between two line segments
 * @param {THREE.Vector2} p1 - First point of first line segment
 * @param {THREE.Vector2} p2 - Second point of first line segment
 * @param {THREE.Vector2} p3 - First point of second line segment
 * @param {THREE.Vector2} p4 - Second point of second line segment
 * @returns {THREE.Vector2|null} - Intersection point or null if no intersection
 */
function lineLineIntersection(p1, p2, p3, p4) {
  // Extract coordinates
  const x1 = p1.x, y1 = p1.y;
  const x2 = p2.x, y2 = p2.y;
  const x3 = p3.x, y3 = p3.y;
  const x4 = p4.x, y4 = p4.y;
  
  // Calculate denominator
  const denominator = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
  
  // If denominator is close to 0, lines are parallel or collinear
  if (Math.abs(denominator) < 1e-10) {
    if (DEBUG_ENABLED) {
      console.log("Lines are parallel or collinear");
    }
    return null;
  }
  
  // Calculate parameters
  const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denominator;
  const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denominator;
  
  // Check if intersection is within both line segments
  if (ua < 0 || ua > 1 || ub < 0 || ub > 1) {
    if (DEBUG_ENABLED) {
      console.log("Intersection outside segment bounds", { ua, ub });
    }
    return null;
  }
  
  // Calculate intersection point
  const x = x1 + ua * (x2 - x1);
  const y = y1 + ua * (y2 - y1);
  
  return new THREE.Vector2(x, y);
}

/**
 * Calculate distance between two points
 * @param {THREE.Vector2} p1 - First point
 * @param {THREE.Vector2} p2 - Second point
 * @returns {number} - Distance between points
 */
function distanceBetweenPoints(p1, p2) {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

/**
 * Check if a point is too close to any existing points
 * @param {THREE.Vector2} point - The point to check
 * @param {Array<THREE.Vector2>} existingPoints - Array of existing points
 * @param {number} threshold - Distance threshold
 * @returns {boolean} - True if point is too close to any existing point
 */
function isPointTooClose(point, existingPoints, threshold = INTERSECTION_MERGE_THRESHOLD) {
  for (const existing of existingPoints) {
    if (distanceBetweenPoints(point, existing) < threshold) {
      if (DEBUG_ENABLED) {
        console.log("Point too close to existing point", {
          point: [point.x, point.y],
          existing: [existing.x, existing.y],
          distance: distanceBetweenPoints(point, existing)
        });
      }
      return true;
    }
  }
  return false;
}

/**
 * Check if a point is too close to any of the vertices or edges
 * @param {THREE.Vector2} point - The point to check
 * @param {Array<THREE.Vector2>} vertices - Array of polygon vertices
 * @param {number} threshold - Distance threshold
 * @returns {boolean} - True if point is too close to any vertex or edge
 */
function isPointTooCloseToVerticesOrEdges(point, vertices, threshold = INTERSECTION_MERGE_THRESHOLD) {
  // Check vertices first
  for (const vertex of vertices) {
    if (distanceBetweenPoints(point, vertex) < threshold) {
      if (DEBUG_ENABLED) {
        console.log("Point too close to vertex", {
          point: [point.x, point.y],
          vertex: [vertex.x, vertex.y],
          distance: distanceBetweenPoints(point, vertex)
        });
      }
      return true;
    }
  }
  
  // Check edges (distance to line segments)
  for (let i = 0; i < vertices.length; i++) {
    const p1 = vertices[i];
    const p2 = vertices[(i + 1) % vertices.length];
    
    // Distance from point to line segment
    const distance = distanceToLineSegment(point, p1, p2);
    
    if (distance < threshold) {
      if (DEBUG_ENABLED) {
        console.log("Point too close to edge", {
          point: [point.x, point.y],
          edge: [[p1.x, p1.y], [p2.x, p2.y]],
          distance
        });
      }
      return true;
    }
  }
  
  return false;
}

/**
 * Calculate distance from point to line segment
 * @param {THREE.Vector2} p - The point
 * @param {THREE.Vector2} v - First endpoint of line segment
 * @param {THREE.Vector2} w - Second endpoint of line segment
 * @returns {number} - Distance from point to line segment
 */
function distanceToLineSegment(p, v, w) {
  // Return minimum distance between line segment vw and point p
  const l2 = distanceBetweenPoints(v, w) ** 2;  // length squared of segment
  
  // If segment is a point, return distance to the point
  if (l2 === 0) return distanceBetweenPoints(p, v);
  
  // Consider the line extending the segment, parameterized as v + t (w - v)
  // We find projection of point p onto the line.
  // It falls where t = [(p-v) . (w-v)] / |w-v|^2
  // We clamp t from [0,1] to handle points outside the segment
  const t = Math.max(0, Math.min(1, 
    ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2
  ));
  
  // Projection falls on the segment
  const projection = new THREE.Vector2(
    v.x + t * (w.x - v.x),
    v.y + t * (w.y - v.y)
  );
  
  return distanceBetweenPoints(p, projection);
}

/**
 * Calculate intersections for a star polygon given its vertices and skip value
 * @param {Array<THREE.Vector2>} vertices - Array of polygon vertices
 * @param {number} starSkip - Skip value for the star polygon
 * @returns {Array<THREE.Vector2>} - Array of intersection points
 */
export function calculateStarCutsVertices(vertices, starSkip) {
  const intersectionPoints = [];
  
  // Input validation
  if (!Array.isArray(vertices) || vertices.length < 4) {
    console.warn("Invalid vertices array: need at least 4 points for intersections");
    return intersectionPoints;
  }
  
  if (DEBUG_ENABLED) {
    console.log("Calculating star cuts for vertices:", vertices.length, "with skip:", starSkip);
    vertices.forEach((v, i) => {
      console.log(`Vertex ${i}: (${v.x.toFixed(4)}, ${v.y.toFixed(4)})`);
    });
  }
  
  // Check all pairs of non-adjacent line segments for intersections
  const vertexCount = vertices.length;
  let intersectionCount = 0;
  
  for (let i = 0; i < vertexCount; i++) {
    for (let j = i + 2; j < vertexCount; j++) {
      // Skip adjacent segments (including wraparound)
      if (i === j || 
          (i + 1) % vertexCount === j || 
          (j + 1) % vertexCount === i) {
        continue;
      }
      
      // Skip segments that would be connected in a star polygon
      // Specifically for a {n/k} star, vertices that are k steps apart are connected
      if (starSkip > 1) {
        const diff1 = (j - i + vertexCount) % vertexCount;
        const diff2 = (i - j + vertexCount) % vertexCount;
        if (diff1 === starSkip || diff2 === starSkip ||
            (i + starSkip) % vertexCount === j || (j + starSkip) % vertexCount === i) {
          continue;
        }
      }
      
      // Define the two line segments
      const segment1Start = vertices[i];
      const segment1End = vertices[(i + 1) % vertexCount];
      const segment2Start = vertices[j];
      const segment2End = vertices[(j + 1) % vertexCount];
      
      // Skip degenerate segments
      if (distanceBetweenPoints(segment1Start, segment1End) < INTERSECTION_MERGE_THRESHOLD ||
          distanceBetweenPoints(segment2Start, segment2End) < INTERSECTION_MERGE_THRESHOLD) {
        continue;
      }
      
      if (DEBUG_ENABLED) {
        console.log(`Checking segments ${i}->${(i+1)%vertexCount} and ${j}->${(j+1)%vertexCount}`);
      }
      
      // Find intersection
      const intersection = lineLineIntersection(
        segment1Start, 
        segment1End, 
        segment2Start, 
        segment2End
      );
      
      if (intersection) {
        intersectionCount++;
        
        if (DEBUG_ENABLED) {
          console.log(`Found intersection ${intersectionCount}:`, {
            point: [intersection.x.toFixed(4), intersection.y.toFixed(4)],
            segment1: [`(${segment1Start.x.toFixed(2)},${segment1Start.y.toFixed(2)})`, 
                      `(${segment1End.x.toFixed(2)},${segment1End.y.toFixed(2)})`],
            segment2: [`(${segment2Start.x.toFixed(2)},${segment2Start.y.toFixed(2)})`, 
                      `(${segment2End.x.toFixed(2)},${segment2End.y.toFixed(2)})`]
          });
        }
        
        // Only add if not too close to any existing intersection point
        if (!isPointTooClose(intersection, intersectionPoints)) {
          // Only add if not too close to any existing vertex or edge
          if (!isPointTooCloseToVerticesOrEdges(intersection, vertices)) {
            intersectionPoints.push(intersection);
            if (DEBUG_ENABLED) {
              console.log(`Added intersection point: (${intersection.x.toFixed(4)}, ${intersection.y.toFixed(4)})`);
            }
          }
        }
      }
    }
  }
  
  if (DEBUG_ENABLED) {
    console.log(`Total intersections found: ${intersectionCount}`);
    console.log(`Valid intersections after filtering: ${intersectionPoints.length}`);
  }
  
  return intersectionPoints;
}

/**
 * Debug function to visualize and log star cuts calculation
 * @param {Array<THREE.Vector2>} vertices - Array of polygon vertices
 * @param {number} k - Skip value for the star polygon
 * @returns {Object} - Debug information including vertices and intersections
 */
export function debugStarCuts(vertices, k) {
  console.log(`==== STAR CUTS DEBUG - ${vertices.length} vertices with skip ${k} ====`);
  
  // Log all vertices
  console.log("Input vertices:");
  vertices.forEach((v, i) => {
    console.log(`Vertex ${i}: (${v.x.toFixed(4)}, ${v.y.toFixed(4)})`);
  });
  
  // Store the old debug flag
  const oldDebug = DEBUG_ENABLED;
  
  // Force debug on for this calculation
  window.DEBUG_ENABLED = true;
  
  // Calculate intersections
  const intersections = calculateStarCutsVertices(vertices, k);
  
  // Log all intersections
  console.log("\nCalculated intersections:");
  intersections.forEach((p, i) => {
    console.log(`Intersection ${i}: (${p.x.toFixed(4)}, ${p.y.toFixed(4)})`);
  });
  
  // Run validation
  const validationResult = validateIntersections(intersections, vertices);
  console.log("\nValidation result:", validationResult);
  
  // Restore original debug flag
  window.DEBUG_ENABLED = oldDebug;
  
  console.log("==== END STAR CUTS DEBUG ====");
  
  return {
    vertices,
    intersections,
    validation: validationResult
  };
}

/**
 * Validate that the calculated intersections are correct
 * @param {Array<THREE.Vector2>} intersectionPoints - Array of intersection points
 * @param {Array<THREE.Vector2>} vertices - Array of polygon vertices
 * @returns {Object} - Validation results with metrics
 */
export function validateIntersections(intersectionPoints, vertices) {
  const results = {
    totalIntersections: intersectionPoints.length,
    areValid: true,
    tooCloseToVertex: 0,
    tooCloseToEdge: 0,
    tooCloseToOther: 0,
    issues: []
  };
  
  // Check that no intersection is too close to a vertex
  for (let i = 0; i < intersectionPoints.length; i++) {
    const intersection = intersectionPoints[i];
    
    // Check distance to vertices
    for (let j = 0; j < vertices.length; j++) {
      const vertex = vertices[j];
      const distance = distanceBetweenPoints(intersection, vertex);
      
      if (distance < INTERSECTION_MERGE_THRESHOLD) {
        results.areValid = false;
        results.tooCloseToVertex++;
        results.issues.push({
          type: 'too_close_to_vertex',
          intersection: i,
          vertex: j,
          distance
        });
      }
    }
    
    // Check distance to edges
    for (let j = 0; j < vertices.length; j++) {
      const v1 = vertices[j];
      const v2 = vertices[(j + 1) % vertices.length];
      const distance = distanceToLineSegment(intersection, v1, v2);
      
      // Skip if it's actually an intersection on this edge
      // We expect intersections to be on edges
      const onEdge = (distance < 1e-10);
      if (!onEdge && distance < INTERSECTION_MERGE_THRESHOLD) {
        results.areValid = false;
        results.tooCloseToEdge++;
        results.issues.push({
          type: 'too_close_to_edge',
          intersection: i,
          edge: [j, (j + 1) % vertices.length],
          distance
        });
      }
    }
    
    // Check distance to other intersections
    for (let j = i + 1; j < intersectionPoints.length; j++) {
      const otherIntersection = intersectionPoints[j];
      const distance = distanceBetweenPoints(intersection, otherIntersection);
      
      if (distance < INTERSECTION_MERGE_THRESHOLD) {
        results.areValid = false;
        results.tooCloseToOther++;
        results.issues.push({
          type: 'too_close_to_other',
          intersection1: i,
          intersection2: j,
          distance
        });
      }
    }
  }
  
  return results;
}

// Unit test cases (in comments)
/*
UNIT TEST 1: Regular pentagon with skip=2 (star pentagon)
const vertices = [
  new THREE.Vector2(0, 1),
  new THREE.Vector2(0.951, 0.309),
  new THREE.Vector2(0.588, -0.809),
  new THREE.Vector2(-0.588, -0.809),
  new THREE.Vector2(-0.951, 0.309)
];
const intersections = calculateStarCutsVertices(vertices, 2);
// Expected: 5 intersection points (one for each inside crossing)

UNIT TEST 2: Regular heptagon (7 sides) with skip=2
const vertices = [];
for (let i = 0; i < 7; i++) {
  const angle = (i / 7) * Math.PI * 2;
  vertices.push(new THREE.Vector2(Math.cos(angle), Math.sin(angle)));
}
const intersections = calculateStarCutsVertices(vertices, 2);
// Expected: 7 intersection points

UNIT TEST 3: Regular heptagon (7 sides) with skip=3
const vertices = [];
for (let i = 0; i < 7; i++) {
  const angle = (i / 7) * Math.PI * 2;
  vertices.push(new THREE.Vector2(Math.cos(angle), Math.sin(angle)));
}
const intersections = calculateStarCutsVertices(vertices, 3);
// Expected: 7 intersection points (different positions than test 2)

UNIT TEST 4: Square (should have no intersections)
const vertices = [
  new THREE.Vector2(-1, 1),
  new THREE.Vector2(1, 1),
  new THREE.Vector2(1, -1),
  new THREE.Vector2(-1, -1)
];
const intersections = calculateStarCutsVertices(vertices, 1);
// Expected: 0 intersection points
*/ 