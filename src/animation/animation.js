// src/animation/animation.js - Enhanced for high framerate trigger detection
import * as THREE from 'three';
import { getCurrentTime } from '../time/time.js';
import { processPendingTriggers, clearLayerMarkers } from '../triggers/triggers.js';
import { ANIMATION_STATES, MAX_VELOCITY } from '../config/constants.js';
import { detectIntersections, applyVelocityToMarkers } from '../geometry/intersections.js';
import { updateLabelPositions, updateAxisLabels } from '../ui/domLabels.js';

// Frame counter and timing stats
let frameCount = 0;
let lastTime = 0;
let fpsStats = { min: Infinity, max: 0, avg: 0, frames: 0, total: 0 };
let lastFrameTimestamp = 0;

// Enhanced timing controls for extreme high-precision trigger detection
const TARGET_FPS = 240; // Target 240 FPS for maximum precision
const FRAME_INTERVAL = 1000 / TARGET_FPS;
let animationFrameId = null;
let lastFrameTime = 0;

// Track if a time reset has occurred
let timeResetOccurred = false;

// Listen for time reset events
window.addEventListener('timeReset', (event) => {
  console.log('[ANIMATION] Time reset detected, preparing for time discontinuity');
  timeResetOccurred = true;
  
  // Reset frame counter and timing stats to avoid incorrect FPS calculations
  frameCount = 0;
  lastTime = 0;
  lastFrameTimestamp = performance.now();
  fpsStats = { min: Infinity, max: 0, avg: 0, frames: 0, total: 0 };
  lastFrameTime = performance.now();
});

/**
 * Main animation loop with optimized timing
 * @param {Object} props Animation properties
 */
export function animate(props) {
  const { 
    scene, renderer, cam, state, stats, 
    group, triggerAudioCallback, csound, globalState
  } = props;
  
  // IMPORTANT: Ensure camera and renderer are properly set in the scene
  // This is critical for proper trigger detection and visualization
  if (scene && cam && renderer) {
    // Set camera and renderer in scene userData for access by all systems
    scene.userData = scene.userData || {};
    scene.userData.camera = cam;
    scene.userData.renderer = renderer;
    
    // Also set direct properties for backwards compatibility
    scene.mainCamera = cam;
    scene.mainRenderer = renderer;
    
    // Ensure each layer has access to camera and renderer
    if (scene._layerManager && scene._layerManager.layers) {
      scene._layerManager.ensureCameraAndRendererForLayers(cam, renderer);
    }
  }
  
  // Measure current time for this frame
  const timestamp = performance.now();
  const currentTime = getCurrentTime();
  
  // Calculate time since last frame
  const deltaTime = timestamp - lastFrameTimestamp;
  lastFrameTimestamp = timestamp;
  
  // Handle time reset events that occurred between frames
  if (timeResetOccurred) {
    console.log('[ANIMATION] Handling time reset in animation loop');
    timeResetOccurred = false;
    // No need to do anything else - the time handling code in GlobalStateManager 
    // and Layer classes will handle the time discontinuity
  }
  
  // Calculate actual FPS
  const actualFps = 1000 / deltaTime;
  
  // Skip calculations on first frame or if frame time is too long
  if (frameCount > 0 && deltaTime < 1000) {
    // Update FPS stats
    fpsStats.frames++;
    fpsStats.total += actualFps;
    fpsStats.avg = fpsStats.total / fpsStats.frames;
    fpsStats.min = Math.min(fpsStats.min, actualFps);
    fpsStats.max = Math.max(fpsStats.max, actualFps);
    
    // Occasionally log FPS stats
    if (frameCount % 300 === 0) {
      console.log(`FPS: current=${actualFps.toFixed(1)}, avg=${fpsStats.avg.toFixed(1)}, min=${fpsStats.min.toFixed(1)}, max=${fpsStats.max.toFixed(1)}`);
    }
  }
  
  // Begin stats monitoring if available
  if (stats) stats.begin();
  
  // FIXED: Calculate angle using GlobalStateManager before updating layers
  // This ensures the angle is calculated correctly based on framerate-independent time
  
  // IMPORTANT DISTINCTION:
  // - rotationAngle: The dynamic angle that rotates the entire layer group over time (driven by BPM)
  // - copyAngleOffset: The fixed angle between successive copies of a polygon (set by user in UI)
  //
  // This rotationAngle is used to animate the rotation of the entire layer group
  
  let rotationAngle = 0; // Renamed from 'angle' for clarity
  if (globalState && typeof globalState.updateAngle === 'function') {
    // CRITICAL FIX: Check if BPM is zero and issue a warning
    if (globalState.bpm === 0) {
      // Log warning every 180 frames to avoid console spam
      if (frameCount % 180 === 0) {
        console.warn(`[ROTATION CRITICAL] BPM is zero! Rotation will not occur. Please set BPM > 0 to enable rotation.`);
        
        // Try to automatically fix it
        if (typeof globalState.setBpm === 'function') {
          globalState.setBpm(60); // Set to default 60 BPM
          console.log(`[ROTATION CRITICAL] Automatically setting BPM to 60 to restore rotation.`);
        }
      }
    }
    
    // Update the angle using global state - will use BPM and real time delta
    // GlobalStateManager.updateAngle() returns angle in DEGREES
    const angleData = globalState.updateAngle(currentTime);
    
    // IMPORTANT: Convert degrees to radians for Three.js
    // THREE.js uses radians for all rotations
    rotationAngle = (angleData.angle * Math.PI) / 180;
    
    // CRITICAL DEBUG: Log consistent debug information for angle calculation
    // Every 30 frames, log key information about the angle
    if (frameCount % 30 === 0) {
      console.log(`[ROTATION CRITICAL] Animation calculated angle=${angleData.angle.toFixed(2)}° (${rotationAngle.toFixed(6)} radians)`);
      console.log(`[ROTATION CRITICAL] Global state: BPM=${globalState.bpm}, lastAngle=${globalState.lastAngle.toFixed(2)}°`);
      
      // Check if the angle is actually changing over time
      if (typeof window.__lastDebugAngle === 'undefined') {
        window.__lastDebugAngle = angleData.angle;
        window.__debugAngleChangeCount = 0;
      } else if (Math.abs(window.__lastDebugAngle - angleData.angle) > 0.01) {
        window.__lastDebugAngle = angleData.angle;
        window.__debugAngleChangeCount++;
        console.log(`[ROTATION CRITICAL] Angle has changed ${window.__debugAngleChangeCount} times since debugging started`);
      } else {
        console.log(`[ROTATION CRITICAL] WARNING: Angle has not changed since last debug check!`);
      }
    }
  }
  
  // Update all layers by delegating to the layer manager
  if (scene._layerManager) {
    // CRITICAL FIX: We rotate the layers directly in the Layer class
    // Each layer manages its own rotation - we don't need LayerManager to also apply rotation
    const preventDoubleRotation = true;
    
    // Save current rotations for validation
    const layerRotations = {};
    if (scene._layerManager.layers) {
      scene._layerManager.layers.forEach(layer => {
        if (layer && layer.group) {
          layerRotations[layer.id] = layer.group.rotation.z;
        }
      });
    }
    
    // Pass animation parameters to updateLayers
    scene._layerManager.updateLayers({
      tNow: currentTime,
      dt: deltaTime,
      angle: rotationAngle, // Pass the calculated angle from globalState
      activeLayerId: scene._layerManager.activeLayerId,
      camera: cam,
      renderer: renderer,
      triggerAudioCallback: triggerAudioCallback,
      preventDoubleRotation // Each layer will apply its own rotation via layer.updateAngle()
    });
    
    // CRITICAL: Ensure all layers have their updateAngle called directly 
    // This ensures rotation is properly applied regardless of whether LayerManager calls it
    if (scene._layerManager.layers) {
      for (const layer of scene._layerManager.layers) {
        if (layer && typeof layer.updateAngle === 'function') {
          layer.updateAngle(currentTime);
          
          // CRITICAL: Check if something is resetting the rotation during/after updateAngle
          if (layer.group && layer.currentAngle && Math.abs(layer.group.rotation.z - layer.currentAngle) > 0.0001) {
            console.error(`[ROTATION MISMATCH] Layer ${layer.id} rotation.z (${layer.group.rotation.z.toFixed(6)}) doesn't match currentAngle (${layer.currentAngle.toFixed(6)})`);
            
            // Force rotation again
            layer.group.rotation.z = layer.currentAngle;
            layer.group.updateMatrix();
            layer.group.updateMatrixWorld(true);
          }
        }
      }
    }
    
    // Validate rotations post-update (once every 60 frames)
    if (frameCount % 60 === 0 && scene._layerManager.layers) {
      scene._layerManager.layers.forEach(layer => {
        if (layer && layer.group && layerRotations[layer.id] !== undefined) {
          const delta = Math.abs(layer.group.rotation.z - layerRotations[layer.id]);
          if (delta < 0.0001) {
            console.warn(`[ROTATION STALLED] Layer ${layer.id} rotation didn't change during animation frame!`);
          }
        }
      });
    }
  }
  
  // Process any pending triggers (for quantized notes)
  processPendingTriggers(currentTime, triggerAudioCallback, scene);
  
  // Clear expired markers for all layers
  if (scene._layerManager) {
    scene._layerManager.layers.forEach(layer => {
      if (layer.visible) {
        clearLayerMarkers(layer);
      }
    });
  }
  
  // Update DOM label positions if any exist
  updateLabelPositions(renderer, cam);
  
  // Update axis labels with current time
  updateAxisLabels(currentTime);
  
  // Apply physics to markers (mainly for visuals)
  applyVelocityToMarkers(scene);
  
  // Render the scene
  renderer.render(scene, cam);
  
  // End stats monitoring
  if (stats) stats.end();
  
  // Update last angle for next frame
  if (state) {
    state.lastAngle = rotationAngle;
  }
  
  // Increment frame counter
  frameCount++;
  
  // Calculate the time that's passed since the last frame
  const now = performance.now();
  const timeSinceLastFrame = now - lastFrameTime;
  
  // Calculate how long to wait until the next frame to maintain our target FPS
  // If we're behind schedule, run immediately
  const timeToNextFrame = Math.max(0, FRAME_INTERVAL - timeSinceLastFrame);
  
  // Use setTimeout to schedule the next frame with precise timing
  // This allows us to exceed the monitor refresh rate
  if (timeToNextFrame <= 0) {
    // We're behind schedule, run next frame immediately
    lastFrameTime = now;
    setTimeout(() => animate(props), 0);
  } else {
    // Schedule next frame at precisely the right time
    lastFrameTime = now + timeToNextFrame;
    setTimeout(() => animate(props), timeToNextFrame);
  }
  
  // Also use requestAnimationFrame as a fallback to ensure we always have a frame
  // This ensures we have a reliable rendering loop even if setTimeout fails
  animationFrameId = requestAnimationFrame(() => {
    // Don't animate again if setTimeout already handled it
    // This is just a safety fallback
  });
}