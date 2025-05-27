// src/geometry/geometry.js - Performance-optimized with camera-independent sizing and fixed segments rounding
import * as THREE from 'three';
import { 
  VERTEX_CIRCLE_SIZE, 
  VERTEX_CIRCLE_OPACITY, 
  VERTEX_CIRCLE_COLOR,
  INTERSECTION_POINT_SIZE,
  INTERSECTION_POINT_COLOR,
  INTERSECTION_POINT_OPACITY
} from '../config/constants.js';
// DEPRECATED: Removed import from intersections.js - functionality moved to starCuts.js
// import { findAllIntersections, processIntersections } from './intersections.js';
import { createOrUpdateLabel } from '../ui/domLabels.js';
// Import the frequency utilities at the top of geometry.js
import { quantizeToEqualTemperament, getNoteName } from '../audio/frequencyUtils.js';
import { createNote } from '../notes/notes.js';
// Import the star cuts calculation function
import { calculateStarCutsVertices, hasStarSelfIntersections, createStarPolygonPoints, createRegularStarPolygonPoints } from './starCuts.js';
// Import the new plain intersection system
import { processPlainIntersections, calculateCopyIntersections } from './plainIntersection.js';

// Debug flag to control logging
const DEBUG_LOGGING = false;

// Reuse geometries for better performance
const vertexCircleGeometry = new THREE.CircleGeometry(1, 12); // Fewer segments (12) for performance

/**
 * Apply fractal subdivision to an array of points
 * @param {Array<THREE.Vector2>} points Array of 2D points to subdivide
 * @param {number} fractalValue Fractal iteration value
 * @returns {Array<THREE.Vector2>} Subdivided points
 */
function applyFractalSubdivision(points, fractalValue) {
  // If fractal value is 1 or less, just return the original points
  if (fractalValue <= 1 || !points || points.length < 2) {
    return points;
  }
  
  // Number of divisions per segment (rounded to nearest integer)
  const divisions = Math.max(2, Math.round(fractalValue));
  
  const newPoints = [];
  
  // For each pair of points, create divisions-1 new points between them
  for (let i = 0; i < points.length; i++) {
    const currentPoint = points[i];
    const nextPoint = points[(i + 1) % points.length];
    
    // Add the current point
    newPoints.push(currentPoint);
    
    // Add divisions-1 new points between current and next
    for (let div = 1; div < divisions; div++) {
      const factor = div / divisions;
      const midX = currentPoint.x + (nextPoint.x - currentPoint.x) * factor;
      const midY = currentPoint.y + (nextPoint.y - currentPoint.y) * factor;
      
      newPoints.push(new THREE.Vector2(midX, midY));
    }
  }
  
  return newPoints;
}

/**
 * Apply fractal subdivision to line segments
 * @param {Array<Array<THREE.Vector2>>} lineSegments Array of line segments, each segment is [start, end]
 * @param {number} fractalValue Fractal iteration value
 * @returns {Array<THREE.Vector2>} All points from fractalized line segments
 */
function applyFractalSubdivisionToLineSegments(lineSegments, fractalValue) {
  if (fractalValue <= 1 || !lineSegments || lineSegments.length === 0) {
    // Return all unique points from the line segments
    const allPoints = [];
    const pointSet = new Set();
    
    for (const segment of lineSegments) {
      for (const point of segment) {
        const key = `${point.x.toFixed(6)},${point.y.toFixed(6)}`;
        if (!pointSet.has(key)) {
          pointSet.add(key);
          allPoints.push(point);
        }
      }
    }
    return allPoints;
  }
  
  const divisions = Math.max(2, Math.round(fractalValue));
  const allPoints = [];
  const pointSet = new Set();
  
  // Apply fractal subdivision to each line segment
  for (const segment of lineSegments) {
    const [start, end] = segment;
    
    // Add the start point
    const startKey = `${start.x.toFixed(6)},${start.y.toFixed(6)}`;
    if (!pointSet.has(startKey)) {
      pointSet.add(startKey);
      allPoints.push(start);
    }
    
    // Add fractal subdivision points along this segment
    for (let div = 1; div < divisions; div++) {
      const factor = div / divisions;
      const midX = start.x + (end.x - start.x) * factor;
      const midY = start.y + (end.y - start.y) * factor;
      const midPoint = new THREE.Vector2(midX, midY);
      
      const midKey = `${midX.toFixed(6)},${midY.toFixed(6)}`;
      if (!pointSet.has(midKey)) {
        pointSet.add(midKey);
        allPoints.push(midPoint);
      }
    }
    
    // Add the end point
    const endKey = `${end.x.toFixed(6)},${end.y.toFixed(6)}`;
    if (!pointSet.has(endKey)) {
      pointSet.add(endKey);
      allPoints.push(end);
    }
  }
  
  return allPoints;
}

/**
 * Apply fractal subdivision to line segments and return both points and segment information
 * @param {Array<Array<THREE.Vector2>>} lineSegments Array of line segments, each segment is [start, end]
 * @param {number} fractalValue Fractal iteration value
 * @returns {Object} Object with points array and segments array for proper line drawing
 */
function applyFractalSubdivisionToLineSegmentsWithSegments(lineSegments, fractalValue) {
  if (fractalValue <= 1 || !lineSegments || lineSegments.length === 0) {
    // Return all unique points from the line segments and the original segments
    const allPoints = [];
    const pointSet = new Set();
    const pointIndexMap = new Map();
    
    for (const segment of lineSegments) {
      for (const point of segment) {
        const key = `${point.x.toFixed(6)},${point.y.toFixed(6)}`;
        if (!pointSet.has(key)) {
          pointSet.add(key);
          pointIndexMap.set(key, allPoints.length);
          allPoints.push(point);
        }
      }
    }
    
    // Convert original segments to indices
    const segmentIndices = [];
    for (const segment of lineSegments) {
      const startKey = `${segment[0].x.toFixed(6)},${segment[0].y.toFixed(6)}`;
      const endKey = `${segment[1].x.toFixed(6)},${segment[1].y.toFixed(6)}`;
      const startIdx = pointIndexMap.get(startKey);
      const endIdx = pointIndexMap.get(endKey);
      segmentIndices.push([startIdx, endIdx]);
    }
    
    return { points: allPoints, segments: segmentIndices };
  }
  
  const divisions = Math.max(2, Math.round(fractalValue));
  const allPoints = [];
  const pointSet = new Set();
  const pointIndexMap = new Map();
  const segmentIndices = [];
  
  // Apply fractal subdivision to each line segment
  for (const segment of lineSegments) {
    const [start, end] = segment;
    const segmentPoints = [];
    
    // Add the start point
    const startKey = `${start.x.toFixed(6)},${start.y.toFixed(6)}`;
    if (!pointSet.has(startKey)) {
      pointSet.add(startKey);
      pointIndexMap.set(startKey, allPoints.length);
      allPoints.push(start);
    }
    segmentPoints.push(pointIndexMap.get(startKey));
    
    // Add fractal subdivision points along this segment
    for (let div = 1; div < divisions; div++) {
      const factor = div / divisions;
      const midX = start.x + (end.x - start.x) * factor;
      const midY = start.y + (end.y - start.y) * factor;
      const midPoint = new THREE.Vector2(midX, midY);
      
      const midKey = `${midX.toFixed(6)},${midY.toFixed(6)}`;
      if (!pointSet.has(midKey)) {
        pointSet.add(midKey);
        pointIndexMap.set(midKey, allPoints.length);
        allPoints.push(midPoint);
      }
      segmentPoints.push(pointIndexMap.get(midKey));
    }
    
    // Add the end point
    const endKey = `${end.x.toFixed(6)},${end.y.toFixed(6)}`;
    if (!pointSet.has(endKey)) {
      pointSet.add(endKey);
      pointIndexMap.set(endKey, allPoints.length);
      allPoints.push(end);
    }
    segmentPoints.push(pointIndexMap.get(endKey));
    
    // Create line segments connecting consecutive points in this fractalized segment
    for (let i = 0; i < segmentPoints.length - 1; i++) {
      segmentIndices.push([segmentPoints[i], segmentPoints[i + 1]]);
    }
  }
  
  return { points: allPoints, segments: segmentIndices };
}

/**
 * Add line segments connecting star cut intersection points to the fractalized geometry
 * @param {Array<Array<number>>} fractalSegments Existing fractal line segments
 * @param {Array<THREE.Vector2>} allPoints All points including intersection points
 * @param {Array<THREE.Vector2>} intersectionPoints Star cut intersection points
 * @param {number} intersectionStartIndex Starting index of intersection points in allPoints array
 * @returns {Array<Array<number>>} Updated line segments including intersection connections
 */
function addIntersectionPointSegments(fractalSegments, allPoints, intersectionPoints, intersectionStartIndex) {
  const updatedSegments = [...fractalSegments];
  
  // For each intersection point, find the closest fractalized points and connect to them
  for (let i = 0; i < intersectionPoints.length; i++) {
    const intersection = intersectionPoints[i];
    const intersectionIndex = intersectionStartIndex + i;
    
    // Find the closest fractalized points (excluding other intersection points)
    const fractalizedPoints = allPoints.slice(0, intersectionStartIndex);
    let closestDistances = [];
    
    for (let j = 0; j < fractalizedPoints.length; j++) {
      const fractalPoint = fractalizedPoints[j];
      const distance = Math.hypot(
        intersection.x - fractalPoint.x,
        intersection.y - fractalPoint.y
      );
      closestDistances.push({ index: j, distance });
    }
    
    // Sort by distance and connect to the closest points
    closestDistances.sort((a, b) => a.distance - b.distance);
    
    // Connect to the 2-3 closest points to create star cut lines
    const connectionsToMake = Math.min(3, closestDistances.length);
    for (let k = 0; k < connectionsToMake; k++) {
      const closestPoint = closestDistances[k];
      // Only connect if the distance is reasonable (not too far)
      if (closestPoint.distance < 300) { // Adjust threshold as needed
        updatedSegments.push([intersectionIndex, closestPoint.index]);
      }
    }
  }
  
  return updatedSegments;
}

/**
 * Generate line segments for a regular polygon
 * @param {Array<THREE.Vector2>} points Array of polygon vertices
 * @returns {Array<Array<THREE.Vector2>>} Array of line segments
 */
function generateRegularPolygonLineSegments(points) {
  const segments = [];
  for (let i = 0; i < points.length; i++) {
    const start = points[i];
    const end = points[(i + 1) % points.length];
    segments.push([start, end]);
  }
  return segments;
}

/**
 * Generate line segments for a star polygon (without cuts)
 * @param {Array<THREE.Vector2>} points Array of star polygon vertices
 * @param {number} starSkip Skip value for the star
 * @returns {Array<Array<THREE.Vector2>>} Array of line segments
 */
function generateStarLineSegments(points, starSkip) {
  const segments = [];
  const vertexCount = points.length;
  
  for (let i = 0; i < vertexCount; i++) {
    const startIdx = i;
    const endIdx = (i + starSkip) % vertexCount;
    segments.push([points[startIdx], points[endIdx]]);
  }
  
  return segments;
}

/**
 * Generate line segments for a star polygon with cuts
 * This creates the new line segments that replace the original star lines
 * @param {Array<THREE.Vector2>} allPoints Array of all points (original vertices + intersection points)
 * @param {Array<THREE.Vector2>} intersectionPoints Array of intersection points
 * @param {number} starSkip Skip value for the star
 * @param {number} originalVertexCount Number of original vertices
 * @returns {Array<Array<THREE.Vector2>>} Array of line segments
 */
function generateStarCutLineSegments(allPoints, intersectionPoints, starSkip, originalVertexCount) {
  // For now, return the original star line segments plus segments to intersection points
  // This is a simplified approach - a more sophisticated implementation would
  // trace the actual star cut paths
  
  const segments = [];
  
  // Add original star line segments
  for (let i = 0; i < originalVertexCount; i++) {
    const startIdx = i;
    const endIdx = (i + starSkip) % originalVertexCount;
    segments.push([allPoints[startIdx], allPoints[endIdx]]);
  }
  
  // Add segments from original vertices to nearby intersection points
  for (let i = 0; i < originalVertexCount; i++) {
    const vertex = allPoints[i];
    
    // Find closest intersection points to this vertex
    for (const intersection of intersectionPoints) {
      const distance = Math.hypot(vertex.x - intersection.x, vertex.y - intersection.y);
      
      // Only connect if the intersection is reasonably close
      if (distance < 200) { // Adjust this threshold as needed
        segments.push([vertex, intersection]);
      }
    }
  }
  
  return segments;
}

/**
 * Generate the actual star cut line segments that represent the star cut pattern
 * This creates the line segments that should be fractalized, not just connections to intersection points
 * @param {Array<THREE.Vector2>} allPoints Array of all points (original vertices + intersection points)
 * @param {number} starSkip Skip value for the star
 * @param {number} originalVertexCount Number of original vertices
 * @returns {Array<Array<THREE.Vector2>>} Array of line segments representing the star cut pattern
 */
function generateActualStarCutLineSegments(allPoints, starSkip, originalVertexCount) {
  const segments = [];
  const originalVertices = allPoints.slice(0, originalVertexCount);
  const intersectionPoints = allPoints.slice(originalVertexCount);
  
  // For each original star line, trace the path through intersection points
  for (let i = 0; i < originalVertexCount; i++) {
    const startVertex = originalVertices[i];
    const endVertex = originalVertices[(i + starSkip) % originalVertexCount];
    
    // Find intersection points that lie on this star line
    const lineIntersections = [];
    
    for (const intersection of intersectionPoints) {
      // Check if this intersection point lies on the line between startVertex and endVertex
      if (isPointOnLineSegment(intersection, startVertex, endVertex)) {
        lineIntersections.push(intersection);
      }
    }
    
    // Sort intersection points by distance from start vertex
    lineIntersections.sort((a, b) => {
      const distA = Math.hypot(a.x - startVertex.x, a.y - startVertex.y);
      const distB = Math.hypot(b.x - startVertex.x, b.y - startVertex.y);
      return distA - distB;
    });
    
    // Create line segments: start -> first intersection -> second intersection -> ... -> end
    const pathPoints = [startVertex, ...lineIntersections, endVertex];
    
    for (let j = 0; j < pathPoints.length - 1; j++) {
      segments.push([pathPoints[j], pathPoints[j + 1]]);
    }
  }
  
  return segments;
}

/**
 * Check if a point lies on a line segment (with tolerance)
 * @param {THREE.Vector2} point Point to check
 * @param {THREE.Vector2} lineStart Start of line segment
 * @param {THREE.Vector2} lineEnd End of line segment
 * @returns {boolean} True if point is on the line segment
 */
function isPointOnLineSegment(point, lineStart, lineEnd) {
  const epsilon = 1e-3; // Tolerance for floating-point comparison
  
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
  
  // Check if t is in range [0,1] with tolerance
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
 * Create a polygon geometry with the given parameters
 * Pipeline order: 1-base geometry, 2-star geometry+cuts, 3-euclid, 4-fractal on line segments, 5-copies, 6-intersections, 7-delete
 * Note: Star cuts generate NEW line segments that replace original star lines, then fractal operates on those segments
 * @param {number} radius Radius of the polygon
 * @param {number} segments Number of segments in the polygon
 * @param {Object} state Application state for additional parameters
 * @returns {THREE.BufferGeometry} The created geometry
 */
export function createPolygonGeometry(radius, segments, state = null) {
  // Ensure we have valid inputs
  radius = radius || 300;
  segments = segments || 2;
  
  // Get the specific shape type from state if available
  const shapeType = state?.shapeType || 'regular';
  
  // Step 1: Determine base polygon type and create initial points
  let points = [];
  
  // Check if we're using Euclidean rhythm - if so, skip star creation entirely
  const isUsingEuclidean = state?.useEuclidean || shapeType === 'euclidean';
  
  switch (shapeType) {
    case 'star':
      // Only create star if not using Euclidean
      if (!isUsingEuclidean) {
        points = createStarPolygonPointsLocal(radius, segments, state?.starSkip || 1, state);
      } else {
        points = createRegularPolygonPoints(radius, segments, state);
      }
      break;
    case 'euclidean':
      // For euclidean shape type, start with regular polygon and apply euclidean later
      points = createRegularPolygonPoints(radius, segments, state);
      break;
    case 'fractal':
      // For fractal shape type, start with regular polygon and apply fractal later
      points = createRegularPolygonPoints(radius, segments, state);
      break;
    case 'regular':
    default:
      // Handle star polygon creation even in regular mode if useStars is enabled
      // But skip if using Euclidean rhythm
      if (state?.useStars && state?.starSkip > 1 && !isUsingEuclidean) {
        points = createStarPolygonPointsLocal(radius, segments, state.starSkip, state);
      } else {
        points = createRegularPolygonPoints(radius, segments, state);
      }
      break;
  }

  // Step 2: Handle star polygons and star cuts
  // This determines the line segments that fractal will operate on
  const isStarPolygon = state?.useStars && state?.starSkip > 1 && !isUsingEuclidean;
  let lineSegments = [];
  
  if (isStarPolygon) {
    if (state?.useCuts) {
      // Star cuts enabled: Generate the actual star cut line segments
      const intersectionPoints = calculateStarCutsVertices(points, state.starSkip);
      
      if (intersectionPoints.length > 0) {
        // Add intersection points to the vertex array for point rendering
        points = [...points, ...intersectionPoints];
        
        // Generate the actual star cut line segments (not just connections to intersections)
        lineSegments = generateActualStarCutLineSegments(points, state.starSkip, state.segments);
      } else {
        // No intersections found, use regular star line segments
        lineSegments = generateStarLineSegments(points, state.starSkip);
      }
    } else {
      // Star cuts disabled: Use regular star line segments
      lineSegments = generateStarLineSegments(points, state.starSkip);
    }
  } else {
    // Regular polygon: Generate consecutive line segments
    lineSegments = generateRegularPolygonLineSegments(points);
  }

  // Step 3: Apply Euclidean rhythm if enabled (BEFORE fractal)
  // Skip if we already created a euclidean shape or if euclidean is disabled
  if (state?.useEuclidean && state?.euclidValue > 0 && shapeType !== 'euclidean') {
    // Apply euclidean rhythm to existing points
    const euclideanPattern = calculateEuclideanRhythm(points.length, state.euclidValue);
    points = points.filter((point, index) => euclideanPattern[index]);
    
    // Update line segments to match the filtered points
    lineSegments = generateRegularPolygonLineSegments(points);
  } else if (shapeType === 'euclidean') {
    // For euclidean shape type, apply euclidean rhythm to the base polygon
    points = createEuclideanPoints(radius, segments, state?.euclidValue || 3, state);
    // Update line segments for euclidean points
    lineSegments = generateRegularPolygonLineSegments(points);
  }

  // Step 4: Apply fractal subdivision to the line segments (AFTER euclidean)
  let fractalizedLineSegments = null;
  
  if (state?.useFractal && state?.fractalValue > 1 && shapeType !== 'fractal') {
    const result = applyFractalSubdivisionToLineSegmentsWithSegments(lineSegments, state.fractalValue);
    points = result.points;
    fractalizedLineSegments = result.segments;
  } else if (shapeType === 'fractal') {
    const result = applyFractalSubdivisionToLineSegmentsWithSegments(lineSegments, state?.fractalValue || 1);
    points = result.points;
    fractalizedLineSegments = result.segments;
  }

  // Step 5: Create geometry from final points
  const geometry = createGeometryFromPoints(points, state, fractalizedLineSegments);

  // Add metadata to geometry
  if (geometry.userData === undefined) {
    geometry.userData = {};
  }

  // Set layer ID if available
  if (state?.layerId !== undefined) {
    geometry.userData.layerId = state.layerId;
  }

  // Add information about geometry composition
  geometry.userData.geometryInfo = {
    type: state?.useStars && state?.starSkip > 1 && !isUsingEuclidean ? 'star' : shapeType,
    baseVertexCount: segments,
    totalVertexCount: points.length,
    hasIntersections: state?.useStars && state?.useCuts && state?.starSkip > 1 && !isUsingEuclidean,
    starSkip: state?.starSkip,
    fractalLevel: state?.useFractal ? state.fractalValue : 1,
    isUsingEuclidean: isUsingEuclidean
  };

  return geometry;
}

/**
 * Create a regular polygon geometry
 * @param {number} radius Radius of the polygon
 * @param {number} segments Number of segments
 * @param {Object} state Application state
 * @returns {THREE.BufferGeometry} The created geometry
 */
function createRegularPolygonGeometry(radius, segments, state) {
  // Create points for a regular polygon
  const points = createRegularPolygonPoints(radius, segments, state);
  
  // Create geometry from points
  return createGeometryFromPoints(points, state);
}

/**
 * Create geometry from an array of points
 * @param {Array<THREE.Vector2>} points Array of 2D points
 * @param {Object} state Application state
 * @param {Array<Array<number>>} fractalSegments Optional array of line segment indices for fractalized geometry
 * @returns {THREE.BufferGeometry} The created geometry
 */
function createGeometryFromPoints(points, state, fractalSegments = null) {
  // Create geometry
  const geometry = new THREE.BufferGeometry();
  
  // Check if we're using Euclidean rhythm - if so, skip star geometry creation
  const isUsingEuclidean = state?.useEuclidean || state?.shapeType === 'euclidean';
  
  // Check if we have fractal segments to use for line drawing
  if (fractalSegments && fractalSegments.length > 0) {
    // Use the fractal segments for proper line drawing
    const vertices = [];
    const indices = [];
    
    // Create position vertices for all points
    for (let i = 0; i < points.length; i++) {
      vertices.push(points[i].x, points[i].y, 0);
    }
    
    // Use the fractal segments for indices
    for (const [start, end] of fractalSegments) {
      indices.push(start, end);
    }
    
    // Set the attributes
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
  } else if (state?.useStars && state?.starSkip > 1 && points.length >= 3 && !isUsingEuclidean) {
    // For star patterns without fractal, we need to create a custom indexed geometry
    const vertices = [];
    const indices = [];
    
    // First, create position vertices for all points
    for (let i = 0; i < points.length; i++) {
      vertices.push(points[i].x, points[i].y, 0);
    }
    
    // For star polygons, connect vertices using the skip pattern
    const baseVertexCount = state.segments;
    const skip = state.starSkip;
    
    // Create indices to connect vertices in star pattern
    const allIndices = [];
    for (let i = 0; i < baseVertexCount; i++) {
      const startIdx = i;
      const endIdx = (i + skip) % baseVertexCount;
      allIndices.push([startIdx, endIdx]);
    }
    
    // For star polygons, primitives deletion is handled at the copy level in updateGroup
    // Here we just create the full geometry for each copy
    for (const [start, end] of allIndices) {
      indices.push(start, end);
    }
    
    // Set the attributes
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
  } else {
    // Standard non-indexed geometry for regular polygons
    // FIXED: Don't delete vertices here - deletion is now handled at the copy level in updateGroup
    // with global vertex indexing and visibility-only deletion
    const positionArray = new Float32Array(points.length * 3);
    
    for (let i = 0; i < points.length; i++) {
      positionArray[i * 3] = points[i].x;
      positionArray[i * 3 + 1] = points[i].y;
      positionArray[i * 3 + 2] = 0;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positionArray, 3));
  }
  
  // Add metadata
  if (geometry.userData === undefined) {
    geometry.userData = {};
  }
  
  if (state?.layerId !== undefined) {
    geometry.userData.layerId = state.layerId;
  }
  
  geometry.userData.vertexCount = points.length;
  
  // Add star polygon specific metadata
  // But only if not using Euclidean rhythm (they are mutually exclusive)
  if (state?.useStars && state?.starSkip > 1 && !isUsingEuclidean) {
    const hasIntersections = hasStarSelfIntersections(state.segments, state.starSkip);
    geometry.userData.geometryInfo = {
      type: 'star_with_cuts',
      baseVertexCount: state.segments,
      intersectionCount: state.useCuts ? (points.length - state.segments) : 0,
      totalVertexCount: points.length,
      starSkip: state.starSkip,
      hasIntersections,
      isStarPolygon: true
    };
  }
  
  return geometry;
}

/**
 * Create a star polygon geometry {n/k}
 * @param {number} radius - Radius of the polygon
 * @param {number} n - Number of vertices
 * @param {number} k - Skip value (step size)
 * @param {boolean} useFractal - Whether to use fractal subdivision
 * @param {number} fractalValue - Fractal subdivision level
 * @param {boolean} debug - Enable debug logging
 * @returns {THREE.BufferGeometry} Star polygon geometry
 */
function createStarPolygonGeometry(radius, n, k, useFractal, fractalValue, debug = false) {
  // This function is now obsolete - replaced by createStarPolygonPoints
  
  
  // Create points using our new implementation
  const points = createStarPolygonPointsLocal(radius, n, k, { useFractal, fractalValue, useCuts: false });
  
  // Create geometry from points
  const geometry = new THREE.BufferGeometry();
  
  // Convert points to Float32Array for position attribute
  const positionArray = new Float32Array(points.length * 3);
  
  for (let i = 0; i < points.length; i++) {
    positionArray[i * 3] = points[i].x;
    positionArray[i * 3 + 1] = points[i].y;
    positionArray[i * 3 + 2] = 0; // Z-coordinate is always 0 in 2D
  }
  
  // Set the position attribute
  geometry.setAttribute('position', new THREE.BufferAttribute(positionArray, 3));
  
  return geometry;
}

/**
 * Create a polygon geometry based on Euclidean rhythm
 * @param {number} radius - Radius of the polygon
 * @param {number} n - Total number of vertices in the complete polygon
 * @param {number} k - Number of vertices to distribute according to Euclidean rhythm
 * @param {boolean} useFractal - Whether to use fractal subdivision
 * @param {number} fractalValue - Fractal subdivision level
 * @param {boolean} debug - Enable debug logging
 * @returns {THREE.BufferGeometry} Euclidean rhythm polygon geometry
 */
function createEuclideanPolygonGeometry(radius, n, k, useFractal, fractalValue, debug = false) {
  // This function is now obsolete - replaced by createEuclideanPoints
  
  
  // Create points using our new implementation
  const points = createEuclideanPoints(radius, n, k, { useFractal, fractalValue });
  
  // Create geometry from points
  const geometry = new THREE.BufferGeometry();
  
  // Convert points to Float32Array for position attribute
  const positionArray = new Float32Array(points.length * 3);
  
  for (let i = 0; i < points.length; i++) {
    positionArray[i * 3] = points[i].x;
    positionArray[i * 3 + 1] = points[i].y;
    positionArray[i * 3 + 2] = 0; // Z-coordinate is always 0 in 2D
  }
  
  // Set the position attribute
  geometry.setAttribute('position', new THREE.BufferAttribute(positionArray, 3));
  
  return geometry;
}

/**
 * Create the vertical axis
 * @param {THREE.Scene} scene - Scene to add axis to
 */
export function createAxis(scene) {
  const axisGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 2048, 0),
  ]);
  scene.add(new THREE.Line(axisGeo, new THREE.LineBasicMaterial({ color: 0xffffff })));
}

/**
 * Calculate the bounding sphere radius for all visible geometry
 * @param {THREE.Group} group - Group containing all polygon copies
 * @param {Object} state - Application state
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
  
  // DEPRECATED: Account for intersection points - functionality removed
  // if ((state.useIntersections || (state.useStars && state.useCuts)) && state.intersectionPoints && state.intersectionPoints.length > 0) {
  //   for (const point of state.intersectionPoints) {
  //     const dist = Math.hypot(point.x, point.y);
  //     maxDistance = Math.max(maxDistance, dist * 1.1); // Add 10% margin
  //   }
  // }
  
  // Never go below minimum visible distance
  return Math.max(maxDistance, 500);
}

/**
 * Create a frequency label
 * @param {string} text - Label text
 * @param {THREE.Vector3} position - Label position
 * @param {THREE.Object3D} parent - Parent object
 * @param {boolean} isAxisLabel - Whether this is an axis label
 * @param {THREE.Camera} camera - Camera for positioning
 * @param {THREE.WebGLRenderer} renderer - Renderer for positioning
 * @returns {Object} Label info object
 */
export function createTextLabel(text, position, parent, isAxisLabel = true, camera = null, renderer = null) {
  // For DOM-based labels, we don't actually create a Three.js object
  // Instead, we return an info object that can be used to update the DOM label
  
  // Check global state for equal temperament formatting
  let displayText = text;
  const globalState = window._globalState;
  if (globalState && globalState.useEqualTemperament && typeof text === 'number') {
    // Text is a frequency value
    const freq = text;
    const refFreq = globalState.referenceFrequency || 440;
    const quantizedFreq = quantizeToEqualTemperament(freq, refFreq);
    const noteName = getNoteName(quantizedFreq, refFreq);
    displayText = `${freq.toFixed(1)}Hz (${noteName})`;
  } else if (typeof text === 'number') {
    // Text is a frequency value but equal temperament is disabled
    displayText = `${text.toFixed(2)}Hz`;
  }
  
  return {
    text: displayText,
    position: position.clone ? position.clone() : new THREE.Vector3(position.x, position.y, position.z || 0),
    isAxisLabel,
    id: `label-${Math.random().toString(36).substr(2, 9)}`,
    domElement: null,
    update: function(camera, renderer) {
      // Create or update the DOM label
      this.domElement = createOrUpdateLabel(this.id, this.position, this.text, camera, renderer);
      return this;
    }
  };
}

/**
 * Clean up intersection markers
 * @param {THREE.Scene} scene - Scene containing markers
 */
export function cleanupIntersectionMarkers(scene) {
  // Skip if scene doesn't exist
  if (!scene) return;
  
  // Clean up the legacy marker group in the scene
  if (scene.userData && scene.userData.intersectionMarkerGroup) {
    const group = scene.userData.intersectionMarkerGroup;
    const parent = group.parent;
    
    if (parent) {
      parent.remove(group);
    } else {
      scene.remove(group);
    }
    
    // Clean up resources
    group.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
    
    scene.userData.intersectionMarkerGroup = null;
  }
  
  // Clean up any legacy marker groups in child objects
  if (scene.children) {
    scene.children.forEach(child => {
      if (child.userData && child.userData.intersectionMarkerGroup) {
        const markerGroup = child.userData.intersectionMarkerGroup;
        child.remove(markerGroup);
        
        markerGroup.traverse(obj => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (Array.isArray(obj.material)) {
              obj.material.forEach(m => m.dispose());
            } else {
              obj.material.dispose();
            }
          }
        });
        
        child.userData.intersectionMarkerGroup = null;
      }
      
      // Clean up new global intersection marker groups
      if (child.userData && child.userData.globalIntersectionMarkerGroup) {
        const globalMarkerGroup = child.userData.globalIntersectionMarkerGroup;
        child.remove(globalMarkerGroup);
        
        globalMarkerGroup.traverse(obj => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (Array.isArray(obj.material)) {
              obj.material.forEach(m => m.dispose());
            } else {
              obj.material.dispose();
            }
          }
        });
        
        child.userData.globalIntersectionMarkerGroup = null;
      }
    });
  }
  
  // Clean up individual markers if present
  if (scene && scene.userData && scene.userData.intersectionMarkers) {
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
}

// Keep track of how many times we've called updateGroup
let updateGroupCallCounter = 0;

/**
 * Update the display group with copies of the base geometry
 * @param {number} copies Number of copies to create
 * @param {number} stepScale Scale factor between copies
 * @param {THREE.BufferGeometry} baseGeo Base geometry
 * @param {THREE.Material} mat Material to use
 * @param {number} segments Number of segments
 * @param {number} angle Angle between copies in degrees
 * @param {Object} state Application state
 * @param {boolean} isLerping Whether values are currently being lerped
 * @param {boolean} justCalculatedIntersections Whether intersections were just calculated
 */
export function updateGroup(group, copies, stepScale, baseGeo, mat, segments, angle = 0, state = null, isLerping = false, justCalculatedIntersections = false) {
  // Skip update if invalid inputs
  if (!group || !baseGeo || !mat) {
    console.error("Missing required parameters for updateGroup");
    return;
  }

  // Plain intersections will be processed AFTER copies are created

  // Check if we're using star cuts
  const useStarCuts = state && state.useStars && state.useCuts && state.starSkip > 1;
  
  // Force intersection update when star cuts are enabled
  // DEPRECATED: Removed processIntersections call - functionality moved to starCuts.js
  // if (useStarCuts && state) {
  //   state.needsIntersectionUpdate = true;
  //   // Process the intersections for star cuts
  //   processIntersections(state, baseGeo, group);
  //   justCalculatedIntersections = true;
  // }
  
  // Get justCalculatedIntersections from group userData if it's available and not provided
  if (!justCalculatedIntersections && group.userData && group.userData.justCalculatedIntersections) {
    justCalculatedIntersections = group.userData.justCalculatedIntersections;
    // Reset the flag after reading it
    group.userData.justCalculatedIntersections = false;
  }
  
  // FIXED: Track objects for guaranteed cleanup
  const debugObjects = [];
  const newChildren = [];
  const materialsToDispose = [];
  const geometriesToDispose = [];
  
  let pointFreqLabelsCreated = [];

  try {
    // Find and temporarily store debug sphere and other debug objects
    for (let i = group.children.length - 1; i >= 0; i--) {
      const child = group.children[i];
      if (child.type === 'Mesh' && child.geometry && child.geometry.type === 'SphereGeometry') {
        debugObjects.push(child);
        group.remove(child);
        continue;
      }
      
      // FIXED: Don't preserve intersection marker groups - they need to be recalculated
      // when geometry parameters change
      if (child.userData && child.userData.isIntersectionGroup) {
        // Clean up the old intersection group properly
        child.traverse(obj => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) {
            if (Array.isArray(obj.material)) {
              obj.material.forEach(m => m.dispose());
            } else {
              obj.material.dispose();
            }
          }
        });
        group.remove(child);
        continue;
      }
    }
    
    // FIXED: Clear all remaining children with proper disposal tracking
    while (group.children.length > 0) {
      const child = group.children[group.children.length - 1];
      
      // Track geometries and materials for disposal
      if (child.geometry && child.geometry !== baseGeo) {
        geometriesToDispose.push(child.geometry);
      }
      
      if (child.material) {
        if (Array.isArray(child.material)) {
          materialsToDispose.push(...child.material);
        } else {
          materialsToDispose.push(child.material);
        }
      }
      
      group.remove(child);
    }
    
    // Handle case where copies is 0 or less
    if (copies <= 0) {
      // Make the group invisible when no copies
      group.visible = false;
      
      // Restore debug objects
      for (const debugObj of debugObjects) {
        group.add(debugObj);
      }
      
      return;
    }
    
    // Make sure the group is visible
    group.visible = true;
    
    // Increment the call counter
    updateGroupCallCounter++;
    
    // Ensure segments is a proper integer
    const numSegments = Math.round(segments);
    
    // Clean up existing point frequency labels if they exist
    if (state && state.pointFreqLabels) {
      state.cleanupPointFreqLabels();
    }
    
    // Get camera and renderer from scene's userData (assuming they're stored there)
    const camera = group.parent?.userData?.camera;
    const renderer = group.parent?.userData?.renderer;

    // Calculate camera distance for size adjustment
    const cameraDistance = camera ? camera.position.z : 2000;
    
    // Calculate global sequential index for vertex indexing
    let globalVertexIndex = 0;
    
    // Create point frequency labels if enabled
    const shouldCreatePointLabels = state && 
                                   state.showPointsFreqLabels && 
                                   !isLerping;
    
    // If we should create point labels, initialize the array
    if (shouldCreatePointLabels) {
      state.pointFreqLabels = [];
      pointFreqLabelsCreated = [];
    }
    
      // Check if we should delete entire copies (primitives mode)
  let copiesToCreate = copies;
  let deletedCopies = new Set();
  
  if (state && state.useDelete && state.deleteTarget === 'primitives') {
    deletedCopies = calculateDeletedVertices(copies, state);
    // Count how many copies will actually be created
    copiesToCreate = copies - deletedCopies.size;
  }

  // Now create the actual polygon copies for display
  for (let i = 0; i < copies; i++) {
    // Skip this copy if it should be deleted in primitives mode
    if (deletedCopies.has(i)) {
      continue;
    }
    
    // Base scale factor from step scale
    let stepScaleFactor = Math.pow(stepScale, i);
    
    // Apply modulus scaling if enabled
    let finalScale = stepScaleFactor;
    if (state && state.useModulus) {
      const modulusScale = state.getScaleFactorForCopy(i);
      finalScale = modulusScale * stepScaleFactor;
    }
    // Apply alt scale if enabled
    else if (state && state.useAltScale && ((i + 1) % state.altStepN === 0)) {
      finalScale = stepScaleFactor * state.altScale;
    }
      
      // Each copy gets a cumulative angle (i * angle) in degrees, plus the starting angle
      const startingAngle = state?.startingAngle || 0;
      const cumulativeAngleDegrees = startingAngle + (i * angle);
      
      // Convert to radians only when setting the actual Three.js rotation
      const cumulativeAngleRadians = (cumulativeAngleDegrees * Math.PI) / 180;
      
      // Create a group for this copy to hold both the lines and vertex circles
      const copyGroup = new THREE.Group();
      
      // Use the current geometry (may have been updated with intersections)
      // Create a modified material based on the original but with increased visibility
      const lineMaterial = mat.clone();
      lineMaterial.transparent = false;
      lineMaterial.opacity = 1.0;
      lineMaterial.depthTest = false;
      lineMaterial.depthWrite = false;
      
      // IMPORTANT: Use the original material's color instead of hardcoding green
      // This ensures each layer maintains its own color
      
      lineMaterial.linewidth = 5; // Much thicker lines
      
      // FIXED: Track cloned materials for proper disposal
      materialsToDispose.push(lineMaterial);
      
      // Check if this is a star polygon
      const isStarPolygon = baseGeo.userData?.geometryInfo?.type === 'star_with_cuts' ||
                            (state && state.useStars && state.starSkip > 1);
                            
      // For star polygons, use LINE_SEGMENTS with indexed geometry
      if (isStarPolygon && baseGeo.index) {
        // Create line segments for star patterns
        const lines = new THREE.LineSegments(baseGeo, lineMaterial);
        lines.scale.set(finalScale, finalScale, 1);
        
        // Set renderOrder to ensure it renders on top of other objects
        lines.renderOrder = 10; // Higher render order
        
        // Add the line geometry to the copy group
        copyGroup.add(lines);
      } else {
        // For regular polygons, use the standard LINE_LOOP
        const lines = new THREE.LineLoop(baseGeo, lineMaterial);
        lines.scale.set(finalScale, finalScale, 1);
        
        // Set renderOrder to ensure it renders on top of other objects
        lines.renderOrder = 10; // Higher render order
        
        // Add the line geometry to the copy group
        copyGroup.add(lines);
      }
      
      // Get the positions from the base geometry
      const positions = baseGeo.getAttribute('position').array;
      const count = baseGeo.getAttribute('position').count;
      
      // For star polygons, add the original vertices information to userData to help with triggers
      if (isStarPolygon && baseGeo.index) {
        // Store the original vertex indices to help with trigger detection
        const originalVertexIndices = [];
        const originalVertexCount = baseGeo.getAttribute('position').count;
        for (let v = 0; v < originalVertexCount; v++) {
          // For vertices up to the base vertex count, they're part of the star polygon
          if (v < state?.segments) {
            originalVertexIndices.push(v);
          }
        }
        // Store in the copyGroup's userData for trigger detection
        copyGroup.userData.originalVertexIndices = originalVertexIndices;
        copyGroup.userData.isStarPolygon = true;
        copyGroup.userData.starSkip = state?.starSkip || 1;
        copyGroup.userData.originalVertexCount = originalVertexCount;
      }
      
      // Add circles at each vertex
      for (let v = 0; v < count; v++) {
        const x = positions[v * 3] * finalScale;
        const y = positions[v * 3 + 1] * finalScale;
        
        // Create trigger data for this vertex
        const triggerData = {
          x: x,
          y: y,
          copyIndex: i,
          vertexIndex: v,
          isIntersection: false, // Will be updated when intersections are added
          globalIndex: globalVertexIndex
        };
        
        // For star polygons, mark if this is a base vertex or intersection point
        if (isStarPolygon) {
          triggerData.isBaseVertex = v < state?.segments;
          triggerData.isIntersection = v >= state?.segments;
        }
        
        // FIXED: Check if this vertex should be deleted using GLOBAL vertex index
        let isDeleted = false;
        let deletedOpacity = 1.0;
        if (state && state.useDelete && state.deleteTarget === 'points') {
          // Calculate total vertices across all copies for global indexing
          const totalVertices = copies * count;
          const deletedVertices = calculateDeletedVertices(totalVertices, state);
          
          if (deletedVertices.has(globalVertexIndex)) {
            isDeleted = true;
            deletedOpacity = 0.1; // Make deleted vertices very faint but still visible
          }
        }
        
        // Increment the global vertex index
        globalVertexIndex++;
        
        // Create a note object to get duration and velocity parameters
        const note = createNote(triggerData, state);
        
        // Calculate size factor that scales with camera distance
        const baseCircleSize = VERTEX_CIRCLE_SIZE;
        const durationScaleFactor = 0.5 + note.duration;
        
        // For star polygons, adjust vertex circle size based on whether it's a base vertex or intersection
        let sizeAdjustment = 1.0;
        if (isStarPolygon) {
          // Make base vertices of a star polygon slightly larger
          sizeAdjustment = triggerData.isBaseVertex ? 1.2 : 0.9;
        }
        
        // Size that remains visually consistent at different camera distances
        // Adjust the multiplier (0.3) to make points larger or smaller overall
        const sizeScaleFactor = (cameraDistance / 1000) * baseCircleSize * durationScaleFactor * 10.3 * sizeAdjustment;
        
        // Create material with opacity based on velocity and delete status
        const baseOpacity = note.velocity * deletedOpacity;
        const vertexCircleMaterial = new THREE.MeshBasicMaterial({ 
          color: mat && mat.color ? mat.color : VERTEX_CIRCLE_COLOR,
          transparent: true,
          opacity: baseOpacity, 
          depthTest: false,
          side: THREE.DoubleSide // Render both sides for better visibility
        });
        
        // Store trigger data with the material for audio trigger detection
        // Include delete status for trigger system
        vertexCircleMaterial.userData = {
          ...triggerData,
          note: note,
          isDeleted: isDeleted // Flag for trigger system to ignore deleted vertices
        };
        
        // FIXED: Track created materials for proper disposal
        materialsToDispose.push(vertexCircleMaterial);
        
        // Create a mesh using the shared geometry
        const vertexCircle = new THREE.Mesh(vertexCircleGeometry, vertexCircleMaterial);
        vertexCircle.scale.set(sizeScaleFactor, sizeScaleFactor, 1);
        
        // Set renderOrder higher to ensure it renders on top
        vertexCircle.renderOrder = 1;
        
        // Position the circle at the vertex
        vertexCircle.position.set(x, y, 0);
        
        // Add to the copy group (always add, even if deleted - just with low opacity)
        copyGroup.add(vertexCircle);
        
        // Add persistent frequency label if enabled
        if (shouldCreatePointLabels && camera && renderer) {
          try {
            // Calculate frequency for this vertex
            const freq = Math.hypot(x, y);
            
            // Format display text
            let labelText;
            // Check global state for equal temperament
            const globalState = window._globalState;
            if (globalState && globalState.useEqualTemperament && note.noteName) {
              labelText = `${freq.toFixed(1)}Hz (${note.noteName}) ${note.duration.toFixed(2)}s`;
            } else {
              labelText = `${freq.toFixed(2)}Hz ${note.duration.toFixed(2)}s`;
            }
            
            // Create a world position for this vertex in the copy
            const worldPos = new THREE.Vector3(x, y, 0);
            
            // Apply the copy's rotation
            const rotatedPos = worldPos.clone();
            rotatedPos.applyAxisAngle(new THREE.Vector3(0, 0, 1), cumulativeAngleRadians);
            
            // Create a text label for this vertex
            const textLabel = createTextLabel(
              labelText, 
              rotatedPos, 
              copyGroup, // Parent is not really used for DOM labels
              false, // Not an axis label
              camera,
              renderer
            );
            
            // Update the label immediately
            textLabel.update(camera, renderer);
            
            // Store reference for cleanup
            const labelInfo = {
              label: textLabel,
              copyIndex: i,
              vertexIndex: v,
              position: rotatedPos.clone()
            };
            
            state.pointFreqLabels.push(labelInfo);
            pointFreqLabelsCreated.push(labelInfo);
          } catch (labelError) {
            
            // Continue processing other vertices even if one label fails
          }
        }
      }
      
      // Apply rotation to the copy group
      copyGroup.rotation.z = cumulativeAngleRadians;
      
      // Track the copy group for cleanup if needed
      newChildren.push(copyGroup);
      
      // Add the whole copy group to the main group
      group.add(copyGroup);
      
      // DEPRECATED: Intersection markers functionality removed - star cuts are now handled in starCuts.js
    }
    
    // FIXED: Process plain intersections AFTER all copies are created
    // This adds intersection points as vertices to each copy's geometry
    if (state && state.usePlainIntersections && state.copies > 1) {
      processPlainIntersectionsAfterCopies(group, state, baseGeo);
    }
    
    // Clear any old intersection group references from userData
    if (group.userData && group.userData.globalIntersectionMarkerGroup) {
      group.userData.globalIntersectionMarkerGroup = null;
    }
    
    // After all copies are created, restore debug objects (but not intersection groups)
    for (const debugObj of debugObjects) {
      group.add(debugObj);
    }
    
  } catch (error) {
    console.error("Error in updateGroup:", error);
    
    // FIXED: Clean up any partially created labels on error
    if (state && pointFreqLabelsCreated.length > 0) {
      for (const labelInfo of pointFreqLabelsCreated) {
        try {
          if (labelInfo.label && labelInfo.label.dispose) {
            labelInfo.label.dispose();
          }
        } catch (disposeError) {
          
        }
      }
      
      // Remove the labels from state.pointFreqLabels
      if (state.pointFreqLabels) {
        state.pointFreqLabels = state.pointFreqLabels.filter(label => 
          !pointFreqLabelsCreated.includes(label)
        );
      }
    }
    
    // FIXED: Clean up any partially created children on error
    for (const child of newChildren) {
      try {
        if (child.parent) {
          child.parent.remove(child);
        }
      } catch (removeError) {
        
      }
    }
    
    // Re-throw the error after cleanup
    throw error;
  } finally {
    // FIXED: Guaranteed cleanup of materials and geometries
    // Dispose of old materials and geometries that were tracked for disposal
    for (const material of materialsToDispose) {
      try {
        if (material && material.dispose && material !== mat) {
          material.dispose();
        }
      } catch (disposeError) {
        
      }
    }
    
    for (const geometry of geometriesToDispose) {
      try {
        if (geometry && geometry.dispose && geometry !== baseGeo) {
          geometry.dispose();
        }
      } catch (disposeError) {
        
      }
    }
  }
}

/**
 * Process plain intersections after copies have been created
 * This adds intersection points as regular vertices to each copy's geometry
 * @param {THREE.Group} group - The group containing all copy groups
 * @param {Object} state - Application state
 * @param {THREE.BufferGeometry} baseGeo - Base geometry
 */
function processPlainIntersectionsAfterCopies(group, state, baseGeo) {
  if (!group || !state || !baseGeo || state.copies <= 1) {
    return;
  }
  
  const DEBUG_ENABLED = false; // Set to true for debugging
  
  if (DEBUG_ENABLED) {
    console.log(`[PLAIN INTERSECTION] Processing intersections after copies created for ${state.copies} copies`);
  }
  
  // Calculate intersections between copies using the existing logic
  const intersectionPoints = calculateCopyIntersections(baseGeo, state);
  
  if (intersectionPoints.length === 0) {
    if (DEBUG_ENABLED) {
      console.log(`[PLAIN INTERSECTION] No intersections found`);
    }
    return;
  }
  
  if (DEBUG_ENABLED) {
    console.log(`[PLAIN INTERSECTION] Found ${intersectionPoints.length} intersection points`);
  }
  
  // Add intersection points as vertex circles to the main group (not to individual copies)
  // Each intersection point should exist only once in the world
  for (let i = 0; i < intersectionPoints.length; i++) {
    const point = intersectionPoints[i];
    
    // The intersection points are already in world coordinates
    const worldX = point.x;
    const worldY = point.y;
    
    // Create trigger data for this intersection point
    const triggerData = {
      x: worldX,
      y: worldY,
      copyIndex: -1, // Not associated with any specific copy
      vertexIndex: -1, // Special marker for intersection points
      isIntersection: true,
      globalIndex: -1 // Will be set by overlapping cleaner
    };
    
    // Create a note object to get duration and velocity parameters
    const note = createNote(triggerData, state);
    
    // Calculate size factor
    const baseCircleSize = VERTEX_CIRCLE_SIZE;
    const durationScaleFactor = 0.5 + note.duration;
    const cameraDistance = 2000; // Default camera distance
    const sizeScaleFactor = (cameraDistance / 1000) * baseCircleSize * durationScaleFactor * 10.3 * 0.8; // Smaller for intersections
    
    // Create material for intersection point
    const vertexCircleMaterial = new THREE.MeshBasicMaterial({ 
      color: INTERSECTION_POINT_COLOR,
      transparent: true,
      opacity: note.velocity, 
      depthTest: false,
      side: THREE.DoubleSide
    });
    
    // Store trigger data with the material
    vertexCircleMaterial.userData = {
      ...triggerData,
      note: note
    };
    
    // Create vertex circle for intersection point
    const vertexCircle = new THREE.Mesh(vertexCircleGeometry, vertexCircleMaterial);
    vertexCircle.scale.set(sizeScaleFactor, sizeScaleFactor, 1);
    vertexCircle.renderOrder = 1;
    vertexCircle.position.set(worldX, worldY, 0);
    
    // Add to the main group (not to individual copy groups)
    group.add(vertexCircle);
    
    if (DEBUG_ENABLED) {
      console.log(`[PLAIN INTERSECTION] Added intersection point ${i} at (${worldX.toFixed(2)}, ${worldY.toFixed(2)})`);
    }
  }
  
  if (DEBUG_ENABLED) {
    console.log(`[PLAIN INTERSECTION] Added ${intersectionPoints.length} intersection points to main group`);
  }
}

/**
 * Get vertex positions for a specific copy
 * @param {THREE.BufferGeometry} baseGeo - Base geometry
 * @param {number} scale - Scale factor
 * @param {number} rotationAngle - Rotation angle in radians
 * @returns {Array<THREE.Vector3>} Array of vertex positions
 */
export function getVertexPositions(baseGeo, scale, rotationAngle) {
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
    
    vertices.push(new THREE.Vector3(rotX, rotY, 0));
  }
  
  return vertices;
}

/**
 * Get frequency for a point
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {number} Frequency value
 */
export function getFrequency(x, y) {
  return Math.hypot(x, y);
}

/**
 * Generate a Euclidean rhythm pattern
 * Distributes k pulses over n steps as evenly as possible
 * @param {number} n Total number of steps
 * @param {number} k Number of pulses to distribute
 * @returns {Array<boolean>} Array where true indicates a pulse
 */
function calculateEuclideanRhythm(n, k) {
  // Edge cases
  if (k <= 0) return Array(n).fill(false);
  if (k >= n) return Array(n).fill(true);
  
  // Simpler and more direct implementation
  // This implementation guarantees exactly k pulses distributed as evenly as possible
  const pattern = Array(n).fill(false);
  
  // Calculate the step size for even distribution
  const step = n / k;
  
  // Place pulses at evenly distributed positions
  for (let i = 0; i < k; i++) {
    // Round to nearest integer and ensure it's within bounds
    const position = Math.floor(i * step) % n;
    pattern[position] = true;
  }
  
  // Verify we have exactly k pulses
  const pulseCount = pattern.filter(p => p).length;
  if (pulseCount !== k) {
    
    
    // Force exactly k pulses by adding or removing as needed
    if (pulseCount < k) {
      // Add more pulses to positions that are as far as possible from existing pulses
      const gaps = [];
      let lastPulse = -1;
      
      // Find gaps between pulses
      for (let i = 0; i < n; i++) {
        if (pattern[i]) {
          if (lastPulse >= 0) {
            gaps.push({start: lastPulse, end: i, length: i - lastPulse});
          }
          lastPulse = i;
        }
      }
      
      // Add the gap that wraps around the end
      if (lastPulse >= 0) {
        gaps.push({start: lastPulse, end: n + pattern.indexOf(true), length: n - lastPulse + pattern.indexOf(true)});
      }
      
      // Sort gaps by length (descending)
      gaps.sort((a, b) => b.length - a.length);
      
      // Add pulses in the middle of the largest gaps
      for (let i = 0; i < k - pulseCount && gaps.length > 0; i++) {
        const gap = gaps.shift();
        const middle = Math.floor((gap.start + gap.length / 2)) % n;
        pattern[middle] = true;
      }
    } else if (pulseCount > k) {
      // Remove excess pulses
      const pulsePositions = [];
      for (let i = 0; i < n; i++) {
        if (pattern[i]) pulsePositions.push(i);
      }
      
      // Remove pulses that are closest to other pulses
      while (pulsePositions.length > k) {
        let minDistance = Infinity;
        let indexToRemove = -1;
        
        for (let i = 0; i < pulsePositions.length; i++) {
          const nextIndex = (i + 1) % pulsePositions.length;
          const distance = (pulsePositions[nextIndex] - pulsePositions[i] + n) % n;
          
          if (distance < minDistance) {
            minDistance = distance;
            indexToRemove = i;
          }
        }
        
        // Remove the pulse at this position
        if (indexToRemove >= 0) {
          pattern[pulsePositions[indexToRemove]] = false;
          pulsePositions.splice(indexToRemove, 1);
        }
      }
    }
  }
  
  return pattern;
}

/**
 * Create points for a regular polygon
 * @param {number} radius Radius of the polygon
 * @param {number} numSegments Number of segments
 * @param {Object} state Application state
 * @returns {Array<THREE.Vector2>} Array of points
 */
function createRegularPolygonPoints(radius, numSegments, state = null) {
  const points = [];
  const angleStep = (Math.PI * 2) / numSegments;
  
  // Create a regular polygon using full radius
  for (let i = 0; i < numSegments; i++) {
    const angle = i * angleStep;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;

    points.push(new THREE.Vector2(x, y));
  }
  
  return points;
}

/**
 * Create points for a star polygon
 * @param {number} radius Radius of the polygon
 * @param {number} numSegments Number of segments
 * @param {number} skip Skip value for star
 * @param {Object} state Application state
 * @returns {Array<THREE.Vector2>} Array of points
 */
function createStarPolygonPointsLocal(radius, numSegments, skip, state = null) {
  // If skip is invalid or 1, create a regular polygon
  if (!skip || skip <= 1) {
    return createRegularPolygonPoints(radius, numSegments, state);
  }
  
  // For star polygons, we just need to create the vertices in order around the circle
  // The actual star pattern is created by the indices in createGeometryFromPoints
  const angleStep = (Math.PI * 2) / numSegments;
  const points = [];
  
  // Create vertices evenly spaced around the circle
  for (let i = 0; i < numSegments; i++) {
    const angle = i * angleStep;
    // Use full radius for star polygons
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    points.push(new THREE.Vector2(x, y));
  }
  
  return points;
}

/**
 * Create points using Euclidean rhythm
 * @param {number} radius Radius of the polygon
 * @param {number} numSegments Total number of segments in a complete polygon
 * @param {number} pulseCount Number of points to include (Euclidean k value)
 * @param {Object} state Application state
 * @returns {Array<THREE.Vector2>} Array of points
 */
function createEuclideanPoints(radius, numSegments, pulseCount, state = null) {
  const points = [];
  const angleStep = (Math.PI * 2) / numSegments;
  
  // Calculate Euclidean rhythm
  const pattern = calculateEuclideanRhythm(numSegments, pulseCount);
  
  // Create points based on the pattern
  for (let i = 0; i < numSegments; i++) {
    if (pattern[i]) {
      const angle = i * angleStep;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      points.push(new THREE.Vector2(x, y));
    }
  }
  
  return points;
}

/**
 * Create points for a fractal polygon
 * @param {number} radius Radius of the polygon
 * @param {number} numSegments Number of segments
 * @param {number} fractalValue Fractal iteration value
 * @param {Object} state Application state
 * @returns {Array<THREE.Vector2>} Array of points
 */
function createFractalPolygonPoints(radius, numSegments, fractalValue, state = null) {
  // Start with a regular polygon
  const basePoints = createRegularPolygonPoints(radius, numSegments, state);
  
  // Apply fractal subdivision
  return applyFractalSubdivision(basePoints, fractalValue);
}

/**
 * Generate a Euclidean rhythm pattern
 * Distributes k pulses over n steps as evenly as possible
 * @param {number} n Total number of steps
 * @param {number} k Number of pulses to distribute
 * @returns {Array<boolean>} Array where true indicates a pulse
 */
function generateEuclideanRhythm(n, k) {
  // This function is now obsolete - replaced by calculateEuclideanRhythm
  
  return calculateEuclideanRhythm(n, k);
}

/**
 * Calculate which vertices should be deleted based on delete parameters
 * @param {number} totalVertices Total number of vertices
 * @param {Object} state Application state containing delete parameters
 * @returns {Set} Set of vertex indices to delete
 */
export function calculateDeletedVertices(totalVertices, state) {
  if (!state || !state.useDelete || totalVertices <= 0) {
    return new Set();
  }
  
  const { deleteMin, deleteMax, deleteMode, deleteSeed } = state;
  const deletedIndices = new Set();
  
  // Ensure min <= max
  const min = Math.min(deleteMin, deleteMax);
  const max = Math.max(deleteMin, deleteMax);
  
  if (deleteMode === 'pattern') {
    // Pattern mode: for each max vertices, delete min vertices in sequence
    for (let start = 0; start < totalVertices; start += max) {
      for (let i = 0; i < min && (start + i) < totalVertices; i++) {
        deletedIndices.add(start + i);
      }
    }
  } else if (deleteMode === 'random') {
    // Random mode: use seed to create deterministic random sequence
    const rng = createSeededRandom(deleteSeed);
    
    // Create array of all vertex indices
    const allIndices = Array.from({ length: totalVertices }, (_, i) => i);
    
    // Shuffle the array using seeded random
    for (let i = allIndices.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [allIndices[i], allIndices[j]] = [allIndices[j], allIndices[i]];
    }
    
    // Apply pattern deletion to the shuffled array
    for (let start = 0; start < totalVertices; start += max) {
      for (let i = 0; i < min && (start + i) < totalVertices; i++) {
        deletedIndices.add(allIndices[start + i]);
      }
    }
  }
  
  return deletedIndices;
}

/**
 * Create a seeded random number generator
 * @param {number} seed Random seed
 * @returns {Function} Random number generator function
 */
function createSeededRandom(seed) {
  let state = seed;
  return function() {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}