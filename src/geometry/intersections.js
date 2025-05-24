// src/geometry/intersections.js - Optimized version
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
  
  // For star cuts debugging
  if (DEBUG_STAR_CUTS) {
    
  }
  
  // Calculate denominator
  const denominator = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
  
  // If denominator is close to 0, lines are parallel or collinear
  if (Math.abs(denominator) < 1e-10) {
    if (DEBUG_STAR_CUTS) {
      
    }
    return null;
  }
  
  // Calculate parameters
  const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denominator;
  const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denominator;
  
  // Check if intersection is within both line segments
  if (ua < 0 || ua > 1 || ub < 0 || ub > 1) {
    if (DEBUG_STAR_CUTS) {
      
    }
    return null;
  }
  
  // Calculate intersection point
  const x = x1 + ua * (x2 - x1);
  const y = y1 + ua * (y2 - y1);
  
  if (DEBUG_STAR_CUTS) {
    
  }
  
  return new THREE.Vector3(x, y, 0);
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
 * Find all intersections between polygon copies
 * @param {THREE.Group} group Group containing polygon copies
 * @returns {Array<THREE.Vector3>} Array of intersection points
 */
export function findAllIntersections(group) {
  const intersectionPoints = [];
  const debug = DEBUG_STAR_CUTS; // Enable debugging for star cuts
  
  // Get state object from group's userData
  const state = group.userData.state;
  
  if (!state) {
    // Warn but don't continue to spam console
    
    return intersectionPoints;
  }
  
  // Check if we're using star cuts
  const useStarCuts = state.useStars && state.useCuts && state.starSkip > 1;
  
  if (debug && useStarCuts) {
    
    
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
  
  if (debug && useStarCuts) {
    
  }
  
  // Skip if not enough copies for regular intersections and not using star cuts
  if (copies < 2 && !useStarCuts) {
    if (debug) {
      
    }
    return intersectionPoints;
  }
  
  // Generate base polygon vertices based on whether stars are enabled
  let vertices = [];
  
  // IMPORTANT: Calculate star self-intersections FIRST for star cuts
  if (useStarCuts) {
    if (debug) {
      
    }
    
    // Generate base star polygon vertices
    vertices = generateStarPolygonVertices(state.segments, state.starSkip, state.radius);
    
    if (debug) {
      
    }
    
    // Find self-intersections in the original star
    const selfIntersections = findStarSelfIntersections(vertices);
    
    if (debug) {
      
      // Log the coordinates of the self-intersections
      for (let i = 0; i < selfIntersections.length; i++) {
        const point = selfIntersections[i];
        
      }
    }
    
    // Add self-intersections to the result
    for (const point of selfIntersections) {
      if (!isPointTooClose(point, intersectionPoints)) {
        // Add with base scale (modulus scaling will be applied later during rendering)
        intersectionPoints.push(point);
        if (debug) {
          
        }
      }
    }
  }
  
  // For star cuts only or not enough copies for regular intersections
  if (useStarCuts && (copies < 2 || !state.useIntersections)) {
    if (debug) {
      
    }
    return intersectionPoints;
  }
  
  // If we reach here, we need to process regular intersections between copies too
  // This would be the code to find intersections between different copies
  
  if (debug && useStarCuts) {
    
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
  // We want to calculate star cut intersections regardless of useIntersections flag
  const useStarCuts = state && state.useStars && state.useCuts && state.starSkip > 1;
  
  if ((!state || (!state.useIntersections && !useStarCuts) || !state.needsIntersectionUpdate || !baseGeo || !group)) {
    if (DEBUG_STAR_CUTS) {
      
    }
    return baseGeo;
  }
  
  if (DEBUG_STAR_CUTS && useStarCuts) {
    
  }
  
  // Make sure group has access to state through the stateId
  // Instead of setting state directly (which might be a getter property)
  if (state && state.layerId !== undefined) {
    group.userData.stateId = state.layerId;
  }
  
  // Find intersections - this will now include star cut intersections
  const intersectionPoints = findAllIntersections(group);
  
  if (DEBUG_STAR_CUTS && useStarCuts) {
    
  }
  
  if (intersectionPoints.length === 0) {
    state.needsIntersectionUpdate = false;
    state.intersectionPoints = [];
    return baseGeo;
  }
  
  // Update state
  state.intersectionPoints = intersectionPoints;
  state.needsIntersectionUpdate = false;
  
  // Force an update of the intersection marker display 
  if (group && group.userData) {
    group.userData.justCalculatedIntersections = true;
  }
  
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

/**
 * Detect intersections for the active layer
 * @param {Object} layer The active layer
 * @returns {Array} Array of intersections
 */
export function detectIntersections(layer) {
  if (!layer) return [];
  
  // Skip if layer state doesn't exist
  if (!layer.state) return [];
  
  // IMPORTANT: Skip intersection detection if explicitly disabled
  // Check both useIntersections and useStars+useCuts flags
  const useIntersections = layer.state.useIntersections === true;
  const useStarCuts = layer.state.useStars === true && layer.state.useCuts === true && layer.state.starSkip > 1;
  
  if (!useIntersections && !useStarCuts) {
    // Return empty array when intersections are disabled
    return [];
  }
  
  // Only require at least 2 copies for regular intersections
  // For star cuts, we can have any number of copies (even 0 or 1)
  if (!useStarCuts && layer.state.copies < 2) {
    return [];
  }
  
  // Get the current markers array or create a new one
  if (!layer.markers) {
    layer.markers = [];
  }
  
  // Process any existing markers first
  const existingMarkers = layer.markers.filter(m => 
    m.animState !== ANIMATION_STATES.EXPIRED
  );
  
  // Find intersections between elements in the layer
  let intersections = [];
  if (layer.group) {
    intersections = findAllIntersections(layer.group);
  }
  
  // Create markers for new intersections
  for (const intersection of intersections) {
    // Skip if intersection is invalid (null or has NaN coordinates)
    if (!intersection || isNaN(intersection.x) || isNaN(intersection.y)) {
      continue;
    }
    
    // Check if this intersection already has a marker
    const exists = existingMarkers.some(m => 
      m.position && 
      intersection && 
      distanceBetweenPoints(m.position, intersection) < INTERSECTION_MERGE_THRESHOLD
    );
    
    if (!exists) {
      // Create a new marker for this intersection
      const marker = {
        position: intersection.clone(),
        velocity: 0,
        lifetime: MARK_LIFE,
        animState: ANIMATION_STATES.ACTIVE,
        justHit: false,
        frequency: calculateFrequencyForPoint(intersection, layer.state),
        pan: calculatePanForPoint(intersection)
      };
      layer.markers.push(marker);
    }
  }
  
  return intersections;
}

/**
 * Apply velocity updates to markers
 * @param {Object} layer The layer containing markers
 * @param {number} deltaTime Time elapsed since last frame in seconds
 */
export function applyVelocityToMarkers(layer, deltaTime) {
  if (!layer || !layer.markers) return;
  
  // Process each marker
  for (let i = layer.markers.length - 1; i >= 0; i--) {
    const marker = layer.markers[i];
    
    // Skip if marker is already expired
    if (marker.animState === ANIMATION_STATES.EXPIRED) {
      continue;
    }
    
    // Update marker based on its state
    if (marker.animState === ANIMATION_STATES.ACTIVE) {
      // For active markers, increase velocity when hit by rotating line
      if (isMarkerHit(marker, layer)) {
        marker.velocity = MAX_VELOCITY;
        marker.animState = ANIMATION_STATES.HIT;
        marker.justHit = true;
      }
    } else if (marker.animState === ANIMATION_STATES.HIT) {
      // Decrease velocity over time
      marker.velocity = Math.max(0, marker.velocity - (deltaTime * MAX_VELOCITY * 0.5));
      
      // Decrease lifetime
      marker.lifetime -= deltaTime * 1000;
      
      // Mark as expired if lifetime is up
      if (marker.lifetime <= 0) {
        marker.animState = ANIMATION_STATES.EXPIRED;
      }
    }
  }
  
  // Remove expired markers
  layer.markers = layer.markers.filter(m => m.animState !== ANIMATION_STATES.EXPIRED);
}

/**
 * Check if a marker is hit by the rotating line
 * @param {Object} marker The marker to check
 * @param {Object} layer The layer containing the marker
 * @returns {boolean} True if marker is hit
 */
function isMarkerHit(marker, layer) {
  if (!layer || !layer.state) return false;
  
  // Get current angle from layer
  const currentAngle = layer.currentAngle || 0;
  const prevAngle = layer.previousAngle || 0;
  
  // Calculate angle of the marker relative to center
  const markerAngle = Math.atan2(marker.position.y, marker.position.x);
  
  // Normalize angles to 0-2π range
  const normCurrentAngle = (currentAngle % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  const normPrevAngle = (prevAngle % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
  const normMarkerAngle = (markerAngle + Math.PI * 2) % (Math.PI * 2);
  
  // Check if the rotating line passed over the marker in this frame
  if (normCurrentAngle < normPrevAngle) {
    // Handle wraparound case
    return (normMarkerAngle <= normCurrentAngle) || 
           (normMarkerAngle > normPrevAngle);
  } else {
    return (normMarkerAngle <= normCurrentAngle) && 
           (normMarkerAngle > normPrevAngle);
  }
}

/**
 * Calculate frequency for an intersection point
 * @param {THREE.Vector3} point The intersection point
 * @param {Object} state The state object
 * @returns {number} Frequency in Hz
 */
function calculateFrequencyForPoint(point, state) {
  // Default to a frequency based on distance from center
  const distance = Math.sqrt(point.x * point.x + point.y * point.y);
  const baseFreq = 110; // A2
  const maxFreq = 880;  // A5
  
  // Map distance to frequency range (inverse relationship)
  // Closer to center = higher frequency
  const normalizedDist = Math.min(1.0, distance / state.radius);
  const frequency = maxFreq - (normalizedDist * (maxFreq - baseFreq));
  
  return frequency;
}

/**
 * Calculate pan position for a point
 * @param {THREE.Vector3} point The point
 * @returns {number} Pan position (-1 to 1)
 */
function calculatePanForPoint(point) {
  // Map x position to pan range (-1 to 1)
  // This assumes the point is in world coordinates centered at origin
  const maxDistance = 300; // Adjust based on your scene scale
  return Math.max(-1, Math.min(1, point.x / maxDistance));
}