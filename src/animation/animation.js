// src/animation/animation.js - Updated to use browser performance timing
import * as THREE from 'three';
import { ANIMATION_STATES, MAX_VELOCITY, MARK_LIFE } from '../config/constants.js';
import { detectIntersections, applyVelocityToMarkers } from '../geometry/intersections.js';
import { getCurrentTime } from '../time/time.js';
import { updateLabelPositions } from '../ui/domLabels.js';
import { detectTriggers, processPendingTriggers, clearExpiredMarkers } from '../triggers/triggers.js';

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
    triggerAudioCallback, 
    syncStateAcrossSystems,
    layerManager
  } = props;
  
  // Skip animation if essential components are missing
  if (!renderer || !scene || !cam) {
    console.error("[ANIMATION] Cannot animate - missing essential components");
    return;
  }
  
  // Debug layer visibility and geometry existence
  if (layerManager && layerManager.layers && layerManager.layers.length > 0) {
    // Only log occasionally to avoid console spam
    if (frameCount % 300 === 0) {
      console.log(`[ANIMATION] Layers status check (${layerManager.layers.length} layers):`);
      layerManager.layers.forEach(layer => {
        const hasGeometry = layer.baseGeo && layer.baseGeo.getAttribute && layer.baseGeo.getAttribute('position');
        const geometryStatus = hasGeometry ? 
          `geometry OK (${layer.baseGeo.getAttribute('position').count} vertices)` : 
          'NO GEOMETRY';
        console.log(`  Layer ${layer.id}: visible=${layer.visible}, group.visible=${layer.group?.visible}, ${geometryStatus}`);
      });
    }
  } else if (frameCount % 300 === 0) {
    console.warn("[ANIMATION] No layers available for rendering");
  }
  
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
  
  // IMPORTANT: Clear expired markers EVERY frame to ensure they fade out properly
  if (scene && typeof clearExpiredMarkers === 'function') {
    clearExpiredMarkers(scene);
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
      const angleInfo = globalState.updateAngle(currentTime * 1000);
      
      // Ensure we log angle updates occasionally
      if (frameCount % 300 === 0) {
        console.log(`[ANIMATION] Global angle update: current=${angleInfo.angle.toFixed(2)}°, previous=${angleInfo.lastAngle.toFixed(2)}°, delta=${(angleInfo.angle - angleInfo.lastAngle).toFixed(2)}°`);
      }
    }
    
    // Process any pending triggers from all layers
    if (triggerAudioCallback) {
      processPendingTriggers(currentTime, triggerAudioCallback, scene);
    }
    
    // Update all visible layers with their respective angles
    if (scene._layerManager && scene._layerManager.layers) {
      // Get the global angle for this frame
      const currentAngle = globalState?.lastAngle || 0;
      const previousAngle = globalState?.previousAngle || 0;
      
      // Log angle tracking occasionally
      if (frameCount % 600 === 0) {
        console.log(`[ANGLE TRACKING] Current=${currentAngle.toFixed(2)}°, Previous=${previousAngle.toFixed(2)}°, Delta=${(currentAngle - previousAngle).toFixed(2)}°`);
      }
      
      // Convert angles from degrees to radians
      const currentAngleRad = (currentAngle * Math.PI) / 180;
      const previousAngleRad = (previousAngle * Math.PI) / 180;
      
      // Process each layer independently for triggering
      scene._layerManager.layers.forEach(layer => {
        if (layer && layer.visible && layer.group && layer.baseGeo) {
          // Process triggers directly for each layer
          if (layer.state.copies > 0 && triggerAudioCallback) {
            // Debug log to verify triggers
            if (frameCount % 300 === 0) {
              console.log(`[TRIGGER DEBUG] Checking triggers for Layer ${layer.id}: using group rotation directly (angle=${layer.group.rotation.z.toFixed(3)}), copies=${layer.state.copies}`);
              
              // Log the actual state of the group's children
              console.log(`[GROUP STRUCTURE] Layer ${layer.id} group children: ${layer.group.children.length} items`);
              if (layer.group.children.length > 0) {
                layer.group.children.forEach((child, idx) => {
                  if (idx < 3) { // Log just a few to avoid spam
                    console.log(`  Child ${idx}: type=${child.type}, rotation=${child.rotation?.z?.toFixed(3) || 'N/A'}`);
                  }
                });
              }
            }
            
            // Initialize lastTrig if needed
            if (!layer.state.lastTrig || !(layer.state.lastTrig instanceof Set)) {
              layer.state.lastTrig = new Set();
            }
            
            // Calculate the actual rotation values to use
            // Use layer-specific rotation tracking if available, otherwise fall back to group rotation
            let prevRot, currRot;
            
            if (layer.currentAngle !== undefined && layer.previousAngle !== undefined) {
              // Use the layer's tracked rotation values
              prevRot = layer.previousAngle;
              currRot = layer.currentAngle;
              
              // Log occasionally for debugging
              if (Math.random() < 0.005) {
                console.log(`[ROTATION] Layer ${layer.id} using tracked angles: current=${currRot.toFixed(3)}, previous=${prevRot.toFixed(3)}, delta=${(currRot-prevRot).toFixed(5)}`);
              }
            } else {
              // Fallback to group rotation with a small delta
              prevRot = layer.group.rotation.z - 0.05; // Small delta for previous frame
              currRot = layer.group.rotation.z;
              
              if (Math.random() < 0.005) {
                console.log(`[ROTATION] Layer ${layer.id} using group rotation: ${currRot.toFixed(3)}`);
              }
            }
            
            // Explicitly detect triggers for this layer with its layerId
            const triggeredPoints = detectTriggers(
              layer.baseGeo, 
              layer.group.rotation.z - 0.05, // Use actual group rotation with small delta for previous frame
              layer.group.rotation.z,       // Use actual current group rotation
              layer.state.copies, 
              layer.group, 
              layer.state.lastTrig, 
              currentTime,
              (note) => {
                // Add layer ID to the note before sending to audio callback
                const layerNote = { ...note, layerId: layer.id };
                console.log(`[TRIGGER] Detected trigger on layer ${layer.id}, freq: ${layerNote.frequency.toFixed(1)}Hz`);
                return triggerAudioCallback(layerNote);
              }
            );
            
            // Log if no triggers were found
            if (frameCount % 300 === 0) {
              console.log(`[TRIGGER CHECK] Layer ${layer.id}: Checked for triggers - vertices in geometry: ${layer.baseGeo?.getAttribute?.('position')?.count || 0}, group rotation: ${layer.group?.rotation.z?.toFixed(3) || 'N/A'}`);
            }
            
            // Update the layer's last triggered points
            if (triggeredPoints && triggeredPoints.size > 0) {
              console.log(`[TRIGGER] Layer ${layer.id} triggered ${triggeredPoints.size} points`);
              layer.state.lastTrig = triggeredPoints;
            }
          }
          
          // Update layer angle
          if (typeof layer.updateAngle === 'function') {
            layer.updateAngle(currentTime);
          }
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
            pan: marker.pan || 0,
            layerId: activeLayer.id // Add layer ID to the note
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
      camera: cam,
      renderer: renderer
    };
    
    // Update all layers via the layer manager
    scene._layerManager.updateLayers(animationParams);
  }
}