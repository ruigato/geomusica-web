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
import { createOrUpdateLabel, removePointLabel } from '../ui/domLabels.js';
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
  const useEuclid = state?.useEuclid || false;
  const euclidValue = state?.euclidValue || 3;
  const debug = false; // Set to true only when debugging is needed
  
  // Always create a completely fresh geometry
  const geometry = new THREE.BufferGeometry();
  
  // If Euclidean rhythm is enabled, create a polygon based on Euclidean distribution
  if (useEuclid && euclidValue > 0 && euclidValue <= numSegments) {
    return createEuclideanPolygonGeometry(radius, numSegments, euclidValue, useFractal, fractalValue, debug);
  }
  
  // If a valid skip is specified and stars are enabled, create a star polygon
  if (useStars && starSkip > 1 && starSkip < numSegments) {
    // Calculate GCD to determine if this creates a proper star
    const gcd = calculateGCD(numSegments, starSkip);
    if (debug) {
      console.log(`Creating star polygon with: useStars=${useStars}, starSkip=${starSkip}, segments=${numSegments}, gcd=${gcd}`);
    }
    
    // Only use star pattern when gcd=1 (ensures a single connected path)
    if (gcd === 1 || starSkip === 1) {
      return createStarPolygonGeometry(radius, numSegments, starSkip, useFractal, fractalValue, debug);
    } else if (debug) {
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
 * @param {boolean} debug - Enable debug logging
 * @returns {THREE.BufferGeometry} Star polygon geometry
 */
function createStarPolygonGeometry(radius, n, k, useFractal, fractalValue, debug = false) {
  const geometry = new THREE.BufferGeometry();
  const vertices = [];
  
  // Calculate GCD to determine if we'll get a single star or multiple shapes
  const gcd = calculateGCD(n, k);
  
  if (debug) {
    console.log(`Creating star polygon {${n}/${k}} - GCD: ${gcd}`);
  }
  
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
  if (debug) {
    console.log(`This will create ${gcd} separate figure(s) with ${verticesPerFigure} vertices each`);
  }
  
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

/**
 * Update the visual representation of a single layer, including its copies, intersections, and markers.
 * This function replaces the old `updateGroup` and is designed to work on a per-layer basis.
 */
export function updateLayerVisuals(
    layerGroup, baseGeo, layerState, globalState, scene, camera, renderer
) {
    if (!layerGroup || !baseGeo || !layerState || !globalState || !scene || !camera) {
        console.error("updateLayerVisuals: Missing one or more critical arguments.");
        return;
    }
    const { 
        copies, segments, stepScale, angle, radius, 
        useModulus, useAltScale, altStepN, altScale,
        useIntersections, useStars, useCuts,
        color, opacity
    } = layerState;
    const numSegments = Math.round(segments);
    const lineMaterial = new THREE.LineBasicMaterial({ 
        color: color || 0xffffff, 
        opacity: opacity || 1.0,
        transparent: (opacity || 1.0) < 1.0,
    });

    // Cleanup existing visuals from this layer's group
    // Dispose of geometries and materials of children explicitly to free GPU memory
    while(layerGroup.children.length > 0){
        const child = layerGroup.children[0];
        layerGroup.remove(child);
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
            if (Array.isArray(child.material)) {
                child.material.forEach(m => { if(m.dispose) m.dispose(); });
            } else if (child.material.dispose) {
                child.material.dispose();
            }
        }
        // If child is a group, traverse and dispose its children too if necessary,
        // but for LineLoop and Mesh, direct disposal is usually enough.
    }
    // layerGroup.clear(); // .clear() just removes them, doesn't dispose materials/geometries

    // Cleanup existing point frequency labels associated with this layer
    if (layerState.pointFreqLabelsArray && layerState.pointFreqLabelsArray.length > 0) {
        layerState.pointFreqLabelsArray.forEach(labelId => {
            removePointLabel(labelId);
        });
    }
    layerState.pointFreqLabelsArray = []; // Clear the array for the current frame's labels
    layerState.needsPointFreqLabelsUpdate = false; // Reset flag for this layer

    // Cache the base radius for this layer
    const baseRadiusForLayer = radius; // from layerState

    let tempIntersectionGroup = null;
    let currentLayerIntersectionPoints = [];
    const layerNeedsIntersectionRecalculation = 
        (useIntersections || (useStars && useCuts)) &&
        layerState.needsIntersectionUpdate && 
        (copies > 1 || (useStars && useCuts));

    if (layerNeedsIntersectionRecalculation) {
        tempIntersectionGroup = new THREE.Group();
        tempIntersectionGroup.userData.state = layerState; 
        for (let i = 0; i < copies; i++) {
            let currentCopyScale = Math.pow(stepScale, i);
            // Use the method from layerState directly
            if (useModulus && typeof layerState.getScaleFactorForCopy === 'function') { 
                currentCopyScale *= layerState.getScaleFactorForCopy(i);
            } else if (useAltScale && (i + 1) % altStepN === 0) {
                currentCopyScale *= altScale;
            }
            const cumulativeAngleRad = (i * angle * Math.PI) / 180;
            const copyVisual = new THREE.LineLoop(baseGeo, lineMaterial.clone());
            copyVisual.scale.set(currentCopyScale, currentCopyScale, 1);
            const copyGroupForIntersection = new THREE.Group();
            copyGroupForIntersection.add(copyVisual);
            copyGroupForIntersection.rotation.z = cumulativeAngleRad;
            tempIntersectionGroup.add(copyGroupForIntersection);
        }
        if (tempIntersectionGroup.children.length > 0) {
            currentLayerIntersectionPoints = findAllIntersections(tempIntersectionGroup, layerState);
        }
        layerState.intersectionPoints = currentLayerIntersectionPoints;
        layerState.needsIntersectionUpdate = false;
        layerState.justCalculatedIntersections = true;
        // Dispose of temporary group and its contents
        tempIntersectionGroup.traverse(child => {
            if (child.geometry && child.geometry !== baseGeo) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
        tempIntersectionGroup = null;
    } else {
        layerState.justCalculatedIntersections = false;
        currentLayerIntersectionPoints = layerState.intersectionPoints || []; 
    }

    // --- Create Actual Polygon Copies, Vertex Markers, and Labels for Display --- 
    const isCurrentlyLerping = typeof layerState.isLerping === 'function' ? layerState.isLerping() : false;
    const shouldCreatePointLabels = globalState.showPointsFreqLabels && !isCurrentlyLerping;
    if (shouldCreatePointLabels && !layerState.pointFreqLabelsArray) {
        layerState.pointFreqLabelsArray = [];
    }

    const cameraDistance = camera.position.z; 
    let perLayerVertexIndex = 0; // Sequential index for vertices and intersection points within THIS layer

    for (let i = 0; i < copies; i++) {
        let finalCopyScale = Math.pow(stepScale, i);
        if (useModulus && typeof layerState.getScaleFactorForCopy === 'function') {
            finalCopyScale *= layerState.getScaleFactorForCopy(i);
        } else if (useAltScale && (i + 1) % altStepN === 0) {
            finalCopyScale *= altScale;
        }
        const cumulativeAngleRad = (i * angle * Math.PI) / 180;
        const singleCopyGroup = new THREE.Group();
        const lines = new THREE.LineLoop(baseGeo, lineMaterial.clone());
        lines.scale.set(finalCopyScale, finalCopyScale, 1);
        singleCopyGroup.add(lines);

        const positions = baseGeo.getAttribute('position').array;
        const numVerticesInBase = baseGeo.getAttribute('position').count;
        for (let v = 0; v < numVerticesInBase; v++) {
            const baseX = positions[v * 3];
            const baseY = positions[v * 3 + 1];
            const scaledX = baseX * finalCopyScale;
            const scaledY = baseY * finalCopyScale;
            const triggerData = {
                x: scaledX, y: scaledY, // Local to the unrotated singleCopyGroup
                copyIndex: i, 
                vertexIndex: v, 
                isIntersection: false, 
                layerId: layerState.id, 
                pointIdInLayer: perLayerVertexIndex // Unique ID for this point within this layer
            };
            const note = createNote(triggerData, layerState);
            const circleSizeFactor = (cameraDistance / 1000) * VERTEX_CIRCLE_SIZE * (0.5 + note.duration) * 0.3;
            const vertexCircleMaterial = new THREE.MeshBasicMaterial({ 
                color: VERTEX_CIRCLE_COLOR, transparent: true,
                opacity: note.velocity * VERTEX_CIRCLE_OPACITY, depthTest: false, side: THREE.DoubleSide
            });
            const vertexCircle = new THREE.Mesh(vertexCircleGeometry, vertexCircleMaterial);
            vertexCircle.scale.set(circleSizeFactor, circleSizeFactor, 1);
            vertexCircle.position.set(scaledX, scaledY, 0.1);
            vertexCircle.renderOrder = 1;
            vertexCircle.userData.triggerData = triggerData; // STORE TRIGGER DATA HERE
            singleCopyGroup.add(vertexCircle);

            if (shouldCreatePointLabels) {
                const labelId = `layer_${layerState.id}_vertex_${perLayerVertexIndex}`;
                const worldPosition = vertexCircle.getWorldPosition(new THREE.Vector3());
                let labelText = `${note.frequency.toFixed(1)}Hz`;
                if (note.noteName) {
                    labelText += ` (${note.noteName})`;
                }
                createOrUpdateLabel(labelId, worldPosition, labelText, camera, renderer);
                layerState.pointFreqLabelsArray.push(labelId);
            }

            perLayerVertexIndex++;
        }
        singleCopyGroup.rotation.z = cumulativeAngleRad;
        layerGroup.add(singleCopyGroup);
    }

    // --- Add Intersection Point Markers (specific to this layer) ---
    const hasEnoughCopiesForIntersections = copies > 1;
    const displayIntersectionMarkers = 
        (useIntersections || (useStars && useCuts)) && 
        (hasEnoughCopiesForIntersections || (useStars && useCuts)) &&
        currentLayerIntersectionPoints && currentLayerIntersectionPoints.length > 0 && 
        copies > 0 && !isCurrentlyLerping;

    if (displayIntersectionMarkers) {
        const intersectionMarkerGroup = new THREE.Group();
        intersectionMarkerGroup.name = `${layerState.id}_intersections`;
        intersectionMarkerGroup.userData.isIntersectionGroup = true;
        for (const point of currentLayerIntersectionPoints) {
            const triggerData = {
                x: point.x, // These are already in layerGroup space (world space of the layer)
                y: point.y,
                isIntersection: true,
                intersectionIndex: perLayerVertexIndex, // Continue sequence from vertices
                layerId: layerState.id,
                pointIdInLayer: perLayerVertexIndex
            };
            const note = createNote(triggerData, layerState);
            const pointSizeFactor = (cameraDistance / 1000) * INTERSECTION_POINT_SIZE * (0.5 + note.duration) * 0.3;
            const intersectionPointMaterial = new THREE.MeshBasicMaterial({
                color: INTERSECTION_POINT_COLOR, transparent: true,
                opacity: note.velocity * INTERSECTION_POINT_OPACITY, depthTest: false, side: THREE.DoubleSide
            });
            const pointMesh = new THREE.Mesh(vertexCircleGeometry, intersectionPointMaterial);
            pointMesh.scale.set(pointSizeFactor, pointSizeFactor, 1);
            pointMesh.position.set(point.x, point.y, 0.2);
            pointMesh.renderOrder = 2;
            pointMesh.userData.triggerData = triggerData; // STORE TRIGGER DATA HERE
            intersectionMarkerGroup.add(pointMesh);

            if (shouldCreatePointLabels) {
                const labelId = `layer_${layerState.id}_intersect_${perLayerVertexIndex}`;
                // For intersection points, their positions (point.x, point.y) are already relative 
                // to the layerGroup if findAllIntersections returns them in that coordinate space.
                // If they are in the un-rotated space of one of the copies, more complex transform is needed.
                // Assuming point.x, point.y are in the same space as layerGroup's children after their transforms.
                // For robustness, use pointMesh.getWorldPosition.
                const worldPosition = pointMesh.getWorldPosition(new THREE.Vector3());
                let labelText = `${note.frequency.toFixed(1)}Hz`;
                if (note.noteName) {
                    labelText += ` (${note.noteName})`;
                }
                createOrUpdateLabel(labelId, worldPosition, labelText, camera, renderer);
                layerState.pointFreqLabelsArray.push(labelId);
            }

            perLayerVertexIndex++;
        }
        layerGroup.add(intersectionMarkerGroup);
    }
    
    // Store total points for this layer if needed for trigger logic outside
    layerState.totalPointsInLayer = perLayerVertexIndex;
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
function generateEuclideanRhythm(n, k) {
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
  const geometry = new THREE.BufferGeometry();
  
  if (debug) {
    console.log(`Creating Euclidean rhythm polygon with n=${n}, k=${k}`);
  }
  
  // Generate Euclidean rhythm pattern
  const pattern = generateEuclideanRhythm(n, k);
  
  // Debug: log the generated pattern
  console.log(`Euclidean rhythm pattern for n=${n}, k=${k}: ${JSON.stringify(pattern)}`);
  
  // Generate all vertex positions on the circle
  const allVertices = [];
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    allVertices.push(new THREE.Vector3(x, y, 0));
  }
  
  // Filter vertices based on the Euclidean pattern
  const selectedVertices = [];
  for (let i = 0; i < n; i++) {
    if (pattern[i]) {
      selectedVertices.push(allVertices[i]);
    }
  }
  
  // Ensure we have the correct number of vertices based on k
  console.log(`Selected ${selectedVertices.length} vertices from pattern, expected ${k}`);
  
  // If we have fewer vertices than k, there might be an issue with the pattern generation
  if (selectedVertices.length < k) {
    console.warn(`Got fewer vertices (${selectedVertices.length}) than expected (${k}). Forcing selection of ${k} vertices.`);
    
    // Force selection of k evenly distributed vertices
    selectedVertices.length = 0;
    const step = Math.floor(n / k);
    for (let i = 0; i < k; i++) {
      const index = (i * step) % n;
      selectedVertices.push(allVertices[index]);
    }
  }
  
  // Sort vertices by angle to maintain order around the circle
  selectedVertices.sort((a, b) => {
    const angleA = Math.atan2(a.y, a.x);
    const angleB = Math.atan2(b.y, b.x);
    return angleA - angleB;
  });
  
  // If no vertices were selected, return empty geometry
  if (selectedVertices.length === 0) {
    if (debug) {
      console.warn("Euclidean pattern resulted in no vertices");
    }
    return geometry;
  }
  
  // Create position array for geometry
  const vertices = [];
  
  // If fractal subdivision is enabled, add subdivision points
  if (useFractal && fractalValue > 1) {
    const subdivisions = fractalValue;
    
    for (let i = 0; i < selectedVertices.length; i++) {
      const startVertex = selectedVertices[i];
      const endVertex = selectedVertices[(i + 1) % selectedVertices.length];
      
      // Add the start vertex
      vertices.push(startVertex.x, startVertex.y, startVertex.z);
      
      // Create subdivision points between vertices
      for (let j = 1; j < subdivisions; j++) {
        const t = j / subdivisions;
        const x = startVertex.x + (endVertex.x - startVertex.x) * t;
        const y = startVertex.y + (endVertex.y - startVertex.y) * t;
        vertices.push(x, y, 0);
      }
    }
    
    // We don't need to add the first vertex again because the last subdivision 
    // connects back to the first vertex already
  } else {
    // Just add the selected vertices without subdivision
    for (const vertex of selectedVertices) {
      vertices.push(vertex.x, vertex.y, vertex.z);
    }
    
    // Add the first vertex again to close the loop
    if (selectedVertices.length > 0) {
      const firstVertex = selectedVertices[0];
      vertices.push(firstVertex.x, firstVertex.y, firstVertex.z);
    }
  }
  
  // Set up the attributes
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  
  return geometry;
}