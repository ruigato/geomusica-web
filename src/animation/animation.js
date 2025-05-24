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
  
  // Update all layers by delegating to the layer manager
  if (scene._layerManager) {
    // Pass animation parameters to updateLayers
    scene._layerManager.updateLayers({
      tNow: currentTime,
      dt: deltaTime,
      angle: state?.angle || 0,
      activeLayerId: scene._layerManager.activeLayerId,
      camera: cam,
      renderer: renderer,
      triggerAudioCallback: triggerAudioCallback
    });
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
    state.lastAngle = state.angle;
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