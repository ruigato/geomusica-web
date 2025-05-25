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
  
  // Occasionally log intersection points (1 in 100 to avoid spam)
  if (Math.random() < 0.01) {
    console.log("Found intersection point:", x.toFixed(2), y.toFixed(2));
  }
  
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
      // Log if we're skipping a point
      console.log(`Skipping duplicate intersection point at (${point.x.toFixed(2)}, ${point.y.toFixed(2)}) - too close to existing point (${existing.x.toFixed(2)}, ${existing.y.toFixed(2)}) - distance: ${distance.toFixed(2)}`);
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
 * @param {Layer} layer Layer containing the geometry and state
 * @returns {Array<THREE.Vector3>} Array of intersection points
 */
export function findAllIntersections(layer) {
  console.log(`findAllIntersections called with layer: ${layer.id}`);
  
  // Skip if layer or group is missing
  if (!layer || !layer.group) return [];
  
  // Skip if state is missing
  if (!layer.state) {
    console.warn("findAllIntersections - layer state not found");
    return [];
  }
  
  console.log(`findAllIntersections - layer state useIntersections: ${layer.state.useIntersections}`);
  
  // CRITICAL: Verify we have at least 2 copies for intersections
  if (!layer.state.copies || layer.state.copies < 2) {
    console.log(`findAllIntersections - skipping with insufficient copies: ${layer.state.copies}`);
    // Clear any existing intersection points
    if (layer.intersectionPoints && layer.intersectionPoints.length > 0) {
      console.log(`Clearing ${layer.intersectionPoints.length} stale intersection points because copies is ${layer.state.copies}`);
      layer.intersectionPoints = [];
    }
    return [];
  }
  
  const intersectionPoints = [];
  const debug = DEBUG_STAR_CUTS; // Enable debugging for star cuts
  
  // Get state directly from the layer
  const state = layer.state;
  console.log("findAllIntersections - layer state useIntersections:", state.useIntersections);
  
  // Check if we're using star cuts
  const useStarCuts = state.useStars && state.useCuts && state.starSkip > 1;
  
  if (debug && useStarCuts) {
    
  }
  
  // Count real copy count (excluding intersection marker groups)
  const actualCopies = [];
  for (let i = 0; i < layer.group.children.length; i++) {
    const child = layer.group.children[i];
    
    // Find actual polygon copies using several methods:
    // 1. Check for our explicit copy marking from userData.isCopy
    // 2. If that's not present, use type detection and exclusion rules
    
    // First check for explicit copy marking (preferred method)
    if (child.userData && child.userData.isCopy === true) {
      actualCopies.push(child);
      continue;
    }
    
    // For backwards compatibility, check each copy group's children
    if (child.type === 'Group') {
      // Look for LineLoop objects inside the group
      const lineLoop = child.children.find(c => 
        c.type === 'Line' || c.type === 'LineLoop' || c.type === 'LineSegments'
      );
      
      if (lineLoop) {
        actualCopies.push(lineLoop);
        continue;
      }
    }
    
    // Fallback to previous filtering method
    if (!(child.userData && (
      child.userData.isIntersectionGroup || 
      child.userData.isMarker || 
      child.userData.isAxisLabel ||
      child.userData.isHelper ||
      child.userData.isDebugSphere
    )) && 
    (child.type === 'Line' || child.type === 'LineLoop' || child.type === 'LineSegments')) {
      actualCopies.push(child);
    }
  }
  
  const copies = actualCopies.length;
  console.log("findAllIntersections - actual copies count:", copies, "total children:", layer.group.children.length);
  
  if (debug && useStarCuts) {
    
  }
  
  // Skip if not enough copies for regular intersections and not using star cuts
  if (copies < 2 && !useStarCuts) {
    console.warn("Not enough copies for intersections:", copies);
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
  if (state.useIntersections && copies >= 2) {
    console.log("Finding intersections between copies - useIntersections:", state.useIntersections, "copies:", copies);
    // Generate regular polygon vertices if not already done for star cuts
    if (!useStarCuts || vertices.length === 0) {
      // Generate polygon vertices for a regular polygon
      vertices = [];
      const segments = state.segments;
      const radius = state.radius;
      
      for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        vertices.push(new THREE.Vector3(x, y, 0));
      }
    }
    
    // For each pair of copies, find intersections between their line segments
    for (let i = 0; i < copies - 1; i++) {
      const copyA = actualCopies[i];
      const matrixA = copyA.matrix;
      
      // Get rotation from the actual object or its parent
      let rotationA = 0;
      if (copyA.userData && copyA.userData.angle !== undefined) {
        // Convert from degrees to radians if needed
        rotationA = (copyA.userData.angle * Math.PI) / 180;
      } else if (copyA.rotation && copyA.rotation.z !== undefined) {
        rotationA = copyA.rotation.z;
      } else if (copyA.parent && copyA.parent.rotation && copyA.parent.rotation.z !== undefined) {
        rotationA = copyA.parent.rotation.z;
      }
      
      for (let j = i + 1; j < copies; j++) {
        const copyB = actualCopies[j];
        const matrixB = copyB.matrix;
        
        // Get rotation from the actual object or its parent
        let rotationB = 0;
        if (copyB.userData && copyB.userData.angle !== undefined) {
          // Convert from degrees to radians if needed
          rotationB = (copyB.userData.angle * Math.PI) / 180;
        } else if (copyB.rotation && copyB.rotation.z !== undefined) {
          rotationB = copyB.rotation.z;
        } else if (copyB.parent && copyB.parent.rotation && copyB.parent.rotation.z !== undefined) {
          rotationB = copyB.parent.rotation.z;
        }
        
        // Debug the matrices occasionally to avoid flooding the console
        if (i === 0 && j === 1) {
          console.log(`Checking intersections between copies ${i} and ${j}`);
          console.log(`Copy ${i} rotation:`, rotationA);
          console.log(`Copy ${j} rotation:`, rotationB);
          console.log(`Copy ${i} matrix:`, copyA.matrix.elements);
          console.log(`Copy ${j} matrix:`, copyB.matrix.elements);
          
          // Make sure the rotations are different
          if (Math.abs(rotationA - rotationB) < 0.001) {
            console.warn(`Warning: Copies ${i} and ${j} have the same rotation, unlikely to find intersections`);
          }
        }
        
        // Transform vertices to get actual positions for both copies
        const verticesA = [];
        const verticesB = [];

        // Get base positions from the geometry
        const positionsA = copyA.geometry?.getAttribute('position');
        const positionsB = copyB.geometry?.getAttribute('position');

        if (!positionsA || !positionsB) {
          console.warn("Missing position attributes for intersection calculation");
          continue;
        }

        // Get the world matrices - these need to include the group rotation
        const worldMatrixA = new THREE.Matrix4();
        const worldMatrixB = new THREE.Matrix4();

        // We need to start with the object's own scale and position
        copyA.updateMatrix();
        copyB.updateMatrix();
        worldMatrixA.copy(copyA.matrix);
        worldMatrixB.copy(copyB.matrix);

        // Then include parent transformations (especially rotation)
        if (copyA.parent) {
          const parentMatrixA = new THREE.Matrix4();
          // Only take the rotation part of the parent matrix
          parentMatrixA.makeRotationFromEuler(copyA.parent.rotation);
          worldMatrixA.multiply(parentMatrixA);
        }

        if (copyB.parent) {
          const parentMatrixB = new THREE.Matrix4();
          // Only take the rotation part of the parent matrix
          parentMatrixB.makeRotationFromEuler(copyB.parent.rotation);
          worldMatrixB.multiply(parentMatrixB);
        }

        // Log matrix and rotation values
        if (i === 0 && j === 1) {
          console.log(`Copy ${i} world matrix:`, worldMatrixA.elements);
          console.log(`Copy ${j} world matrix:`, worldMatrixB.elements);
          console.log(`Copy ${i} parent rotation:`, copyA.parent ? copyA.parent.rotation.z : "no parent");
          console.log(`Copy ${j} parent rotation:`, copyB.parent ? copyB.parent.rotation.z : "no parent");
        }

        // Create vertices with proper world positions
        for (let v = 0; v < positionsA.count; v++) {
          const vertex = new THREE.Vector3(
            positionsA.array[v * 3],
            positionsA.array[v * 3 + 1],
            positionsA.array[v * 3 + 2]
          );
          // Apply the full transformation matrix
          vertex.applyMatrix4(worldMatrixA);
          verticesA.push(vertex);
        }

        for (let v = 0; v < positionsB.count; v++) {
          const vertex = new THREE.Vector3(
            positionsB.array[v * 3],
            positionsB.array[v * 3 + 1],
            positionsB.array[v * 3 + 2]
          );
          // Apply the full transformation matrix
          vertex.applyMatrix4(worldMatrixB);
          verticesB.push(vertex);
        }

        // Log vertex count occasionally
        if (i === 0 && j === 1) {
          console.log(`Copy ${i} vertices:`, verticesA.length);
          console.log(`Copy ${j} vertices:`, verticesB.length);
          
          // Debug the first few vertices of each copy
          console.log(`Copy ${i} first vertex:`, verticesA[0]);
          console.log(`Copy ${j} first vertex:`, verticesB[0]);
        }
        
        // Check intersections between all line segments
        for (let a = 0; a < verticesA.length; a++) {
          const a1 = verticesA[a];
          const a2 = verticesA[(a + 1) % verticesA.length];
          
          for (let b = 0; b < verticesB.length; b++) {
            const b1 = verticesB[b];
            const b2 = verticesB[(b + 1) % verticesB.length];
            
            // Find intersection between line segments
            const intersection = findIntersection(a1, a2, b1, b2);
            
            // If an intersection was found, check if it's a duplicate before adding
            if (intersection) {
              // Debug about once every 10 intersections
              if (Math.random() < 0.1) {
                console.log(`Found potential intersection at (${intersection.x.toFixed(2)}, ${intersection.y.toFixed(2)})`);
              }
              
              // Only add if not too close to any existing intersection point
              if (!isPointTooClose(intersection, intersectionPoints)) {
                // Extra validation - make sure the point isn't too close to any vertex
                let tooCloseToVertex = false;
                for (const vertices of [verticesA, verticesB]) {
                  for (const vertex of vertices) {
                    const dx = vertex.x - intersection.x;
                    const dy = vertex.y - intersection.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < INTERSECTION_MERGE_THRESHOLD * 1.5) {
                      tooCloseToVertex = true;
                      console.log(`Skipping intersection too close to vertex: (${intersection.x.toFixed(2)}, ${intersection.y.toFixed(2)})`);
                      break;
                    }
                  }
                  if (tooCloseToVertex) break;
                }
                
                if (!tooCloseToVertex) {
                  intersectionPoints.push(intersection);
                }
              }
            }
          }
        }
      }
    }
  }
  
  if (debug && useStarCuts) {
    
  }
  
  console.log("findAllIntersections - found intersection points:", intersectionPoints.length);
  return intersectionPoints;
}

/**
 * Process intersections for a specific layer
 * @param {Layer} layer The layer to process intersections for
 * @returns {boolean} True if intersections were processed
 */
export function processIntersections(layer) {
  console.log(`processIntersections called with layer: ${layer.id}`);
  
  // Skip if layer state doesn't exist
  if (!layer.state) {
    console.log("Skipping intersection processing - layer state not found");
    return false;
  }
  
  // Extract state
  const { useIntersections, useStars, useCuts, needsIntersectionUpdate, copies } = layer.state;
  
  console.log(`processIntersections - useIntersections: ${useIntersections} needsIntersectionUpdate: ${needsIntersectionUpdate}`);
  
  // IMPORTANT: Always reset the needsIntersectionUpdate flag regardless of other conditions
  // This prevents continuous checking when intersections are disabled
  layer.state.needsIntersectionUpdate = false;
  
  // CRITICAL: Skip all processing when copies is 0 or undefined
  if (!copies || copies <= 0) {
    console.log(`Skipping intersection processing - copies is ${copies}`);
    
    // Clear any existing intersection points to prevent stale data
    if (layer.intersectionPoints && layer.intersectionPoints.length > 0) {
      console.log(`Clearing ${layer.intersectionPoints.length} stale intersection points because copies is 0`);
      layer.intersectionPoints = [];
      layer.state.intersectionPoints = [];
    }
    
    return false;
  }
  
  // Only process if both features are enabled and update is needed
  const useStarCuts = useStars && useCuts && layer.state.starSkip > 1;
  
  if ((!useIntersections && !useStarCuts) || !needsIntersectionUpdate) {
    console.log("Skipping intersection processing - conditions not met");
    return false;
  }
  
  // Find intersection points for this layer
  const intersectionPoints = findAllIntersections(layer);
  
  // Store intersection points in the layer
  layer.intersectionPoints = intersectionPoints;
  layer.state.intersectionPoints = intersectionPoints;
  
  console.log(`Layer intersectionPoints updated with ${intersectionPoints.length} points`);
  
  // Set flag indicating we just calculated intersections
  layer.state.justCalculatedIntersections = true;
  
  return true;
}

/**
 * Create visualization markers for intersection points
 * @param {THREE.Scene} scene The scene
 * @param {Layer} layer Layer object containing intersection points
 */
export function createIntersectionMarkers(scene, layer) {
  console.log("createIntersectionMarkers called - scene:", !!scene, "layer:", layer?.id);
  
  if (!scene || !layer) {
    console.warn("Cannot create intersection markers - missing scene or layer");
    return;
  }
  
  // CRITICAL: Skip all marker creation when copies is 0 or undefined
  if (!layer.state?.copies || layer.state.copies <= 0) {
    console.log(`Skipping marker creation - copies is ${layer.state?.copies}`);
    
    // Make sure any existing markers are removed
    layer.clearIntersections();
    
    // Clear any stale intersection points
    if (layer.intersectionPoints && layer.intersectionPoints.length > 0) {
      console.log(`Clearing ${layer.intersectionPoints.length} stale intersection points because copies is 0`);
      layer.intersectionPoints = [];
      
      if (layer.state) {
        layer.state.intersectionPoints = [];
      }
    }
    
    return;
  }
  
  // Verify that intersections are enabled
  const useIntersections = layer.state?.useIntersections === true;
  const useStarCuts = layer.state?.useStars === true && 
                     layer.state?.useCuts === true && 
                     layer.state?.starSkip > 1;
                     
  if (!useIntersections && !useStarCuts) {
    console.log("Skipping marker creation - intersections disabled");
    // Make sure any existing markers are removed
    layer.clearIntersections();
    return;
  }
  
  // Validate intersection points exist and have valid length
  if (!layer.intersectionPoints) {
    console.warn("Cannot create intersection markers - no intersectionPoints array");
    return;
  }
  
  const validPoints = layer.intersectionPoints.filter(p => 
    p && typeof p.x === 'number' && typeof p.y === 'number' && !isNaN(p.x) && !isNaN(p.y)
  );
  
  console.log("Creating markers for", validPoints.length, "valid intersection points out of", 
              layer.intersectionPoints.length, "total points");
  
  if (validPoints.length === 0) {
    console.warn("No valid intersection points to create markers for");
    return;
  }
  
  // Clear any existing intersection markers in this layer
  layer.clearIntersections();
  
  // Create an intersection marker group for this layer
  const markersGroup = new THREE.Group();
  markersGroup.name = `intersections-layer-${layer.id}`;
  markersGroup.userData.isIntersectionGroup = true;
  markersGroup.userData.layerId = layer.id;
  
  // Make sure the group is visible
  markersGroup.visible = true;
  
  // Set high renderOrder to ensure it appears on top of other geometry
  markersGroup.renderOrder = 1000;
  
  // Add to layer group
  if (layer.group) {
    layer.group.add(markersGroup);
    console.log("Added markers group to layer group");
    
    // DEBUG: Log the layer group's children to verify addition
    console.log(`Layer group now has ${layer.group.children.length} children`);
    console.log(`Marker group parent is:`, markersGroup.parent === layer.group ? 'correct' : 'WRONG!');
    
    // Store a reference to the marker group on the layer for easy access
    layer.markersGroup = markersGroup;
  } else {
    scene.add(markersGroup);
    console.log("Added markers group directly to scene");
    
    // DEBUG: Log scene children
    console.log(`Scene now has ${scene.children.length} children`);
    console.log(`Marker group parent is:`, markersGroup.parent === scene ? 'correct' : 'WRONG!');
    
    // Store a reference even when added to scene
    layer.markersGroup = markersGroup;
  }
  
  // Create shared resources
  // Make intersection points larger and more visible
  const pointSize = INTERSECTION_POINT_SIZE * 5; // Make points 5x larger for better visibility
  console.log(`Creating circle geometry with size: ${pointSize}`);
  const circleGeometry = new THREE.CircleGeometry(pointSize, 32); // More segments for smoother circles
  
  // Use the layer's color instead of a fixed color
  const markerColor = layer.color ? layer.color.clone() : new THREE.Color(INTERSECTION_POINT_COLOR);
  
  // Make intersection markers brighter than the layer color
  markerColor.multiplyScalar(1.5);
  
  // Debug the intersection points
  console.log(`Intersection points to create markers for:`, 
              validPoints.length, 
              `First point:`, 
              validPoints[0] ? 
                `x: ${validPoints[0].x.toFixed(2)}, y: ${validPoints[0].y.toFixed(2)}` : 
                'undefined');
  
  let markerCount = 0;
  
  // IMPORTANT: Initialize or clear the layer's markers array for audio triggers
  if (!layer.markers) {
    layer.markers = [];
  } else {
    // Keep only non-intersection markers
    layer.markers = layer.markers.filter(m => !m.isIntersection);
  }
  
  console.log(`Layer markers array initialized with ${layer.markers.length} non-intersection markers`);
  
  // Create markers for each valid intersection point
  for (let i = 0; i < validPoints.length; i++) {
    const point = validPoints[i];
    
    // Create material for this marker with improved visibility
    const intersectionMaterial = new THREE.MeshBasicMaterial({
      color: markerColor,
      transparent: true,
      opacity: 1.0, // Full opacity for better visibility
      depthTest: false, // Disable depth testing to ensure visibility
      depthWrite: false,
      side: THREE.DoubleSide, // Show both sides of the circle
      fog: false, // Ignore scene fog for consistent visibility
      toneMapped: false // Disable tone mapping for brighter appearance
    });
    
    // Create the marker mesh
    const marker = new THREE.Mesh(circleGeometry, intersectionMaterial);
    
    // Set the position with a much larger z-offset to ensure it's well above other geometry
    marker.position.set(point.x, point.y, 10.0); // Increased from 1.0 to 10.0
    
    // Set extra high renderOrder to ensure it appears on top of everything
    marker.renderOrder = 5000;
    
    // MODIFIED: Use both layers 0 and 1 to ensure visibility
    // First, clear any existing layers
    marker.layers.set(0); // Reset to default layer
    // Then enable layer 1 as well
    marker.layers.enable(1);
    
    // Add metadata to the marker
    marker.userData.isIntersectionMarker = true;
    marker.userData.layerId = layer.id;
    marker.userData.intersectionIndex = i;
    marker.visible = true; // Explicitly set visible
    
    // Add to the markers group
    markersGroup.add(marker);
    markerCount++;
    
    // IMPORTANT: Create an audio trigger marker for this intersection point
    const audioMarker = {
      position: point.clone(),
      velocity: 0,
      lifetime: MARK_LIFE,
      animState: ANIMATION_STATES.ACTIVE,
      justHit: false,
      frequency: calculateFrequencyForPoint(point, layer.state),
      pan: calculatePanForPoint(point),
      layerId: layer.id,
      isIntersection: true, // Mark as intersection point
      intersectionIndex: i,
      created: Date.now()
    };
    
    // Add to layer's markers array for audio triggering
    layer.markers.push(audioMarker);
    
    // Log occasionally to avoid console spam
    if (i === 0 || i === validPoints.length - 1 || i % 10 === 0) {
      console.log(`Created marker ${i+1}/${validPoints.length} at position:`, 
                  point.x.toFixed(2), point.y.toFixed(2), "z-offset: 10.0");
    }
  }
  
  console.log(`Created ${markerCount} intersection markers out of ${validPoints.length} valid points`);
  console.log(`Added ${markerCount} audio trigger markers to layer.markers (total: ${layer.markers.length})`);
  
  // DEBUG: Verify the marker group has the correct number of children
  console.log(`Marker group has ${markersGroup.children.length} children (should be ${markerCount})`);
  console.log(`Marker group visible:`, markersGroup.visible);
  
  // IMPORTANT: Ensure camera can see this layer
  if (markersGroup.children.length > 0) {
    // Ensure the markers are in the camera's visible layers
    if (scene.userData && scene.userData.camera) {
      const camera = scene.userData.camera;
      // Make sure camera can see layer 1
      camera.layers.enable(1);
      console.log("Enabled layer 1 on camera for marker visibility");
    }
  }
  
  return markersGroup; // Return the created group for reference
}

/**
 * Detect intersections for a specific layer
 * @param {Layer} layer The layer to detect intersections for
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
  
  // Check if intersections need updating
  if (layer.needsIntersectionUpdate) {
    // Process intersections
    processIntersections(layer);
  }
  
  // Get the current markers array or create a new one
  if (!layer.markers) {
    layer.markers = [];
  }
  
  // Process any existing markers first
  const existingMarkers = layer.markers.filter(m => 
    m.animState !== ANIMATION_STATES.EXPIRED
  );
  
  // Create markers for new intersections
  for (const intersection of layer.intersectionPoints) {
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
        pan: calculatePanForPoint(intersection),
        layerId: layer.id
      };
      layer.markers.push(marker);
    }
  }
  
  return layer.intersectionPoints;
}

/**
 * Apply velocity updates to markers
 * @param {Layer} layer The layer containing markers
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
 * @param {Layer} layer The layer containing the marker
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