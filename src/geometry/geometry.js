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
import { findAllIntersections } from './intersections.js';
import { createOrUpdateLabel } from '../ui/domLabels.js';
// Import the frequency utilities at the top of geometry.js
import { quantizeToEqualTemperament, getNoteName } from '../audio/frequencyUtils.js';
import { createNote } from '../notes/notes.js';

// Reuse geometries for better performance
const vertexCircleGeometry = new THREE.CircleGeometry(1, 12); // Fewer segments (12) for performance

/**
 * Creates a polygon geometry with the given radius and segment count
 * @param {number} radius - Radius of the polygon
 * @param {number} segments - Number of sides
 * @param {Object} state - Application state for additional parameters
 * @returns {THREE.BufferGeometry} - The created geometry
 */
export function createPolygonGeometry(radius, segments, state) {
  console.log(`[GEOMETRY] Creating polygon with radius=${radius}, segments=${segments}`);
  
  // Ensure valid parameters
  if (!radius || radius <= 0) {
    console.warn("[GEOMETRY] Invalid radius, using default 100");
    radius = 100;
  }
  
  if (!segments || segments < 3) {
    console.warn("[GEOMETRY] Invalid segment count, using default 3");
    segments = 3;
  }
  
  // Create a new buffer geometry
  const geometry = new THREE.BufferGeometry();
  
  // Calculate vertices for the polygon
  const vertices = [];
  const step = Math.PI * 2 / segments;
  
  // Use alternate scale for frequency calculation
  let useAltScale = false;
  let altScale = null;
  let altStepN = 1;
  
  // Use Euclidean rhythm for vertex distribution
  let useEuclid = false;
  let euclidValue = 0;
  
  // Use stars instead of regular polygons
  let useStars = false;
  let starSkip = 2;
  
  // Use modulus for some segments
  let useModulus = false;
  let modulus = 1;
  
  // Read parameters from state if available
  if (state) {
    useAltScale = state.useAltScale || false;
    altScale = state.altScale || 'pentatonic';
    altStepN = state.altStepN || 1;
    
    useEuclid = state.useEuclid || false;
    euclidValue = state.euclidValue || 0;
    
    useStars = state.useStars || false;
    starSkip = state.starSkip || 2;
    
    useModulus = state.useModulus || false;
    modulus = state.modulus || 1;
  }
  
  try {
    // Generate points for polygon, star, or Euclidean rhythm
    if (useStars) {
      // Create a star pattern by connecting vertices with a step of starSkip
      // For example, a pentagram is created by skipping every 2nd vertex of a pentagon
      for (let i = 0; i < segments; i++) {
        const index = (i * starSkip) % segments;
        const angle = index * step;
        const x = radius * Math.cos(angle);
        const y = radius * Math.sin(angle);
        const z = 0;
        
        vertices.push(x, y, z);
      }
      
      // Close the loop by adding the first vertex again
      const firstX = vertices[0];
      const firstY = vertices[1];
      const firstZ = vertices[2];
      vertices.push(firstX, firstY, firstZ);
      
    } else if (useEuclid) {
      // Create a rhythm using the Euclidean algorithm for even distribution
      const rhythm = calculateEuclideanRhythm(segments, euclidValue);
      
      for (let i = 0; i < segments; i++) {
        if (rhythm[i]) {
          const angle = i * step;
          const x = radius * Math.cos(angle);
          const y = radius * Math.sin(angle);
          const z = 0;
          
          vertices.push(x, y, z);
        }
      }
      
      // Make sure to close the shape
      if (vertices.length > 0) {
        const firstX = vertices[0];
        const firstY = vertices[1];
        const firstZ = vertices[2];
        vertices.push(firstX, firstY, firstZ);
      }
      
    } else {
      // Standard polygon or modulo pattern
      for (let i = 0; i <= segments; i++) {
        // For modulo pattern, skip vertices based on the modulus
        if (useModulus && i % modulus !== 0 && i < segments) continue;
        
        const angle = (i % segments) * step;
        const x = radius * Math.cos(angle);
        const y = radius * Math.sin(angle);
        const z = 0;
        
        vertices.push(x, y, z);
      }
    }
    
    // Set up the buffer attributes
    const positionAttribute = new THREE.Float32BufferAttribute(vertices, 3);
    geometry.setAttribute('position', positionAttribute);
    
    // Log success
    console.log(`[GEOMETRY] Created polygon with ${positionAttribute.count} vertices`);
    
    return geometry;
  } catch (error) {
    console.error("[GEOMETRY] Error creating geometry:", error);
    
    // Create a simple fallback triangle
    const fallbackGeometry = new THREE.BufferGeometry();
    const fallbackVertices = [
      100, 0, 0,    // Vertex 1
      -50, 86.6, 0, // Vertex 2
      -50, -86.6, 0,// Vertex 3
      100, 0, 0     // Close the loop
    ];
    fallbackGeometry.setAttribute('position', new THREE.Float32BufferAttribute(fallbackVertices, 3));
    console.log("[GEOMETRY] Created fallback triangle geometry");
    
    return fallbackGeometry;
  }
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
  console.warn("createStarPolygonGeometry is deprecated, use createStarPolygonPoints instead");
  
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
  console.warn("createEuclideanPolygonGeometry is deprecated, use createEuclideanPoints instead");
  
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

// Add a counter for logging at the module level
let updateGroupCallCounter = 0;

/**
 * Update the group of polygon copies
 * @param {THREE.Group} group - Group to update
 * @param {number} copies - Number of copies
 * @param {number} stepScale - Scale factor between copies
 * @param {THREE.BufferGeometry} baseGeo - Base geometry
 * @param {THREE.Material} mat - Material to use
 * @param {number} segments - Number of segments
 * @param {number} angle - Rotation angle between copies
 * @param {Object} state - Application state
 * @param {boolean} isLerping - Whether we're currently lerping
 * @param {boolean} justCalculatedIntersections - Whether we just calculated intersections
 */
export function updateGroup(group, copies, stepScale, baseGeo, mat, segments, angle = 0, state = null, isLerping = false, justCalculatedIntersections = false) {
  // Only log on first call or when parameters change
  updateGroupCallCounter++;
  if (updateGroupCallCounter % 900 === 0) {
    console.log(`UpdateGroup called: copies=${copies}, segments=${segments}, group.children=${group.children.length}`);
  }
  
  // Ensure segments is a proper integer
  const numSegments = Math.round(segments);
  
  // Enhanced OPTIMIZATION: More robust check to skip update if nothing changed
  // The +5 accounts for the debug objects (sphere + 3 axis lines + parent group)
  if (!isLerping && 
      !justCalculatedIntersections && 
      state && !state.needsIntersectionUpdate &&
      group.children.length === copies + 5 && // +5 for debug objects and marker group
      updateGroupCallCounter > 10) { // Don't skip during first few calls for stability
    
    // Special handling for layer 2 (third layer) to prevent the issue
    // where changes to layer 3 cause unnecessary geometry updates when switching layers
    if (state.layerId === 2) {
      // Double check parameter changes for this layer
      const hasChanges = Object.values(state.parameterChanges).some(flag => flag);
      if (hasChanges) {
        console.warn(`[GEOMETRY WARNING] Layer 2 still has parameter changes that should have been reset - forcing reset`);
        // Force reset the parameter changes
        Object.keys(state.parameterChanges).forEach(key => {
          state.parameterChanges[key] = false;
        });
      }
    }
    
    // Add enhanced debug info when we're skipping updates
    if (updateGroupCallCounter % 300 === 0) {
      // Log the layerId for clarity
      const layerId = state.layerId !== undefined ? state.layerId : 'unknown';
      console.log(`[GEOMETRY SKIP] Layer ${layerId}: Skipping geometry update - no changes detected`);
      
      // Log parameter change flags for debugging
      if (state.parameterChanges) {
        const changedParams = Object.entries(state.parameterChanges)
          .filter(([_, val]) => val)
          .map(([key, _]) => key)
          .join(", ");
        
        if (changedParams) {
          console.warn(`[GEOMETRY WARNING] Layer ${layerId} has parameter changes (${changedParams}) but update was skipped`);
        }
      }
    }
    
    // Still ensure group is visible
    group.visible = true;
    return; // Skip the rest of the update
  }
  
  // Clean up existing point frequency labels if they exist
  if (state && state.pointFreqLabels) {
    state.cleanupPointFreqLabels();
  }
  
  // IMPORTANT: Make sure the group is visible
  group.visible = true;
  
  // Clean up the group
  group.clear();
  
  // Add a simple visible debug object
  const debugSphere = new THREE.Mesh(
    new THREE.SphereGeometry(10, 16, 16),  // Much smaller sphere (10 instead of 50)
    new THREE.MeshBasicMaterial({ color: 0xff0000 })
  );
  debugSphere.position.set(0, 0, 0);
  group.add(debugSphere);
  
  // Add multiple visible lines in different directions
  const axes = [
    { start: new THREE.Vector3(-20, 0, 0), end: new THREE.Vector3(20, 0, 0), color: 0x00ff00 },  // X-axis (green)
    { start: new THREE.Vector3(0, -20, 0), end: new THREE.Vector3(0, 20, 0), color: 0x0000ff },  // Y-axis (blue)
    { start: new THREE.Vector3(0, 0, -20), end: new THREE.Vector3(0, 0, 20), color: 0xff00ff }   // Z-axis (magenta)
  ];
  
  axes.forEach(axis => {
    const lineGeo = new THREE.BufferGeometry().setFromPoints([axis.start, axis.end]);
    const lineMat = new THREE.LineBasicMaterial({ color: axis.color });
    const line = new THREE.Line(lineGeo, lineMat);
    group.add(line);
  });
  
  // Only log this message once
  if (updateGroupCallCounter === 1) {
    console.log("Added smaller debug objects to group");
  }
  
  // Cache the base radius once to use for all modulus calculations
  const baseRadius = state ? state.radius : 0;
  
  // Early exit with warning if copies is 0 or negative
  if (copies <= 0) {
    console.warn("UpdateGroup called with copies <= 0, nothing will be rendered");
    return;
  }
  
  // Early exit with warning if baseGeo is invalid
  if (!baseGeo || !baseGeo.getAttribute || !baseGeo.getAttribute('position')) {
    console.error("UpdateGroup called with invalid baseGeo, cannot render");
    return;
  }
  
  // Only create markers if we have multiple copies
  const hasEnoughCopiesForIntersections = copies > 1;

  // For intersection detection, we'll need to create a temporary group to calculate intersections
  // before they're added to the actual group
  let tempGroup = null;
  let intersectionPoints = [];
  
  // Check if we need to find intersections and have multiple copies
  // OPTIMIZATION: Only do this when needsIntersectionUpdate is true to avoid per-frame recalculation
  if (state && (state.useIntersections || (state.useStars && state.useCuts)) && 
      state.needsIntersectionUpdate && 
      (copies > 1 || (state.useStars && state.useCuts))) {
    // Create a temporary group for intersection calculation
    tempGroup = new THREE.Group();
    tempGroup.position.copy(group.position);
    tempGroup.rotation.copy(group.rotation);
    tempGroup.scale.copy(group.scale);
    tempGroup.userData = { state: state }; // Important: add state to userData to avoid "No state found" errors
    
    // First create all the polygon copies in the temp group
    for (let i = 0; i < copies; i++) {
      // Base scale factor from step scale
      let stepScaleFactor = Math.pow(stepScale, i);
      
      // Initialize final scale variables
      let finalScale = stepScaleFactor;
      
      // Determine scale based on different features
      if (state) {
        if (state.useModulus) {
          // Get the sequence value (increasing from 1/modulus to 1.0)
          const modulusScale = state.getScaleFactorForCopy(i);
          finalScale = modulusScale * stepScaleFactor;  // Apply both modulus scale and step scale
        } else if (state.useAltScale) {
          // Apply alt scale multiplier if this is an Nth copy (without modulus)
          // Always use the current altScale value (which will be lerped if lerping is enabled)
          if ((i + 1) % state.altStepN === 0) {
            finalScale = stepScaleFactor * state.altScale;
          }
        }
      }
      
      // Each copy gets a cumulative angle (i * angle) in degrees
      const cumulativeAngleDegrees = i * angle;
      
      // Convert to radians only when setting the actual Three.js rotation
      const cumulativeAngleRadians = (cumulativeAngleDegrees * Math.PI) / 180;
      
      // Create a group for this copy to hold both the lines and vertex circles
      const copyGroup = new THREE.Group();
      copyGroup.name = `copy-${i}`;
      
      // Add clear identification to the copy group's userData
      copyGroup.userData = {
        isCopyObject: true,
        copyIndex: i,
        scale: finalScale,
        layerId: state?.layerId
      };
      
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
      
      // Create line loop with the enhanced material
      const lines = new THREE.LineLoop(baseGeo, lineMaterial);
      lines.scale.set(finalScale, finalScale, 1);
      lines.name = `polygon-${i}`;
      
      // Set renderOrder to ensure it renders on top of other objects
      lines.renderOrder = 10; // Higher render order
      
      // IMPORTANT: Also add userData to the line object itself
      lines.userData = {
        isCopyObject: true,
        isPolygon: true,
        copyIndex: i,
        scale: finalScale,
        layerId: state?.layerId
      };
      
      // Add the line geometry to the copy group
      copyGroup.add(lines);
      
      // Apply rotation to the copy group
      copyGroup.rotation.z = cumulativeAngleRadians;
      
      // Add the whole copy group to the temp group
      tempGroup.add(copyGroup);
    }
    
    // Find all intersection points between the copies in the temp group
    intersectionPoints = findAllIntersections(tempGroup);
    
    // Update the geometry with intersections before creating the real group
    if (intersectionPoints.length > 0) {
      // Store intersection points in state
      state.intersectionPoints = intersectionPoints;
      
      // Reset the flag since we've updated the intersections
      state.needsIntersectionUpdate = false;
    } else {
      // Reset the flag even if no intersections found
      state.needsIntersectionUpdate = false;
      state.intersectionPoints = [];
    }
  }
  
  // Create point frequency labels if enabled
  const shouldCreatePointLabels = state && 
                                 state.showPointsFreqLabels && 
                                 !isLerping;
  
  // If we should create point labels, initialize the array
  if (shouldCreatePointLabels) {
    state.pointFreqLabels = [];
  }
  
  // Get camera and renderer from scene's userData (assuming they're stored there)
  const camera = group.parent?.userData?.camera;
  const renderer = group.parent?.userData?.renderer;

  // Calculate camera distance for size adjustment
  const cameraDistance = camera ? camera.position.z : 2000;
  
  // Calculate global sequential index for vertex indexing
  let globalVertexIndex = 0;
  
  // Clean up temporary group if it exists
  if (tempGroup) {
    tempGroup.traverse(child => {
      if (child.geometry && child !== baseGeo) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
    tempGroup = null;
  }
  
  // Now create the actual polygon copies for display
  for (let i = 0; i < copies; i++) {
    // Base scale factor from step scale
    let stepScaleFactor = Math.pow(stepScale, i);
    
    // Initialize final scale variables
    let finalScale = stepScaleFactor;
    
    // Determine scale based on different features
    if (state) {
      if (state.useModulus) {
        // Get the sequence value (increasing from 1/modulus to 1.0)
        const modulusScale = state.getScaleFactorForCopy(i);
        finalScale = modulusScale * stepScaleFactor;  // Apply both modulus scale and step scale
      } else if (state.useAltScale) {
        // Apply alt scale multiplier if this is an Nth copy (without modulus)
        if ((i + 1) % state.altStepN === 0) {
          finalScale = stepScaleFactor * state.altScale;
        }
      }
    }
    
    // Each copy gets a cumulative angle (i * angle) in degrees
    const cumulativeAngleDegrees = i * angle;
    
    // Convert to radians only when setting the actual Three.js rotation
    const cumulativeAngleRadians = (cumulativeAngleDegrees * Math.PI) / 180;
    
    // Create a group for this copy to hold both the lines and vertex circles
    const copyGroup = new THREE.Group();
    copyGroup.name = `copy-${i}`;
    
    // Add clear identification to the copy group's userData
    copyGroup.userData = {
      isCopyObject: true,
      copyIndex: i,
      scale: finalScale,
      layerId: state?.layerId
    };
    
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
    
    // Create line loop with the enhanced material
    const lines = new THREE.LineLoop(baseGeo, lineMaterial);
    lines.scale.set(finalScale, finalScale, 1);
    lines.name = `polygon-${i}`;
    
    // Set renderOrder to ensure it renders on top of other objects
    lines.renderOrder = 10; // Higher render order
    
    // IMPORTANT: Also add userData to the line object itself
    lines.userData = {
      isCopyObject: true,
      isPolygon: true,
      copyIndex: i,
      scale: finalScale,
      layerId: state?.layerId
    };
    
    // Add the line geometry to the copy group
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
        color: VERTEX_CIRCLE_COLOR,
        transparent: true,
        opacity: note.velocity, 
        depthTest: false,
        side: THREE.DoubleSide // Render both sides for better visibility
      });
      
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
        state.pointFreqLabels.push({
          label: textLabel,
          copyIndex: i,
          vertexIndex: v,
          position: rotatedPos.clone()
        });
      }
    }
    
    // Apply rotation to the copy group
    copyGroup.rotation.z = cumulativeAngleRadians;
    
    // Add the whole copy group to the main group
    group.add(copyGroup);
  }
  
  // Finally, add the intersection point markers to the group (so they rotate with everything)
  // Only create/update markers if:
  // 1. We're using intersections OR (using stars AND using cuts) AND
  // 2. We have intersection points AND
  // 3. We're not currently lerping AND
  // 4. We have at least 1 copy AND
  // 5. Either we just calculated new intersections OR we don't have markers yet
  const needToCreateMarkers = state && 
                             (state.useIntersections || (state.useStars && state.useCuts)) && 
                             (hasEnoughCopiesForIntersections || (state.useStars && state.useCuts)) && // Only if we have enough copies or using star cuts
                             state.intersectionPoints && 
                             state.intersectionPoints.length > 0 && 
                             copies > 0 && // Don't create markers if copies = 0
                             !isLerping &&
                             (justCalculatedIntersections || !group.userData.intersectionMarkerGroup);
                             
  if (needToCreateMarkers) {
    // Clean up any existing marker group on this group
    if (group.userData && group.userData.intersectionMarkerGroup) {
      group.remove(group.userData.intersectionMarkerGroup);
      group.userData.intersectionMarkerGroup.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
      group.userData.intersectionMarkerGroup = null;
    }
    
    // Create a group to hold the intersection markers
    const intersectionMarkerGroup = new THREE.Group();
    
    // Tag this group for identification during audio triggers
    intersectionMarkerGroup.userData.isIntersectionGroup = true;
    
    // Add visual representation for each intersection point
    for (let i = 0; i < state.intersectionPoints.length; i++) {
      const point = state.intersectionPoints[i];
      
      // Create trigger data for this intersection point
      const triggerData = {
        x: point.x,
        y: point.y,
        isIntersection: true,
        intersectionIndex: i,
        globalIndex: globalVertexIndex
      };
      
      // Increment the global vertex index
      globalVertexIndex++;
      
      // Create a note object to get duration and velocity parameters
      const note = createNote(triggerData, state);
      
      // Calculate size factors for this intersection marker
      const basePointSize = INTERSECTION_POINT_SIZE;
      const durationScaleFactor = 0.5 + note.duration;
      
      // Size that remains visually consistent at different camera distances
      // Adjust the multiplier (0.3) to make points larger or smaller overall
      const sizeScaleFactor = (cameraDistance / 1000) * basePointSize * durationScaleFactor * 0.3;
      
      // Create a mesh for the intersection point using shared geometry
      const pointMesh = new THREE.Mesh(
        vertexCircleGeometry, // Reuse the same geometry
        new THREE.MeshBasicMaterial({
          color: INTERSECTION_POINT_COLOR,
          transparent: true,
          opacity: note.velocity,
          depthTest: false,
          side: THREE.DoubleSide
        })
      );
      
      pointMesh.scale.set(sizeScaleFactor, sizeScaleFactor, 1);
      pointMesh.position.copy(point);
      
      // Set renderOrder higher to ensure it renders on top
      pointMesh.renderOrder = 1;
      
      // Add to the intersection marker group
      intersectionMarkerGroup.add(pointMesh);
      
      // Add persistent frequency label for intersection point if enabled
      if (shouldCreatePointLabels && camera && renderer) {
        // Calculate frequency for this intersection point
        const freq = Math.hypot(point.x, point.y);
        
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
          point, 
          intersectionMarkerGroup, // Parent is not really used for DOM labels
          false, // Not an axis label
          camera,
          renderer
        );
        
        // Update the label immediately
        textLabel.update(camera, renderer);
        
        // Store reference for cleanup
        state.pointFreqLabels.push({
          label: textLabel,
          isIntersection: true,
          position: point.clone()
        });
      }
    }
    
    // Add the whole marker group to the main group
    group.add(intersectionMarkerGroup);
    
    // Store reference to the intersection marker group
    group.userData.intersectionMarkerGroup = intersectionMarkerGroup;
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
    console.warn(`Expected ${k} pulses but generated ${pulseCount}. Adjusting pattern.`);
    
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
  
  // Create a regular polygon
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
function createStarPolygonPoints(radius, numSegments, skip, state = null) {
  const points = [];
  const angleStep = (Math.PI * 2) / numSegments;
  
  // If skip is invalid, fall back to 1 (regular polygon)
  skip = skip || 1;
  
  // If useCuts is enabled, create star with cuts to the center
  if (state && state.useCuts) {
    // Create a star polygon with cuts
    for (let i = 0; i < numSegments; i++) {
      // Outer point
      const outerAngle = i * angleStep;
      const outerX = Math.cos(outerAngle) * radius;
      const outerY = Math.sin(outerAngle) * radius;
      points.push(new THREE.Vector2(outerX, outerY));
      
      // Inner point (at center)
      points.push(new THREE.Vector2(0, 0));
    }
  } else {
    // Standard star polygon using skip value
    let vertex = 0;
    const visited = new Array(numSegments).fill(false);
    
    for (let i = 0; i < numSegments; i++) {
      if (!visited[vertex]) {
        const angle = vertex * angleStep;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        points.push(new THREE.Vector2(x, y));
        visited[vertex] = true;
      }
      
      // Jump by skip amount
      vertex = (vertex + skip) % numSegments;
      
      // If we get back to where we started and not all vertices are visited,
      // move to the next unvisited vertex and continue
      if (vertex === 0 && i < numSegments - 1) {
        let nextVertex = 0;
        while (nextVertex < numSegments && visited[nextVertex]) {
          nextVertex++;
        }
        vertex = nextVertex;
      }
    }
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
  let points = createRegularPolygonPoints(radius, numSegments, state);
  
  // Apply fractal iterations
  const iterations = Math.floor(fractalValue);
  
  // For each iteration, apply the fractal transformation
  for (let i = 0; i < iterations; i++) {
    points = applyFractalIteration(points, fractalValue - Math.floor(fractalValue));
  }
  
  return points;
}

/**
 * Apply a fractal iteration to the points
 * @param {Array<THREE.Vector2>} points Input points
 * @param {number} fractalFactor Fractional part of fractal value for scaling
 * @returns {Array<THREE.Vector2>} New points after fractal iteration
 */
function applyFractalIteration(points, fractalFactor) {
  const newPoints = [];
  const factor = 0.3 + fractalFactor * 0.4; // Scale between 0.3 and 0.7
  
  // Add original vertices
  for (let i = 0; i < points.length; i++) {
    newPoints.push(points[i]);
    
    // Add a new point between this vertex and the next
    const nextIndex = (i + 1) % points.length;
    const midX = points[i].x + (points[nextIndex].x - points[i].x) * factor;
    const midY = points[i].y + (points[nextIndex].y - points[i].y) * factor;
    
    newPoints.push(new THREE.Vector2(midX, midY));
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
  console.warn("generateEuclideanRhythm is deprecated, use calculateEuclideanRhythm instead");
  return calculateEuclideanRhythm(n, k);
}