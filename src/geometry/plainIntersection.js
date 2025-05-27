/**
 * plainIntersection.js - Intersection calculations for same layer polygon copies
 * 
 * This module calculates intersections between different copies of the same polygon
 * within a layer. The intersections generate new vertices that are treated exactly
 * the same as normal vertices (no special intersection triggers).
 * 
 * Geometry pipeline order:
 * 1. Base geometry is generated
 * 2. Stars can be made
 * 3. Euclid or fractal applied
 * 4. Copies are made with scaling and angle offset features
 * 5. Intersections are calculated between copies
 * 6. Geometry is passed to rotation and trigger detection
 */

import * as THREE from 'three';

// Threshold for considering points as coincident (to avoid duplicate intersections)
const INTERSECTION_MERGE_THRESHOLD = 0.001;

// Debug flag to control detailed logging
const DEBUG_ENABLED = false;

/**
 * Calculate distance between two points
 * @param {THREE.Vector2|THREE.Vector3} p1 - First point
 * @param {THREE.Vector2|THREE.Vector3} p2 - Second point
 * @returns {number} - Distance between points
 */
function distanceBetweenPoints(p1, p2) {
  return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
}

/**
 * Check if a point is too close to any existing points
 * @param {THREE.Vector2|THREE.Vector3} point - The point to check
 * @param {Array<THREE.Vector2|THREE.Vector3>} existingPoints - Array of existing points
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
 * Find intersection point between two line segments
 * @param {THREE.Vector2} p1 - First endpoint of first line segment
 * @param {THREE.Vector2} p2 - Second endpoint of first line segment
 * @param {THREE.Vector2} p3 - First endpoint of second line segment
 * @param {THREE.Vector2} p4 - Second endpoint of second line segment
 * @returns {THREE.Vector2|null} - Intersection point or null if no intersection
 */
function lineSegmentIntersection(p1, p2, p3, p4) {
  const debugEnabled = DEBUG_ENABLED;
  
  // Extract coordinates
  const x1 = p1.x, y1 = p1.y;
  const x2 = p2.x, y2 = p2.y;
  const x3 = p3.x, y3 = p3.y;
  const x4 = p4.x, y4 = p4.y;
  
  if (debugEnabled) {
    console.log(`[PLAIN INTERSECTION] Checking segments (${x1.toFixed(2)},${y1.toFixed(2)})-(${x2.toFixed(2)},${y2.toFixed(2)}) and (${x3.toFixed(2)},${y3.toFixed(2)})-(${x4.toFixed(2)},${y4.toFixed(2)})`);
  }
  
  // Calculate denominators
  const denom = ((y4 - y3) * (x2 - x1)) - ((x4 - x3) * (y2 - y1));
  
  // If denominator is zero, lines are parallel or collinear
  if (Math.abs(denom) < 1e-10) {
    if (debugEnabled) {
      console.log(`[PLAIN INTERSECTION] Lines are parallel or collinear (denom = ${denom.toFixed(10)})`);
    }
    return null;
  }
  
  // Calculate intersection parameters
  const ua = (((x4 - x3) * (y1 - y3)) - ((y4 - y3) * (x1 - x3))) / denom;
  const ub = (((x2 - x1) * (y1 - y3)) - ((y2 - y1) * (x1 - x3))) / denom;
  
  if (debugEnabled) {
    console.log(`[PLAIN INTERSECTION] Parameters: ua=${ua.toFixed(5)}, ub=${ub.toFixed(5)}`);
  }
  
  // Check if intersection is within both line segments
  // Use a small epsilon for numerical stability
  const epsilon = 1e-5;
  if (ua < -epsilon || ua > 1+epsilon || ub < -epsilon || ub > 1+epsilon) {
    if (debugEnabled) {
      console.log(`[PLAIN INTERSECTION] Intersection outside segment bounds: ua=${ua.toFixed(5)}, ub=${ub.toFixed(5)}`);
    }
    return null;
  }
  
  // Calculate intersection point
  const x = x1 + ua * (x2 - x1);
  const y = y1 + ua * (y2 - y1);
  
  if (debugEnabled) {
    console.log(`[PLAIN INTERSECTION] Found intersection at (${x.toFixed(4)},${y.toFixed(4)})`);
  }
  
  // Create a new Vector2 for the intersection point
  return new THREE.Vector2(x, y);
}

/**
 * Get vertex positions for a specific copy with transformations applied
 * @param {THREE.BufferGeometry} baseGeo - Base geometry
 * @param {number} scale - Scale factor
 * @param {number} rotationAngle - Rotation angle in radians
 * @returns {Array<THREE.Vector2>} Array of vertex positions as Vector2
 */
function getTransformedVertexPositions(baseGeo, scale, rotationAngle) {
  const positions = baseGeo.getAttribute('position').array;
  const count = baseGeo.getAttribute('position').count;
  const vertices = [];
  
  for (let i = 0; i < count; i++) {
    const x = positions[i * 3] * scale;
    const y = positions[i * 3 + 1] * scale;
    
    // Apply rotation
    const cos = Math.cos(rotationAngle);
    const sin = Math.sin(rotationAngle);
    const rotX = x * cos - y * sin;
    const rotY = x * sin + y * cos;
    
    vertices.push(new THREE.Vector2(rotX, rotY));
  }
  
  return vertices;
}

/**
 * Get line segments from a polygon (connecting consecutive vertices)
 * @param {Array<THREE.Vector2>} vertices - Array of vertex positions
 * @param {boolean} isStarPolygon - Whether this is a star polygon with indexed geometry
 * @param {THREE.BufferGeometry} baseGeo - Base geometry (for star polygon indices)
 * @returns {Array<Array<THREE.Vector2>>} Array of line segments, each segment is [start, end]
 */
function getPolygonLineSegments(vertices, isStarPolygon = false, baseGeo = null) {
  const segments = [];
  
  if (isStarPolygon && baseGeo && baseGeo.index) {
    // For star polygons, use the index to determine which vertices are connected
    const indices = baseGeo.index.array;
    
    // Process indices in pairs to create line segments
    for (let i = 0; i < indices.length; i += 2) {
      const startIdx = indices[i];
      const endIdx = indices[i + 1];
      
      if (startIdx < vertices.length && endIdx < vertices.length) {
        segments.push([vertices[startIdx], vertices[endIdx]]);
      }
    }
  } else {
    // For regular polygons, connect consecutive vertices in a loop
    for (let i = 0; i < vertices.length; i++) {
      const start = vertices[i];
      const end = vertices[(i + 1) % vertices.length];
      segments.push([start, end]);
    }
  }
  
  return segments;
}

/**
 * Calculate intersections between two sets of line segments
 * @param {Array<Array<THREE.Vector2>>} segments1 - First set of line segments
 * @param {Array<Array<THREE.Vector2>>} segments2 - Second set of line segments
 * @returns {Array<THREE.Vector2>} Array of intersection points
 */
function calculateSegmentIntersections(segments1, segments2) {
  const intersections = [];
  
  for (const seg1 of segments1) {
    for (const seg2 of segments2) {
      const intersection = lineSegmentIntersection(seg1[0], seg1[1], seg2[0], seg2[1]);
      
      if (intersection) {
        // Only add if not too close to any existing intersection
        if (!isPointTooClose(intersection, intersections)) {
          intersections.push(intersection);
          
          if (DEBUG_ENABLED) {
            console.log(`[PLAIN INTERSECTION] Added intersection: (${intersection.x.toFixed(4)}, ${intersection.y.toFixed(4)})`);
          }
        }
      }
    }
  }
  
  return intersections;
}

/**
 * Calculate all intersections between polygon copies in a layer
 * @param {THREE.BufferGeometry} baseGeo - Base geometry
 * @param {Object} state - Application state containing copy parameters
 * @returns {Array<THREE.Vector2>} Array of intersection points
 */
export function calculateCopyIntersections(baseGeo, state) {
  if (!baseGeo || !state || state.copies <= 1) {
    return []; // Need at least 2 copies for intersections
  }
  
  const debugEnabled = DEBUG_ENABLED;
  
  if (debugEnabled) {
    console.log(`[PLAIN INTERSECTION] Calculating intersections for ${state.copies} copies`);
  }
  
  const allIntersections = [];
  const copyData = [];
  
  // Check if this is a star polygon
  const isStarPolygon = baseGeo.userData?.geometryInfo?.type === 'star_with_cuts' ||
                        (state.useStars && state.starSkip > 1);
  
  // First, generate all copy transformations and their line segments
  for (let i = 0; i < state.copies; i++) {
    // Calculate scale factor (same logic as in updateGroup)
    let stepScaleFactor = Math.pow(state.stepScale, i);
    
    // Apply modulus scaling if enabled
    let finalScale = stepScaleFactor;
    if (state.useModulus) {
      const modulusScale = state.getScaleFactorForCopy(i);
      finalScale = modulusScale * stepScaleFactor;
    }
    // Apply alt scale if enabled
    else if (state.useAltScale && ((i + 1) % state.altStepN === 0)) {
      finalScale = stepScaleFactor * state.altScale;
    }
    
    // Calculate rotation angle (same logic as in updateGroup)
    const startingAngle = state?.startingAngle || 0;
    const cumulativeAngleDegrees = startingAngle + (i * state.angle);
    const cumulativeAngleRadians = (cumulativeAngleDegrees * Math.PI) / 180;
    
    // Get transformed vertex positions for this copy
    const vertices = getTransformedVertexPositions(baseGeo, finalScale, cumulativeAngleRadians);
    
    // Get line segments for this copy
    const segments = getPolygonLineSegments(vertices, isStarPolygon, baseGeo);
    
    copyData.push({
      copyIndex: i,
      vertices: vertices,
      segments: segments,
      scale: finalScale,
      angle: cumulativeAngleRadians
    });
    
    if (debugEnabled) {
      console.log(`[PLAIN INTERSECTION] Copy ${i}: scale=${finalScale.toFixed(3)}, angle=${cumulativeAngleDegrees.toFixed(1)}°, ${vertices.length} vertices, ${segments.length} segments`);
    }
  }
  
  // Now calculate intersections between all pairs of copies
  for (let i = 0; i < copyData.length; i++) {
    for (let j = i + 1; j < copyData.length; j++) {
      const copy1 = copyData[i];
      const copy2 = copyData[j];
      
      if (debugEnabled) {
        console.log(`[PLAIN INTERSECTION] Checking intersections between copy ${i} and copy ${j}`);
      }
      
      // Calculate intersections between the two copies
      const intersections = calculateSegmentIntersections(copy1.segments, copy2.segments);
      
      if (intersections.length > 0) {
        if (debugEnabled) {
          console.log(`[PLAIN INTERSECTION] Found ${intersections.length} intersections between copy ${i} and copy ${j}`);
        }
        
        // Add all intersections, filtering out duplicates
        for (const intersection of intersections) {
          if (!isPointTooClose(intersection, allIntersections)) {
            allIntersections.push(intersection);
          }
        }
      }
    }
  }
  
  if (debugEnabled) {
    console.log(`[PLAIN INTERSECTION] Total intersections found: ${allIntersections.length}`);
    allIntersections.forEach((point, i) => {
      console.log(`[PLAIN INTERSECTION] Intersection ${i}: (${point.x.toFixed(4)}, ${point.y.toFixed(4)})`);
    });
  }
  
  return allIntersections;
}

/**
 * Create a new geometry that includes the original vertices plus intersection points
 * @param {THREE.BufferGeometry} baseGeo - Original base geometry
 * @param {Array<THREE.Vector2>} intersectionPoints - Array of intersection points
 * @returns {THREE.BufferGeometry} New geometry with intersection points added as vertices
 */
export function createGeometryWithIntersections(baseGeo, intersectionPoints) {
  if (!baseGeo || !intersectionPoints || intersectionPoints.length === 0) {
    return baseGeo; // Return original geometry if no intersections
  }
  
  const debugEnabled = DEBUG_ENABLED;
  
  if (debugEnabled) {
    console.log(`[PLAIN INTERSECTION] Creating geometry with ${intersectionPoints.length} intersection points`);
  }
  
  // Get original positions
  const originalPositions = baseGeo.getAttribute('position').array;
  const originalCount = baseGeo.getAttribute('position').count;
  
  // Create new positions array with original vertices + intersection points
  const newVertexCount = originalCount + intersectionPoints.length;
  const newPositions = new Float32Array(newVertexCount * 3);
  
  // Copy original vertices
  for (let i = 0; i < originalPositions.length; i++) {
    newPositions[i] = originalPositions[i];
  }
  
  // Add intersection points as new vertices
  for (let i = 0; i < intersectionPoints.length; i++) {
    const point = intersectionPoints[i];
    const offset = (originalCount + i) * 3;
    newPositions[offset] = point.x;
    newPositions[offset + 1] = point.y;
    newPositions[offset + 2] = 0; // Z coordinate is always 0
  }
  
  // Create new geometry
  const newGeometry = new THREE.BufferGeometry();
  newGeometry.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));
  
  // IMPORTANT: Do NOT copy the index when we add intersection points
  // The index only knows about the original vertices and would create invalid connections
  // if we include the intersection points. The intersection points are only for triggers.
  // For line drawing, we only want to connect the original vertices.
  if (baseGeo.index && intersectionPoints.length === 0) {
    // Only copy index if we haven't added intersection points
    newGeometry.setIndex(baseGeo.index.clone());
  }
  
  // Copy userData and update it
  if (baseGeo.userData) {
    newGeometry.userData = { ...baseGeo.userData };
  } else {
    newGeometry.userData = {};
  }
  
  // Update geometry info to reflect the new vertices
  if (newGeometry.userData.geometryInfo) {
    newGeometry.userData.geometryInfo = {
      ...newGeometry.userData.geometryInfo,
      totalVertexCount: newVertexCount,
      intersectionCount: intersectionPoints.length,
      hasPlainIntersections: true
    };
  } else {
    newGeometry.userData.geometryInfo = {
      totalVertexCount: newVertexCount,
      intersectionCount: intersectionPoints.length,
      hasPlainIntersections: true
    };
  }
  
  if (debugEnabled) {
    console.log(`[PLAIN INTERSECTION] Created new geometry with ${newVertexCount} total vertices (${originalCount} original + ${intersectionPoints.length} intersections)`);
  }
  
  return newGeometry;
}

/**
 * Main function to process plain intersections for a layer
 * This should be called after copies are made but before rotation and trigger detection
 * @param {THREE.BufferGeometry} baseGeo - Base geometry
 * @param {Object} state - Application state
 * @returns {THREE.BufferGeometry} New geometry with intersection points added as vertices
 */
export function processPlainIntersections(baseGeo, state) {
  if (!baseGeo || !state) {
    return baseGeo;
  }
  
  // Calculate intersections between copies
  const intersectionPoints = calculateCopyIntersections(baseGeo, state);
  
  // Create new geometry with intersection points added as vertices
  return createGeometryWithIntersections(baseGeo, intersectionPoints);
} 