// src/animation/animation.js - Updated for browser performance timing
import * as THREE from 'three';
import { getCurrentTime } from '../time/time.js';
import { processPendingTriggers } from '../triggers/triggers.js';
import { ANIMATION_STATES, MAX_VELOCITY } from '../config/constants.js';
import { detectIntersections, applyVelocityToMarkers } from '../geometry/intersections.js';
import { updateLabelPositions } from '../ui/domLabels.js';

// Frame counter and timing stats
let frameCount = 0;
let lastTime = 0;
let fpsStats = { min: Infinity, max: 0, avg: 0, frames: 0, total: 0 };

/**
 * Main animation function using browser performance timing
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
  
  // Calculate time delta in seconds (with a reasonable cap to prevent huge jumps)
  const timeDelta = Math.min(currentTime - lastTime, 0.1); // Cap at 100ms
  
  // Update lastTime for next frame
  lastTime = currentTime;
  
  // Update FPS stats
  frameCount++;
  if (timeDelta > 0) {
    const fps = 1 / timeDelta;
    fpsStats.frames++;
    fpsStats.total += fps;
    fpsStats.avg = fpsStats.total / fpsStats.frames;
    fpsStats.min = Math.min(fpsStats.min, fps);
    fpsStats.max = Math.max(fpsStats.max, fps);
  }
  
  // Update stats if available
  if (stats) {
    stats.begin();
  }
  
  // Update state.lastTime which is used for angle calculation
  if (state && typeof state.lastTime !== 'undefined') {
    state.lastTime = currentTime;
  }
  
  // Process any pending quantized triggers
  if (triggerAudioCallback) {
    processPendingTriggers(currentTime, triggerAudioCallback, scene);
  }
  
  // Periodically log timing info
  if (frameCount % 300 === 0) {
    console.log(`[ANIMATION] Frame ${frameCount}, time: ${currentTime.toFixed(3)}s, ` + 
                `FPS: current=${(1/timeDelta).toFixed(1)}, ` +
                `avg=${fpsStats.avg.toFixed(1)}, ` +
                `min=${fpsStats.min.toFixed(1)}, ` +
                `max=${fpsStats.max.toFixed(1)}`);
    
    // Reset FPS stats occasionally to avoid long-term averaging skew
    if (frameCount % 3000 === 0) {
      fpsStats = { min: Infinity, max: 0, avg: 0, frames: 0, total: 0 };
    }
  }
  
  // Get the active layer from the scene if available
  const activeLayer = scene?._layerManager?.getActiveLayer();
  
  // Log active layer status on occasion
  if (frameCount % 600 === 0 && activeLayer) {
    console.log(`[ANIMATION] Active layer stats:`, {
      id: activeLayer.id,
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
    
    // Apply velocity updates to markers
    applyVelocityToMarkers(activeLayer, timeDelta);
    
    // Call the update method on the active layer
    if (typeof activeLayer.update === 'function') {
      activeLayer.update(currentTime, timeDelta);
    }
    
    // Also update the global angle in GlobalStateManager
    if (globalState && typeof globalState.updateAngle === 'function') {
      // Convert to ms for compatibility with the existing updateAngle method
      globalState.updateAngle(currentTime * 1000);
    }
    
    // IMPORTANT: Remove per-layer angle updates here
    // Layer rotation will be handled in LayerManager.updateLayers instead
    // This prevents double-application of rotation
    
    // Check if any markers need to trigger audio
    const markers = activeLayer.markers;
    if (markers && markers.length > 0) {
      for (let i = 0; i < markers.length; i++) {
        const marker = markers[i];
        
        // Skip markers that aren't in hit state
        if (marker.state !== ANIMATION_STATES.HIT) continue;
        
        // Get velocity from marker or use max velocity
        const velocity = marker.velocity !== undefined ? marker.velocity : MAX_VELOCITY;
        
        // Create frequency from marker and trigger audio
        const note = {
          frequency: marker.frequency,
          noteName: marker.noteName || "",
          velocity: velocity,
          duration: 0.5,
          x: marker.position.x,
          y: marker.position.y,
          // Add additional properties for debugging
          markerId: i,
          time: currentTime
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
  
  // Inside the animate function, after updating global angle
  // Add the updateLayers call for the layer manager
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
      camera: cam
    };
    
    // Update all layers via the layer manager
    scene._layerManager.updateLayers(animationParams);
  }
  
  // Render the scene
  renderer.render(scene, cam);
  
  // End stats tracking
  if (stats) {
    stats.end();
  }
}