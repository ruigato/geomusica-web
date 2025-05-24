// src/triggers/temporalTriggerIntegration.js - Integration between temporal engine and existing trigger system
import * as THREE from 'three';
import { TemporalTriggerEngine, TemporalCrossingResult, createNoteFromCrossing } from './temporalTriggers.js';
import { getCurrentTime } from '../time/time.js';

// Try to import createNote, but provide a fallback if it fails
let createNote;
try {
  createNote = (await import('../notes/notes.js')).createNote;
} catch (e) {
  
  createNote = (props) => ({ ...props, mock: true });
}

// Mock implementation of createMarker for the demo
export function createMarker(position, color, duration = 1.0) {
  
  return {
    position: position ? { ...position } : { x: 0, y: 0, z: 0 },
    color: color || 0xffffff,
    duration: duration,
    isMockMarker: true
  };
}

// Singleton instance of the temporal trigger engine
let temporalEngine = null;

/**
 * Get the global temporal engine instance or create it if it doesn't exist
 * @param {Object} options - Optional configuration for the engine
 * @returns {TemporalTriggerEngine} The temporal engine instance
 */
export function getTemporalEngine(options = {}) {
  if (!temporalEngine) {
    temporalEngine = new TemporalTriggerEngine(options);
    temporalEngine.initialize();
  }
  return temporalEngine;
}

/**
 * Reset the temporal engine, clearing all state
 */
export function resetTemporalEngine() {
  if (temporalEngine) {
    temporalEngine.clearAllHistory();
  }
}

/**
 * Apply temporal trigger detection to a layer
 * This function integrates with the existing trigger system
 * @param {Object} layer - Layer object
 * @param {number} tNow - Current time in seconds
 * @param {Function} audioCallback - Callback for audio triggering
 * @param {Object} options - Additional options
 * @returns {boolean} True if any triggers were detected
 */
export function detectTemporalLayerTriggers(layer, tNow, audioCallback, options = {}) {
  // Initialize if not done yet
  if (!temporalEngine) {
    getTemporalEngine();
  }
  
  // Validation
  if (!layer || !layer.group) {
    return false;
  }
  
  // Skip processing if group is not visible
  if (!layer.group.visible) {
    return false;
  }
  
  // Get state and scene
  const state = layer.state;
  const scene = layer.group?.parent;
  
  if (!state || !scene) {
    return false;
  }
  
  // Get camera and renderer
  let camera = scene?.userData?.camera;
  let renderer = scene?.userData?.renderer;
  
  // Try to get camera and renderer from layer's group if not found in scene
  if (!camera || !renderer) {
    camera = layer.group?.userData?.camera;
    renderer = layer.group?.userData?.renderer;
    
    // Try layer's ensureCameraAndRenderer method as a last resort
    if ((!camera || !renderer) && typeof layer.ensureCameraAndRenderer === 'function') {
      const result = layer.ensureCameraAndRenderer();
      camera = result.camera;
      renderer = result.renderer;
    }
  }
  
  // Get current and previous angle
  const angle = layer.currentAngle || 0;
  const lastAngle = layer.previousAngle || 0;
  
  // Check how many copies we have
  let copies = 0;
  if (state.copies) {
    copies = state.copies;
  } else if (layer.group.children) {
    // Count real copies (excluding intersection marker groups)
    copies = layer.group.children.filter(child => 
      !(child.userData && child.userData.isIntersectionGroup)
    ).length - 1; // Subtract 1 for the debug sphere
  }
  
  // Skip if no copies or zero segments
  if (copies <= 0 || state.segments <= 0) {
    return false;
  }
  
  // Create matrices for calculations
  const inverseRotationMatrix = new THREE.Matrix4().makeRotationZ(-angle);
  const rotationMatrix = new THREE.Matrix4().makeRotationZ(angle);
  
  // Setup variables for tracking triggers
  const triggeredNow = new Set();
  const triggeredPoints = [];
  
  // Track if we've triggered anything
  let anyTriggers = false;
  
  // Calculate cooldown in seconds
  const cooldownTime = options.cooldownTime || 
    (state.isLerping && state.isLerping() ? 0.250 : 0); // 250ms default during lerping
  
  // Process each copy
  for (let ci = 0; ci < copies; ci++) {
    // Find the correct copy group
    let copyIndex = ci;
    let copyGroup = null;
    let foundCopyCount = 0;
    
    // Find the copy group, skipping non-copy groups
    for (let i = 0; i < layer.group.children.length; i++) {
      const child = layer.group.children[i];
      // Skip debug objects and intersection groups
      if (child.userData && child.userData.isIntersectionGroup) continue;
      if (child.type === 'Mesh' && child.geometry && child.geometry.type === 'SphereGeometry') continue;
      if (child.type === 'Line') continue;
      
      // Count this as a valid copy group
      if (foundCopyCount === ci) {
        copyGroup = child;
        break;
      }
      
      // Otherwise, increment our counter and continue
      foundCopyCount++;
    }
    
    // Skip if we couldn't find a valid copy group
    if (!copyGroup || !copyGroup.children || copyGroup.children.length === 0) {
      continue;
    }
    
    // Find the LineLoop (main geometry)
    const mesh = copyGroup.children.find(child => child.type === 'LineLoop');
    if (!mesh) {
      continue;
    }
    
    // Validate geometry and attributes
    if (!mesh.geometry || !mesh.geometry.getAttribute('position')) {
      continue;
    }
    
    const positions = mesh.geometry.getAttribute('position');
    if (!positions || !positions.count) {
      continue;
    }
    
    const count = positions.count;
    
    // Validate base geometry
    if (!layer.baseGeo || !layer.baseGeo.getAttribute('position') || !layer.baseGeo.getAttribute('position').array) {
      continue;
    }
    
    const basePositions = layer.baseGeo.getAttribute('position').array;
    
    // Calculate world matrix without rotation
    const tempWorldMatrix = new THREE.Matrix4();
    mesh.updateMatrixWorld();
    tempWorldMatrix.copy(mesh.matrixWorld);
    tempWorldMatrix.premultiply(inverseRotationMatrix);
    
    // Temp vectors for calculations
    const worldPos = new THREE.Vector3();
    const currentTime = getCurrentTime();
    
    // Process each vertex in this copy
    for (let vi = 0; vi < count; vi++) {
      // Create a unique key for this vertex
      const vertexId = TemporalTriggerEngine.createVertexId(layer.id, ci, vi);
      
      // Skip if already triggered in this frame
      if (triggeredNow.has(vertexId)) continue;
      
      try {
        // Get current vertex world position (unrotated)
        worldPos.fromBufferAttribute(positions, vi);
        
        // Skip invalid vertices
        if (isNaN(worldPos.x) || isNaN(worldPos.y) || isNaN(worldPos.z)) {
          continue;
        }
        
        // Apply unrotated world matrix to get position in world space
        worldPos.applyMatrix4(tempWorldMatrix);
        
        // Store original non-rotated position for frequency calculation
        const nonRotatedPos = worldPos.clone();
        
        // Apply rotation for trigger detection
        const rotatedPos = nonRotatedPos.clone().applyMatrix4(rotationMatrix);
        
        // Record this position in the temporal engine
        temporalEngine.recordVertexPosition(
          vertexId,
          {
            x: rotatedPos.x,
            y: rotatedPos.y,
            z: rotatedPos.z
          },
          currentTime
        );
        
        // Check for trigger crossing
        const crossingResult = temporalEngine.detectCrossing(vertexId, cooldownTime);
        
        // Process if crossing detected
        if (crossingResult.hasCrossed) {
          // Check for overlap with previously triggered points
          if (!isPointOverlapping(crossingResult.position.x, crossingResult.position.y, triggeredPoints)) {
            // Add to triggered points
            triggeredPoints.push({ 
              x: crossingResult.position.x, 
              y: crossingResult.position.y 
            });
            
            // Check base geometry bounds
            if (vi * 3 + 1 >= basePositions.length) {
              
              continue;
            }
            
            // Get original local coordinates from the baseGeo for frequency calculation
            const x0 = basePositions[vi * 3];
            const y0 = basePositions[vi * 3 + 1];
            
            // Validate coordinates
            if (x0 === undefined || y0 === undefined || isNaN(x0) || isNaN(y0)) {
              
              continue;
            }
            
            // Calculate frequency from the non-rotated coordinates
            const frequency = Math.hypot(nonRotatedPos.x, nonRotatedPos.y);
            
            // Create base note with frequency
            const baseNote = createNote({
              x: nonRotatedPos.x,
              y: nonRotatedPos.y,
              frequency: frequency,
              copyIndex: ci,
              vertexIndex: vi,
              layerId: layer.id,
            }, state);
            
            // Create note from crossing with precise timing
            const note = createNoteFromCrossing(crossingResult, baseNote, state);
            
            // Handle quantization if enabled
            if (state.useQuantization) {
              // Handle quantization (re-use existing quantization logic)
              // This would be implemented based on the existing quantization code
              
              // For now, just trigger with exact time
              audioCallback(note);
              
              // Create visual marker
              createMarker(
                angle, 
                crossingResult.position.x, 
                crossingResult.position.y, 
                scene, 
                note, 
                camera, 
                renderer, 
                true, // isQuantized
                layer
              );
            } else {
              // Regular non-quantized trigger
              audioCallback(note);
              
              // Create visual marker
              createMarker(
                angle, 
                crossingResult.position.x, 
                crossingResult.position.y, 
                scene, 
                note, 
                camera, 
                renderer, 
                false, // not quantized
                layer
              );
            }
            
            // Add to triggered set
            triggeredNow.add(vertexId);
            anyTriggers = true;
          }
        }
      } catch (error) {
        console.error(`Error in temporal trigger detection for layer ${layer.id}, copy ${ci}, vertex ${vi}:`, error);
      }
    }
    
    // Process intersection points for this copy
    processIntersectionPoints(
      copyGroup, layer, ci, angle, lastAngle, tNow, audioCallback,
      triggeredNow, triggeredPoints, inverseRotationMatrix, rotationMatrix,
      camera, renderer, scene, cooldownTime
    );
  }
  
  // Update the layer's last triggered set
  layer.lastTrig = triggeredNow;
  
  return anyTriggers;
}

/**
 * Process intersection points for temporal trigger detection
 * @param {Object} copyGroup - Copy group containing intersection markers
 * @param {Object} layer - Layer object
 * @param {number} ci - Copy index
 * @param {number} angle - Current angle
 * @param {number} lastAngle - Previous angle
 * @param {number} tNow - Current time
 * @param {Function} audioCallback - Audio callback function
 * @param {Set} triggeredNow - Set of triggered points
 * @param {Array} triggeredPoints - Array of triggered point positions
 * @param {THREE.Matrix4} inverseRotationMatrix - Inverse rotation matrix
 * @param {THREE.Matrix4} rotationMatrix - Rotation matrix
 * @param {THREE.Camera} camera - Camera
 * @param {THREE.Renderer} renderer - Renderer
 * @param {THREE.Scene} scene - Scene
 * @param {number} cooldownTime - Cooldown time in seconds
 * @returns {boolean} True if any triggers were detected
 */
function processIntersectionPoints(
  copyGroup, layer, ci, angle, lastAngle, tNow, audioCallback,
  triggeredNow, triggeredPoints, inverseRotationMatrix, rotationMatrix,
  camera, renderer, scene, cooldownTime
) {
  // Skip if no copy group
  if (!copyGroup || !copyGroup.userData) {
    return false;
  }
  
  // Get state
  const state = layer.state;
  if (!state) {
    return false;
  }
  
  // Find intersection marker group
  let intersectionGroup = null;
  
  // First, check the standard location
  if (copyGroup.userData.intersectionMarkerGroup) {
    intersectionGroup = copyGroup.userData.intersectionMarkerGroup;
  } else {
    // Try to find an intersection group as a direct child
    for (let i = 0; copyGroup.children && i < copyGroup.children.length; i++) {
      const child = copyGroup.children[i];
      if (child.userData && child.userData.isIntersectionGroup) {
        intersectionGroup = child;
        break;
      }
    }
  }
  
  // Skip if no intersection group or children
  if (!intersectionGroup || !intersectionGroup.children) {
    return false;
  }
  
  // Get the temporal engine
  const engine = getTemporalEngine();
  
  // Determine if these are star cut intersections
  const isStarCuts = state.useStars && state.useCuts && state.starSkip > 1;
  
  // Calculate unrotated world matrix
  const tempWorldMatrix = new THREE.Matrix4();
  intersectionGroup.updateMatrixWorld();
  tempWorldMatrix.copy(intersectionGroup.matrixWorld);
  tempWorldMatrix.premultiply(inverseRotationMatrix);
  
  // Track if any triggers occurred
  let anyTriggers = false;
  
  // Get current time
  const currentTime = getCurrentTime();
  
  // Process each intersection marker
  for (let i = 0; i < intersectionGroup.children.length; i++) {
    const marker = intersectionGroup.children[i];
    
    // Skip non-mesh objects
    if (marker.type !== 'Mesh') {
      continue;
    }
    
    // Create a unique ID for this intersection point
    const intersectionId = TemporalTriggerEngine.createIntersectionId(layer.id, ci, i);
    
    // Skip if already triggered in this frame
    if (triggeredNow.has(intersectionId)) {
      continue;
    }
    
    try {
      // Get marker world position (unrotated)
      const worldPos = new THREE.Vector3().copy(marker.position);
      
      // Skip invalid positions
      if (isNaN(worldPos.x) || isNaN(worldPos.y) || isNaN(worldPos.z)) {
        continue;
      }
      
      // Apply unrotated world matrix
      worldPos.applyMatrix4(tempWorldMatrix);
      
      // Store unrotated position
      const nonRotatedPos = worldPos.clone();
      
      // Apply rotation for trigger detection
      const rotatedPos = nonRotatedPos.clone().applyMatrix4(rotationMatrix);
      
      // Record position in the temporal engine
      engine.recordVertexPosition(
        intersectionId,
        {
          x: rotatedPos.x,
          y: rotatedPos.y,
          z: rotatedPos.z
        },
        currentTime
      );
      
      // Check for trigger crossing
      const crossingResult = engine.detectCrossing(intersectionId, cooldownTime);
      
      // Process if crossing detected
      if (crossingResult.hasCrossed) {
        // Check for overlap with previously triggered points
        if (!isPointOverlapping(crossingResult.position.x, crossingResult.position.y, triggeredPoints)) {
          // Add to triggered points
          triggeredPoints.push({ 
            x: crossingResult.position.x, 
            y: crossingResult.position.y 
          });
          
          // Calculate frequency from the non-rotated coordinates
          const frequency = Math.hypot(nonRotatedPos.x, nonRotatedPos.y);
          
          // Create note for this intersection
          const baseNote = createNote({
            x: nonRotatedPos.x,
            y: nonRotatedPos.y,
            isIntersection: true,
            isStarCut: isStarCuts,
            intersectionIndex: i,
            copyIndex: ci,
            frequency: frequency,
          }, state);
          
          // Create note from crossing with precise timing
          const note = createNoteFromCrossing(crossingResult, baseNote, state);
          
          // Handle quantization if enabled
          if (state.useQuantization) {
            // For now, just trigger with exact time
            audioCallback(note);
            
            // Create visual marker
            createMarker(
              angle, 
              crossingResult.position.x, 
              crossingResult.position.y, 
              scene, 
              note, 
              camera, 
              renderer, 
              true, // isQuantized
              layer
            );
          } else {
            // Regular non-quantized trigger
            audioCallback(note);
            
            // Create visual marker
            createMarker(
              angle, 
              crossingResult.position.x, 
              crossingResult.position.y, 
              scene, 
              note, 
              camera, 
              renderer, 
              false, // not quantized
              layer
            );
          }
          
          // Add to triggered set
          triggeredNow.add(intersectionId);
          anyTriggers = true;
        }
      }
    } catch (error) {
      console.error(`Error in temporal intersection trigger detection for layer ${layer.id}, intersection ${i}:`, error);
    }
  }
  
  return anyTriggers;
}

/**
 * Check if a point is too close to any existing active points
 * @param {number} x Point x coordinate
 * @param {number} y Point y coordinate
 * @param {Array<Object>} activePoints Array of already active points
 * @returns {boolean} True if point is overlapping with existing points
 */
function isPointOverlapping(x, y, activePoints) {
  if (!activePoints || activePoints.length === 0) return false;
  
  const OVERLAP_THRESHOLD = 20; // From constants.js
  
  for (const point of activePoints) {
    const distance = Math.sqrt(Math.pow(x - point.x, 2) + Math.pow(y - point.y, 2));
    if (distance < OVERLAP_THRESHOLD) return true;
  }
  
  return false;
} 