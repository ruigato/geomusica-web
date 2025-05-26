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
import { findAllIntersections, processIntersections } from './intersections.js';
import { createOrUpdateLabel } from '../ui/domLabels.js';
// Import the frequency utilities at the top of geometry.js
import { quantizeToEqualTemperament, getNoteName } from '../audio/frequencyUtils.js';
import { createNote } from '../notes/notes.js';
// Import the star cuts calculation function
import { calculateStarCutsVertices, hasStarSelfIntersections, createStarPolygonPoints, createRegularStarPolygonPoints } from './starCuts.js';

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
 * Create a polygon geometry with the given parameters
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
  switch (shapeType) {
    case 'star':
      points = createStarPolygonPointsLocal(radius, segments, state?.starSkip || 1, state);
      break;
    case 'euclidean':
      points = createEuclideanPoints(radius, segments, state?.euclidValue || 3, state);
      break;
    case 'fractal':
      points = createFractalPolygonPoints(radius, segments, state?.fractalValue || 1, state);
      break;
    case 'regular':
    default:
      // Handle star polygon creation even in regular mode if useStars is enabled
      if (state?.useStars && state?.starSkip > 1) {
        points = createStarPolygonPointsLocal(radius, segments, state.starSkip, state);
      } else {
        points = createRegularPolygonPoints(radius, segments, state);
      }
      break;
  }

  // Step 2: Apply fractal subdivision if enabled
  // Skip if we already created a fractal shape or if fractal is disabled
  if (state?.useFractal && state?.fractalValue > 1 && shapeType !== 'fractal') {
    points = applyFractalSubdivision(points, state.fractalValue);
  }

  // Step 3: Add star cuts if enabled
  // Only add cuts for star polygons when explicitly enabled
  if (state?.useStars && state?.useCuts && state?.starSkip > 1) {
    const originalVertexCount = points.length;
    const intersectionPoints = calculateStarCutsVertices(points, state.starSkip);
    
    if (intersectionPoints.length > 0) {
      points = [...points, ...intersectionPoints];
    }
  }

  // Step 4: Create geometry from final points
  const geometry = createGeometryFromPoints(points, state);

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
    type: state?.useStars && state?.starSkip > 1 ? 'star' : shapeType,
    baseVertexCount: segments,
    totalVertexCount: points.length,
    hasIntersections: state?.useStars && state?.useCuts && state?.starSkip > 1,
    starSkip: state?.starSkip,
    fractalLevel: state?.useFractal ? state.fractalValue : 1
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
 * @returns {THREE.BufferGeometry} The created geometry
 */
function createGeometryFromPoints(points, state) {
  // Create geometry
  const geometry = new THREE.BufferGeometry();
  
  // For star patterns, we need to create a custom indexed geometry
  if (state?.useStars && state?.starSkip > 1 && points.length >= 3) {
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
    for (let i = 0; i < baseVertexCount; i++) {
      const startIdx = i;
      const endIdx = (i + skip) % baseVertexCount;
      indices.push(startIdx, endIdx);
    }
    
    // Set the attributes
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
  } else {
    // Standard non-indexed geometry for regular polygons
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
  if (state?.useStars && state?.starSkip > 1) {
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
  
  // Account for intersection points if needed
  if ((state.useIntersections || (state.useStars && state.useCuts)) && state.intersectionPoints && state.intersectionPoints.length > 0) {
    for (const point of state.intersectionPoints) {
      const dist = Math.hypot(point.x, point.y);
      maxDistance = Math.max(maxDistance, dist * 1.1); // Add 10% margin
    }
  }
  
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
  
  // Clean up the marker group in the scene
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
  
  // Clean up any marker groups in child objects
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

  // Check if we're using star cuts
  const useStarCuts = state && state.useStars && state.useCuts && state.starSkip > 1;
  
  // Force intersection update when star cuts are enabled
  if (useStarCuts && state) {
    state.needsIntersectionUpdate = true;
    // Process the intersections for star cuts
    processIntersections(state, baseGeo, group);
    justCalculatedIntersections = true;
  }
  
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
      
      // Store intersection marker groups separately
      if (child.userData && child.userData.isIntersectionGroup) {
        debugObjects.push(child);
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
    
    // Now create the actual polygon copies for display
    for (let i = 0; i < copies; i++) {
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
      

      
      // Each copy gets a cumulative angle (i * angle) in degrees
      const cumulativeAngleDegrees = i * angle;
      
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
      
      // Get the positions from the geometry
      const positions = baseGeo.getAttribute('position').array;
      const count = baseGeo.getAttribute('position').count;
      
      // For star polygons, add the original vertices information to userData to help with triggers
      if (isStarPolygon && baseGeo.index) {
        // Store the original vertex indices to help with trigger detection
        const originalVertexIndices = [];
        for (let v = 0; v < count; v++) {
          // For vertices up to the base vertex count, they're part of the star polygon
          if (v < state?.segments) {
            originalVertexIndices.push(v);
          }
        }
        // Store in the copyGroup's userData for trigger detection
        copyGroup.userData.originalVertexIndices = originalVertexIndices;
        copyGroup.userData.isStarPolygon = true;
        copyGroup.userData.starSkip = state?.starSkip || 1;
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
          isIntersection: false,
          globalIndex: globalVertexIndex
        };
        
        // For star polygons, mark if this is a base vertex or intersection point
        if (isStarPolygon) {
          triggerData.isBaseVertex = v < state?.segments;
          triggerData.isIntersection = v >= state?.segments;
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
        
        // Create material with opacity based on velocity
        const vertexCircleMaterial = new THREE.MeshBasicMaterial({ 
          color: mat && mat.color ? mat.color : VERTEX_CIRCLE_COLOR,
          transparent: true,
          opacity: note.velocity, 
          depthTest: false,
          side: THREE.DoubleSide // Render both sides for better visibility
        });
        
        // Store trigger data with the material for audio trigger detection
        vertexCircleMaterial.userData = {
          ...triggerData,
          note: note
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
        
        // Add to the copy group
        copyGroup.add(vertexCircle);
        
        // Add persistent frequency label if enabled
        if (shouldCreatePointLabels && camera && renderer) {
          try {
            // Calculate frequency for this vertex
            const freq = Math.hypot(x, y);
            
            // Format display text
            let labelText;
            if (state.useEqualTemperament && note.noteName) {
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
      
      // FIXED: After creating a copy, add intersection markers to ALL copies, not just the first one
      if (state && state.intersectionPoints && state.intersectionPoints.length > 0 &&
          (state.useIntersections || useStarCuts) && !isLerping) {
        try {
          // Create a group to hold the intersection markers
          const intersectionMarkerGroup = new THREE.Group();
          
          // Tag this group for identification during audio triggers
          intersectionMarkerGroup.userData.isIntersectionGroup = true;
          
          // Add visual representation for each intersection point
          for (let j = 0; j < state.intersectionPoints.length; j++) {
            const point = state.intersectionPoints[j];
            
            // IMPORTANT: Apply the same modulus scaling to intersection points
            // This ensures star cuts scale with the polygon when modulus is used
            let scaledX = point.x * finalScale;
            let scaledY = point.y * finalScale;
            
            // Create trigger data for this intersection point
            const triggerData = {
              x: scaledX,
              y: scaledY,
              isIntersection: true,
              intersectionIndex: j,
              globalIndex: globalVertexIndex
            };
            
            // Increment the global vertex index
            globalVertexIndex++;
            
            // Create a note object to get duration and velocity parameters
            const note = createNote(triggerData, state);
            
            // Calculate size factors for this intersection marker
            const basePointSize = useStarCuts ? INTERSECTION_POINT_SIZE * 1.5 : INTERSECTION_POINT_SIZE;
            const durationScaleFactor = 0.5 + note.duration;
            
            // Size that remains visually consistent at different camera distances
            // Make star intersection points larger for better visibility
            const sizeMultiplier = useStarCuts ? 0.5 : 0.3;
            const sizeScaleFactor = (cameraDistance / 1000) * basePointSize * durationScaleFactor * sizeMultiplier;
            
            // Create material for intersection point - use brighter color for star cuts
            const intersectionMaterial = new THREE.MeshBasicMaterial({
              // Use the layer's color with higher brightness for intersections
              color: useStarCuts ? 
                (mat && mat.color ? mat.color.clone().multiplyScalar(1.8) : 0xffff00) : 
                (mat && mat.color ? mat.color.clone().multiplyScalar(1.2) : INTERSECTION_POINT_COLOR),
              transparent: true,
              opacity: useStarCuts ? 0.9 : note.velocity,
              depthTest: false,
              side: THREE.DoubleSide
            });
            
            // FIXED: Track created materials for proper disposal
            materialsToDispose.push(intersectionMaterial);
            
            // Create a mesh for the intersection point using shared geometry
            const pointMesh = new THREE.Mesh(vertexCircleGeometry, intersectionMaterial);
            
            pointMesh.scale.set(sizeScaleFactor, sizeScaleFactor, 1);
            // IMPORTANT: Use scaled coordinates for intersection points
            pointMesh.position.set(scaledX, scaledY, 0);
            
            // Set renderOrder higher to ensure it renders on top
            pointMesh.renderOrder = 2; // Even higher render order for intersections
            
            // Add to the intersection marker group
            intersectionMarkerGroup.add(pointMesh);
            
            // Add persistent frequency label for intersection point if enabled
            if (shouldCreatePointLabels && camera && renderer) {
              try {
                // Calculate frequency for this intersection point
                const freq = Math.hypot(scaledX, scaledY);
                
                // Format display text
                let labelText;
                if (state.useEqualTemperament && note.noteName) {
                  labelText = `${freq.toFixed(1)}Hz (${note.noteName}) ${note.duration.toFixed(2)}s`;
                } else {
                  labelText = `${freq.toFixed(2)}Hz ${note.duration.toFixed(2)}s`;
                }
                
                // Create a text label for this intersection point
                const textLabel = createTextLabel(
                  labelText, 
                  new THREE.Vector3(scaledX, scaledY, 0), 
                  intersectionMarkerGroup, // Parent is not really used for DOM labels
                  false, // Not an axis label
                  camera,
                  renderer
                );
                
                // Update the label immediately
                textLabel.update(camera, renderer);
                
                // Store reference for cleanup
                const labelInfo = {
                  label: textLabel,
                  isIntersection: true,
                  position: new THREE.Vector3(scaledX, scaledY, 0)
                };
                
                state.pointFreqLabels.push(labelInfo);
                pointFreqLabelsCreated.push(labelInfo);
              } catch (labelError) {
                
                // Continue processing other intersection points
              }
            }
          }
          
          // Add the whole marker group to the copy group to apply proper rotation
          copyGroup.add(intersectionMarkerGroup);
          
          // Store reference to the intersection marker group
          copyGroup.userData.intersectionMarkerGroup = intersectionMarkerGroup;
        } catch (intersectionError) {
          console.error("Error creating intersection markers:", intersectionError);
          // Continue execution even if intersection markers fail
        }
      }
    }
    
    // After all copies are created, restore debug objects
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