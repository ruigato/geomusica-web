// src/animation/animation.js - Enhanced for high framerate trigger detection
import * as THREE from 'three';
import { getCurrentTime } from '../time/time.js';
import { processPendingTriggers, clearLayerMarkers } from '../triggers/triggers.js';
import { ANIMATION_STATES, MAX_VELOCITY } from '../config/constants.js';
import { detectIntersections, applyVelocityToMarkers } from '../geometry/intersections.js';
import { updateLabelPositions } from '../ui/domLabels.js';

// Frame counter and timing stats
let frameCount = 0;
let lastTime = 0;
let fpsStats = { min: Infinity, max: 0, avg: 0, frames: 0, total: 0 };

// Enhanced timing controls for high BPM support
const TARGET_FPS = 120; // Target 120 FPS for better trigger precision
const MIN_FRAME_TIME = 1 / TARGET_FPS; // Minimum time between frames
const MAX_FRAME_TIME = 1 / 30; // Maximum frame time to prevent huge jumps

/**
 * Main animation function with enhanced timing for high BPM support
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
      console.log(`[ANIMATION PERFORMANCE]`, performanceInfo);
      
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
    
    console.log(`[ANIMATION] Frame ${frameCount}, time: ${currentTime.toFixed(3)}s, ` + 
                `FPS: ${currentFPS.toFixed(1)}, BPM: ${bpm}, RotHz: ${rotationHz.toFixed(2)}, ` +
                `FrameTime: ${(timeDelta * 1000).toFixed(2)}ms`);
  }
  
  // Get the active layer from the scene if available
  const activeLayer = scene?._layerManager?.getActiveLayer();
  
  // Enhanced layer status logging for debugging trigger issues
  if (frameCount % 1200 === 0 && activeLayer) { // Every 20 seconds at 60fps
    const bpm = globalState?.bpm || 120;
    const currentFPS = 1 / timeDelta;
    const rotationSpeed = bpm / 240; // rotations per second
    const degreesPerFrame = (rotationSpeed * 360) / currentFPS;
    
    console.log(`[ANIMATION] Layer debug:`, {
      id: activeLayer.id,
      bpm: bpm,
      rotationHz: rotationSpeed.toFixed(3),
      degreesPerFrame: degreesPerFrame.toFixed(2),
      currentFPS: currentFPS.toFixed(1),
      visible: activeLayer.visible,
      groupVisible: activeLayer.group?.visible,
      childCount: activeLayer.group?.children.length,
      state: {
        radius: activeLayer.state.radius,
        segments: activeLayer.state.segments,
        copies: activeLayer.state.copies
      }
    });
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
    
    // Call the update method on the active layer with precise timing
    if (typeof activeLayer.update === 'function') {
      activeLayer.update(currentTime, timeDelta);
    }
    
    // Also update the global angle in GlobalStateManager with enhanced precision
    if (globalState && typeof globalState.updateAngle === 'function') {
      // Convert to ms for compatibility with the existing updateAngle method
      globalState.updateAngle(currentTime * 1000);
    }
    
    // Check if any markers need to trigger audio
    const markers = activeLayer.markers;
    if (markers && markers.length > 0) {
      for (let i = 0; i < markers.length; i++) {
        const marker = markers[i];
        
        // Skip markers that aren't in hit state
        if (marker.state !== ANIMATION_STATES.HIT) continue;
        
        // Get velocity from marker or use max velocity
        const velocity = marker.velocity !== undefined ? marker.velocity : MAX_VELOCITY;
        
        // Create frequency from marker and trigger audio with precise timing
        const note = {
          frequency: marker.frequency,
          noteName: marker.noteName || "",
          velocity: velocity,
          duration: 0.5,
          x: marker.position.x,
          y: marker.position.y,
          // Add additional properties for debugging
          markerId: i,
          time: currentTime,
          frameTime: timeDelta, // Add frame timing info
          bpm: globalState?.bpm || 120
        };
        
        triggerAudioCallback(note);
        
        // Change state to triggered
        marker.state = ANIMATION_STATES.TRIGGERED;
      }
    }
    
    // Update DOM label positions if the function is available
    if (typeof updateLabelPositions === 'function') {
      updateLabelPositions(activeLayer, cam, renderer);
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
      camera: cam,
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