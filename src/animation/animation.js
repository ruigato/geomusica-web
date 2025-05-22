// src/animation/animation.js - Updated to use browser performance timing
import * as THREE from 'three';
import { ANIMATION_STATES, MAX_VELOCITY, MARK_LIFE } from '../config/constants.js';
import { detectIntersections, applyVelocityToMarkers } from '../geometry/intersections.js';
import { getCurrentTime } from '../time/time.js';
import { updateLabelPositions } from '../ui/domLabels.js';

// Track the last frame time
let lastTime = 0;
let frameCount = 0;
let fpsStats = { min: Infinity, max: 0, avg: 0, frames: 0, total: 0 };

/**
 * Main animation function
 * Uses browser performance timing for smooth animation
 */
export function animate(props) {
  const { 
    scene, 
    renderer, 
    group, 
    cam, 
    baseGeo, 
    mat, 
    stats, 
    state, 
    globalState,
    triggerAudioCallback
  } = props;
  
  // Always request next frame first to ensure animation loop continues
  requestAnimationFrame(() => animate(props));
  
  // Skip animation frame if scene or renderer isn't ready
  if (!scene || !renderer) {
    return;
  }
  
  frameCount++;
  
  // Update stats if available
  if (stats) {
    stats.begin();
  }
  
  // Get current time from time.js - Simple browser performance timing
  const currentTime = getCurrentTime();
  
  // Calculate time delta
  let timeDelta = 0;
  if (lastTime > 0) {
    // Compute delta in seconds, clamping to reasonable values
    timeDelta = Math.min(0.1, Math.max(0.001, currentTime - lastTime));
    
    // Track FPS stats
    const fps = 1 / timeDelta;
    fpsStats.min = Math.min(fpsStats.min, fps);
    fpsStats.max = Math.max(fpsStats.max, fps);
    fpsStats.total += fps;
    fpsStats.frames++;
    fpsStats.avg = fpsStats.total / fpsStats.frames;
  }
  
  // Store current time for next frame
  lastTime = currentTime;
  
  // Update state.lastTime which is used for angle calculation
  if (state && typeof state.lastTime !== 'undefined') {
    state.lastTime = currentTime;
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
      detectIntersections(activeLayer);
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
    
    // Update all layers with their respective angles
    if (scene._layerManager && scene._layerManager.layers) {
      scene._layerManager.layers.forEach(layer => {
        if (layer && layer.visible && typeof layer.updateAngle === 'function') {
          layer.updateAngle(currentTime);
        }
      });
    }
    
    // Check if any markers need to trigger audio
    const markers = activeLayer.markers;
    if (markers) {
      markers.forEach(marker => {
        // Check if marker was hit in this frame
        if (marker.animState === ANIMATION_STATES.HIT && 
            marker.velocity >= MAX_VELOCITY * 0.9 && 
            marker.justHit && 
            triggerAudioCallback) {
          
          // Create note object
          const note = {
            frequency: marker.frequency || 440,
            velocity: 0.8,
            duration: marker.lifetime / 1000 || 0.5,
            pan: marker.pan || 0
          };
          
          // Trigger audio
          triggerAudioCallback(note);
          
          // Mark as processed
          marker.justHit = false;
        }
      });
    }
  }
  
  // Update DOM label positions if we have an active layer
  if (activeLayer && activeLayer.markers) {
    updateLabelPositions(activeLayer.markers, cam, renderer);
  }
  
  // Render the scene
  renderer.render(scene, cam);
  
  // Debug rendering issues occasionally
  if (frameCount % 900 === 0) {
    console.log('[ANIMATION] Render stats:', {
      renderer: {
        info: renderer.info,
        fps: Math.round(1/timeDelta)
      },
      timing: {
        current: currentTime.toFixed(3),
        delta: timeDelta.toFixed(4)
      }
    });
  }
  
  // Update stats if available
  if (stats) {
    stats.end();
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
}