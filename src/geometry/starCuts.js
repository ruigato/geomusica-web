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
  // Input validation
  if (!Number.isInteger(n) || !Number.isInteger(k) || n < 3 || k < 1) {
    console.warn("Invalid parameters for star polygon check:", n, k);
    return false;
  }
  
  // Normalize k to be less than n/2
  k = k % n;
  if (k > n/2) k = n - k;
  if (k === 0) k = n;
  
  // Find greatest common divisor
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  const d = gcd(n, k);
  
  // Mathematical criteria for self-intersections:
  // 1. If n and k are coprime (gcd=1) and k < n/2, the star will have intersections
  if (d === 1 && k > 1 && k < n/2) {
    return true;
  }
  
  // 2. If gcd(n,k) > 1, we have multiple disconnected paths
  // Each path will have intersections if the reduced star has intersections
  if (d > 1) {
    // Check if the reduced star (n/d, k/d) has intersections
    return hasStarSelfIntersections(n/d, k/d);
  }
  
  return false;
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
 * Find intersection point between two line segments or lines
 * @param {THREE.Vector2} p1 - First endpoint of first line segment
 * @param {THREE.Vector2} p2 - Second endpoint of first line segment
 * @param {THREE.Vector2} p3 - First endpoint of second line segment
 * @param {THREE.Vector2} p4 - Second endpoint of second line segment
 * @param {boolean} extendLines - If true, treat as infinite lines rather than segments
 * @returns {THREE.Vector2|null} - Intersection point or null if no intersection
 */
function lineLineIntersection(p1, p2, p3, p4, extendLines = false) {
  // Line segment 1 is p1 to p2, line segment 2 is p3 to p4
  const debugEnabled = DEBUG_ENABLED;
  
  // Extract coordinates
  const x1 = p1.x, y1 = p1.y;
  const x2 = p2.x, y2 = p2.y;
  const x3 = p3.x, y3 = p3.y;
  const x4 = p4.x, y4 = p4.y;
  
  if (debugEnabled) {
    console.log(`[LINE INTERSECTION] Checking segments (${x1.toFixed(2)},${y1.toFixed(2)})-(${x2.toFixed(2)},${y2.toFixed(2)}) and (${x3.toFixed(2)},${y3.toFixed(2)})-(${x4.toFixed(2)},${y4.toFixed(2)})`);
  }
  
  // Calculate denominators
  const denom = ((y4 - y3) * (x2 - x1)) - ((x4 - x3) * (y2 - y1));
  
  // If denominator is zero, lines are parallel or collinear
  if (Math.abs(denom) < 1e-10) {
    if (debugEnabled) {
      console.log(`[LINE INTERSECTION] Lines are parallel or collinear (denom = ${denom.toFixed(10)})`);
    }
    return null;
  }
  
  // Calculate intersection parameters
  const ua = (((x4 - x3) * (y1 - y3)) - ((y4 - y3) * (x1 - x3))) / denom;
  const ub = (((x2 - x1) * (y1 - y3)) - ((y2 - y1) * (x1 - x3))) / denom;
  
  if (debugEnabled) {
    console.log(`[LINE INTERSECTION] Parameters: ua=${ua.toFixed(5)}, ub=${ub.toFixed(5)}`);
  }
  
  // For star cuts, we want to allow intersections outside the segment bounds
  if (!extendLines) {
    // Check if intersection is within both line segments
    // Use a small epsilon for numerical stability
    const epsilon = 1e-5;
    if (ua < -epsilon || ua > 1+epsilon || ub < -epsilon || ub > 1+epsilon) {
      if (debugEnabled) {
        console.log(`[LINE INTERSECTION] Intersection outside segment bounds: ua=${ua.toFixed(5)}, ub=${ub.toFixed(5)}`);
      }
      return null;
    }
  }
  
  // Calculate intersection point
  const x = x1 + ua * (x2 - x1);
  const y = y1 + ua * (y2 - y1);
  
  if (debugEnabled) {
    console.log(`[LINE INTERSECTION] Found intersection at (${x.toFixed(4)},${y.toFixed(4)})`);
  }
  
  // Create a new Vector2 for the intersection point
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
  
  // Force debug on for this critical function
  const debugEnabled = DEBUG_ENABLED;
  
  if (debugEnabled) {
    console.log(`[STAR CUTS DEBUG] Calculating star cuts for ${vertices.length} vertices with skip ${starSkip}`);
    vertices.forEach((v, i) => {
      console.log(`[STAR CUTS DEBUG] Vertex ${i}: (${v.x.toFixed(4)}, ${v.y.toFixed(4)})`);
    });
  }
  
  // For star polygons, we need a different approach to find intersections
  const vertexCount = vertices.length;
  let intersectionCount = 0;
  
  // A star polygon {n/k} connects vertices that are k apart in a continuous path
  // For a pentagon with skip=2, we connect 0->2->4->1->3->0
  
  // For stars, we need to check if the lines (not segments) connecting non-consecutive vertices intersect
  
  // First create all the possible lines in the star
  const starLines = [];
  for (let i = 0; i < vertexCount; i++) {
    const nextIdx = (i + starSkip) % vertexCount;
    starLines.push([i, nextIdx]);
  }
  
  if (debugEnabled) {
    console.log("[STAR CUTS DEBUG] Star lines:", starLines.map(line => `${line[0]}->${line[1]}`).join(', '));
  }
  
  // Now check for intersections between all pairs of non-adjacent lines
  for (let i = 0; i < starLines.length; i++) {
    for (let j = i + 1; j < starLines.length; j++) {
      const line1 = starLines[i];
      const line2 = starLines[j];
      
      // Skip if the lines share a vertex
      if (line1[0] === line2[0] || line1[0] === line2[1] || 
          line1[1] === line2[0] || line1[1] === line2[1]) {
        if (debugEnabled) {
          console.log(`[STAR CUTS DEBUG] Skipping lines ${line1[0]}->${line1[1]} and ${line2[0]}->${line2[1]} (shared vertex)`);
        }
        continue;
      }
      
      const p1 = vertices[line1[0]];
      const p2 = vertices[line1[1]];
      const p3 = vertices[line2[0]];
      const p4 = vertices[line2[1]];
      
      if (debugEnabled) {
        console.log(`[STAR CUTS DEBUG] Checking lines ${line1[0]}->${line1[1]} and ${line2[0]}->${line2[1]}`);
      }
      
      // Find intersection between the line segments
      // Only detect intersections that occur within the actual line segments
      const intersection = lineLineIntersection(p1, p2, p3, p4, false);
      
      if (intersection) {
        // For star cuts, we need to verify that the intersection falls within the polygon's convex hull
        // This avoids detecting "phantom" intersections that occur when lines are extended infinitely
        
        // Check if this is a real intersection within the bounds of the star
        const withinBounds = isPointInsidePolygonConvexHull(intersection, vertices, starSkip);
        
        if (withinBounds) {
          intersectionCount++;
          
          if (debugEnabled) {
            console.log(`[STAR CUTS DEBUG] Found valid intersection at (${intersection.x.toFixed(4)}, ${intersection.y.toFixed(4)})`);
          }
          
          // Only add if not too close to any existing intersection point
          if (!isPointTooClose(intersection, intersectionPoints)) {
            // For star polygons, we add all valid intersections without additional filtering
            intersectionPoints.push(intersection);
            if (debugEnabled) {
              console.log(`[STAR CUTS DEBUG] Added intersection point: (${intersection.x.toFixed(4)}, ${intersection.y.toFixed(4)})`);
            }
          } else {
            if (debugEnabled) {
              console.log(`[STAR CUTS DEBUG] Skipping duplicate intersection: (${intersection.x.toFixed(4)}, ${intersection.y.toFixed(4)})`);
            }
          }
        } else {
          if (debugEnabled) {
            console.log(`[STAR CUTS DEBUG] Intersection at (${intersection.x.toFixed(4)}, ${intersection.y.toFixed(4)}) is outside the polygon's convex hull`);
          }
        }
      } else {
        if (debugEnabled) {
          console.log(`[STAR CUTS DEBUG] No intersection between lines ${line1[0]}->${line1[1]} and ${line2[0]}->${line2[1]}`);
        }
      }
    }
  }
  
  if (debugEnabled) {
    console.log(`[STAR CUTS DEBUG] Total intersections found: ${intersectionCount}`);
    console.log(`[STAR CUTS DEBUG] Valid intersections after filtering: ${intersectionPoints.length}`);
    if (intersectionPoints.length > 0) {
      console.log("[STAR CUTS DEBUG] Final intersection points:");
      intersectionPoints.forEach((p, i) => {
        console.log(`[STAR CUTS DEBUG] Point ${i}: (${p.x.toFixed(4)}, ${p.y.toFixed(4)})`);
      });
    }
  }
  
  return intersectionPoints;
}

/**
 * Check if a point is on a line segment
 * @param {THREE.Vector2} point - Point to check
 * @param {THREE.Vector2} lineStart - Start of line segment
 * @param {THREE.Vector2} lineEnd - End of line segment
 * @returns {boolean} - True if point is on the line segment
 */
function isPointOnLineSegment(point, lineStart, lineEnd) {
  const epsilon = 1e-5; // Small epsilon for floating-point comparison
  
  // Check if point is between the endpoints
  const dxL = lineEnd.x - lineStart.x;
  const dyL = lineEnd.y - lineStart.y;
  const dxP = point.x - lineStart.x;
  const dyP = point.y - lineStart.y;
  
  // If line is a point, check if the test point is close to that point
  if (Math.abs(dxL) < epsilon && Math.abs(dyL) < epsilon) {
    return Math.abs(dxP) < epsilon && Math.abs(dyP) < epsilon;
  }
  
  // Calculate the t parameter (0 <= t <= 1 means the point is on the segment)
  let t;
  if (Math.abs(dxL) > Math.abs(dyL)) {
    // Line is more horizontal, use x for t
    t = dxP / dxL;
  } else {
    // Line is more vertical, use y for t
    t = dyP / dyL;
  }
  
  // Check if t is in range [0,1] with a small epsilon for numerical stability
  if (t < -epsilon || t > 1 + epsilon) {
    return false;
  }
  
  // Check if the point is close to the line using the cross product method
  const crossProduct = Math.abs(dxP * dyL - dyP * dxL);
  const lineLength = Math.sqrt(dxL * dxL + dyL * dyL);
  const distance = crossProduct / lineLength;
  
  return distance < epsilon;
}

/**
 * Create a function to generate star polygon points
 * This is for testing purposes and debugging star cuts
 * @param {number} radius - Radius of the star polygon
 * @param {number} n - Number of points
 * @param {number} k - Skip value
 * @returns {Array<THREE.Vector2>} - Array of star polygon vertices
 */
export function createStarPolygonPoints(radius, n, k) {
  const points = [];
  const angleStep = (2 * Math.PI) / n;
  
  // Use half radius to match regular polygon scaling
  const adjustedRadius = radius / 2;
  
  // Create vertices at regular intervals around a circle
  for (let i = 0; i < n; i++) {
    const angle = i * angleStep;
    const x = adjustedRadius * Math.cos(angle);
    const y = adjustedRadius * Math.sin(angle);
    points.push(new THREE.Vector2(x, y));
  }
  
  // If we wanted to create a path that follows the star pattern,
  // we would connect points in this order:
  // e.g., for n=5, k=2: [0, 2, 4, 1, 3, 0]
  // But we're just returning the vertices here, the connection
  // logic is handled in calculateStarCutsVertices
  
  return points;
}

/**
 * Create a regular star polygon {n/k} with vertices in proper star order
 * @param {number} radius - Radius of the star polygon
 * @param {number} n - Number of vertices
 * @param {number} k - Skip value between connected vertices
 * @returns {Array<THREE.Vector2>} - Vertices in star polygon order
 */
export function createRegularStarPolygonPoints(radius, n, k) {
  // For a proper star polygon, we just need to create the points 
  // arranged in a circle - we won't change their order.
  // The actual star pattern is created by how we connect them,
  // which is handled in the rendering code.
  
  const points = [];
  const angleStep = (2 * Math.PI) / n;
  
  // Use half radius to match regular polygon scaling
  const adjustedRadius = radius / 2;
  
  // Create vertices at regular intervals around a circle
  for (let i = 0; i < n; i++) {
    const angle = i * angleStep;
    const x = adjustedRadius * Math.cos(angle);
    const y = adjustedRadius * Math.sin(angle);
    points.push(new THREE.Vector2(x, y));
  }
  
  if (DEBUG_ENABLED) {
    console.log(`Created regular star polygon with ${n} vertices and skip ${k}`);
  }
  
  return points;
}

/**
 * Check if a point is inside the convex hull of a polygon
 * @param {THREE.Vector2} point - Point to check
 * @param {Array<THREE.Vector2>} vertices - Polygon vertices
 * @param {number} skip - Skip value for star polygons
 * @returns {boolean} - True if point is inside the convex hull
 */
function isPointInsidePolygonConvexHull(point, vertices, skip = 1) {
  // If we have fewer than 3 vertices, we can't form a polygon
  if (vertices.length < 3) {
    return false;
  }
  
  // For star polygons with a skip > 1 that should have intersections,
  // we need to be more permissive because their intersections often
  // occur outside the convex hull of the original vertices
  if (skip > 1) {
    const n = vertices.length;
    const hasIntersections = hasStarSelfIntersections(n, skip);
    
    if (hasIntersections) {
      // Create an expanded convex hull that's scaled from the centroid
      // to better capture the potential intersection points
      const centroid = calculateCentroid(vertices);
      const expandedVertices = vertices.map(v => {
        // Scale the vertex outward from the centroid by a factor of 5
        // This creates a much larger area to check for intersections
        const dx = v.x - centroid.x;
        const dy = v.y - centroid.y;
        return new THREE.Vector2(
          centroid.x + dx * 5,
          centroid.y + dy * 5
        );
      });
      
      // Compute the convex hull of the expanded vertices
      const expandedHull = computeConvexHull(expandedVertices);
      
      // Check if the point is inside this expanded hull
      const isInside = isPointInPolygon(point, expandedHull);
      
      if (DEBUG_ENABLED) {
        console.log(`Using expanded hull for star {${n}/${skip}}, point (${point.x.toFixed(4)}, ${point.y.toFixed(4)}) is ${isInside ? 'INSIDE' : 'OUTSIDE'}`);
      }
      
      return isInside;
    }
  }
  
  // First, calculate the convex hull of the polygon vertices
  const convexHull = computeConvexHull(vertices);
  
  // If the convex hull has fewer than 3 points, it's not a proper polygon
  if (convexHull.length < 3) {
    return false;
  }
  
  // Now check if the point is inside this convex hull
  return isPointInPolygon(point, convexHull);
}

/**
 * Compute the convex hull of a set of points using the Graham scan algorithm
 * @param {Array<THREE.Vector2>} points - Array of points
 * @returns {Array<THREE.Vector2>} - Convex hull points in counterclockwise order
 */
function computeConvexHull(points) {
  // Clone the points to avoid modifying the original array
  const pts = [...points];
  
  // If we have fewer than 3 points, return the points as is
  if (pts.length < 3) {
    return pts;
  }
  
  // Find the lowest point (and leftmost if tied)
  let lowestIdx = 0;
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].y < pts[lowestIdx].y || 
        (pts[i].y === pts[lowestIdx].y && pts[i].x < pts[lowestIdx].x)) {
      lowestIdx = i;
    }
  }
  
  // Swap the lowest point to the first position
  [pts[0], pts[lowestIdx]] = [pts[lowestIdx], pts[0]];
  
  // Sort the remaining points by polar angle with respect to the lowest point
  const p0 = pts[0];
  pts.sort((a, b) => {
    // Skip the first point (our reference point)
    if (a === p0) return -1;
    if (b === p0) return 1;
    
    // Calculate the orientation
    const orient = orientation(p0, a, b);
    if (orient === 0) {
      // If collinear, take the closer one first
      return distanceBetweenPoints(p0, a) - distanceBetweenPoints(p0, b);
    }
    
    // Counter-clockwise is positive, clockwise is negative
    return -orient; // Negated because we want counterclockwise order
  });
  
  // Build the convex hull
  const hull = [pts[0], pts[1]];
  
  for (let i = 2; i < pts.length; i++) {
    let top = hull.length - 1;
    
    // Pop points from the hull while they make a non-left turn
    while (hull.length > 1 && orientation(hull[top - 1], hull[top], pts[i]) <= 0) {
      hull.pop();
      top--;
    }
    
    hull.push(pts[i]);
  }
  
  return hull;
}

/**
 * Determine the orientation of three points
 * @param {THREE.Vector2} p - First point
 * @param {THREE.Vector2} q - Second point
 * @param {THREE.Vector2} r - Third point
 * @returns {number} - 0 if collinear, positive if counterclockwise, negative if clockwise
 */
function orientation(p, q, r) {
  const val = (q.y - p.y) * (r.x - q.x) - (q.x - p.x) * (r.y - q.y);
  
  if (Math.abs(val) < 1e-10) return 0; // Collinear
  return val;
}

/**
 * Check if a point is inside a polygon using the ray casting algorithm
 * @param {THREE.Vector2} point - Point to check
 * @param {Array<THREE.Vector2>} polygon - Polygon vertices
 * @returns {boolean} - True if the point is inside the polygon
 */
function isPointInPolygon(point, polygon) {
  // Ray casting algorithm - count the number of times a ray from the point crosses the polygon edges
  let inside = false;
  const x = point.x;
  const y = point.y;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    
    // Check if the point is exactly on an edge
    const onSegment = isPointOnLineSegment(point, polygon[i], polygon[j]);
    if (onSegment) return true;
    
    // Check if the ray crosses this edge
    const intersect = ((yi > y) !== (yj > y)) && 
                      (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    
    if (intersect) inside = !inside;
  }
  
  return inside;
}

/**
 * Calculate the centroid (average position) of a set of points
 * @param {Array<THREE.Vector2>} points - Array of points
 * @returns {THREE.Vector2} - Centroid point
 */
function calculateCentroid(points) {
  let sumX = 0, sumY = 0;
  
  for (const point of points) {
    sumX += point.x;
    sumY += point.y;
  }
  
  return new THREE.Vector2(
    sumX / points.length,
    sumY / points.length
  );
}
