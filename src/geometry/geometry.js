// src/geometry/geometry.js - Performance-optimized with camera-independent sizing and fixed segments rounding
import * as THREE from 'three';
import { 
  VERTEX_CIRCLE_SIZE, 
  VERTEX_CIRCLE_OPACITY, 
  VERTEX_CIRCLE_COLOR,
  INTERSECTION_POINT_SIZE,
  INTERSECTION_POINT_COLOR,
  INTERSECTION_POINT_OPACITY,
  INTERSECTION_MERGE_THRESHOLD
} from '../config/constants.js';
import { findIntersection, findAllIntersections } from './intersections.js';
import { createOrUpdateLabel } from '../ui/domLabels.js';
// Import the frequency utilities at the top of geometry.js
import { quantizeToEqualTemperament, getNoteName } from '../audio/frequencyUtils.js';
import { createNote } from '../notes/notes.js';

// Debug flag to control logging
const DEBUG_LOGGING = false;

// Set to true to enable debugging for the star cuts feature
const DEBUG_STAR_CUTS = true;

// Counter to track the number of updateGroup calls
let updateGroupCallCounter = 0;

// Reuse geometries for better performance
const vertexCircleGeometry = new THREE.CircleGeometry(1, 12); // Fewer segments (12) for performance

/**
 * Create a polygon geometry with the given parameters
 * @param {number} radius Radius of the polygon
 * @param {number} segments Number of segments in the polygon
 * @param {Object} state Application state for additional parameters
 * @returns {THREE.BufferGeometry} The created geometry
 */
export function createPolygonGeometry(radius, segments, state = null) {
  console.log(`Creating polygon geometry: radius=${radius}, segments=${segments}, copies=${state.copies}`);
  
  // Standardize inputs
  const r = Number(radius) || 100;
  const sides = Math.max(2, Math.floor(Number(segments)) || 3);
  
  // Create a buffer geometry
  const geometry = new THREE.BufferGeometry();
  
  // Ensure we have valid inputs
  radius = radius || 300;
  segments = segments || 2;
  
  // Add this for debugging to track when we're creating new geometry
  const layerId = state && state.layerId !== undefined ? state.layerId : 'unknown';
  
  // Get the specific shape type from state if available
  const shapeType = state?.shapeType || 'regular';
  
  // More verbose debugging for star shapes
  if (DEBUG_STAR_CUTS && state?.useStars) {
    
  } else if (DEBUG_LOGGING) {
    
  }
  
  // Create base points based on shape type
  let points;
  
  // Handle different shape types
  switch (shapeType) {
    case 'star':
      // Create a star polygon
      if (DEBUG_STAR_CUTS) {
        
      }
      
      points = createStarPolygonPoints(radius, segments, state?.starSkip || 1, state);
      if (DEBUG_STAR_CUTS) {
        
      }
      break;
      
    case 'fractal':
      // Create a fractal-like shape
      if (DEBUG_LOGGING) {
        
      }
      points = createFractalPolygonPoints(radius, segments, state?.fractalValue || 1, state);
      break;
      
    case 'euclidean':
      // Create a polygon with Euclidean rhythm
      if (DEBUG_LOGGING) {
        
      }
      points = createEuclideanPoints(radius, segments, state?.euclidValue || 3, state);
      break;
      
    case 'regular':
    default:
      // When useStars is true but shapeType is not 'star', override to create a star
      if (state?.useStars && state?.starSkip > 1) {
        if (DEBUG_STAR_CUTS) {
          
        }
        points = createStarPolygonPoints(radius, segments, state.starSkip, state);
      } else {
        // Create a regular polygon
        points = createRegularPolygonPoints(radius, segments, state);
      }
      break;
  }
  
  // Calculate intersections if needed and available from state
  let intersectionPoints = [];
  
  // Only calculate intersections if there are multiple copies and either
  // state.useIntersections is true OR we're using star cuts
  const useIntersections = state?.useIntersections === true;
  const useStarCuts = state?.useStars === true && state?.useCuts === true && state?.starSkip > 1;
  
  if ((useIntersections || useStarCuts) && state?.copies > 1) {
    console.log(`Calculating intersections: useIntersections=${useIntersections}, useStarCuts=${useStarCuts}`);
    // First, create transformed copies of the base polygon with all rotations applied
    const copyPolygons = [];
    
    for (let i = 0; i < state.copies; i++) {
      // Calculate scale factor
      let scaleFactor = Math.pow(state.stepScale || 1.05, i);
      
      // Apply modulus scaling if enabled
      if (state.useModulus) {
        const modulusScale = state.getScaleFactorForCopy ? state.getScaleFactorForCopy(i) : 1.0;
        scaleFactor = modulusScale * scaleFactor;
      }
      // Apply alt scale if enabled
      else if (state.useAltScale && ((i + 1) % state.altStepN === 0)) {
        scaleFactor = scaleFactor * state.altScale;
      }
      
      // Each copy gets a cumulative angle in radians
      const cumulativeAngle = i * ((state.rotation || 0) * Math.PI / 180);
      
      // Calculate transformed points for this copy
      const transformedPoints = calculateCopyPositions(points, scaleFactor, cumulativeAngle);
      
      // Add to copy polygons array
      copyPolygons.push(transformedPoints);
    }
    
    // Calculate intersections between all copies
    intersectionPoints = calculatePolygonIntersections(copyPolygons);
  }
  
  // Create geometry from points and intersections
  return createGeometryFromPoints(points, state, intersectionPoints);
}

/**
 * Create a regular polygon geometry
 * @param {number} radius Radius of the polygon
 * @param {number} segments Number of segments in the polygon
 * @param {Object} state Application state
 * @returns {THREE.BufferGeometry} The created geometry
 */
function createRegularPolygonGeometry(radius, segments, state = null) {
  // Get points for a regular polygon
  const points = createRegularPolygonPoints(radius, segments, state);
  
  // Create geometry from points
  return createGeometryFromPoints(points, state);
}

/**
 * Create geometry from an array of points
 * @param {Array<THREE.Vector2|THREE.Vector3>} points Array of 2D or 3D points
 * @param {Object} state Application state
 * @param {Array<THREE.Vector3>} intersectionPoints Optional array of intersection points to include
 * @returns {THREE.BufferGeometry} The created geometry
 */
function createGeometryFromPoints(points, state, intersectionPoints = []) {
  // Create geometry
  const geometry = new THREE.BufferGeometry();
  
  // Combine regular points with intersection points if provided
  const allPoints = [...points];
  
  // Add intersection points to the vertex array
  if (intersectionPoints && intersectionPoints.length > 0) {
    allPoints.push(...intersectionPoints);
  }
  
  // Convert points to Float32Array for position attribute
  const positionArray = new Float32Array(allPoints.length * 3);
  
  for (let i = 0; i < allPoints.length; i++) {
    positionArray[i * 3] = allPoints[i].x;
    positionArray[i * 3 + 1] = allPoints[i].y;
    positionArray[i * 3 + 2] = allPoints[i].z || 0; // Z-coordinate is 0 in 2D if not specified
  }
  
  // Set the position attribute
  geometry.setAttribute('position', new THREE.BufferAttribute(positionArray, 3));
  
  // For audio trigger detection - add the vertex count to the geometry userData
  if (geometry.userData === undefined) {
    geometry.userData = {};
  }
  
  // Set the layer ID in the geometry userData if available in state
  if (state && state.layerId !== undefined) {
    geometry.userData.layerId = state.layerId;
  }
  
  // Store number of vertices for use in trigger detection
  geometry.userData.vertexCount = allPoints.length;
  
  // Store metadata about which vertices are original vs intersections
  geometry.userData.originalVertexCount = points.length;
  geometry.userData.intersectionVertexCount = intersectionPoints.length;
  geometry.userData.hasIntersections = intersectionPoints.length > 0;
  
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
  const points = createStarPolygonPoints(radius, n, k, { useFractal, fractalValue, useCuts: false });
  
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
 * Create a text label for a position
 * @param {string} text - Text to display
 * @param {THREE.Vector3} position - Position to place label
 * @param {THREE.Object3D} parent - Parent object to attach label to
 * @param {boolean} isAxisLabel - Whether this is an axis label
 * @param {THREE.Camera} camera - Camera for perspective calculation
 * @param {THREE.WebGLRenderer} renderer - Renderer
 * @returns {Object} Created label object
 */
export function createTextLabel(text, position, parent, isAxisLabel = true, camera = null, renderer = null) {
  // For DOM-based labels, we don't actually create a Three.js object
  // Instead, we return an info object that can be used to update the DOM label
  
  // If the parent has a userData.state with equal temperament settings,
  // format the text accordingly
  let displayText = text;
  if (parent && parent.userData && parent.userData.state) {
    const state = parent.userData.state;
    if (state.useEqualTemperament && typeof text === 'number') {
      // Text is a frequency value
      const freq = text;
      const refFreq = state.referenceFrequency || 440;
      const quantizedFreq = quantizeToEqualTemperament(freq, refFreq);
      const noteName = getNoteName(quantizedFreq, refFreq);
      displayText = `${freq.toFixed(1)}Hz (${noteName})`;
    } else if (typeof text === 'number') {
      // Text is a frequency value but equal temperament is disabled
      displayText = `${text.toFixed(2)}Hz`;
    }
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
 * Update group based on state changes
 * @param {Object} options - Options object containing various parameters
 * @returns {THREE.Group} Updated group
 */
export function updateGroup(options = {}) {
  const { state, group, layer, scene } = options;
  
  // FIXED: Extract all needed parameters from options
  const { 
    copies = 0, 
    stepScale = 1, 
    baseGeo = null, 
    mat = null, 
    segments = 3,
    angle = 0,
    isLerping = false
  } = options;
  
  // Reduce excessive logging
  const DEBUG_LOGGING = false;
  
  // Only log parameters when debug logging is enabled
  if (DEBUG_LOGGING) {
    console.log(`updateGroup called with copies=${copies}, radius=${state?.radius}, segments=${segments}, angle=${angle}`);
    console.log(`State copies=${state?.copies}, radius=${state?.radius}, segments=${state?.segments}`);
  }
  
  if (!state || !group) {
    console.warn('Cannot update group: Invalid state or group');
    return;
  }
  
  // Use parameters passed to the function rather than reading from state where possible
  // This ensures that we're using the correct values each time updateGroup is called
  const copyCount = copies !== undefined ? copies : (state.copies || 1);
  const radiusValue = state.radius || 300; // Always use state for radius as it's not directly applied here
  const segmentCount = segments !== undefined ? segments : (state.segments || 3);
  const angleValue = angle !== undefined ? angle : (state.angle || 0);
  const stepScaleValue = stepScale !== undefined ? stepScale : (state.stepScale || 1);
  
  // Store previous values to detect actual changes
  if (!group.userData.previousValues) {
    group.userData.previousValues = {
      copies: copyCount,
      radius: radiusValue,
      segments: segmentCount,
      angle: angleValue,
      stepScale: stepScaleValue,
      // Add more state parameters that affect geometry
      useStars: state.useStars || false,
      starSkip: state.starSkip || 1,
      useFractal: state.useFractal || false,
      fractalValue: state.fractalValue || 1,
      useEuclid: state.useEuclid || false,
      euclidValue: state.euclidValue || 3,
      useModulus: state.useModulus || false,
      modulusValue: state.modulusValue || 5,
      useAltScale: state.useAltScale || false,
      altScale: state.altScale || 1.5,
      altStepN: state.altStepN || 2
    };
  }
  
  // Use epsilon values appropriate for each parameter type
  const EPSILON = {
    copies: 0.01,      // Integer, so any difference > 0.01 is significant
    radius: 0.5,       // Allow small differences in radius (0.5 units)
    segments: 0.01,    // Integer, so any difference > 0.01 is significant
    angle: 0.01,       // Small angle differences can be ignored (0.01 radians)
    stepScale: 0.001,  // Very small differences in scale can be ignored
    starSkip: 0.01,    // Integer
    fractalValue: 0.01, // Small fractional differences
    euclidValue: 0.01  // Integer
  };
  
  // Check if any parameters have meaningfully changed using appropriate epsilons
  const hasChanges = 
    Math.abs(group.userData.previousValues.copies - copyCount) > EPSILON.copies ||
    Math.abs(group.userData.previousValues.radius - radiusValue) > EPSILON.radius ||
    Math.abs(group.userData.previousValues.segments - segmentCount) > EPSILON.segments ||
    Math.abs(group.userData.previousValues.angle - angleValue) > EPSILON.angle ||
    Math.abs(group.userData.previousValues.stepScale - stepScaleValue) > EPSILON.stepScale ||
    group.userData.previousValues.useStars !== state.useStars ||
    (state.useStars && Math.abs(group.userData.previousValues.starSkip - state.starSkip) > EPSILON.starSkip) ||
    group.userData.previousValues.useFractal !== state.useFractal ||
    (state.useFractal && Math.abs(group.userData.previousValues.fractalValue - state.fractalValue) > EPSILON.fractalValue) ||
    group.userData.previousValues.useEuclid !== state.useEuclid ||
    (state.useEuclid && Math.abs(group.userData.previousValues.euclidValue - state.euclidValue) > EPSILON.euclidValue) ||
    group.userData.previousValues.useModulus !== state.useModulus ||
    group.userData.previousValues.useAltScale !== state.useAltScale ||
    (state.useAltScale && group.userData.previousValues.altScale !== state.altScale) ||
    (state.useAltScale && group.userData.previousValues.altStepN !== state.altStepN);
  
  // Also check if we need to update due to a special condition
  const needsSpecialUpdate = isLerping || state.needsIntersectionUpdate;
    
  // If nothing has changed, we can avoid a lot of unnecessary work
  if (!hasChanges && !needsSpecialUpdate && group.children.length > 0) {
    if (DEBUG_LOGGING) {
      console.log("No meaningful parameter changes detected, skipping geometry update");
    }
    return;
  }
  
  if (DEBUG_LOGGING && hasChanges) {
    // Log which specific parameters have changed
    const changes = [];
    if (Math.abs(group.userData.previousValues.copies - copyCount) > EPSILON.copies) 
      changes.push(`copies: ${group.userData.previousValues.copies} -> ${copyCount}`);
    if (Math.abs(group.userData.previousValues.radius - radiusValue) > EPSILON.radius)
      changes.push(`radius: ${group.userData.previousValues.radius} -> ${radiusValue}`);
    if (Math.abs(group.userData.previousValues.segments - segmentCount) > EPSILON.segments)
      changes.push(`segments: ${group.userData.previousValues.segments} -> ${segmentCount}`);
    if (Math.abs(group.userData.previousValues.stepScale - stepScaleValue) > EPSILON.stepScale)
      changes.push(`stepScale: ${group.userData.previousValues.stepScale} -> ${stepScaleValue}`);
    if (group.userData.previousValues.useStars !== state.useStars)
      changes.push(`useStars: ${group.userData.previousValues.useStars} -> ${state.useStars}`);
    
    console.log(`Parameters changed: ${changes.join(', ')}`);
  }
  
  // Update the stored previous values
  group.userData.previousValues = {
    copies: copyCount,
    radius: radiusValue,
    segments: segmentCount,
    angle: angleValue,
    stepScale: stepScaleValue,
    useStars: state.useStars || false,
    starSkip: state.starSkip || 1,
    useFractal: state.useFractal || false,
    fractalValue: state.fractalValue || 1,
    useEuclid: state.useEuclid || false,
    euclidValue: state.euclidValue || 3,
    useModulus: state.useModulus || false,
    modulusValue: state.modulusValue || 5,
    useAltScale: state.useAltScale || false,
    altScale: state.altScale || 1.5,
    altStepN: state.altStepN || 2
  };
  
  // Process intersections if needed
  if (layer && state.needsIntersectionUpdate) {
    if (DEBUG_LOGGING) {
      console.log("updateGroup - Processing intersections for layer:", layer.id);
      console.log("Layer state:", {
        useIntersections: state.useIntersections,
        useStars: state.useStars,
        useCuts: state.useCuts,
        needsIntersectionUpdate: state.needsIntersectionUpdate
      });
    }
    
    // CRITICAL: Skip intersection processing entirely when copies is 0
    if (!state.copies || state.copies <= 0) {
      if (DEBUG_LOGGING) {
        console.log(`updateGroup - Skipping intersection processing because copies is ${state.copies}`);
      }
      state.needsIntersectionUpdate = false;
      
      // Clear any existing intersections
      if (layer && typeof layer.clearIntersections === 'function') {
        if (DEBUG_LOGGING && options.useStarCuts) {
          console.log("Calling layer.clearIntersections in updateGroup");
        }
        layer.clearIntersections();
      }
    }
  }
  
  // Get justCalculatedIntersections from layer or group userData if available and not provided
  if (!options.justCalculatedIntersections) {
    if (layer && layer.group && layer.group.userData) {
      options.justCalculatedIntersections = layer.group.userData.justCalculatedIntersections || false;
      // Reset the flag after reading it
      layer.group.userData.justCalculatedIntersections = false;
    } else if (group.userData && group.userData.justCalculatedIntersections) {
      options.justCalculatedIntersections = group.userData.justCalculatedIntersections;
      // Reset the flag after reading it
      group.userData.justCalculatedIntersections = false;
    }
    
    if (DEBUG_STAR_CUTS && options.useStarCuts) {
      
    }
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
    if (copyCount <= 0) {
      // Make the group invisible when no copies
      group.visible = false;
      
      // Restore debug objects
      for (const debugObj of debugObjects) {
        group.add(debugObj);
      }
      
      console.log(`No copies (${copyCount}), making group invisible`);
      return;
    }
    
    // Ensure we're using the copies parameter passed to the function, not from state
    const copiesCount = copyCount > 0 ? copyCount : (state?.copies > 0 ? state.copies : 1);
    console.log(`Using copiesCount=${copiesCount} (from copies=${copyCount}, state.copies=${state?.copies})`);
    
    // Make sure the group is visible
    group.visible = true;
    
    // Increment the call counter
    updateGroupCallCounter++;
    
    // Ensure segments is a proper integer
    const numSegments = Math.round(segmentCount);
    
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
    for (let i = 0; i < copiesCount; i++) {
      // Base scale factor from step scale
      let stepScaleFactor = Math.pow(stepScaleValue, i);
      
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
      const cumulativeAngleDegrees = i * angleValue;
      
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
      
      // Create line loop with the enhanced material
      const lines = new THREE.LineLoop(baseGeo, lineMaterial);
      lines.scale.set(finalScale, finalScale, 1);
      
      // Mark as a polygon copy for intersection detection
      lines.userData = {
        isCopy: true,
        copyIndex: i,
        layerId: state?.layerId || layer?.id || 0,
        finalScale: finalScale,
        angle: cumulativeAngleDegrees // Store angle for debugging
      };
      
      // Set renderOrder to ensure it renders on top of other objects
      lines.renderOrder = 10; // Higher render order
      
      // Add lines to this copy's group
      copyGroup.add(lines);
      
      // Get the positions from the geometry
      const positions = baseGeo.getAttribute('position').array;
      const count = baseGeo.getAttribute('position').count;
      
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
        
        // Increment the global vertex index
        globalVertexIndex++;
        
        // Create a note object to get duration and velocity parameters
        const note = createNote(triggerData, state);
        
        // Calculate size factor that scales with camera distance
        const baseCircleSize = VERTEX_CIRCLE_SIZE;
        const durationScaleFactor = 0.5 + note.duration;
        
        // Size that remains visually consistent at different camera distances
        // Adjust the multiplier (0.3) to make points larger or smaller overall
        const sizeScaleFactor = (cameraDistance / 1000) * baseCircleSize * durationScaleFactor * 10.3;
        
        // Create material with opacity based on velocity
        const vertexCircleMaterial = new THREE.MeshBasicMaterial({ 
          color: mat && mat.color ? mat.color : VERTEX_CIRCLE_COLOR,
          transparent: true,
          opacity: note.velocity, 
          depthTest: false,
          side: THREE.DoubleSide // Render both sides for better visibility
        });
        
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
      copyGroup.userData = copyGroup.userData || {};
      copyGroup.userData.angle = cumulativeAngleDegrees; // Store angle in the group too
      
      // Track the copy group for cleanup if needed
      newChildren.push(copyGroup);
      
      // Add the whole copy group to the main group
      group.add(copyGroup);
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
 * Get vertex positions from a geometry with transformations applied
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
 * Calculate frequency for a point in space
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @returns {number} Frequency in Hz
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
 * @param {number} segments Number of segments in the polygon
 * @param {Object} state Application state
 * @returns {Array<THREE.Vector3>} Array of vertices
 */
function createRegularPolygonPoints(radius, segments, state) {
  // Round segments to an integer
  segments = Math.max(2, Math.round(segments));
  
  // Create points array for a regular polygon
  const points = [];
  const angle = (Math.PI * 2) / segments;
  
  for (let i = 0; i < segments; i++) {
    const x = Math.cos(angle * i) * radius;
    const y = Math.sin(angle * i) * radius;
    points.push(new THREE.Vector3(x, y, 0));
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
function createStarPolygonPoints(radius, numSegments, skip, state = null) {
  const points = [];
  const angleStep = (Math.PI * 2) / numSegments;
  
  // If skip is invalid, fall back to 1 (regular polygon)
  skip = skip || 1;
  
  // Calculate GCD to determine if this is a proper star
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  const gcdValue = gcd(numSegments, skip);
  
  // When creating a star with cuts, force intersection update
  if (state && state.useStars && state.useCuts && skip > 1) {
    if (DEBUG_STAR_CUTS) {
      
    }
    // Force intersection recalculation
    state.needsIntersectionUpdate = true;
  }
  
  if (DEBUG_STAR_CUTS && state && state.useStars) {
    
  }
  
  // Create a stellated figure when useStars is true and skip > 1
  const createStellateFigure = state?.useStars && skip > 1;
  
  if (createStellateFigure) {
    if (DEBUG_STAR_CUTS) {
      
    }
    
    // Generate the outer vertices first
    const outerVertices = [];
    for (let i = 0; i < numSegments; i++) {
      const angle = i * angleStep;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      outerVertices.push(new THREE.Vector2(x, y));
    }
    
    // For a proper star (gcd=1), create a single continuous path
    if (gcdValue === 1) {
      let vertex = 0;
      const visited = new Array(numSegments).fill(false);
      
      while (!visited[vertex]) {
        const currentVertex = outerVertices[vertex];
        points.push(currentVertex);
        visited[vertex] = true;
        
        // Jump by skip amount
        vertex = (vertex + skip) % numSegments;
      }
      
      if (DEBUG_STAR_CUTS) {
        
      }
    } else {
      // For multiple disconnected paths (gcd > 1), create each segment separately
      const numPaths = gcdValue;
      const verticesPerPath = numSegments / numPaths;
      
      if (DEBUG_STAR_CUTS) {
        
      }
      
      // Generate each separate path
      for (let pathStart = 0; pathStart < numPaths; pathStart++) {
        let vertex = pathStart;
        
        for (let i = 0; i < verticesPerPath; i++) {
          const currentVertex = outerVertices[vertex];
          points.push(currentVertex);
          
          // Jump by skip amount
          vertex = (vertex + skip) % numSegments;
        }
      }
      
      if (DEBUG_STAR_CUTS) {
        
      }
    }
    
    return points;
  }
  
  // For regular polygons (skip=1) or when useStars is false
  if (skip === 1 || !state?.useStars) {
    if (DEBUG_STAR_CUTS) {
      
    }
    
    // Create simple regular polygon
    for (let i = 0; i < numSegments; i++) {
      const angle = i * angleStep;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      points.push(new THREE.Vector2(x, y));
    }
    
    return points;
  }
  
  // This should never be reached, but just in case, return a regular polygon
  for (let i = 0; i < numSegments; i++) {
    const angle = i * angleStep;
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
  
  
  
  
  // If fractal value is 1 or less, just return the base polygon
  if (fractalValue <= 1) {
    return basePoints;
  }
  
  // Number of divisions per segment (rounded to nearest integer)
  const divisions = Math.max(2, Math.round(fractalValue));
  
  
  const newPoints = [];
  
  // For each pair of original points, create divisions-1 new points between them
  for (let i = 0; i < basePoints.length; i++) {
    const currentPoint = basePoints[i];
    const nextPoint = basePoints[(i + 1) % basePoints.length];
    
    // Add the current original point
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
 * Calculate positions for a copy with rotation applied
 * @param {Array<THREE.Vector2|THREE.Vector3>} basePoints Array of base points
 * @param {number} scale Scale factor for this copy
 * @param {number} angleRadians Rotation angle in radians
 * @returns {Array<THREE.Vector3>} Array of transformed points
 */
function calculateCopyPositions(basePoints, scale, angleRadians) {
  const transformedPoints = [];
  
  // Calculate rotation matrix components
  const cos = Math.cos(angleRadians);
  const sin = Math.sin(angleRadians);
  
  // Apply transformation to each point
  for (const point of basePoints) {
    // Apply scale
    const scaledX = point.x * scale;
    const scaledY = point.y * scale;
    
    // Apply rotation
    const rotatedX = scaledX * cos - scaledY * sin;
    const rotatedY = scaledX * sin + scaledY * cos;
    
    // Create a new Vector3 with the transformed coordinates
    transformedPoints.push(new THREE.Vector3(rotatedX, rotatedY, point.z || 0));
  }
  
  return transformedPoints;
}

/**
 * Calculate intersections between multiple copy polygons
 * @param {Array<Array<THREE.Vector3>>} copyPolygons Array of polygon vertex arrays
 * @returns {Array<THREE.Vector3>} Array of unique intersection points
 */
function calculatePolygonIntersections(copyPolygons) {
  const intersections = [];
  
  // Helper function to check if a point is too close to existing points
  function isPointTooClose(point, existingPoints, threshold = INTERSECTION_MERGE_THRESHOLD) {
    for (const existing of existingPoints) {
      if (!existing || !point) continue;
      
      // Calculate distance in 2D space
      const dx = existing.x - point.x;
      const dy = existing.y - point.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < threshold) {
        return true;
      }
    }
    return false;
  }
  
  // Check for intersections between all pairs of polygons
  for (let i = 0; i < copyPolygons.length; i++) {
    const polyA = copyPolygons[i];
    
    // Check for self-intersections within this polygon
    for (let a1 = 0; a1 < polyA.length; a1++) {
      const a1next = (a1 + 1) % polyA.length;
      
      for (let a2 = a1 + 2; a2 < polyA.length; a2++) {
        // Skip adjacent segments (including wraparound)
        if (a2 === a1 || a2 === a1next || (a2 + 1) % polyA.length === a1) {
          continue;
        }
        
        const a2next = (a2 + 1) % polyA.length;
        
        // Find intersection between segments
        const intersection = findIntersection(
          polyA[a1], polyA[a1next], 
          polyA[a2], polyA[a2next]
        );
        
        // Add unique intersection point
        if (intersection && !isPointTooClose(intersection, intersections)) {
          intersections.push(intersection);
        }
      }
    }
    
    // Check for intersections with other polygons
    for (let j = i + 1; j < copyPolygons.length; j++) {
      const polyB = copyPolygons[j];
      
      // Check all segment pairs between the two polygons
      for (let a = 0; a < polyA.length; a++) {
        const aNext = (a + 1) % polyA.length;
        
        for (let b = 0; b < polyB.length; b++) {
          const bNext = (b + 1) % polyB.length;
          
          // Find intersection between segments
          const intersection = findIntersection(
            polyA[a], polyA[aNext],
            polyB[b], polyB[bNext]
          );
          
          // Add unique intersection point
          if (intersection && !isPointTooClose(intersection, intersections)) {
            intersections.push(intersection);
          }
        }
      }
    }
  }
  
  return intersections;
}