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
 * Create a regular polygon outline
 * @param {number} radius - Radius of the polygon
 * @param {number} segments - Number of sides
 * @param {Object} state - Application state for additional parameters
 * @returns {THREE.BufferGeometry} Polygon geometry
 */
export function createPolygonGeometry(radius, segments, state = null) {
  // Fix for rounding bug: Ensure we have a valid integer number of segments
  const numSegments = Math.max(2, Math.round(segments));
  
  // Get state parameters with defaults
  const useFractal = state?.useFractal || false;
  const fractalValue = state?.fractalValue || 1;
  const useStars = state?.useStars || false;
  const starSkip = state?.starSkip || 1;
  
  // Always create a completely fresh geometry
  const geometry = new THREE.BufferGeometry();
  
  // If a valid skip is specified and stars are enabled, create a star polygon
  if (useStars && starSkip > 1 && starSkip < numSegments) {
    // Calculate GCD to determine if this creates a proper star
    const gcd = calculateGCD(numSegments, starSkip);
    console.log(`Creating star polygon with: useStars=${useStars}, starSkip=${starSkip}, segments=${numSegments}, gcd=${gcd}`);
    
    // Only use star pattern when gcd=1 (ensures a single connected path)
    if (gcd === 1 || starSkip === 1) {
      return createStarPolygonGeometry(radius, numSegments, starSkip, useFractal, fractalValue);
    } else {
      console.log(`Warning: Skip ${starSkip} with ${numSegments} segments has gcd=${gcd}, would create multiple disconnected shapes`);
      // Fall through to create a regular polygon instead
    }
  }
  
  // Otherwise create a standard polygon
  const vertices = [];
  
  // Collect base vertices of the polygon
  const baseVertices = [];
  for (let i = 0; i < numSegments; i++) {
    const angle = (i / numSegments) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    baseVertices.push(new THREE.Vector3(x, y, 0));
  }
  
  // If fractal subdivision is enabled and value > 1, subdivide each line segment
  if (useFractal && fractalValue > 1) {
    const subdivisions = fractalValue;
    
    for (let i = 0; i < numSegments; i++) {
      const startVertex = baseVertices[i];
      const endVertex = baseVertices[(i + 1) % numSegments];
      
      // Add the start vertex
      vertices.push(startVertex.x, startVertex.y, startVertex.z);
      
      // Create subdivision points between start and end
      for (let j = 1; j < subdivisions; j++) {
        const t = j / subdivisions;
        const x = startVertex.x + (endVertex.x - startVertex.x) * t;
        const y = startVertex.y + (endVertex.y - startVertex.y) * t;
        vertices.push(x, y, 0);
      }
    }
  } else {
    // No subdivision - just use base vertices
    for (let i = 0; i < numSegments; i++) {
      const vertex = baseVertices[i];
      vertices.push(vertex.x, vertex.y, vertex.z);
    }
  }
  
  // Set up the attributes
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  return geometry;
}

/**
 * Create a star polygon geometry {n/k}
 * @param {number} radius - Radius of the polygon
 * @param {number} n - Number of vertices
 * @param {number} k - Skip value (step size)
 * @param {boolean} useFractal - Whether to use fractal subdivision
 * @param {number} fractalValue - Fractal subdivision level
 * @returns {THREE.BufferGeometry} Star polygon geometry
 */
function createStarPolygonGeometry(radius, n, k, useFractal, fractalValue) {
  const geometry = new THREE.BufferGeometry();
  const vertices = [];
  
  // Calculate GCD to determine if we'll get a single star or multiple shapes
  const gcd = calculateGCD(n, k);
  
  console.log(`Creating star polygon {${n}/${k}} - GCD: ${gcd}`);
  
  // Collect base vertices of the polygon in a circle
  const baseVertices = [];
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    baseVertices.push(new THREE.Vector3(x, y, 0));
  }
  
  // If gcd > 1, we'll get multiple disconnected figures
  // The figure will repeat after visiting n/gcd vertices
  const verticesPerFigure = n / gcd;
  console.log(`This will create ${gcd} separate figure(s) with ${verticesPerFigure} vertices each`);
  
  // If fractal subdivision is enabled and value > 1, subdivide each line segment
  if (useFractal && fractalValue > 1) {
    const subdivisions = fractalValue;
    
    // For star polygons with fractal subdivision
    let visited = new Set();  // Track visited vertices
    let currentIndex = 0;     // Start at vertex 0
    
    // Continue until we've visited all vertices or completed a cycle
    while (visited.size < n && !visited.has(currentIndex)) {
      visited.add(currentIndex);
      const startVertex = baseVertices[currentIndex];
      
      // Calculate next vertex based on skip pattern
      const nextIndex = (currentIndex + k) % n;
      const endVertex = baseVertices[nextIndex];
      
      // Add the start vertex
      vertices.push(startVertex.x, startVertex.y, startVertex.z);
      
      // Create subdivision points between start and end
      for (let j = 1; j < subdivisions; j++) {
        const t = j / subdivisions;
        const x = startVertex.x + (endVertex.x - startVertex.x) * t;
        const y = startVertex.y + (endVertex.y - startVertex.y) * t;
        vertices.push(x, y, 0);
      }
      
      // Move to the next vertex in the star pattern
      currentIndex = nextIndex;
    }
  } else {
    // For standard star polygon with no subdivision
    let visited = new Set();  // Track visited vertices
    let currentIndex = 0;     // Start at vertex 0
    
    // Continue until we've visited all vertices or completed a cycle
    while (visited.size < n && !visited.has(currentIndex)) {
      visited.add(currentIndex);
      const vertex = baseVertices[currentIndex];
      vertices.push(vertex.x, vertex.y, vertex.z);
      
      // Calculate next vertex based on skip pattern
      currentIndex = (currentIndex + k) % n;
    }
    
    // Add the first vertex again to close the loop if we didn't already
    if (vertices.length > 0 && currentIndex === 0) {
      const firstVertex = baseVertices[0];
      vertices.push(firstVertex.x, firstVertex.y, firstVertex.z);
    }
  }
  
  // Set up the attributes
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  
  return geometry;
}

// Helper function to calculate Greatest Common Divisor
function calculateGCD(a, b) {
  while (b) {
    const temp = b;
    b = a % b;
    a = temp;
  }
  return a;
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
  if (state.useIntersections && state.intersectionPoints && state.intersectionPoints.length > 0) {
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
  // Ensure segments is a proper integer
  const numSegments = Math.round(segments);

  // Clean up existing point frequency labels if they exist
  if (state && state.pointFreqLabels) {
    state.cleanupPointFreqLabels();
  }
  
  // Clean up the group
  group.clear();
  
  // Cache the base radius once to use for all modulus calculations
  const baseRadius = state ? state.radius : 0;
  
  // Only create markers if we have multiple copies
  const hasEnoughCopiesForIntersections = copies > 1;

  // For intersection detection, we'll need to create a temporary group to calculate intersections
  // before they're added to the actual group
  let tempGroup = null;
  let intersectionPoints = [];
  
  // Check if we need to find intersections and have multiple copies
  if (state && state.useIntersections && copies > 1) {
    tempGroup = new THREE.Group();
    tempGroup.position.copy(group.position);
    tempGroup.rotation.copy(group.rotation);
    tempGroup.scale.copy(group.scale);
  }
  
  // First create all the polygon copies (either in the main group or temp group)
  const targetGroup = tempGroup || group;
  
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
    
    // Create line for the polygon outline - use the original geometry here
    const lines = new THREE.LineLoop(baseGeo, mat.clone());
    lines.scale.set(finalScale, finalScale, 1);
    copyGroup.add(lines);
    
    // Apply rotation to the copy group
    copyGroup.rotation.z = cumulativeAngleRadians;
    
    // Add the whole copy group to the target group
    targetGroup.add(copyGroup);
  }
  
  // If we're using intersections and need an update, find and apply intersections
  if (state && state.useIntersections && state.needsIntersectionUpdate && copies > 1) {
    // Find all intersection points between the copies in the temp group
    intersectionPoints = findAllIntersections(tempGroup);
    
    // Update the geometry with intersections before creating the real group
    if (intersectionPoints.length > 0) {
      // Store intersection points in state
      state.intersectionPoints = intersectionPoints;
      
      // Reset the flag since we've updated the intersections
      state.needsIntersectionUpdate = false;
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
  
  // Now create the actual group based on the updated geometry
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
    
    // Use the current geometry (may have been updated with intersections)
    const lines = new THREE.LineLoop(baseGeo, mat.clone());
    lines.scale.set(finalScale, finalScale, 1);
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
  
  // Finally, add the intersection point markers to the group (so they rotate with everything)
  // Only create/update markers if:
  // 1. We're using intersections AND
  // 2. We have intersection points AND
  // 3. We're not currently lerping AND
  // 4. Either we just calculated new intersections OR we don't have markers yet
  const needToCreateMarkers = state && 
                             state.useIntersections && 
                             hasEnoughCopiesForIntersections && // Only if we have enough copies
                             state.intersectionPoints && 
                             state.intersectionPoints.length > 0 && 
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