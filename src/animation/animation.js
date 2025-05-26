// src/animation/animation.js - Enhanced for high framerate trigger detection with subframe precision
import * as THREE from 'three';
import { getCurrentTime } from '../time/time.js';
import { processPendingTriggers, clearLayerMarkers, detectLayerTriggers, resetTriggerSystem } from '../triggers/triggers.js';
import { ANIMATION_STATES, MAX_VELOCITY } from '../config/constants.js';
// DEPRECATED: Removed import from intersections.js - functionality deprecated
// import { detectIntersections, applyVelocityToMarkers } from '../geometry/intersections.js';
import { updateLabelPositions, updateAxisLabels } from '../ui/domLabels.js';

// Frame counter and timing stats
let frameCount = 0;
let lastAudioTime = 0;
let fpsStats = { min: Infinity, max: 0, avg: 0, frames: 0, total: 0 };

// Enhanced timing controls for high BPM support
const TARGET_FPS = 120; // Target 120 FPS for better trigger detection
const MIN_FRAME_TIME = 1 / TARGET_FPS;
const MAX_FRAME_TIME = MIN_FRAME_TIME * 2;

/**
 * Get current time safely, falling back to performance timing if audio timing isn't ready
 * @returns {number} Current time in seconds
 */
function getSafeTime() {
  try {
    return getCurrentTime();
  } catch (e) {
    return performance.now() / 1000;
  }
}

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
  
  // Initialize trigger system on first frame
  if (frameCount === 0) {
    resetTriggerSystem();
    lastAudioTime = getSafeTime(); // Initialize with safe time
  }
  
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
  
  // CRITICAL FIX: Increment frameCount BEFORE any early returns
  frameCount++;
  
  // Get current time from audio-synchronized timing system
  const currentAudioTime = getSafeTime();
  
  // Calculate time delta using audio time
  let timeDelta = currentAudioTime - lastAudioTime;
  
  // Clamp delta time for stability and precision
  timeDelta = Math.max(0, Math.min(timeDelta, MAX_FRAME_TIME));
  
  // Skip frame if delta is too small (prevents unnecessary processing)
  // But allow first few frames to pass through to get animation started
  if (timeDelta < MIN_FRAME_TIME * 0.5 && frameCount > 5) {
    return;
  }
  
  // Update lastTime for next frame using audio time
  lastAudioTime = currentAudioTime;
  if (timeDelta > 0) {
    const fps = 1 / timeDelta;
    fpsStats.frames++;
    fpsStats.total += fps;
    fpsStats.avg = fpsStats.total / fpsStats.frames;
    fpsStats.min = Math.min(fpsStats.min, fps);
    fpsStats.max = Math.max(fpsStats.max, fps);
    
    // Track high-speed performance using audio timing
    if (frameCount % 600 === 0) { // Log every 10 seconds at 60fps
      const performanceInfo = {
        currentFPS: fps.toFixed(1),
        avgFPS: fpsStats.avg.toFixed(1),
        minFPS: fpsStats.min.toFixed(1),
        maxFPS: fpsStats.max.toFixed(1),
        timeDelta: (timeDelta * 1000).toFixed(2) + 'ms',
        targetFPS: TARGET_FPS,
        audioTime: currentAudioTime.toFixed(3)
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
    state.lastTime = currentAudioTime;
  }
  
  // Process any pending quantized triggers with audio-synchronized timing
  if (triggerAudioCallback) {
    processPendingTriggers(currentAudioTime, triggerAudioCallback, scene);
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
    // DEPRECATED: needsIntersectionUpdate functionality removed
    // if (activeLayer.state.needsIntersectionUpdate) {
    //   // Only detect intersections if they're enabled
    //   const useIntersections = activeLayer.state.useIntersections === true;
    //   const useStarCuts = activeLayer.state.useStars === true && activeLayer.state.useCuts === true;
    //   
    //   // DEPRECATED: detectIntersections functionality removed
    //   // if (useIntersections || useStarCuts) {
    //   //   detectIntersections(activeLayer);
    //   // }
    //   
    //   // Always reset the flag regardless
    //   activeLayer.state.needsIntersectionUpdate = false;
    // }
    
    // DEPRECATED: applyVelocityToMarkers functionality removed
    // Apply velocity updates to markers with audio-synchronized timing
    // applyVelocityToMarkers(activeLayer, timeDelta);
    
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
    
    // Call the update method on the active layer with audio-synchronized timing
    if (typeof activeLayer.update === 'function') {
      activeLayer.update(currentAudioTime, timeDelta);
    }
    
    // Also update the global angle in GlobalStateManager with audio-synchronized timing
    if (globalState && typeof globalState.updateAngle === 'function') {
      globalState.updateAngle(currentAudioTime * 1000); // Convert to ms for compatibility
    }
    
    // Update DOM label positions if the function is available
    if (typeof updateLabelPositions === 'function') {
      updateLabelPositions(activeLayer, cam, renderer);
    }
    
    // Update and fade out axis labels
    if (typeof updateAxisLabels === 'function') {
      updateAxisLabels();
    }
  }
  
  // FIXED: Detect triggers on ALL visible layers with audio-synchronized timing
  if (triggerAudioCallback && scene._layerManager && scene._layerManager.layers) {
    for (const layer of scene._layerManager.layers) {
      if (layer && layer.visible && layer.state && layer.state.copies > 0) {
        const layerContext = {
          layerId: layer.id,
          time: currentAudioTime,
          callback: (note) => {
            const noteWithLayerId = {...note, layerId: layer.id};
            triggerAudioCallback(noteWithLayerId);
          }
        };
        
        detectLayerTriggers(layer, layerContext.time, layerContext.callback);
      }
    }
  }
  
  // Enhanced layer manager update with audio-synchronized timing
  if (scene._layerManager && typeof scene._layerManager.updateLayers === 'function') {
    const animationParams = {
      scene,
      tNow: currentAudioTime * 1000, // Convert to ms for backward compatibility
      dt: timeDelta * 1000,     // Convert to ms for backward compatibility
      angle: globalState?.lastAngle || 0,
      lastAngle: globalState?.previousAngle || 0,
      previousAngle: globalState?.previousAngle || 0,
      triggerAudioCallback,
      activeLayerId: scene._layerManager.activeLayerId,
      camera: cam,
      renderer: renderer,
      frameTime: timeDelta,
      targetFPS: TARGET_FPS,
      currentFPS: 1 / timeDelta,
      audioTime: currentAudioTime
    };
    
    scene._layerManager.updateLayers(animationParams);
    
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