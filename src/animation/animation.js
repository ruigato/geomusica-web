// src/animation/animation.js - Enhanced for high framerate trigger detection with subframe precision
import * as THREE from 'three';
import { getCurrentTime } from '../time/time.js';
import { processPendingTriggers, clearLayerMarkers, createMarker } from '../triggers/triggers.js';
import { ANIMATION_STATES, MAX_VELOCITY } from '../config/constants.js';
import { detectIntersections, applyVelocityToMarkers } from '../geometry/intersections.js';
import { updateLabelPositions, updateAxisLabels } from '../ui/domLabels.js';
import { TemporalTriggerEngine, TemporalCrossingResult } from '../SubframeTrigger.js';

// Frame counter and timing stats
let frameCount = 0;
let lastTime = 0;
let fpsStats = { min: Infinity, max: 0, avg: 0, frames: 0, total: 0 };

// Enhanced timing controls for high BPM support
const TARGET_FPS = 120; // Target 120 FPS for better trigger precision
const MIN_FRAME_TIME = 1 / TARGET_FPS; // Minimum time between frames
const MAX_FRAME_TIME = 1 / 30;

// Subframe trigger engine
const subframeEngine = new TemporalTriggerEngine({
  resolution: 1000, // 1000Hz = 1ms resolution
  maxMemory: 100
});

// Initialize the engine
subframeEngine.initialize();

// Subframe timing variables
let lastPositionRecordTime = 0;
const POSITION_RECORD_INTERVAL = 1 / 120; // Record positions at max 120Hz for efficiency
const DEFAULT_COOLDOWN_TIME = 0.05; // 50ms default cooldown between triggers

/**
 * Main animation function with enhanced subframe timing for high BPM support
 * @param {Object} props Animation properties and dependencies
 */
export function animate(props) {
  const { 
    scene, 
    cam, 
    renderer, 
    state, 
    triggerAudioCallback, 
    globalState,
    stats 
  } = props;
  
  // IMPORTANT: Set camera and renderer in scene userData at the very beginning
  // This ensures they're available throughout the entire frame
  if (scene && cam && renderer) {
    scene.userData.camera = cam;
    scene.userData.renderer = renderer;
    
    // Also ensure each layer has access to camera and renderer
    if (scene._layerManager && scene._layerManager.layers) {
      scene._layerManager.layers.forEach(layer => {
        // Make sure the layer's group has references to camera and renderer
        if (layer && layer.group) {
          layer.group.userData.camera = cam;
          layer.group.userData.renderer = renderer;
        }
      });
    }
  }
  
  // Use requestAnimationFrame to schedule the next frame
  requestAnimationFrame(() => animate(props));
  
  // Get current time in seconds using browser performance API
  const currentTime = getCurrentTime();
  
  // Calculate time delta with enhanced precision control
  let timeDelta = currentTime - lastTime;
  
  // Clamp delta time for stability and precision
  timeDelta = Math.max(0, Math.min(timeDelta, MAX_FRAME_TIME));
  
  // Skip frame if delta is too small (prevents unnecessary processing)
  if (timeDelta < MIN_FRAME_TIME * 0.5) {
    return;
  }
  
  // Update lastTime for next frame
  lastTime = currentTime;
  
  // Update FPS stats with enhanced tracking
  frameCount++;
  if (timeDelta > 0) {
    const fps = 1 / timeDelta;
    fpsStats.frames++;
    fpsStats.total += fps;
    fpsStats.avg = fpsStats.total / fpsStats.frames;
    fpsStats.min = Math.min(fpsStats.min, fps);
    fpsStats.max = Math.max(fpsStats.max, fps);
    
    // Track high-speed performance
    if (frameCount % 600 === 0) { // Log every 10 seconds at 60fps
      const performanceInfo = {
        currentFPS: fps.toFixed(1),
        avgFPS: fpsStats.avg.toFixed(1),
        minFPS: fpsStats.min.toFixed(1),
        maxFPS: fpsStats.max.toFixed(1),
        timeDelta: (timeDelta * 1000).toFixed(2) + 'ms',
        targetFPS: TARGET_FPS
      };
      
      
      // Reset stats periodically to avoid skew
      if (frameCount % 6000 === 0) {
        fpsStats = { min: Infinity, max: 0, avg: 0, frames: 0, total: 0 };
      }
    }
  }
  
  // Update stats if available
  if (stats) {
    stats.begin();
  }
  
  // Update state.lastTime which is used for angle calculation
  if (state && typeof state.lastTime !== 'undefined') {
    state.lastTime = currentTime;
  }
  
  // Process any pending quantized triggers with high precision timing
  if (triggerAudioCallback) {
    processPendingTriggers(currentTime, triggerAudioCallback, scene);
  }
  
  // Log timing info with enhanced frequency for debugging high BPM issues
  if (frameCount % 300 === 0) {
    const currentFPS = 1 / timeDelta;
    const bpm = globalState?.bpm || 120;
    const rotationHz = bpm / 240; // Rotations per second
    
    
  }
  
  // Get the active layer from the scene if available
  const activeLayer = scene?._layerManager?.getActiveLayer();
  
  // Enhanced layer status logging for debugging trigger issues
  if (frameCount % 1200 === 0 && activeLayer) { // Every 20 seconds at 60fps
    const bpm = globalState?.bpm || 120;
    const currentFPS = 1 / timeDelta;
    const rotationSpeed = bpm / 240; // rotations per second
    const degreesPerFrame = (rotationSpeed * 360) / currentFPS;
    
    
  }
  
  // Handle active layer if available (prefer it over passed-in group)
  if (activeLayer) {
    // Force visibility in case it was toggled off
    if (!activeLayer.visible) {
      activeLayer.visible = true;
      if (activeLayer.group) {
        activeLayer.group.visible = true;
      }
    }
    
    // Update markers (dots) based on intersections
    if (activeLayer.state.needsIntersectionUpdate) {
      // Only detect intersections if they're enabled
      const useIntersections = activeLayer.state.useIntersections === true;
      const useStarCuts = activeLayer.state.useStars === true && activeLayer.state.useCuts === true;
      
      if (useIntersections || useStarCuts) {
        detectIntersections(activeLayer);
      }
      
      // Always reset the flag regardless
      activeLayer.state.needsIntersectionUpdate = false;
    }
    
    // Apply velocity updates to markers with enhanced timing
    applyVelocityToMarkers(activeLayer, timeDelta);
    
    // Ensure camera and renderer are set in the layer's group before updating
    if (activeLayer.group && cam && renderer) {
      if (!activeLayer.group.userData) activeLayer.group.userData = {};
      activeLayer.group.userData.camera = cam;
      activeLayer.group.userData.renderer = renderer;
      
      // Also ensure the scene has them
      if (scene) {
        scene.userData = scene.userData || {};
        scene.userData.camera = cam;
        scene.userData.renderer = renderer;
      }
    }
    
    // Call the update method on the active layer with precise timing
    if (typeof activeLayer.update === 'function') {
      activeLayer.update(currentTime, timeDelta);
    }
    
    // Also update the global angle in GlobalStateManager with enhanced precision
    if (globalState && typeof globalState.updateAngle === 'function') {
      // Convert to ms for compatibility with the existing updateAngle method
      globalState.updateAngle(currentTime * 1000);
    }
    
    // SUBFRAME ENHANCEMENT: Record positions at fixed intervals
    // This decouples position recording from frame rate for more consistent trigger detection
    if (currentTime - lastPositionRecordTime >= POSITION_RECORD_INTERVAL) {
      recordLayerVertexPositions(activeLayer, currentTime);
      lastPositionRecordTime = currentTime;
    }
    
    // SUBFRAME ENHANCEMENT: Check for triggers with subframe precision
    detectSubframeTriggers(activeLayer, currentTime, triggerAudioCallback, cam, renderer, scene);
    
    // Update DOM label positions if the function is available
    if (typeof updateLabelPositions === 'function') {
      updateLabelPositions(activeLayer, cam, renderer);
    }
    
    // Update and fade out axis labels
    if (typeof updateAxisLabels === 'function') {
      updateAxisLabels();
    }
  }
  
  // Enhanced layer manager update with high precision timing
  if (scene._layerManager && typeof scene._layerManager.updateLayers === 'function') {
    // Create animation parameters to pass to the layer manager
    const animationParams = {
      scene,
      tNow: currentTime * 1000, // Convert to ms for backward compatibility
      dt: timeDelta * 1000,     // Convert to ms for backward compatibility
      angle: globalState?.lastAngle || 0,
      lastAngle: globalState?.previousAngle || 0,
      triggerAudioCallback,
      activeLayerId: scene._layerManager.activeLayerId,
      camera: cam,              // Pass camera reference
      renderer: renderer,       // Pass renderer reference
      // Enhanced timing information
      frameTime: timeDelta,
      targetFPS: TARGET_FPS,
      currentFPS: 1 / timeDelta
    };
    
    // Update all layers via the layer manager
    scene._layerManager.updateLayers(animationParams);
    
    // IMPORTANT: Clean up expired markers for all layers
    // This was missing and is why markers weren't fading out!
    if (scene._layerManager.layers) {
      for (const layer of scene._layerManager.layers) {
        if (layer && typeof clearLayerMarkers === 'function') {
          clearLayerMarkers(layer);
        }
      }
    }
  }
  
  // Render the scene
  renderer.render(scene, cam);
  
  // End stats tracking
  if (stats) {
    stats.end();
  }
}

/**
 * Record vertex positions for a layer into the subframe engine
 * @param {Object} layer Layer to record positions for
 * @param {number} timestamp Current time in seconds
 */
function recordLayerVertexPositions(layer, timestamp) {
  if (!layer || !layer.group) return;
  
  const state = layer.state;
  const group = layer.group;
  
  // Skip if group is not visible
  if (!group.visible) return;
  
  // Check how many copies we have
  let copies = 0;
  if (state.copies) {
    copies = state.copies;
  } else if (group.children) {
    // Count real copies (excluding intersection marker groups)
    copies = group.children.filter(child => 
      !(child.userData && child.userData.isIntersectionGroup)
    ).length - 1; // Subtract 1 for the debug sphere
  }
  
  // Skip if no copies or zero segments
  if (copies <= 0 || state.segments <= 0) return;
  
  // Get angle for rotation calculations
  const angle = layer.currentAngle || 0;
  
  // Create matrices for calculations
  const inverseRotationMatrix = new THREE.Matrix4().makeRotationZ(-angle);
  const rotationMatrix = new THREE.Matrix4().makeRotationZ(angle);
  
  // Process each copy
  for (let ci = 0; ci < copies; ci++) {
    // Find the correct copy group
    let copyIndex = ci;
    let copyGroup = null;
    let foundCopyCount = 0;
    
    // Find the copy group, skipping non-copy groups
    for (let i = 0; i < group.children.length; i++) {
      const child = group.children[i];
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
    
    // Calculate world matrix without rotation
    const tempWorldMatrix = new THREE.Matrix4();
    mesh.updateMatrixWorld();
    tempWorldMatrix.copy(mesh.matrixWorld);
    tempWorldMatrix.premultiply(inverseRotationMatrix);
    
    // Temp vector for calculations
    const worldPos = new THREE.Vector3();
    
    // Process each vertex in this copy
    for (let vi = 0; vi < count; vi++) {
      // Create a unique vertex ID
      const vertexId = `${layer.id}-${ci}-${vi}`;
      
      try {
        // Get current vertex world position (unrotated)
        worldPos.fromBufferAttribute(positions, vi);
        
        // Skip invalid vertices
        if (isNaN(worldPos.x) || isNaN(worldPos.y) || isNaN(worldPos.z)) {
          continue;
        }
        
        // Apply unrotated world matrix to get position in world space
        worldPos.applyMatrix4(tempWorldMatrix);
        
        // Apply rotation for trigger detection
        const rotatedPos = worldPos.clone().applyMatrix4(rotationMatrix);
        
        // Record position in subframe engine
        subframeEngine.recordVertexPosition(
          vertexId,
          {
            x: rotatedPos.x,
            y: rotatedPos.y,
            z: rotatedPos.z
          },
          timestamp
        );
      } catch (error) {
        console.error(`Error recording vertex position for layer ${layer.id}, copy ${ci}, vertex ${vi}:`, error);
      }
    }
  }
}

/**
 * Detect triggers using subframe precision
 * @param {Object} layer Layer to detect triggers for
 * @param {number} timestamp Current time in seconds
 * @param {Function} audioCallback Callback for triggered audio
 * @param {THREE.Camera} camera Camera for visual feedback
 * @param {THREE.WebGLRenderer} renderer Renderer for visual feedback
 * @param {THREE.Scene} scene Scene for adding visual markers
 */
function detectSubframeTriggers(layer, timestamp, audioCallback, camera, renderer, scene) {
  if (!layer || !layer.group || !audioCallback) return;
  
  const state = layer.state;
  const group = layer.group;
  
  // Skip if group is not visible
  if (!group.visible) return;
  
  // Get cooldown time from state or use default
  const cooldownTime = state.triggerCooldown || DEFAULT_COOLDOWN_TIME;
  
  // Check how many copies we have
  let copies = 0;
  if (state.copies) {
    copies = state.copies;
  } else if (group.children) {
    // Count real copies (excluding intersection marker groups)
    copies = group.children.filter(child => 
      !(child.userData && child.userData.isIntersectionGroup)
    ).length - 1; // Subtract 1 for the debug sphere
  }
  
  // Skip if no copies or zero segments
  if (copies <= 0 || state.segments <= 0) return;
  
  // Get angle for calculations
  const angle = layer.currentAngle || 0;
  
  // Process each copy
  for (let ci = 0; ci < copies; ci++) {
    // Process each vertex in this copy
    for (let vi = 0; vi < state.segments; vi++) {
      // Create a unique vertex ID
      const vertexId = `${layer.id}-${ci}-${vi}`;
      
      try {
        // Check for trigger crossing with subframe precision
        const crossingResult = subframeEngine.detectCrossing(vertexId, cooldownTime);
        
        // Process if crossing detected
        if (crossingResult.hasCrossed) {
          // Create frequency based on vertex properties (similar to original system)
          // This is a simplified version - you might need to adapt this based on your existing code
          const baseFreq = 440; // A4
          const octaveOffset = (ci % 4) - 2; // -2 to +1 octave range
          const semitoneOffset = vi % 12; // 0 to 11 semitones
          
          const frequency = baseFreq * Math.pow(2, octaveOffset + semitoneOffset/12);
          
          // Create note object
          const note = {
            frequency: frequency,
            noteName: `Note-${vi}`,
            velocity: 0.8, // Default velocity
            duration: 0.5,
            x: crossingResult.position.x,
            y: crossingResult.position.y,
            z: crossingResult.position.z,
            time: crossingResult.exactTime, // Use precise crossing time
            isSubframe: true,
            vertexId: vertexId
          };
          
          // Trigger audio with the precise crossing time
          audioCallback(note);
          
          // Add visual marker at crossing position
          // This assumes you have a createMarker function similar to the one in triggers.js
          if (typeof createMarker === 'function') {
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
        }
      } catch (error) {
        console.error(`Error in subframe trigger detection for layer ${layer.id}, copy ${ci}, vertex ${vi}:`, error);
      }
    }
  }
}